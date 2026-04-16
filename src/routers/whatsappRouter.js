const express = require("express");
const router = express.Router();
const axios = require("axios");
const verifyAuth = require("../middlewares/verifyAuth");
const Vendor = require("../models/Vendor");
const Subscription = require("../models/Subscription");
const WhatsAppSession = require("../models/WhatsappSession");
const { createSession } = require("../whatsapp/session");
const { checkWhatsAppSessionsLimit } = require("../middlewares/checkSubscription");
const plans = require("../config/plans");
const log = require("../utils/logger");

router.get("/connect-whatsapp", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  log.info(`Attempting WhatsApp connection for vendor ${vendorId}`);

  try {
    const existingSub = await Subscription.findOne({ vendor: vendorId });
    
    if (!existingSub || !existingSub.plan) {
      return res.redirect("/whatsapp/select-plan");
    }

    const sessionLimit = await checkWhatsAppSessionsLimit(vendorId);
    if (!sessionLimit.allowed) {
      req.flash("error", sessionLimit.reason);
      return res.redirect("/dashboard");
    }

    const existingSession = await WhatsAppSession.findOne({ vendor: vendorId });
    
    if (existingSession?.status === "connected") {
      req.flash("success", "WhatsApp is already connected!");
      return res.redirect("/dashboard");
    }

    if (existingSession?.status === "qr" && existingSession?.qr) {
      return res.render("connect-whatsapp", {
        title: "WhatsApp Connection",
        vendorId,
        status: "qr",
      });
    }

    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorId },
      { status: "initializing", qr: null, lastSeen: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );

    createSession(vendorId).catch(err => {
      log.error(`Background session creation error for ${vendorId}:`, err.message);
    });
    
    return res.render("connect-whatsapp", {
      title: "WhatsApp Connection",
      vendorId,
      status: "initializing",
    });
  } catch (err) {
    log.error(`WhatsApp connection error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to initialize WhatsApp connection. Please try again.");
    return res.redirect("/dashboard");
  }
});

router.get("/select-plan", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  
  try {
    const subscription = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
    
    if (subscription && subscription.status === "active") {
      return res.redirect("/whatsapp/connect-whatsapp");
    }
    
    res.render("./dashboard/select-plan", {
      layout: "layouts/dashboard",
      title: "Select a Plan",
      subscription,
      plans: plans,
    });
  } catch (err) {
    log.error(`Select plan page error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load plan selection");
    return res.redirect("/dashboard");
  }
});

router.get("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  
  try {
    const subscription = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
    const currentPlan = subscription?.plan || "none";
    
    res.render("./dashboard/upgrade-plan", {
      layout: "layouts/dashboard",
      title: "Upgrade Plan",
      subscription,
      currentPlan,
      plans: plans,
    });
  } catch (err) {
    log.error(`Upgrade plan page error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load upgrade page");
    return res.redirect("/dashboard");
  }
});

router.post("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;
  
  try {
    const vendor = await Vendor.findById(vendorId);
    
    if (!vendor) {
      req.flash("error", "Vendor not found");
      return res.redirect("/dashboard");
    }
    
    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      req.flash("error", "Invalid plan selected");
      return res.redirect("/whatsapp/upgrade");
    }
    
    log.info(`Upgrading to: ${plan} for vendor ${vendorId}, amount: ${selectedPlan.price * 100}`);
    
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: vendor.email,
        amount: selectedPlan.price * 100,
        metadata: {
          vendorId: vendor._id.toString(),
          plan: plan,
          source: "whatsapp_upgrade",
        },
        callback_url: `${process.env.BASE_URL}/whatsapp/upgrade-callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    return res.redirect(response.data.data.authorization_url);
  } catch (err) {
    log.error(`Upgrade payment error for ${vendorId}:`, err.response?.data || err.message);
    req.flash("error", "Failed to initialize payment");
    return res.redirect("/whatsapp/upgrade");
  }
});

router.get("/upgrade-callback", verifyAuth.requireAuth, async (req, res) => {
  const reference = req.query.reference;
  const vendorId = req.user.id;
  
  try {
    log.info(`Upgrade callback for vendor ${vendorId}, reference: ${reference}`);
    
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        },
      }
    );
    
    const paymentData = response.data.data;
    
    if (paymentData.status !== "success") {
      req.flash("error", "Payment not successful");
      return res.redirect("/whatsapp/upgrade");
    }
    
    const metadata = paymentData.metadata;
    const plan = metadata?.plan || "starter";
    
    log.info(`Upgrading to: ${plan} for vendor ${vendorId}`);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    await Subscription.findOneAndUpdate(
      { vendor: vendorId },
      {
        plan: plan,
        status: "active",
        startDate: new Date(),
        endDate: endDate,
      },
      { upsert: true }
    );
    
    await Vendor.findByIdAndUpdate(vendorId, {
      "subscription.plan": plan,
      "subscription.status": "active",
      "subscription.startDate": new Date(),
      "subscription.endDate": endDate,
    });
    
    req.flash("success", `Upgraded to ${plan.toUpperCase()} plan successfully!`);
    return res.redirect("/dashboard");
  } catch (err) {
    log.error(`Upgrade callback error for ${vendorId}:`, err.response?.data || err.message);
    req.flash("error", "Payment verification failed");
    return res.redirect("/whatsapp/upgrade");
  }
});

router.post("/select-plan", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;
  
  try {
    const vendor = await Vendor.findById(vendorId);
    
    if (!vendor) {
      req.flash("error", "Vendor not found");
      return res.redirect("/dashboard");
    }

    log.info(`Plan selected: ${plan} for vendor ${vendorId}`);
    log.info(`Vendor email: ${vendor.email}`);
    log.info(`Plan details: ${JSON.stringify(plans[plan])}`);
    
    if (plan === "trial") {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      
      await Subscription.findOneAndUpdate(
        { vendor: vendorId },
        {
          plan: "trial",
          status: "trial",
          startDate: new Date(),
          trialEndDate: trialEndDate,
        },
        { upsert: true }
      );
      
      await Vendor.findByIdAndUpdate(vendorId, {
        "subscription.plan": "trial",
        "subscription.status": "trial",
        "subscription.startDate": new Date(),
        "subscription.endDate": trialEndDate,
      });
      
      req.flash("success", "Trial activated! Now connect WhatsApp.");
      return res.redirect("/whatsapp/connect-whatsapp");
    }
    
    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      req.flash("error", "Invalid plan selected");
      return res.redirect("/whatsapp/select-plan");
    }
    
    log.info(`Initializing Paystack payment for plan: ${plan}, amount: ${selectedPlan.price * 100}`);
    log.info(`Paystack Secret exists: ${!!process.env.PAYSTACK_SECRET}`);
    
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: vendor.email,
        amount: selectedPlan.price * 100,
        metadata: {
          vendorId: vendor._id.toString(),
          plan: plan,
          source: "whatsapp_select_plan",
        },
        callback_url: `${process.env.BASE_URL}/whatsapp/payment-callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );
    
    return res.redirect(response.data.data.authorization_url);
  } catch (err) {
    log.error(`Select plan payment error for ${vendorId}:`, err.response?.data || err.message);
    req.flash("error", "Failed to initialize payment");
    return res.redirect("/whatsapp/select-plan");
  }
});

router.get("/payment-callback", verifyAuth.requireAuth, async (req, res) => {
  const reference = req.query.reference;
  const vendorId = req.user.id;
  
  try {
    log.info(`Payment callback for vendor ${vendorId}, reference: ${reference}`);
    
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        },
      }
    );
    
    const paymentData = response.data.data;
    log.info(`Payment status: ${paymentData.status}`);
    
    if (paymentData.status !== "success") {
      req.flash("error", "Payment not successful");
      return res.redirect("/whatsapp/select-plan");
    }
    
    const metadata = paymentData.metadata;
    const plan = metadata?.plan || "starter";
    
    log.info(`Activating plan: ${plan} for vendor ${vendorId}`);
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);
    
    await Subscription.findOneAndUpdate(
      { vendor: vendorId },
      {
        plan: plan,
        status: "active",
        startDate: new Date(),
        endDate: endDate,
      },
      { upsert: true }
    );
    
    await Vendor.findByIdAndUpdate(vendorId, {
      "subscription.plan": plan,
      "subscription.status": "active",
      "subscription.startDate": new Date(),
      "subscription.endDate": endDate,
    });
    
    req.flash("success", "Payment successful! Now connect WhatsApp.");
    return res.redirect("/whatsapp/connect-whatsapp");
  } catch (err) {
    log.error(`Payment callback error for ${vendorId}:`, err.response?.data || err.message);
    req.flash("error", "Payment verification failed");
    return res.redirect("/whatsapp/select-plan");
  }
});

router.get("/whatsapp-status", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const session = await WhatsAppSession.findOne({ vendor: vendorId });

    if (!session) {
      log.warn(`No WhatsApp session found for vendor ${vendorId}`);
      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status,
      qr: session.qr,
    });
  } catch (err) {
    log.error(`Status fetch error for ${vendorId}:`, err.message);
    return res.json({ status: "error", qr: null });
  }
});

router.post("/disconnect", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const { destroySession } = require("../whatsapp/session");
    await destroySession(vendorId);
    
    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorId },
      { status: "disconnected", lastSeen: new Date() },
    );

    req.flash("success", "WhatsApp disconnected successfully");
    return res.redirect("/dashboard");
  } catch (err) {
    log.error(`WhatsApp disconnect error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to disconnect WhatsApp");
    return res.redirect("/dashboard");
  }
});

module.exports = router;
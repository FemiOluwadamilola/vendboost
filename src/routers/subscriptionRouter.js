const express = require("express");
const router = express.Router();
const axios = require("axios");
const verifyAuth = require("../middlewares/verifyAuth");
const Vendor = require("../models/Vendor");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const plans = require("../config/plans");
const log = require("../utils/logger");
const { getTrialStatus, convertTrialToFree } = require("../utils/upgradeTrigger");

router.get("/subscriptions", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const fromWhatsApp = req.query.from === 'whatsapp';
  
  try {
    const subscription = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
    const trialStatus = await getTrialStatus(vendorId);
    
    // Get current plan details
    const currentPlan = subscription ? plans[subscription.plan] : plans.starter;
    
    res.render("./dashboard/subscriptions", {
      layout: "layouts/dashboard",
      title: "Subscription Plans",
      subscription,
      trialStatus,
      currentPlan,
      plans: plans,
      fromWhatsApp,
    });
  } catch (err) {
    log.error(`Subscription page error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load subscription page");
    return res.redirect("/dashboard");
  }
});

router.post("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;

  try {
    // Validate plan
    if (!plans[plan] || plan === "trial") {
      req.flash("error", "Invalid subscription plan selected");
      return res.redirect("/dashboard/subscriptions");
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      log.error(`Vendor not found for ID: ${vendorId}`);
      req.flash("error", "Something went wrong, please try again");
      return res.redirect("/dashboard");
    }

    // If user has trial, convert it first
    const trialStatus = await getTrialStatus(vendorId);
    if (trialStatus && trialStatus.isActive) {
      await convertTrialToFree(vendorId);
    }

    const selectedPlan = plans[plan];
    const paymentLink = await createPaymentLink(vendor, selectedPlan, plan);
    return res.redirect(paymentLink);
  } catch (err) {
    log.error(`Upgrade error for ${vendorId}:`, err.response?.data || err.message);
    req.flash("error", "Failed to initialize payment");
    return res.redirect("/dashboard/subscriptions");
  }
});

router.get("/signup-payment", async (req, res) => {
  try {
    const vendorId = req.session.paymentVendorId;
    const plan = req.session.pendingPlan;

    if (!vendorId) {
      req.flash("error", "Session expired. Please sign up again.");
      return res.redirect("/signup");
    }

    const validPlans = ["starter", "pro"];
    if (!plan || !validPlans.includes(plan)) {
      req.flash("error", "Invalid plan selected.");
      return res.redirect("/signup");
    }

    const selectedPlan = plans[plan];
    if (!selectedPlan) {
      req.flash("error", "Invalid plan selected.");
      return res.redirect("/signup");
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      req.flash("error", "Vendor not found. Please sign up again.");
      return res.redirect("/signup");
    }

    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: vendor.email,
        amount: selectedPlan.price * 100,
        metadata: {
          vendorId: vendor._id.toString(),
          plan: plan,
        },
        callback_url: `${process.env.BASE_URL}/subscription/payment-callback`,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
      }
    );

    await Payment.create({
      vendor: vendorId,
      reference: response.data.data.reference,
      plan: plan,
      amount: selectedPlan.price,
      status: "pending",
    });

    return res.redirect(response.data.data.authorization_url);
  } catch (err) {
    log.error("Signup payment error:", err.response?.data || err.message);
    req.flash("error", "Failed to initialize payment");
    return res.redirect("/signup");
  }
});

router.get("/payment-callback", async (req, res) => {
  const { reference } = req.query;

  try {
    if (!reference) {
      req.flash("error", "Invalid payment reference");
      return res.redirect("/signup");
    }

    const payment = await Payment.findOne({ reference });
    if (!payment) {
      req.flash("error", "Payment not found");
      return res.redirect("/signup");
    }

    if (payment.status === "success") {
      req.flash("success", "Payment successful! Please sign in.");
      return res.redirect("/signin");
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        },
      }
    );

    if (response.data.data.status === "success") {
      payment.status = "success";
      await payment.save();

      const vendorId = payment.vendor;
      const plan = payment.plan;
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Update both Vendor and Subscription collections
      await Vendor.findByIdAndUpdate(vendorId, {
        subscription: {
          plan,
          status: "active",
          startDate: new Date(),
          endDate,
        },
      });

      // Update or create subscription record
      await Subscription.findOneAndUpdate(
        { vendor: vendorId },
        {
          plan,
          status: "active",
          startDate: new Date(),
          endDate,
        },
        { upsert: true }
      );

      // Clear any trial info
      delete req.session.trialInfo;

      req.flash("success", "Payment successful! Welcome to " + plans[plan]?.name + "!");
      return res.redirect("/dashboard");
    }

    req.flash("error", "Payment failed. Please try again.");
    return res.redirect("/signup");
  } catch (err) {
    log.error("Payment callback error:", err.message);
    req.flash("error", "An error occurred during payment verification");
    return res.redirect("/signup");
  }
});

async function getSelectedPlan(plan, vendorId) {
  if (!plans[plan]) {
    log.error(`Invalid plan selected for vendor ${vendorId}`);
    return null;
  }
  return plans[plan];
}

async function createPaymentLink(vendor, selectedPlan, plan) {
  const response = await axios.post(
    "https://api.paystack.co/transaction/initialize",
    {
      email: vendor.email,
      amount: selectedPlan.price * 100,
      metadata: {
        vendorId: vendor._id.toString(),
        plan: plan,
      },
      callback_url: `${process.env.BASE_URL}/dashboard`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.data.authorization_url;
}

module.exports = router;

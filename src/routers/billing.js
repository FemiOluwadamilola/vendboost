const express = require("express");
const router = express.Router();
const axios = require("axios");
const verifyAuth = require("../middlewares/verifyAuth");
const Subscription = require("../models/Subscription");
const Payment = require("../models/Payment");
const Vendor = require("../models/Vendor");
const plans = require("../config/plans");
const log = require("../utils/logger");

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PLANS = {
  starter: { price: 5000, name: "Starter", duration: 30 },
  pro: { price: 15000, name: "Pro", duration: 30 },
};

const initializePayment = async (vendor, plan) => {
  const selectedPlan = PLANS[plan];
  if (!selectedPlan) {
    throw new Error("Invalid plan selected");
  }

  const response = await axios.post(
    `${PAYSTACK_BASE_URL}/transaction/initialize`,
    {
      email: vendor.email,
      amount: selectedPlan.price * 100,
      metadata: {
        vendorId: vendor._id.toString(),
        plan: plan,
      },
      callback_url: `${process.env.BASE_URL}/billing/verify`,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.data;
};

const verifyPayment = async (reference) => {
  const response = await axios.get(
    `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`,
      },
    }
  );

  return response.data.data;
};

const createOrUpdateSubscription = async (vendorId, plan) => {
  const selectedPlan = PLANS[plan];
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + selectedPlan.duration);

  const existingSub = await Subscription.findOne({ vendor: vendorId });

  if (existingSub) {
    existingSub.plan = plan;
    existingSub.status = "active";
    existingSub.startDate = startDate;
    existingSub.endDate = endDate;
    await existingSub.save();
  } else {
    await Subscription.create({
      vendor: vendorId,
      plan: plan,
      status: "active",
      startDate: startDate,
      endDate: endDate,
    });
  }

  await Vendor.findByIdAndUpdate(vendorId, {
    subscription: {
      plan,
      status: "active",
      startDate,
      endDate,
    },
  });
};

router.post("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;

  try {
    if (!PLANS[plan]) {
      req.flash("error", "Invalid subscription plan selected");
      return res.redirect("/dashboard");
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      req.flash("error", "Vendor not found");
      return res.redirect("/dashboard");
    }

    const paymentData = await initializePayment(vendor, plan);

    await Payment.create({
      vendor: vendorId,
      reference: paymentData.reference,
      plan: plan,
      amount: PLANS[plan].price,
      status: "pending",
    });

    log.info(`Payment initialized for vendor ${vendorId}, plan: ${plan}`);
    return res.redirect(paymentData.authorization_url);
  } catch (err) {
    log.error(`Payment initialization error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to initialize payment. Please try again.");
    return res.redirect("/dashboard");
  }
});

router.get("/verify", async (req, res) => {
  const { reference } = req.query;

  if (!reference) {
    req.flash("error", "Invalid payment reference");
    return res.redirect("/dashboard?payment=error");
  }

  try {
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      log.warn(`Payment not found for reference: ${reference}`);
      req.flash("error", "Payment not found");
      return res.redirect("/dashboard?payment=error");
    }

    if (payment.status === "success") {
      log.info(`Payment already verified for reference: ${reference}`);
      return res.redirect("/dashboard?payment=success");
    }

    const paymentData = await verifyPayment(reference);

    if (paymentData.status === "success") {
      payment.status = "success";
      await payment.save();

      const { plan } = payment;
      await createOrUpdateSubscription(payment.vendor, plan);

      log.info(`Payment verified for vendor ${payment.vendor}, plan: ${plan}`);
      req.flash("success", `Successfully subscribed to ${PLANS[plan].name} plan!`);
      return res.redirect("/dashboard?payment=success");
    }

    payment.status = "failed";
    await payment.save();
    req.flash("error", "Payment verification failed");
    return res.redirect("/dashboard?payment=failed");
  } catch (err) {
    log.error(`Payment verification error for ${reference}:`, err.message);
    req.flash("error", "An error occurred during payment verification");
    return res.redirect("/dashboard?payment=error");
  }
});

router.get("/plans", (req, res) => {
  res.json({
    plans: Object.entries(PLANS).map(([key, value]) => ({
      id: key,
      ...value,
      limits: plans[key]?.limits,
    })),
  });
});

module.exports = router;
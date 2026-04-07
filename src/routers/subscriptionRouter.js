const express = require("express");
const router = express.Router();
const axios = require("axios");
// const Subscription = require('../models/Subscription');
const verifyAuth = require("../middlewares/verifyAuth");
const Vendor = require("../models/Vendor");
const plans = require("../config/plans");
const log = require("../utils/logger");

// router.post("/", () => {

// })

router.post("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;

  try {
    // 🔥 Validate plan
    if (!plans[plan]) {
      log.error(`Invalid plan selected for vendor ${vendorId}`);
      req.flash("error", "Invalid subscription plan selected");
      return res.redirect("/dashboard");
    }

    const selectedPlan = plans[plan];

    // 🔥 Get vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      log.error(`Vendor not found for ID: ${vendorId}`);
      req.flash("error", "Something went wrong, please try again");
      return res.redirect("/dashboard");
    }

    // 🔥 Create Paystack transaction
    const response = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email: vendor.email,
        amount: selectedPlan.price * 100, // kobo

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
      },
    );

    const paymentLink = response.data.data.authorization_url;
    req.flash("success", "Payment link generated");
    return res.redirect(paymentLink);
  } catch (err) {
    log.error(
      `Upgrade error for ${vendorId}:`,
      err.response?.data || err.message,
    );
    req.flash("error", "Failed to initialize payment");
    return res.redirect("/dashboard");
  }
});

module.exports = router;

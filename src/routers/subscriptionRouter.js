const express = require("express");
const router = express.Router();
const axios = require("axios");
// const Subscription = require('../models/Subscription');
const verifyAuth = require("../middlewares/verifyAuth");
const Vendor = require("../models/Vendor");
const plans = require("../config/plans");

// router.post("/", () => {

// })

router.post("/upgrade", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { plan } = req.body;

  try {
    // 🔥 Validate plan
    if (!plans[plan]) {
      return res.status(400).json({
        message: "Invalid plan selected",
      });
    }

    const selectedPlan = plans[plan];

    // 🔥 Get vendor
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({
        message: "Vendor not found",
      });
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

    return res.json({
      message: "Payment link generated",
      url: paymentLink,
    });
  } catch (err) {
    console.error("Upgrade error:", err.response?.data || err.message);

    return res.status(500).json({
      message: "Failed to initialize payment",
    });
  }
});

module.exports = router;

// routes/webhook.js
const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const Payment = require("../models/Payment");
const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const log = require("../utils/logger");

router.post("/paystack", async (req, res) => {
  try {
    const secret = process.env.PAYSTACK_SECRET;

    const hash = crypto
      .createHmac("sha512", secret)
      .update(req.body)
      .digest("hex");

    if (hash !== req.headers["x-paystack-signature"]) {
      return res.sendStatus(401);
    }

    const event = JSON.parse(req.body.toString());

    if (event.event === "charge.success") {
      const data = event.data;

      const reference = data.reference;
      const metadata = data.metadata;

      const payment = await Payment.findOne({ reference });
      if (!payment || payment.status === "success") {
        return res.sendStatus(200);
      }

      payment.status = "success";
      await payment.save();

      const vendorId = metadata.vendorId;
      const plan = metadata.plan;

      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await Subscription.findOneAndUpdate(
        { vendor: vendorId },
        {
          plan,
          status: "active",
          startDate: new Date(),
          endDate: endDate,
        },
        { upsert: true },
      );

      await Vendor.findByIdAndUpdate(vendorId, {
        subscription: {
          plan,
          status: "active",
          startDate: new Date(),
          endDate: endDate,
        },
      });

      log.info(`Subscription activated: vendorId=${vendorId}, plan=${plan}`);
    }

    res.sendStatus(200);
  } catch (err) {
    log.error("Webhook error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;

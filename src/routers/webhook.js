const express = require("express");
const router = express.Router();
const crypto = require("crypto");
// const Vendor = require("../models/Vendor");
const Subscription = require("../models/Subscription");

router.post("/paystack", async (req, res) => {
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

    const vendorId = data.metadata.vendorId;
    const plan = data.metadata.plan;

    await Subscription.findOneAndUpdate(
      { vendor: vendorId },
      {
        plan,
        status: "active",
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      { upsert: true },
    );
  }

  res.sendStatus(200);
});

module.exports = router;

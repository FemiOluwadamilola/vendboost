// middleware/checkSubscription.js
const Subscription = require("../models/Subscription");
const plans = require("../config/plans");

exports.checkSubscription = async (req, res, next) => {
  const vendorId = req.user.id;

  const sub = await Subscription.findOne({ vendor: vendorId });

  if (!sub || sub.status !== "active") {
    return res.status(403).json({
      message: "Subscription inactive. Please upgrade.",
    });
  }

  // 🔥 Check expiry
  if (sub.endDate && sub.endDate < new Date()) {
    sub.status = "expired";
    await sub.save();

    return res.status(403).json({
      message: "Subscription expired",
    });
  }

  // 🔥 Attach plan limits
  req.plan = plans[sub.plan];

  next();
};

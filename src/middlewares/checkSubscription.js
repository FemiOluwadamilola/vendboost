// middleware/checkSubscription.js
const Subscription = require("../models/Subscription");
const plans = require("../config/plans");
const log = require("../utils/logger");

exports.checkSubscription = async (req, res, next) => {
  const vendorId = req.user.id;

  const sub = await Subscription.findOne({ vendor: vendorId });

  if (!sub || sub.status !== "active") {
    log.warn(`Subscription inactive for vendor ${vendorId}`);
    req.flash(
      "error",
      "No active subscription found. Please subscribe to access this feature.",
    );
    return res.redirect("/dashboard/subscriptions");
  }

  // 🔥 Check expiry
  if (sub.endDate && sub.endDate < new Date()) {
    sub.status = "expired";
    await sub.save();
    log.warn(`Subscription expired for vendor ${vendorId}`);
    req.flash(
      "error",
      "Your subscription has expired. Please renew to access this feature.",
    );
    return res.redirect("/dashboard/subscriptions");
  }

  // 🔥 Attach plan limits
  req.plan = plans[sub.plan];

  next();
};

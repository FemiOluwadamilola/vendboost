// middleware/checkSubscription.js
const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const Usage = require("../models/Usage");
const plans = require("../config/plans");
const log = require("../utils/logger");

const getVendorSubscription = async (vendorId) => {
  const vendor = await Vendor.findById(vendorId);
  if (vendor?.subscription?.plan && vendor.subscription.status === "active") {
    return {
      plan: vendor.subscription.plan,
      status: vendor.subscription.status,
      startDate: vendor.subscription.startDate,
      endDate: vendor.subscription.endDate,
    };
  }
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
  return sub;
};

const checkSubscription = async (req, res, next) => {
  const vendorId = req.user.id;

  if (!vendorId) {
    return res.redirect("/auth/signin");
  }

  const sub = await getVendorSubscription(vendorId);

  if (!sub || sub.status !== "active") {
    log.warn(`Subscription inactive for vendor ${vendorId}`);
    req.flash(
      "error",
      "No active subscription found. Please subscribe to access this feature."
    );
    return res.redirect("/dashboard/subscriptions");
  }

  if (sub.endDate && sub.endDate < new Date()) {
    await Vendor.findByIdAndUpdate(vendorId, { "subscription.status": "expired" });
    log.warn(`Subscription expired for vendor ${vendorId}`);
    req.flash(
      "error",
      "Your subscription has expired. Please renew to access this feature."
    );
    return res.redirect("/dashboard/subscriptions");
  }

  const planLimits = plans[sub.plan];
  const usage = await Usage.findOne({ vendor: vendorId });

  req.subscription = {
    plan: sub.plan,
    status: sub.status,
    startDate: sub.startDate,
    endDate: sub.endDate,
    limits: planLimits,
    usage: usage || { broadcastsSent: 0, messagesSent: 0 },
  };

  next();
};

const checkPlanLimit = (limitType) => {
  return async (req, res, next) => {
    const vendorId = req.user?.id;
    if (!vendorId) return next();

    const sub = await getVendorSubscription(vendorId);

    if (!sub || sub.status !== "active") {
      return next();
    }

    const limits = plans[sub.plan]?.limits;
    if (!limits) return next();

    const limit = limits[limitType];
    if (limit === 0) {
      req.flash(
        "error",
        `Your ${sub.plan} plan does not include ${limitType}. Please upgrade to access this feature.`
      );
      return res.redirect("/dashboard/subscriptions");
    }

    const usage = await Usage.findOne({ vendor: vendorId });
    const currentUsage = usage?.broadcastsSent || 0;

    if (currentUsage >= limit) {
      req.flash(
        "error",
        `You have reached your ${limitType} limit (${limit}). Please upgrade your plan to continue.`
      );
      return res.redirect("/dashboard/subscriptions");
    }

    next();
  };
};

const checkWhatsAppSessionsLimit = async (vendorId) => {
  const sub = await getVendorSubscription(vendorId);

  const WhatsAppSession = require("../models/WhatsappSession");
  const activeSessions = await WhatsAppSession.countDocuments({
    vendor: vendorId,
    status: "connected",
  });

  if (sub && sub.status === "active") {
    const limits = plans[sub.plan]?.limits;
    const maxSessions = limits?.whatsappSessions || 1;

    if (activeSessions >= maxSessions) {
      return {
        allowed: false,
        reason: `Maximum ${maxSessions} WhatsApp session(s) allowed on ${sub.plan} plan`,
      };
    }
    return { allowed: true };
  }

  if (activeSessions >= 1) {
    return {
      allowed: false,
      reason: "Maximum 1 WhatsApp session allowed. Please upgrade to add more.",
    };
  }

  return { allowed: true };
};

module.exports = { checkSubscription, checkPlanLimit, checkWhatsAppSessionsLimit, getVendorSubscription };

// middleware/checkSubscription.js
const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const Usage = require("../models/Usage");
const plans = require("../config/plans");
const log = require("../utils/logger");

const getVendorSubscription = async (vendorId) => {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
  
  if (!sub) return null;
  
  // Check if trial has expired
  if (sub.plan === "trial" && sub.status === "trial" && sub.trialEndDate) {
    if (new Date() > new Date(sub.trialEndDate)) {
      // Trial expired - convert to free or pending upgrade
      await Subscription.findByIdAndUpdate(sub._id, { status: "expired" });
      return { ...sub.toObject(), status: "expired" };
    }
  }
  
  // Check regular subscription expiry
  if (sub.endDate && new Date(sub.endDate) < new Date() && sub.status === "active") {
    await Subscription.findByIdAndUpdate(sub._id, { status: "expired" });
    return { ...sub.toObject(), status: "expired" };
  }
  
  return sub;
};

const checkSubscription = async (req, res, next) => {
  const vendorId = req.user.id;

  if (!vendorId) {
    return res.redirect("/auth/signin");
  }

  const sub = await getVendorSubscription(vendorId);

  if (!sub) {
    log.warn(`No subscription found for vendor ${vendorId}`);
    req.flash(
      "error",
      "No subscription found. Please subscribe to access this feature."
    );
    return res.redirect("/dashboard/subscriptions");
  }

  // Handle trial status
  const isTrial = sub.plan === "trial" && sub.status === "trial";
  const isTrialExpired = isTrial && sub.trialEndDate && new Date() > new Date(sub.trialEndDate);

  if (isTrialExpired) {
    // Trial expired - convert to free or prompt upgrade
    await Subscription.findByIdAndUpdate(sub._id, { 
      plan: "free", 
      status: "active",
      trialEndDate: null
    });
    
    // Update vendor subscription as well
    await Vendor.findByIdAndUpdate(vendorId, {
      "subscription.plan": "free",
      "subscription.status": "active"
    });
    
    req.flash(
      "info",
      "Your 14-day trial has ended. You've been moved to the Free plan. Upgrade to continue using all features!"
    );
  }

  // Allow access for trial (active), active, and free plans
  const allowedStatuses = ["active", "trial"];
  const isActive = sub.status === "active" || (sub.plan === "trial" && sub.status === "trial");
  
  if (!isActive && sub.plan !== "free") {
    log.warn(`Subscription inactive for vendor ${vendorId}`);
    req.flash(
      "error",
      "No active subscription found. Please subscribe to access this feature."
    );
    return res.redirect("/dashboard/subscriptions");
  }

  const planLimits = plans[sub.plan] || plans.free;
  const usage = await Usage.findOne({ vendor: vendorId, date: new Date().toISOString().split("T")[0] });

  // Calculate trial days remaining
  let trialDaysRemaining = 0;
  if (isTrial && sub.trialEndDate) {
    const now = new Date();
    const end = new Date(sub.trialEndDate);
    trialDaysRemaining = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  }

  // Check if approaching trial end (last 3 days) - upgrade trigger
  if (isTrial && trialDaysRemaining > 0 && trialDaysRemaining <= 3) {
    req.session.trialEndingSoon = true;
    req.session.trialDaysRemaining = trialDaysRemaining;
  }

  // Store upgrade trigger info in session for views to use
  if (isTrial) {
    req.session.isTrial = true;
    req.session.trialDaysRemaining = trialDaysRemaining;
    req.session.trialEndDate = sub.trialEndDate;
  }

  req.subscription = {
    plan: sub.plan,
    status: sub.status,
    startDate: sub.startDate,
    endDate: sub.endDate,
    isTrial: isTrial,
    trialDaysRemaining: trialDaysRemaining,
    limits: planLimits.limits,
    features: {
      automatedReplies: planLimits.limits.automatedReplies,
      statusPosting: planLimits.limits.statusPosting,
      followUpAutomation: planLimits.limits.followUpAutomation,
    },
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

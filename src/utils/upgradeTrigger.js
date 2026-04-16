const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const Lead = require("../models/Lead");
const Usage = require("../models/Usage");
const plans = require("../config/plans");

const getDaysRemaining = (endDate) => {
  if (!endDate) return 0;
  const now = new Date();
  const end = new Date(endDate);
  return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
};

const checkUpgradeTriggers = async (vendorId) => {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
  if (!sub) return { shouldShowUpgrade: false };

  const triggers = {
    shouldShowUpgrade: false,
    reasons: [],
    urgency: "low",
  };

  // Trial-specific triggers
  if (sub.plan === "trial" && sub.status === "trial") {
    const daysRemaining = getDaysRemaining(sub.trialEndDate);
    
    if (daysRemaining <= 0) {
      triggers.shouldShowUpgrade = true;
      triggers.reasons.push("Your trial has expired");
      triggers.urgency = "critical";
    } else if (daysRemaining <= 3) {
      triggers.shouldShowUpgrade = true;
      triggers.reasons.push(`Only ${daysRemaining} day(s) left in your trial`);
      triggers.urgency = "high";
    } else if (daysRemaining <= 7) {
      triggers.reasons.push(`${daysRemaining} days left in your trial`);
      triggers.urgency = "medium";
    }
  }

  // Check lead limit usage (80% threshold)
  const leadCount = await Lead.countDocuments({ vendor: vendorId });
  const leadLimit = plans[sub.plan]?.limits?.leads || 20;
  const leadUsagePercent = (leadCount / leadLimit) * 100;

  if (leadUsagePercent >= 80 && leadUsagePercent < 100) {
    triggers.shouldShowUpgrade = true;
    triggers.reasons.push(`You've used ${Math.round(leadUsagePercent)}% of your ${leadLimit} leads limit`);
    triggers.urgency = triggers.urgency === "critical" ? "critical" : "medium";
  } else if (leadUsagePercent >= 100) {
    triggers.shouldShowUpgrade = true;
    triggers.reasons.push("You've reached your leads limit");
    triggers.urgency = "critical";
  }

  // Check broadcast limit usage (for non-free plans)
  const broadcastLimit = plans[sub.plan]?.limits?.broadcastsPerDay || 0;
  if (broadcastLimit > 0) {
    const today = new Date().toISOString().split("T")[0];
    const usage = await Usage.findOne({ vendor: vendorId, date: today });
    const broadcastsUsed = usage?.broadcastsSent || 0;
    const broadcastUsagePercent = (broadcastsUsed / broadcastLimit) * 100;

    if (broadcastUsagePercent >= 80 && broadcastUsagePercent < 100) {
      triggers.shouldShowUpgrade = true;
      triggers.reasons.push(`You've used ${Math.round(broadcastUsagePercent)}% of your daily ${broadcastLimit} broadcasts`);
      triggers.urgency = triggers.urgency === "critical" ? "critical" : "medium";
    } else if (broadcastUsagePercent >= 100) {
      triggers.shouldShowUpgrade = true;
      triggers.reasons.push("You've reached your daily broadcast limit");
      triggers.urgency = "high";
    }
  }

  // Check WhatsApp sessions limit
  const WhatsAppSession = require("../models/WhatsappSession");
  const activeSessions = await WhatsAppSession.countDocuments({
    vendor: vendorId,
    status: "connected",
  });
  const sessionLimit = plans[sub.plan]?.limits?.whatsappSessions || 1;

  if (activeSessions >= sessionLimit && sessionLimit < 3) {
    triggers.shouldShowUpgrade = true;
    triggers.reasons.push("You've reached your WhatsApp sessions limit. Upgrade to add more.");
    triggers.urgency = triggers.urgency === "critical" ? "critical" : "medium";
  }

  return triggers;
};

const convertTrialToFree = async (vendorId) => {
  const sub = await Subscription.findOne({ vendor: vendorId, plan: "trial" });
  if (sub) {
    await Subscription.findByIdAndUpdate(sub._id, {
      plan: null,
      status: "pending",
      trialEndDate: null,
      isTrialUsed: true,
    });
    await Vendor.findByIdAndUpdate(vendorId, {
      "subscription.plan": null,
      "subscription.status": "pending",
    });
  }
};

const getTrialStatus = async (vendorId) => {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
  if (!sub || sub.plan !== "trial") return null;

  const daysRemaining = getDaysRemaining(sub.trialEndDate);
  return {
    isActive: sub.status === "trial" && daysRemaining > 0,
    daysRemaining,
    endDate: sub.trialEndDate,
    isExpired: daysRemaining <= 0,
    isExpiringSoon: daysRemaining > 0 && daysRemaining <= 7,
  };
};

module.exports = {
  checkUpgradeTriggers,
  convertTrialToFree,
  getTrialStatus,
  getDaysRemaining,
};
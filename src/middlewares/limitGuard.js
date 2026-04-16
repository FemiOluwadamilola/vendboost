const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const Usage = require("../models/Usage");
const plans = require("../config/plans");
const { getTrialStatus } = require("../utils/upgradeTrigger");

function getToday() {
  return new Date().toISOString().split("T")[0];
}

async function getVendorSubscription(vendorId) {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
  
  // Handle trial status
  if (sub && sub.plan === "trial" && sub.status === "trial") {
    const trialStatus = await getTrialStatus(vendorId);
    if (trialStatus && trialStatus.isExpired) {
      return { plan: null, status: "pending" };
    }
    return { plan: "trial", status: "trial", trialEndDate: sub.trialEndDate };
  }
  
  if (!sub) {
    const vendor = await Vendor.findById(vendorId);
    if (vendor?.subscription?.plan) {
      return {
        plan: vendor.subscription.plan,
        status: vendor.subscription.status,
      };
    }
    return { plan: null, status: "pending" };
  }
  
  return { plan: sub.plan, status: sub.status };
}

module.exports = (feature) => {
  return async (req, res, next) => {
    const vendorId = req.user.id;

    const sub = await getVendorSubscription(vendorId);

    // Allow both active and trial statuses
    const isActive = sub.status === "active" || sub.status === "trial";
    
    if (!sub || !isActive) {
      req.flash("error", "No active subscription. Please subscribe to continue.");
      return res.redirect("/dashboard");
    }

    const limits = plans[sub.plan]?.limits || {};

    if (feature === "broadcast") {
      const maxBroadcasts = limits.broadcastsPerDay || 0;

      if (maxBroadcasts === 0) {
        if (sub.plan === "trial") {
          // Allow trial users some broadcasts but show upgrade message
          req.session.showTrialUpgrade = true;
          req.session.upgradeReason = "Broadcasts not included in trial. Upgrade to unlock!";
        }
        req.flash("error", "Broadcast not included in your plan. Please upgrade.");
        return res.redirect("/dashboard");
      }

      const today = getToday();
      const usage = await Usage.findOne({ vendor: vendorId, date: today });

      if (usage && usage.broadcastsSent >= maxBroadcasts) {
        if (sub.plan === "trial") {
          req.session.showTrialUpgrade = true;
          req.session.upgradeReason = `Daily broadcast limit (${maxBroadcasts}) reached. Upgrade to continue!`;
        }
        req.flash("error", `Daily broadcast limit (${maxBroadcasts}) reached. Upgrade to continue.`);
        return res.redirect("/dashboard");
      }

      await Usage.findOneAndUpdate(
        { vendor: vendorId, date: today },
        { $inc: { broadcastsSent: 1 } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    if (feature === "followUp") {
      if (!limits.followUpAutomation) {
        req.flash("error", "Automated follow-ups are not included in your plan. Upgrade to Starter or Pro to unlock!");
        return res.redirect("/dashboard");
      }
    }

    if (feature === "leads") {
      const maxLeads = limits.leads || 20;
      const Lead = require("../models/Lead");
      const leadCount = await Lead.countDocuments({ vendor: vendorId });

      if (leadCount >= maxLeads) {
        if (sub.plan === "trial" && leadCount >= 20) {
          req.session.showTrialUpgrade = true;
          req.session.upgradeReason = "Lead limit reached on trial. Upgrade to get unlimited leads!";
        }
        req.flash("error", `Lead limit (${maxLeads}) reached. Upgrade to continue.`);
        return res.redirect("/dashboard");
      }
      
      // Show warning when approaching 80% of lead limit
      if (leadCount >= maxLeads * 0.8 && sub.plan === "trial") {
        req.session.trialLeadWarning = `You've used ${leadCount} of ${maxLeads} leads. Upgrade to get more!`;
      }
    }

    if (feature === "whatsappSessions") {
      const maxSessions = limits.whatsappSessions || 1;
      const WhatsAppSession = require("../models/WhatsappSession");
      const activeSessions = await WhatsAppSession.countDocuments({
        vendor: vendorId,
        status: "connected",
      });

      if (activeSessions >= maxSessions) {
        if (sub.plan === "trial" && maxSessions < 3) {
          req.session.showTrialUpgrade = true;
          req.session.upgradeReason = "WhatsApp session limit reached. Upgrade to add more!";
        }
        req.flash("error", `WhatsApp session limit (${maxSessions}) reached.`);
        return res.redirect("/dashboard");
      }
    }

    req.subscription = sub;
    next();
  };
};
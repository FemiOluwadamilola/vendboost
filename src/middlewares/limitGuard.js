const Subscription = require("../models/Subscription");
const Vendor = require("../models/Vendor");
const Usage = require("../models/Usage");
const plans = require("../config/plans");

function getToday() {
  return new Date().toISOString().split("T")[0];
}

async function getVendorSubscription(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (vendor?.subscription?.plan && vendor.subscription.status === "active") {
    return {
      plan: vendor.subscription.plan,
      status: vendor.subscription.status,
    };
  }
  return await Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 });
}

module.exports = (feature) => {
  return async (req, res, next) => {
    const vendorId = req.user.id;

    const sub = await getVendorSubscription(vendorId);

    if (!sub || sub.status !== "active") {
      req.flash("error", "No active subscription. Please subscribe to continue.");
      return res.redirect("/dashboard");
    }

    const limits = plans[sub.plan]?.limits || {};

    if (feature === "broadcast") {
      const maxBroadcasts = limits.broadcastsPerDay || 0;

      if (maxBroadcasts === 0) {
        req.flash("error", "Broadcast not included in your plan. Please upgrade.");
        return res.redirect("/dashboard");
      }

      const today = getToday();
      const usage = await Usage.findOne({ vendor: vendorId, date: today });

      if (usage && usage.broadcastsSent >= maxBroadcasts) {
        req.flash("error", `Daily broadcast limit (${maxBroadcasts}) reached. Upgrade to continue.`);
        return res.redirect("/dashboard");
      }

      await Usage.findOneAndUpdate(
        { vendor: vendorId, date: today },
        { $inc: { broadcastsSent: 1 } },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }

    if (feature === "leads") {
      const maxLeads = limits.leads || 20;
      const Lead = require("../models/Lead");
      const leadCount = await Lead.countDocuments({ vendor: vendorId });

      if (leadCount >= maxLeads) {
        req.flash("error", `Lead limit (${maxLeads}) reached. Upgrade to continue.`);
        return res.redirect("/dashboard");
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
        req.flash("error", `WhatsApp session limit (${maxSessions}) reached.`);
        return res.redirect("/dashboard");
      }
    }

    req.subscription = sub;
    next();
  };
};
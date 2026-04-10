const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const Subscription = require("../models/Subscription");
const Usage = require("../models/Usage");
const { getClient } = require("../whatsapp/session");
const plans = require("../config/plans");
const log = require("../utils/logger");

const FOLLOW_UP_MESSAGES = {
  price: (name) =>
    `Hi ${name} 😊 just checking if you're still interested. We can arrange delivery today!`,
  availability: (name) =>
    `Hi ${name} 👋 your item is still available. Let me know if you'd like it reserved ❤️`,
  "ready-to-pay": (name) =>
    `Hi ${name} 💰 just checking if you've completed payment so we can process immediately.`,
  default: (name) =>
    `Hi ${name} 👋 are you still interested? We can reserve it for you.`,
};

const processFollowUp = async (lead, vendor, client) => {
  const { followUpTimes = [6, 24, 72] } = vendor;
  const nextFollowUpIndex = lead.followUpsSent;

  if (nextFollowUpIndex >= followUpTimes.length) {
    log.info(`Lead ${lead._id} has exhausted all follow-ups`);
    return false;
  }

  const hoursSinceCreation =
    (new Date() - lead.createdAt) / 36e5;
  const expectedHours = followUpTimes[nextFollowUpIndex];

  if (hoursSinceCreation < expectedHours) {
    return false;
  }

  const messageFn =
    FOLLOW_UP_MESSAGES[lead.intentType] || FOLLOW_UP_MESSAGES.default;
  const message = messageFn(lead.customerName || "Customer");

  await client.sendMessage(`${lead.customerNumber}@c.us`, message);

  lead.followUpsSent += 1;
  lead.lastFollowUpAt = new Date();
  await lead.save();

  log.info(
    `Sent follow-up #${lead.followUpsSent} to ${lead.customerNumber} (lead: ${lead._id})`
  );
  return true;
};

const checkBroadcastLimit = async (vendorId) => {
  const sub = await Subscription.findOne({ vendor: vendorId }).sort({
    createdAt: -1,
  });

  // Allow trial and active subscriptions
  if (!sub || (sub.status !== "active" && sub.status !== "trial")) {
    return { allowed: false, reason: "No active subscription" };
  }

  // Check if follow-up automation is enabled for this plan
  const planKey = sub.plan === "trial" ? "trial" : sub.plan;
  const limits = plans[planKey]?.limits || plans.free.limits;
  
  if (!limits.followUpAutomation) {
    return { allowed: false, reason: "Automated follow-ups not included in your plan" };
  }

  const maxBroadcasts = limits?.broadcastsPerDay || 0;

  if (maxBroadcasts === 0) {
    return {
      allowed: false,
      reason: "Broadcast not included in your plan",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const usage = await Usage.findOne({ vendor: vendorId, date: today });

  if (usage && usage.broadcastsSent >= maxBroadcasts) {
    return {
      allowed: false,
      reason: `Daily broadcast limit (${maxBroadcasts}) reached`,
    };
  }

  return { allowed: true };
};

const incrementBroadcastUsage = async (vendorId) => {
  const today = new Date().toISOString().split("T")[0];
  await Usage.findOneAndUpdate(
    { vendor: vendorId, date: today },
    { $inc: { broadcastsSent: 1 } },
    { upsert: true, setDefaultsOnInsert: true }
  );
};

async function runFollowUpScheduler() {
  log.info("Starting follow-up scheduler...");

  try {
    const pendingLeads = await Lead.find({ status: { $in: ["new", "pending", "contacted"] } }).populate(
      "vendor"
    );

    if (pendingLeads.length === 0) {
      log.info("No pending leads to process");
      return;
    }

    log.info(`Processing ${pendingLeads.length} pending leads`);

    for (const lead of pendingLeads) {
      try {
        if (!lead.vendor) {
          log.warn(`Lead ${lead._id} has no vendor, skipping`);
          continue;
        }

        const vendorId = lead.vendor._id || lead.vendor;
        const client = getClient(vendorId);

        if (!client) {
          log.warn(`WhatsApp client not available for vendor ${vendorId}`);
          continue;
        }

        const limitCheck = await checkBroadcastLimit(vendorId);
        if (!limitCheck.allowed) {
          log.warn(`Broadcast limit check failed for ${vendorId}: ${limitCheck.reason}`);
          continue;
        }

        await processFollowUp(lead, lead.vendor, client);
        await incrementBroadcastUsage(vendorId);
      } catch (err) {
        log.error(`Error processing lead ${lead._id}:`, err.message);
      }
    }
  } catch (err) {
    log.error("Follow-up scheduler error:", err.message);
  }

  log.info("Follow-up scheduler completed");
}

module.exports = { runFollowUpScheduler, checkBroadcastLimit };
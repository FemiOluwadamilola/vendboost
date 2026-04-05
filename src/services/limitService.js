// services/limitService.js
const Usage = require("../models/Usage");

function getToday() {
  return new Date().toISOString().split("T")[0];
}

async function checkBroadcastLimit(vendorId, plan) {
  const today = getToday();

  let usage = await Usage.findOne({ vendor: vendorId, date: today });

  if (!usage) {
    usage = await Usage.create({
      vendor: vendorId,
      date: today,
    });
  }

  if (usage.broadcastsSent >= plan.limits.broadcastsPerDay) {
    return {
      allowed: false,
      message: "Daily broadcast limit reached",
    };
  }

  return { allowed: true, usage };
}

async function incrementBroadcast(vendorId) {
  const today = getToday();

  await Usage.findOneAndUpdate(
    { vendor: vendorId, date: today },
    { $inc: { broadcastsSent: 1 } },
    { upsert: true },
  );
}

module.exports = {
  checkBroadcastLimit,
  incrementBroadcast,
};

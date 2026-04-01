const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const { getClient } = require("../whatsapp/session");

async function runFollowUpScheduler() {
  const leads = await Lead.find({ status: "pending" });

  for (let lead of leads) {
    const vendor = await Vendor.findById(lead.vendor);
    if (!vendor) continue;

    const client = getClient(vendor._id);
    if (!client) continue;

    const now = new Date();
    const hoursSinceLast = lead.lastFollowUpAt
      ? (now - lead.lastFollowUpAt) / 36e5
      : (now - lead.createdAt) / 36e5;

    const followUpTimes = vendor.followUpTimes; // [6, 24, 72]

    if (
      lead.followUpsSent < followUpTimes.length &&
      hoursSinceLast >= followUpTimes[lead.followUpsSent]
    ) {
      // Send follow-up based on intent
      let message = "";
      switch (lead.intentType) {
        case "price":
          message = `Hi ${lead.customerName} 😊 just checking if you're still interested. We can arrange delivery today!`;
          break;
        case "availability":
          message = `Hi ${lead.customerName} 👋 your item is still available. Let me know if you’d like it reserved ❤️`;
          break;
        case "ready-to-pay":
          message = `Hi ${lead.customerName} 💰 just checking if you’ve completed payment so we can process immediately.`;
          break;
        default:
          message = `Hi ${lead.customerName} 👋 are you still interested? We can reserve it for you.`;
      }

      await client.sendMessage(`${lead.customerNumber}@c.us`, message);

      lead.followUpsSent += 1;
      lead.lastFollowUpAt = new Date();
      await lead.save();

      console.log(
        `Sent follow-up #${lead.followUpsSent} to ${lead.customerNumber}`,
      );
    }
  }
}

module.exports = { runFollowUpScheduler };

const Lead = require("../models/Lead");
const Vendor = require("../models/Vendor");
const intentDetector = require("../utils/intentDetector");
const paymentDetector = require("../utils/paymentDetector");

async function handleIncomingMessage(vendorId, client, msg) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) return;

  const customerNumber = msg.from.replace("@c.us", "");
  const customerName = msg._data.notifyName || "Customer";
  const text = msg.body;

  // Detect intent
  const intent = intentDetector(text);

  // Detect if payment-related
  const isPayment = paymentDetector(text);

  // Find existing lead
  let lead = await Lead.findOne({ vendor: vendorId, customerNumber });

  if (!lead) {
    lead = new Lead({
      vendor: vendorId,
      customerName,
      customerNumber,
      lastMessage: text,
      intentType: intent,
    });
    await lead.save();
  } else {
    // Update existing lead
    lead.lastMessage = text;
    lead.intentType = intent;
    lead.status = "responded";
    lead.followUpsSent = 0; // reset follow-ups
    await lead.save();
  }

  // Optional: log
  console.log(
    `Message from ${customerNumber} detected as ${intent} ${isPayment ? "💰 payment" : ""}`,
  );
}

module.exports = { handleIncomingMessage };

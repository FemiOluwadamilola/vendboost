const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
  customerName: String,
  customerNumber: String,
  lastMessage: String,
  intentType: String, // price, availability, ready-to-pay, silent
  status: { type: String, default: "pending" }, // pending, responded, completed
  createdAt: { type: Date, default: Date.now },
  followUpsSent: { type: Number, default: 0 },
  lastFollowUpAt: Date,
});

module.exports = mongoose.model("Lead", LeadSchema);

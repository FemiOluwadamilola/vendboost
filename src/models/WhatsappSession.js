const mongoose = require("mongoose");

const whatsappSessionSchema = new mongoose.Schema({
  vendorId: { type: String, required: true, unique: true },
  status: { type: String, default: "initializing" },
  qr: { type: String },
  lastSeen: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("WhatsAppSession", whatsappSessionSchema);
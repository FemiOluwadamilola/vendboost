const mongoose = require("mongoose");

const whatsappSessionSchema = new mongoose.Schema({
  vendor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vendor",
    required: true,
    index: true,
  },
  status: { 
    type: String, 
    default: "initializing",
    enum: ["initializing", "qr", "connected", "disconnected", "error", "auth_failed", "destroyed"]
  },
  qr: { type: String },
  lastSeen: { type: Date },
}, { timestamps: true });

whatsappSessionSchema.index({ vendor: 1 }, { unique: true });

module.exports = mongoose.model("WhatsAppSession", whatsappSessionSchema);
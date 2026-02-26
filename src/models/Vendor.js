const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema({
  name: String,
  whatsappId: String, // QR session identifier
  followUpTimes: { type: [Number], default: [6, 24, 72] }, // hours
});

module.exports = mongoose.model("Vendor", VendorSchema);

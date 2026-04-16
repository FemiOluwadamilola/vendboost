const mongoose = require("mongoose");

const pendingVendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  business_type: {
    type: String,
    default: "Other",
  },
  businessName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  plan: {
    type: String,
    default: null,
  },
  verificationToken: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400,
  },
});

module.exports = mongoose.model("PendingVendor", pendingVendorSchema);
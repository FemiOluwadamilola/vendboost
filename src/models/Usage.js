// models/Usage.js
const mongoose = require("mongoose");

const usageSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    broadcastsSent: {
      type: Number,
      default: 0,
    },

    messagesSent: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

usageSchema.index({ vendor: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Usage", usageSchema);

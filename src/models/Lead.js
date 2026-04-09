const mongoose = require("mongoose");

const INTENT_TYPES = ["price", "availability", "ready-to-pay", "order", "inquiry", "silent"];
const LEAD_STATUSES = ["new", "pending", "contacted", "qualified", "converted", "failed"];

const LeadSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      trim: true,
    },
    customerNumber: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    lastMessage: {
      type: String,
      trim: true,
    },
    intentType: {
      type: String,
      enum: INTENT_TYPES,
      default: "inquiry",
    },
    status: {
      type: String,
      enum: LEAD_STATUSES,
      default: "new",
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    source: {
      type: String,
      enum: ["whatsapp", "manual", "imported"],
      default: "whatsapp",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    notes: {
      type: String,
      trim: true,
    },
    followUpsSent: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastFollowUpAt: Date,
    convertedAt: Date,
    lastContactAt: Date,
  },
  {
    timestamps: true,
  }
);

LeadSchema.index({ vendor: 1, status: 1 });
LeadSchema.index({ vendor: 1, createdAt: -1 });
LeadSchema.index({ customerNumber: 1 });

LeadSchema.methods.markAsContacted = function () {
  this.status = "contacted";
  this.lastContactAt = new Date();
  return this.save();
};

LeadSchema.methods.markAsQualified = function () {
  this.status = "qualified";
  this.score = Math.min(this.score + 20, 100);
  return this.save();
};

LeadSchema.methods.markAsConverted = function () {
  this.status = "converted";
  this.convertedAt = new Date();
  this.score = 100;
  return this.save();
};

LeadSchema.methods.markAsFailed = function () {
  this.status = "failed";
  return this.save();
};

LeadSchema.methods.incrementFollowUp = function () {
  this.followUpsSent += 1;
  this.lastFollowUpAt = new Date();
  return this.save();
};

LeadSchema.statics.findByVendor = function (vendorId, options = {}) {
  const { status, limit = 50, skip = 0, sort = { createdAt: -1 } } = options;
  const query = { vendor: vendorId };
  if (status) query.status = status;
  
  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate("product");
};

LeadSchema.statics.getStats = async function (vendorId) {
  const stats = await this.aggregate([
    { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    total: 0,
    new: 0,
    pending: 0,
    contacted: 0,
    qualified: 0,
    converted: 0,
    failed: 0,
  };

  stats.forEach((s) => {
    result[s._id] = s.count;
    result.total += s.count;
  });

  return result;
};

module.exports = mongoose.model("Lead", LeadSchema);
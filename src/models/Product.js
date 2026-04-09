const mongoose = require("mongoose");
const productSchema = new mongoose.Schema(
  {
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
      index: true,
    },
    image: { type: String },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    discount: { type: Number, default: 1 },
    description: { type: String },
    category: { type: String },
    stock: { type: Number, default: 1 },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
    leads: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

productSchema.index({ vendor: 1, createdAt: -1 });
productSchema.index({ name: "text", description: "text" });

module.exports = mongoose.model("Product", productSchema);

const mongoose = require('mongoose');
const productSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  image: { type: String },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  discount: { type: Number, default: 1 }, // 1 means no discount, 0.9 means 10% off
  description: { type: String },
}); 
module.exports = mongoose.model('Product', productSchema);
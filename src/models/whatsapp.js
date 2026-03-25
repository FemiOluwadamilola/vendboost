const mongoose = require('mongoose');
const WhatsappSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  customerName: String,
});
module.exports = mongoose.model('Whatsapp', WhatsappSchema);
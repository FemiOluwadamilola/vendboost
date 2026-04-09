const mongoose = require("mongoose");

const VendorSchema = new mongoose.Schema({
  name: String,
  business_type:String,
    email:{
        type:String,
        required:true,
        unique:true,
    },
    password:{
        type:String,
        required:true
    },
  businessName: String,
  whatsappId: String, // QR session identifier
  followUpTimes: { type: [Number], default: [6, 24, 72] },
  accountDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String
  },
  subscription: {
    plan: { type: String, default: null },
    status: { type: String, default: "inactive" },
    startDate: Date,
    endDate: Date
  }
});

module.exports = mongoose.model("Vendor", VendorSchema);

const mongoose = require("mongoose");

const templateSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor" },
  templates: {
    greeting: String,
    price: String,
    negotiation: String,
    readyToPay: String,
    fallback: String
  }
});

module.exports = mongoose.model("Template", templateSchema);
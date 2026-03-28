const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/verifyAuth');
const Lead = require('../models/Lead');
const Vendor = require('../models/Vendor');

router.get('/', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  
  try {
    const leads = await Lead.find({ vendor: vendorId })
      .sort({ score: -1, lastMessage: -1 })
      .limit(50); // recent 50 leads

    res.render('dashboard', {
      title: "VendBoost Dashboard",
      vendorId,
      leads
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.render('dashboard', {
      title: "VendBoost Dashboard",
      vendorId,
      leads: [],
      error: "Failed to load leads"
    });
  }
});

module.exports = router;
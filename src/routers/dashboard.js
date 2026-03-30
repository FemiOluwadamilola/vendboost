const express = require('express');
const router = express.Router();
const verifyAuth = require('../middlewares/verifyAuth');
const Lead = require('../models/Lead');
const WhatsAppSession = require("../models/WhatsappSession");
const { createSession } = require('../whatsapp/session');
const Vendor = require('../models/Vendor');

router.get('/', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  
  try {
    const leads = await Lead.find({ vendor: vendorId })
      .sort({ score: -1, lastMessage: -1 })
      .limit(50); // recent 50 leads

    res.render('./dashboard/index', {
      layout:'layouts/dashboard',
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

// 🔹 Connect WhatsApp page
router.get('/connect-whatsapp', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    // Ensure a session record exists in MongoDB
    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "initializing", qr: null, lastSeen: new Date() },
      { upsert: true }
    );

    // Start WhatsApp client if not already running
    await createSession(vendorId);

    return res.render('connect-whatsapp', {
      title: "WhatsApp Connection",
      vendorId,
      status: "initializing"
    });

  } catch (err) {
    console.error("WhatsApp connection error:", err);

    return res.render('connect', {
      title: "WhatsApp Connection",
      vendorId,
      status: "error"
    });
  }
});

// 🔹 Endpoint for frontend polling
router.get('/whatsapp-status', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const session = await WhatsAppSession.findOne({ vendorId });

    if (!session) {
      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status, // qr | initializing | connected | error | disconnected
      qr: session.qr
    });

  } catch (err) {
    console.error("Status fetch error:", err);
    res.status(500).json({ status: "error" });
  }
});

router.get("/analytics", verifyAuth.requireAuth, async (req,res) => {
const vendorId = req.user.id;
  
  try {
    const leads = await Lead.find({ vendor: vendorId })
      .sort({ score: -1, lastMessage: -1 })
      .limit(50); // recent 50 leads

    res.render('./dashboard/analytics', {
      layout:'layouts/dashboard',
      title: "VendBoost Analytics",
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
})

module.exports = router;
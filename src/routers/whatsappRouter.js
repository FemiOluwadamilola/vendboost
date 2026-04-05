const express = require("express");
const router = express.Router();
const verifyAuth = require("../middlewares/verifyAuth");
const WhatsAppSession = require("../models/WhatsappSession");
const { createSession } = require("../whatsapp/session");
const log = require("../utils/logger");

// 🔹 Connect WhatsApp page
router.get("/connect-whatsapp", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    // Ensure a session record exists in MongoDB
    await WhatsAppSession.findOneAndUpdate(
      { vendorId },
      { status: "initializing", qr: null, lastSeen: new Date() },
      { upsert: true },
    );

    // Start WhatsApp client if not already running
    await createSession(vendorId);

    return res.render("connect-whatsapp", {
      title: "WhatsApp Connection",
      vendorId,
      status: "initializing",
    });
  } catch (err) {
    log.error(`WhatsApp connection error for ${vendorId}:`, err.message);

    return res.render("connect", {
      title: "WhatsApp Connection",
      vendorId,
      status: "error",
    });
  }
});

// 🔹 Endpoint for frontend polling
router.get("/whatsapp-status", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const session = await WhatsAppSession.findOne({ vendorId });

    if (!session) {
      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status, // qr | initializing | connected | error | disconnected
      qr: session.qr,
    });
  } catch (err) {
    log.error(`Status fetch error for ${vendorId}:`, err.message);
    res.status(500).json({ status: "error" });
  }
});

module.exports = router;

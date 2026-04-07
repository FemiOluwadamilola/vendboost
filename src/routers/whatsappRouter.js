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
    log.info(`WhatsApp session initialized for vendor ${vendorId}`);
    return res.render("connect-whatsapp", {
      title: "WhatsApp Connection",
      vendorId,
      status: "initializing",
    });
  } catch (err) {
    log.error(`WhatsApp connection error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to connect WhatsApp, please try again");
    return res.redirect("/dashboard");
  }
});

// 🔹 Endpoint for frontend polling
router.get("/whatsapp-status", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const session = await WhatsAppSession.findOne({ vendorId });

    if (!session) {
      log.warn(`No WhatsApp session found for vendor ${vendorId}`);
      req.flash("error", "No WhatsApp session found");

      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status, // qr | initializing | connected | error | disconnected
      qr: session.qr,
    });
  } catch (err) {
    log.error(`Status fetch error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to fetch WhatsApp status");
    return res.json({ status: "error", qr: null });
  }
});

module.exports = router;

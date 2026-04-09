const express = require("express");
const router = express.Router();
const verifyAuth = require("../middlewares/verifyAuth");
const WhatsAppSession = require("../models/WhatsappSession");
const { createSession } = require("../whatsapp/session");
const { checkWhatsAppSessionsLimit } = require("../middlewares/checkSubscription");
const log = require("../utils/logger");

router.get("/connect-whatsapp", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  log.info(`Attempting WhatsApp connection for vendor ${vendorId}`);

  try {
    const sessionLimit = await checkWhatsAppSessionsLimit(vendorId);
    if (!sessionLimit.allowed) {
      req.flash("error", sessionLimit.reason);
      return res.redirect("/dashboard");
    }

    const existingSession = await WhatsAppSession.findOne({ vendor: vendorId });
    
    if (existingSession?.status === "connected") {
      req.flash("success", "WhatsApp is already connected!");
      return res.redirect("/dashboard");
    }

    if (existingSession?.status === "qr" && existingSession?.qr) {
      return res.render("connect-whatsapp", {
        title: "WhatsApp Connection",
        vendorId,
        status: "qr",
      });
    }

    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorId },
      { status: "initializing", qr: null, lastSeen: new Date() },
      { upsert: true, setDefaultsOnInsert: true },
    );

    createSession(vendorId).catch(err => {
      log.error(`Background session creation error for ${vendorId}:`, err.message);
    });
    
    return res.render("connect-whatsapp", {
      title: "WhatsApp Connection",
      vendorId,
      status: "initializing",
    });
  } catch (err) {
    log.error(`WhatsApp connection error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to initialize WhatsApp connection. Please try again.");
    return res.redirect("/dashboard");
  }
});

router.get("/whatsapp-status", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const session = await WhatsAppSession.findOne({ vendor: vendorId });

    if (!session) {
      log.warn(`No WhatsApp session found for vendor ${vendorId}`);
      return res.json({ status: "not_initialized", qr: null });
    }

    return res.json({
      status: session.status,
      qr: session.qr,
    });
  } catch (err) {
    log.error(`Status fetch error for ${vendorId}:`, err.message);
    return res.json({ status: "error", qr: null });
  }
});

router.post("/disconnect", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const { destroySession } = require("../whatsapp/session");
    await destroySession(vendorId);
    
    await WhatsAppSession.findOneAndUpdate(
      { vendor: vendorId },
      { status: "disconnected", lastSeen: new Date() },
    );

    req.flash("success", "WhatsApp disconnected successfully");
    return res.redirect("/dashboard");
  } catch (err) {
    log.error(`WhatsApp disconnect error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to disconnect WhatsApp");
    return res.redirect("/dashboard");
  }
});

module.exports = router;
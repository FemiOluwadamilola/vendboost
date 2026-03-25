const express = require('express');
const router = express.Router();
const { createSession, getSession } = require('../whatsapp/session');
const verifyAuth = require('../middlewares/verifyAuth');

router.get('/connect-whatsapp', verifyAuth.requireAuth, async (req, res) => {

  const vendorId = req.user.id;

  try {
    const existing = await getSession(vendorId);

    if (existing) {
      return res.render('connect', {
        title: "WhatsApp Connection",
        vendorId,
        status: "already_connected"
      });
    }

    await createSession(vendorId);

    return res.render('connect', {
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

module.exports = router;
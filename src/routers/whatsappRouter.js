// const express = require("express");
// const router = express.Router();
// const WhatsAppSession = require("../models/WhatsappSession");
// const verifyAuth = require("../middlewares/verifyAuth");

// // 🔥 GET STATUS + QR
// router.get("/status", verifyAuth.requireAuth, async (req, res) => {
//   try {
//     const vendorId = req.user.id;

//     const session = await WhatsAppSession.findOne({ vendorId });

//     if (!session) {
//       return res.json({ status: "not_initialized", qr: null });
//     }

//     return res.json({
//       status: session.status,
//       qr: session.qr
//     });

//   } catch (err) {
//     res.status(500).json({ status: "error" });
//   }
// });
// module.exports = router;
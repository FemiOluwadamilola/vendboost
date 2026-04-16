const express = require("express");
const router = express.Router();
const logViewer = require("./logViewer");

// Mount logs API routes
router.use("/logs", logViewer);

router.get("/", async (req, res) => {
  try {
    res.status(200).render("index", {
      title: "welcome to Vendboost",
    });
  } catch (err) {
    req.flash("error", "Failed to load homepage");
    return res.redirect("/");
  }
});

router.get("/signup", (req, res) => {
  res.render("./dashboard/register", {
    title: "Create Account – VendBoost",
  });
});

// Optional: disable POST signups until launch
router.get("/signin", (req, res) => {
  res.render("./dashboard/login", {
    title: "Sign In – VendBoost",
  });
});

router.get("/verify-email-sent", (req, res) => {
  res.render("./dashboard/verify-email-sent", {
    title: "Verify Email – VendBoost",
  });
});

router.get("/terms", (req, res) => {
  res.render("terms", {
    title: "Terms & Conditions – VendBoost",
  });
});

router.get("/logs", (req, res) => {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOGS_VIEW !== "true") {
    return res.status(403).send("Logs viewer not available in production");
  }
  res.render("./dashboard/logs", {
    title: "System Logs – VendBoost",
  });
});

module.exports = router;

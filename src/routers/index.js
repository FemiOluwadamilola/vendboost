const express = require("express");
const router = express.Router();

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

router.get("/terms", (req, res) => {
  res.render("terms", {
    title: "Terms & Conditions – VendBoost",
  });
});

module.exports = router;

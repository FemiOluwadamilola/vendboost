const express = require("express");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    res.status(200).render("index", {
      title: "welcome to Vendboost",
    });
  } catch (err) {
    return res.status(500).json({
      message: "Server error: something went wrong, please try again later",
      error: err,
    });
  }
});

router.get("/signup", (req, res) => {
  res.render("signup", {
    title: "Create Account – VendBoost",
  });
});

// Optional: disable POST signups until launch
router.get("/signin", (req, res) => {
  res.render("signin", {
    title: "Sign In – VendBoost",
  });
});

router.get("/dashboard", (req, res) => {
  res.render("dashboard", {
    title: "Dashboard – VendBoost",
  });
});

module.exports = router;

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

module.exports = router;

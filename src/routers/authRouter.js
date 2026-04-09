const express = require("express");
const bcrypt = require("bcryptjs");
const Vendor = require("../models/Vendor");
const log = require("../utils/logger");
const router = express.Router();
router.post("/signup", async (req, res) => {
  try {
    const { name, business_type, businessName, email, password, plan } = req.body;

    // Basic validation
    if (!email || !password) {
      req.flash("error", "Email and password are required.");
      return res.redirect("/signup");
    }

    // Validate plan selection
    const validPlans = ["free", "starter", "pro"];
    if (!plan || !validPlans.includes(plan)) {
      req.flash("error", "Please select a subscription plan.");
      return res.redirect("/signup");
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ email });

    if (existingVendor) {
      req.flash("error", "This email is already in use.");
      return res.redirect("/signup");
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Set subscription based on plan
    let subscription = {
      plan: plan,
      status: plan === "free" ? "active" : "inactive",
      startDate: plan === "free" ? new Date() : null,
      endDate: plan === "free" ? null : null
    };

    // Create new vendor
    const newVendor = new Vendor({
      name,
      business_type,
      email,
      businessName,
      password: hashedPassword,
      subscription
    });

    await newVendor.save();

    // If paid plan, redirect to payment
    if (plan !== "free") {
      req.session.paymentVendorId = newVendor._id.toString();
      req.session.pendingPlan = plan;
      return res.redirect("/subscription/signup-payment");
    }

    // Auto-login for free plan
    req.session.regenerate((err) => {
      if (err) {
        log.error("Session error:", err.message);
        req.flash("error", "An error occurred. Please try again.");
        return res.redirect("/signup");
      }

      req.session.user = {
        id: newVendor._id,
        role: newVendor.role,
      };

      req.session.loginTime = Date.now();
      return res.redirect("/dashboard");
    });
  } catch (err) {
    req.flash("error", "An error occurred. Please try again.");
    log.error("Signup error:", err.message);
    return res.redirect("/signup");
  }
});

router.post("/signin", async (req, res) => {
  // Add explicit error handler
  try {
    const { email, password } = req.body;
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/signin");
    }
    const isMatch = await bcrypt.compare(password, vendor.password);

    if (!isMatch) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/signin");
    }

    // Optional: account status check
    if (vendor.status && vendor.status !== "active") {
      req.flash("error", "Account is not active");
      return res.redirect("/signin");
    }

    // 🔐 Secure session creation
    req.session.regenerate((err) => {
      if (err) {
        log.error("Session error:", err.message);
        req.flash("error", "An error occurred. Please try again.");
        return res.redirect("/signin");
      }

      req.session.user = {
        id: vendor._id,
        role: vendor.role,
      };

      // Optional: login tracking
      req.session.loginTime = Date.now();

      return res.redirect("/dashboard");
    });
  } catch (err) {
    log.error("Signin error:", err.message);
    req.flash("error", "An error occurred. Please try again.");
    return res.redirect("/signin");
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      log.error("Logout error:", err.message);
      req.flash("error", "An error occurred. Please try again.");
      return res.redirect("/dashboard");
    }
    res.clearCookie("vendboost.sid");
    return res.redirect("/signin");
  });
});

module.exports = router;

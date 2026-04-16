const express = require("express");
const bcrypt = require("bcryptjs");
const Vendor = require("../models/Vendor");
const PendingVendor = require("../models/PendingVendor");
const log = require("../utils/logger");
const { sendVerificationEmail, sendPasswordResetEmail, generateToken } = require("../utils/emailService");
const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, business_type, businessName, email, password } = req.body;

    if (!email || !password) {
      req.flash("error", "Email and password are required.");
      return res.redirect("/signup");
    }

    const existingVendor = await Vendor.findOne({ email });
    const existingPending = await PendingVendor.findOne({ email });

    if (existingVendor) {
      req.flash("error", "This email is already in use.");
      return res.redirect("/signup");
    }

    if (existingPending) {
      const verificationToken = generateToken();
      existingPending.verificationToken = verificationToken;
      await existingPending.save();
      await sendVerificationEmail(email, verificationToken);
      req.flash("info", "A new verification link has been sent to your email.");
      return res.redirect("/verify-email-sent");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = generateToken();

    const pendingVendor = new PendingVendor({
      name: name || "Unknown",
      business_type: business_type || "Other",
      email,
      businessName: businessName || "Unknown",
      password: hashedPassword,
      plan: null,
      verificationToken,
    });

    await pendingVendor.save();

    const emailSent = await sendVerificationEmail(email, verificationToken);
    if (!emailSent) {
      log.warn(`Failed to send verification email for: ${email}`);
    }

    req.flash("success", "Please check your email to verify your account.");
    return res.redirect("/verify-email-sent");
  } catch (err) {
    log.error("Signup error:", err.message);
    req.flash("error", "An error occurred. Please try again.");
    return res.redirect("/signup");
  }
});

router.get("/verify/:token", async (req, res) => {
  try {
    log.info(`Verify called with token: ${req.params.token}`);
    const pendingVendor = await PendingVendor.findOne({ verificationToken: req.params.token });

    if (!pendingVendor) {
      log.warn(`No pending vendor found with token: ${req.params.token}`);
      req.flash("error", "Invalid or expired verification link.");
      return res.redirect("/signin");
    }

    log.info(`Found pending vendor: ${pendingVendor.email}`);

    let subscription;
    if (pendingVendor.plan === "trial") {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);
      subscription = {
        plan: "trial",
        status: "trial",
        startDate: new Date(),
        endDate: trialEndDate,
      };
    } else if (pendingVendor.plan === "starter" || pendingVendor.plan === "pro") {
      subscription = {
        plan: pendingVendor.plan,
        status: "pending",
        startDate: null,
        endDate: null,
      };
    } else {
      subscription = {
        plan: null,
        status: "pending",
        startDate: null,
        endDate: null,
      };
    }

    const newVendor = new Vendor({
      name: pendingVendor.name,
      business_type: pendingVendor.business_type,
      email: pendingVendor.email,
      businessName: pendingVendor.businessName,
      password: pendingVendor.password,
      subscription,
      isVerified: true,
    });

    await newVendor.save();
    await PendingVendor.deleteOne({ _id: pendingVendor._id });

    log.info(`Vendor created: ${newVendor.email}`);

    req.flash("success", "Email verified! You can now sign in to your account.");
    return res.redirect("/signin");
  } catch (err) {
    log.error("Verification error:", err.message);
    req.flash("error", "An error occurred during verification.");
    return res.redirect("/signin");
  }
});

router.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
     
    if (!email) {
      req.flash("error", "Email is required.");
      return res.redirect("/signin");
    }

    const vendor = await Vendor.findOne({ email });
    const pendingVendor = await PendingVendor.findOne({ email });

    if (!vendor && !pendingVendor) {
      req.flash("error", "No account found with this email.");
      return res.redirect("/signin");
    }

    if (vendor && vendor.isVerified) {
      req.flash("info", "This account is already verified. Please sign in.");
      return res.redirect("/signin");
    }

    let verificationToken;
    if (pendingVendor) {
      verificationToken = generateToken();
      pendingVendor.verificationToken = verificationToken;
      await pendingVendor.save();
    } else if (vendor) {
      verificationToken = generateToken();
      vendor.verificationToken = verificationToken;
      await vendor.save();
    }

    await sendVerificationEmail(email, verificationToken);
    req.flash("success", "Verification link sent! Please check your email.");
    return res.redirect("/verify-email-sent");
  } catch (err) {
    log.error("Resend verification error:", err.message);
    req.flash("error", "An error occurred. Please try again.");
    return res.redirect("/signin");
  }
});

router.get("/forgot-password", (req, res) => {
  res.render("dashboard/forgot-password", { title: "Forgot Password" });
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    log.info(`Forgot password request for: ${email}`);

    const vendor = await Vendor.findOne({ email });

    if (!vendor) {
      req.flash("success", "If an account exists with that email, a password reset link has been sent.");
      return res.redirect("/signin");
    }

    const resetToken = generateToken();
    vendor.resetPasswordToken = resetToken;
    vendor.resetPasswordExpires = new Date(Date.now() + 3600000);
    await vendor.save();

    log.info("Sending password reset email...");
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    log.info(`Email send result: ${emailResult}`);

    req.flash("success", "If an account exists with that email, a password reset link has been sent.");
    return res.redirect("/signin");
  } catch (err) {
    log.error("Forgot password error:", err.message);
    req.flash("error", "An error occurred. Please try again.");
    return res.redirect("/forgot-password");
  }
});

router.get("/reset-password/:token", async (req, res) => {
  try {
    const vendor = await Vendor.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!vendor) {
      req.flash("error", "Invalid or expired password reset link.");
      return res.redirect("/forgot-password");
    }

    res.render("dashboard/reset-password", { 
      title: "Reset Password",
      token: req.params.token 
    });
  } catch (err) {
    log.error("Reset password page error:", err.message);
    req.flash("error", "An error occurred.");
    return res.redirect("/forgot-password");
  }
});

router.post("/reset-password/:token", async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      req.flash("error", "Please fill in all fields.");
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    if (password !== confirmPassword) {
      req.flash("error", "Passwords do not match.");
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    if (password.length < 6) {
      req.flash("error", "Password must be at least 6 characters.");
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    const vendor = await Vendor.findOne({
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!vendor) {
      req.flash("error", "Invalid or expired password reset link.");
      return res.redirect("/forgot-password");
    }

    const salt = await bcrypt.genSalt(10);
    vendor.password = await bcrypt.hash(password, salt);
    vendor.resetPasswordToken = undefined;
    vendor.resetPasswordExpires = undefined;
    await vendor.save();

    req.flash("success", "Password reset successful! Please sign in with your new password.");
    return res.redirect("/signin");
  } catch (err) {
    log.error("Reset password error:", err.message);
    req.flash("error", "An error occurred. Please try again.");
    return res.redirect("/forgot-password");
  }
});

router.post("/signin", async (req, res) => {
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

    // Skip verification for OAuth users (they're auto-verified)
    const isLocalAuth = vendor.authProvider === "local" || !vendor.authProvider;
    log.debug(`Signin - authProvider: ${vendor.authProvider}, isVerified: ${vendor.isVerified}, isLocalAuth: ${isLocalAuth}`);
    
    if (isLocalAuth && !vendor.isVerified) {
      req.flash("error", "Please verify your email before signing in.");
      return res.redirect("/signin");
    }

    if (vendor.status && vendor.status !== "active") {
      req.flash("error", "Account is not active");
      return res.redirect("/signin");
    }

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
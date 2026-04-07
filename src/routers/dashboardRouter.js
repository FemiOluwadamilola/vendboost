const express = require("express");
const router = express.Router();
const verifyAuth = require("../middlewares/verifyAuth");
const Lead = require("../models/Lead");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const log = require("../utils/logger");

router.get("/", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const products = await Product.find({ vendor: vendorId })
    .sort({ createdAt: -1 })
    .limit(10);
  // const totalProducts = await Product.countDocuments({ vendor: vendorId });

  const stats = {
    totalProducts: 34,
    statusPosts: 12,
    broadcasts: 8,
    leads: 25,
  };
  try {
    const leads = await Lead.find({ vendor: vendorId })
      .sort({ score: -1, lastMessage: -1 })
      .limit(50); // recent 50 leads

    return res.render("./dashboard/index", {
      layout: "layouts/dashboard",
      title: "VendBoost Dashboard",
      vendorId,
      leads,
      stats,
      products,
    });
  } catch (err) {
    log.error(`Dashboard error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load dashboard data");
    return res.redirect("/dashboard");
  }
});

router.get("/analytics", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const leads = await Lead.find({ vendor: vendorId })
      .sort({ score: -1, lastMessage: -1 })
      .limit(50); // recent 50 leads

    return res.render("./dashboard/analytics", {
      layout: "./layouts/dashboard",
      title: "VendBoost Analytics",
      vendorId,
      leads,
    });
  } catch (err) {
    log.error(`Analytics error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load analytics data");
    return res.redirect("/dashboard");
  }
});

router.get("/new-product", verifyAuth.requireAuth, async (req, res) => {
  try {
    res.render("./dashboard/productUpload", {
      layout: "layouts/dashboard",
      title: "upload product",
    });
  } catch (err) {
    log.error(`Upload product error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load product upload page");
    res.redirect("/dashboard");
  }
});

router.get("/products", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const vendor = await Vendor.findById(vendorId);
  try {
    const products = await Product.find({ vendor: vendorId }).sort({
      createdAt: -1,
    });
    res.render("./dashboard/products", {
      layout: "layouts/dashboard",
      title: "Settings",
      products,
      vendor,
    });
  } catch (err) {
    log.error(`Fetch products error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load products");
    return res.redirect("/dashboard");
  }
});

router.get("/leads", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const leads = await Lead.find({ vendor: vendorId }).sort({
    score: -1,
    lastMessage: -1,
  });

  const stats = {
    totalLeads: 34,
    newLeads: 12,
    hotLeads: 8,
    converted: 25,
  };

  try {
    res.render("./dashboard/leads", {
      layout: "layouts/dashboard",
      title: "Settings",
      leads,
      stats,
    });
  } catch (err) {
    log.error(`Fetch leads error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load leads");
    return res.redirect("/dashboard");
  }
});

router.get("/settings", verifyAuth.requireAuth, async (req, res) => {
  try {
    res.render("./dashboard/settings", {
      layout: "layouts/dashboard",
      title: "Settings",
    });
  } catch (err) {
    log.error(`Fetch settings error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load settings");
    return res.redirect("/dashboard");
  }
});

module.exports = router;

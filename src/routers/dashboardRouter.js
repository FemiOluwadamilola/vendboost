const express = require("express");
const router = express.Router();
const verifyAuth = require("../middlewares/verifyAuth");
const Lead = require("../models/Lead");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Subscription = require("../models/Subscription");
const Usage = require("../models/Usage");
const plans = require("../config/plans");
const log = require("../utils/logger");

router.get("/", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const [totalProducts, leads, subscription, todayUsage] = await Promise.all([
      Product.countDocuments({ vendor: vendorId }),
      Lead.find({ vendor: vendorId }).sort({ createdAt: -1 }).limit(50),
      Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 }),
      Usage.findOne({ vendor: vendorId, date: new Date().toISOString().split("T")[0] }),
    ]);

    const products = await Product.find({ vendor: vendorId })
      .sort({ createdAt: -1 })
      .limit(10);

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const newLeadsToday = await Lead.countDocuments({
      vendor: vendorId,
      createdAt: { $gte: startOfDay },
    });

    const hotLeads = await Lead.countDocuments({
      vendor: vendorId,
      score: { $gte: 80 },
    });

    const converted = await Lead.countDocuments({
      vendor: vendorId,
      status: "converted",
    });

    const planLimits = subscription ? plans[subscription.plan]?.limits : plans.free.limits;

    const stats = {
      totalProducts,
      statusPosts: todayUsage?.broadcastsSent || 0,
      broadcasts: todayUsage?.broadcastsSent || 0,
      leads: totalProducts,
      newLeadsToday,
      hotLeads,
      converted,
      planLimit: planLimits?.leads || 20,
      broadcastLimit: planLimits?.broadcastsPerDay || 0,
    };

    const vendor = await Vendor.findById(vendorId);

    return res.render("./dashboard/index", {
      layout: "layouts/dashboard",
      title: "VendBoost Dashboard",
      vendorId,
      leads,
      stats,
      products,
      subscription,
      vendor,
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
      .limit(50);

    const totalLeads = await Lead.countDocuments({ vendor: vendorId });
    const converted = await Lead.countDocuments({ vendor: vendorId, status: "converted" });
    const qualified = await Lead.countDocuments({ vendor: vendorId, status: "qualified" });

    const stats = {
      totalLeads,
      converted,
      qualified,
      conversionRate: totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0,
    };

    return res.render("./dashboard/analytics", {
      layout: "./layouts/dashboard",
      title: "VendBoost Analytics",
      vendorId,
      leads,
      stats,
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
      title: "Upload Product",
    });
  } catch (err) {
    log.error(`Upload product error:`, err.message);
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

    const totalProducts = await Product.countDocuments({ vendor: vendorId });
    const availableProducts = await Product.countDocuments({ vendor: vendorId, stock: { $gt: 0 } });
    const outOfStock = await Product.countDocuments({ vendor: vendorId, stock: { $lte: 0 } });

    res.render("./dashboard/products", {
      layout: "layouts/dashboard",
      title: "Products",
      products,
      vendor,
      stats: {
        totalProducts,
        available: availableProducts,
        outOfStock,
      },
    });
  } catch (err) {
    log.error(`Fetch products error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load products");
    return res.redirect("/dashboard");
  }
});

router.get("/leads", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const leads = await Lead.find({ vendor: vendorId }).sort({
      createdAt: -1,
    });

    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));

    const [totalLeads, newLeadsToday, hotLeads, converted] = await Promise.all([
      Lead.countDocuments({ vendor: vendorId }),
      Lead.countDocuments({ vendor: vendorId, createdAt: { $gte: startOfDay } }),
      Lead.countDocuments({ vendor: vendorId, score: { $gte: 80 } }),
      Lead.countDocuments({ vendor: vendorId, status: "converted" }),
    ]);

    const stats = {
      totalLeads,
      newLeads: newLeadsToday,
      hotLeads,
      converted,
    };

    res.render("./dashboard/leads", {
      layout: "layouts/dashboard",
      title: "Leads",
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
  const vendorId = req.user.id;

  try {
    const [vendor, subscription, payments] = await Promise.all([
      Vendor.findById(vendorId),
      Subscription.findOne({ vendor: vendorId }).sort({ createdAt: -1 }),
      require("../models/Payment").find({ vendor: vendorId }).sort({ createdAt: -1 }).limit(10),
    ]);

    const currentPlan = subscription ? plans[subscription.plan] : plans.free;
    const isActive = subscription?.status === "active";

    res.render("./dashboard/settings", {
      layout: "layouts/dashboard",
      title: "Settings",
      vendor,
      subscription: {
        plan: subscription?.plan || "free",
        status: subscription?.status || "inactive",
        startDate: subscription?.startDate,
        endDate: subscription?.endDate,
        isActive,
      },
      planDetails: currentPlan,
      payments: payments || [],
    });
  } catch (err) {
    log.error(`Fetch settings error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to load settings");
    return res.redirect("/dashboard");
  }
});

router.post("/settings/profile", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { name, email, phone, businessName } = req.body;

  try {
    await Vendor.findByIdAndUpdate(vendorId, {
      name,
      email,
      phone,
      businessName,
    });

    req.flash("success", "Profile updated successfully!");
    return res.redirect("/dashboard/settings");
  } catch (err) {
    log.error(`Profile update error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to update profile");
    return res.redirect("/dashboard/settings");
  }
});

router.post("/settings/password", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    const bcrypt = require("bcryptjs");
    const isMatch = await bcrypt.compare(currentPassword, vendor.password);

    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await Vendor.findByIdAndUpdate(vendorId, { password: hashedPassword });

    req.flash("success", "Password updated successfully!");
    return res.redirect("/dashboard/settings");
  } catch (err) {
    log.error(`Password update error for ${vendorId}:`, err.message);
    return res.status(500).json({ error: "Failed to update password" });
  }
});

router.post("/leads/:id/status", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const leadId = req.params.id;
  const { status } = req.body;

  try {
    const lead = await Lead.findOne({ _id: leadId, vendor: vendorId });
    if (!lead) {
      return res.status(404).json({ error: "Lead not found" });
    }

    lead.status = status;
    await lead.save();

    return res.json({ success: true, message: "Lead status updated" });
  } catch (err) {
    log.error(`Lead status update error:`, err.message);
    return res.status(500).json({ error: "Failed to update lead status" });
  }
});

module.exports = router;
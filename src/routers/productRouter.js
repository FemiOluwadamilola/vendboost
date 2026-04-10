const express = require("express");
const router = express.Router();
const fs = require("fs");
const multer = require("multer");
const path = require("path");
const { MessageMedia } = require("whatsapp-web.js");
const verifyAuth = require("../middlewares/verifyAuth");
const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Lead = require("../models/Lead");
const log = require("../utils/logger");
const { optimizeImage } = require("../utils/imageOpt");
const limitGuard = require("../middlewares/limitGuard");
const { checkSubscription } = require("../middlewares/checkSubscription");
// const WhatsAppSession = require("../models/WhatsappSession");
const { createSession, getClient } = require("../whatsapp/session");

// Create a product route
router.post("/new", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const vendor = await Vendor.findOne({ _id: vendorId });
  try {
    const storage = multer.diskStorage({
      destination: `./vendor-product-imgs/${vendor.businessName}`,
      filename: (req, file, cb) => {
        cb(
          null,
          file.fieldname + "_" + Date.now() + path.extname(file.originalname),
        );
      },
    });

    const product = multer({
      storage,
      fileFilter: (req, file, cb) => {
        const extname = path.extname(file.originalname);
        if (extname !== ".jpg" && extname !== ".png") {
          req.flash("error", "Only .jpg or .png files allowed");
        } else {
          cb(null, true);
        }
      },
    }).single("image");

    product(req, res, async (err) => {
      if (err) {
        log.error(`Product upload error for ${vendorId}:`, err.message);
        req.flash("error", "Failed to upload product image");
        return res.redirect("/dashboard");
      } else {
        const { name, price, description, discount } = req.body;
        if (!name || !price) {
          req.flash("error", "Product name and price are required");
          return res.redirect("/dashboard/new-product");
        }
        const newProduct = new Product({
          vendor: vendorId,
          image: req.file.filename,
          name,
          price,
          description,
          discount: discount || 1,
        });
        await newProduct.save();
        req.flash("success", "Product created successfully");
        return res.redirect("/dashboard/products");
      }
    });
  } catch (err) {
    log.error(`Create product error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to create product");
    return res.redirect("/dashboard/new-product");
  }
});

// get a single product route
router.get("/single", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    log.error(`Get product error for ${vendorId}: Missing productId`);
    req.flash("error", "Product not found");
    return res.redirect("/dashboard/products");
  }

  try {
    const product = await Product.findOne({
      _id: productId,
      vendor: vendorId,
    });

    if (!product) {
      log.error(`Get product error for ${vendorId}: Product not found`);
      req.flash("error", "Product not found");
      return res.redirect("/dashboard/products");
    }
  } catch (err) {
    log.error(`Get product error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to fetch product");
    return res.redirect("/dashboard/products");
  }

  res.json({ product });
});

// Product modification route
router.put("/update", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    log.error(`Update product error for ${vendorId}: Missing productId`);
    req.flash("error", "Product not found");
    return res.redirect("/dashboard/products");
  }

  try {
    const updated = await Product.findOneAndUpdate(
      { _id: productId, vendor: vendorId },
      req.body,
      { new: true },
    );

    if (!updated) {
      log.error(`Update product error for ${vendorId}: Product not found`);
      req.flash("error", "Product not found");
      return res.redirect("/dashboard/products");
    }

    req.flash("success", "Product updated successfully");
    return res.redirect("/dashboard/products");
  } catch (err) {
    log.error(`Update product error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to update product");
    return res.redirect("/dashboard/products");
  }
});

// Product delete route
router.delete("/delete", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    log.error(`Delete product error for ${vendorId}: Missing productId`);
    req.flash("error", "Product not found");
    return res.redirect("/dashboard/products");
  }

  try {
    const deleted = await Product.findOneAndDelete({
      _id: productId,
      vendor: vendorId,
    });

    if (!deleted) {
      req.flash("error", "Product not found");
      return res.redirect("/dashboard/products");
    }
    req.flash("success", "Product deleted successfully");
    return res.redirect("/dashboard/products");
  } catch (err) {
    log.error(`Delete product error for ${vendorId}:`, err.message);
    req.flash("error", "Failed to delete product");
    return res.redirect("/dashboard/products");
  }
});

// New Product Upload Broadcast route
router.post(
  "/broadcast",
  verifyAuth.requireAuth,
  checkSubscription,
  limitGuard("broadcast"),
  async (req, res) => {
    const vendorId = req.user.id;
    const { productId } = req.query;

    try {
      const product = await Product.findOne({
        _id: productId,
        vendor: vendorId,
      });

      if (!product) {
        log.error(`Broadcast error for ${vendorId}: Product not found`);
        req.flash("error", "Product not found");
        return res.redirect("/dashboard/products");
      }

      if (!product.image) {
        log.error(`Broadcast error for ${vendorId}: Product image missing`);
        req.flash("error", "Product image is required for broadcast");
        return res.redirect("/dashboard/products");
      }

      const leads = await Lead.find({ vendor: vendorId, status: { $in: ["new", "pending", "contacted", "qualified"] } });

      if (!leads.length) {
        req.flash("error", "No customers available for broadcast");
        return res.redirect("/dashboard/products");
      }

      const client = getClient(vendorId);

      if (!client) {
        await createSession(vendorId);
        req.flash("error", "WhatsApp initializing...");
        return res.redirect("/dashboard/products");
      }

      // 🔥 Load image
      const media = await MessageMedia.fromUrl(product.image);

      const caption = `
🔥 *NEW PRODUCT ALERT*

🛍️ ${product.name}
💰 ₦${product.price}

${product.description || ""}

Reply *buy* to order now 🚀
    `;

      let success = 0;
      let failed = 0;

      for (const lead of leads) {
        try {
          await client.sendMessage(`${lead.customerNumber}@c.us`, media, {
            caption,
          });

          success++;

          // ⚠️ Anti-ban delay (VERY IMPORTANT)
          await new Promise((r) => setTimeout(r, Math.random() * 2000 + 1000));
        } catch (err) {
          req.flash("error", "Failed to send broadcast message");
          log.error(
            `Failed for ${lead.customerNumber} for ${vendorId}:`,
            err.message,
          );
          failed++;
        }
      }

      // await incrementBroadcast(vendorId);
      req.flash(
        "success",
        `Broadcast completed: ${success} sent, ${failed} failed`,
      );
      return res.redirect("/dashboard/products");
    } catch (err) {
      log.error(`Broadcast error for ${vendorId}:`, err.message);
      req.flash("error", "Failed to broadcast product");
      return res.redirect("/dashboard/products");
    }
  },
);

// upload product to status route;
router.post(
  "/post-status",
  verifyAuth.requireAuth,
  checkSubscription,
  async (req, res) => {
    const vendorId = req.user.id;

    // Check if status posting is allowed
    if (!req.subscription.features.statusPosting) {
      req.flash("error", "WhatsApp Status posting is not available on your plan. Upgrade to Pro to unlock!");
      return res.redirect("/dashboard/products");
    }

    const { productId } = req.query;

    try {
      // 🔥 Get vendor safely
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        log.error(`Status Post error for ${vendorId}: Vendor not found`);
        req.flash("error", "Vendor not found");
        return res.redirect("/dashboard/products");
      }

      // 🔥 Get product
      const product = await Product.findOne({
        _id: productId,
        vendor: vendorId,
      });

      if (!product) {
        log.error(`Status Post error for ${vendorId}: Product not found`);
        req.flash("error", "Product not found");
        return res.redirect("/dashboard/products");
      }

      if (!product.image) {
        log.error(`Status Post error for ${vendorId}: Product image missing`);
        req.flash("error", "Product image is required to post status");
        return res.redirect("/dashboard/products");
      }

      // 🔥 WhatsApp session
      const client = getClient(vendorId);

      if (!client) {
        await createSession(vendorId);
        req.flash("error", "WhatsApp initializing...");
        return res.redirect("/dashboard/products");
      }

      const productImagePath = path.join(
        __dirname,
        `../vendor-product-imgs/${vendor.businessName}/${product.image}`,
      );

      if (!fs.existsSync(productImagePath)) {
        log.error(
          `Status Post error for ${vendorId}: Product image file not found`,
        );
        req.flash("error", "Product image file not found on server");
        return res.redirect("/dashboard/products");
      }

      const optimizedPath = path.join(
        __dirname,
        `../temp/optimized-${product.image}`,
      );

      // 🔥 Resize & compress
      await optimizeImage(productImagePath, optimizedPath);

      // 🔥 Send optimized image
      const media = MessageMedia.fromFilePath(optimizedPath);

      const caption = `
🛍️ *${product.name}*

💰 ₦${product.price}

${product.description || ""}

Reply *buy* to order 🚀
    `;

      // 🔥 Send to status
      await client.sendMessage("status@broadcast", media, {
        caption,
      });

      // 🔥 Clean up temp file (important)
      fs.unlinkSync(optimizedPath);
      req.flash("success", "Product posted to WhatsApp status with image");
      return res.redirect("/dashboard/products");
    } catch (err) {
      log.error(`Status Post failed for ${vendorId}:`, err.message);
      req.flash("error", "Failed to post status");
      return res.redirect("/dashboard/products");
    }
  },
);

module.exports = router;

// API Routes for AJAX calls
router.delete("/:id", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const productId = req.params.id;

  try {
    const deleted = await Product.findOneAndDelete({
      _id: productId,
      vendor: vendorId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    log.error(`Delete product error for ${vendorId}:`, err.message);
    return res.status(500).json({ error: "Failed to delete product" });
  }
});

router.post("/:id/broadcast", verifyAuth.requireAuth, checkSubscription, limitGuard("broadcast"), async (req, res) => {
  const vendorId = req.user.id;
  const productId = req.params.id;

  try {
    const product = await Product.findOne({
      _id: productId,
      vendor: vendorId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const leads = await Lead.find({ vendor: vendorId, status: { $in: ["new", "pending", "contacted", "qualified"] } });

    if (!leads.length) {
      return res.status(400).json({ error: "No customers available for broadcast" });
    }

    const client = getClient(vendorId);
    if (!client) {
      return res.status(400).json({ error: "WhatsApp is not connected. Please connect first." });
    }

    const caption = `
🔥 *NEW PRODUCT ALERT*

🛍️ ${product.name}
💰 ₦${product.price}

${product.description || ""}

Reply *buy* to order now 🚀
    `;

    let success = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        await client.sendMessage(`${lead.customerNumber}@c.us`, caption);
        success++;
        await new Promise((r) => setTimeout(r, Math.random() * 2000 + 1000));
      } catch (err) {
        failed++;
      }
    }

    return res.json({ success: true, message: `Broadcast completed: ${success} sent, ${failed} failed` });
  } catch (err) {
    log.error(`Broadcast error for ${vendorId}:`, err.message);
    return res.status(500).json({ error: "Failed to broadcast product" });
  }
});

router.post("/:id/status", verifyAuth.requireAuth, checkSubscription, async (req, res) => {
  const vendorId = req.user.id;
  const productId = req.params.id;

  // Check if status posting is allowed
  if (!req.subscription.features.statusPosting) {
    return res.status(403).json({ error: "WhatsApp Status posting is not available on your plan. Upgrade to Pro!" });
  }

  try {
    const product = await Product.findOne({
      _id: productId,
      vendor: vendorId,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const client = getClient(vendorId);
    if (!client) {
      return res.status(400).json({ error: "WhatsApp is not connected. Please connect first." });
    }

    const vendor = await Vendor.findById(vendorId);
    const productImagePath = path.join(__dirname, `../vendor-product-imgs/${vendor.businessName}/${product.image}`);

    if (!fs.existsSync(productImagePath)) {
      return res.status(400).json({ error: "Product image file not found" });
    }

    const optimizedPath = path.join(__dirname, `../temp/optimized-${product.image}`);
    await optimizeImage(productImagePath, optimizedPath);

    const media = MessageMedia.fromFilePath(optimizedPath);
    const caption = `
🛍️ *${product.name}*

💰 ₦${product.price}

${product.description || ""}

Reply *buy* to order 🚀
    `;

    await client.sendMessage("status@broadcast", media, { caption });
    fs.unlinkSync(optimizedPath);

    return res.json({ success: true, message: "Posted to status successfully!" });
  } catch (err) {
    log.error(`Status Post error for ${vendorId}:`, err.message);
    return res.status(500).json({ error: "Failed to post to status" });
  }
});

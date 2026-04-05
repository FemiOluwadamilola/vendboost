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
const checkSubscription = require("../middlewares/checkSubscription");
// const WhatsAppSession = require("../models/WhatsappSession");
const { createSession, getSession } = require("../whatsapp/session");

// Create a product route
router.post("/new", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const vendor = Vendor.findOne({ _id: vendorId });
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
        if (extname !== ".jpg") {
          res
            .status(403)
            .json({ error_msg: "Only .jpg or .png files allowed..." });
        } else {
          cb(null, true);
        }
      },
    }).single("image");

    product(req, res, async (err) => {
      if (err) {
        log.error(`Product upload error for ${vendorId}:`, err.message);
      } else {
        const { name, price, description, discount } = req.body;
        if (!name || !price) {
          return res.status(400).json({
            message: "Product name and price are required",
          });
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
        res.status(201).json({
          message: "Product created successfully",
          product,
        });
      }
    });
  } catch (err) {
    log.error(`Create product error for ${vendorId}:`, err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// get a single product route
router.get("/single", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const product = await Product.findOne({
      _id: productId,
      vendor: vendorId,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    log.error(`Get product error for ${vendorId}:`, err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Product modification route
router.put("/update", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const updated = await Product.findOneAndUpdate(
      { _id: productId, vendor: vendorId },
      req.body,
      { new: true },
    );

    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product updated",
      product: updated,
    });
  } catch (err) {
    log.error(`Update product error for ${vendorId}:`, err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Product delete route
router.delete("/delete", verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const deleted = await Product.findOneAndDelete({
      _id: productId,
      vendor: vendorId,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted" });
  } catch (err) {
    log.error(`Delete product error for ${vendorId}:`, err.message);
    res.status(500).json({ message: "Server error" });
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
        return res.status(404).json({ message: "Product not found" });
      }

      if (!product.image) {
        return res.status(400).json({
          message: "Product image is required for broadcast",
        });
      }

      const leads = await Lead.find({ vendor: vendorId });

      if (!leads.length) {
        return res.status(400).json({
          message: "No customers available for broadcast",
        });
      }

      const client = getSession(vendorId);

      if (!client) {
        createSession(vendorId);
        return res.status(400).json({
          message: "WhatsApp initializing...",
        });
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
          log.error(
            `Failed for ${lead.customerNumber} for ${vendorId}:`,
            err.message,
          );
          failed++;
        }
      }

      // await incrementBroadcast(vendorId);

      res.json({
        message: "Broadcast completed",
        total: leads.length,
        success,
        failed,
      });
    } catch (err) {
      log.error(`Broadcast error for ${vendorId}:`, err.message);
      res.status(500).json({ message: "Server error" });
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
    const { productId } = req.query;

    try {
      // 🔥 Get vendor safely
      const vendor = await Vendor.findById(vendorId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }

      // 🔥 Get product
      const product = await Product.findOne({
        _id: productId,
        vendor: vendorId,
      });

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (!product.image) {
        return res.status(400).json({
          message: "Product image is required",
        });
      }

      // 🔥 WhatsApp session
      const client = getSession(vendorId);

      if (!client) {
        createSession(vendorId);
        return res.status(400).json({
          message: "WhatsApp initializing...",
        });
      }

      const productImagePath = path.join(
        __dirname,
        `../vendor-product-imgs/${vendor.businessName}/${product.image}`,
      );

      if (!fs.existsSync(productImagePath)) {
        return res.status(400).json({
          message: "Product image file not found on server",
        });
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

      return res.json({
        message: "Product posted to WhatsApp status with image",
      });
    } catch (err) {
      log.error(`Status Post failed for ${vendorId}:`, err.message);
      return res.status(500).json({
        message: "Failed to post status",
      });
    }
  },
);

module.exports = router;

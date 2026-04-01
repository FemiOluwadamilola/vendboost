const express = require('express');
const router = express.Router();
const { MessageMedia } = require('whatsapp-web.js');
const verifyAuth = require('../middlewares/verifyAuth');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');
const WhatsAppSession = require("../models/WhatsappSession");
const { createSession, getSession } = require('../whatsapp/session');


// Create a product route
router.post('/', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const { name, price, description, discount } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        message: "Product name and price are required"
      });
    }

    const product = new Product({
      vendor: vendorId,
      name,
      price,
      description,
      discount: discount || 1
    });

    await product.save();

    res.status(201).json({
      message: "Product created successfully",
      product
    });

  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Get all products routes
router.get('/', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;

  try {
    const products = await Product.find({ vendor: vendorId }).sort({ createdAt: -1 });
    res.json(products);

  } catch (err) {
    console.error("Fetch products error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// get a single product route
router.get('/single', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const product = await Product.findOne({
      _id: productId,
      vendor: vendorId
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);

  } catch (err) {
    console.error("Get product error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Product modification route
router.put('/update', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const updated = await Product.findOneAndUpdate(
      { _id: productId, vendor: vendorId },
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({
      message: "Product updated",
      product: updated
    });

  } catch (err) {
    console.error("Update product error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Product delete route
router.delete('/delete', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  if (!productId) {
    return res.status(400).json({ message: "productId is required" });
  }

  try {
    const deleted = await Product.findOneAndDelete({
      _id: productId,
      vendor: vendorId
    });

    if (!deleted) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted" });

  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// New Product Upload Broadcast route
router.post('/broadcast', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  try {
    const product = await Product.findOne({ _id: productId, vendor: vendorId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.image) {
      return res.status(400).json({
        message: "Product image is required for broadcast"
      });
    }

    const leads = await Lead.find({ vendor: vendorId });

    if (!leads.length) {
      return res.status(400).json({
        message: "No customers available for broadcast"
      });
    }

    const client = getSession(vendorId);

    if (!client) {
      createSession(vendorId);
      return res.status(400).json({
        message: "WhatsApp initializing..."
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
        await client.sendMessage(
          `${lead.customerNumber}@c.us`,
          media,
          { caption }
        );

        success++;

        // ⚠️ Anti-ban delay (VERY IMPORTANT)
        await new Promise(r => setTimeout(r, Math.random() * 2000 + 1000));

      } catch (err) {
        console.error(`Failed for ${lead.customerNumber}`, err.message);
        failed++;
      }
    }

    res.json({
      message: "Broadcast completed",
      total: leads.length,
      success,
      failed
    });

  } catch (err) {
    console.error("Broadcast error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// upload product to status route;
router.post('/post-status', verifyAuth.requireAuth, async (req, res) => {
  const vendorId = req.user.id;
  const { productId } = req.query;

  try {
    const product = await Product.findOne({ _id: productId, vendor: vendorId });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (!product.image) {
      return res.status(400).json({
        message: "Product image is required for status post"
      });
    }

    const client = getSession(vendorId);

    if (!client) {
      createSession(vendorId);
      return res.status(400).json({
        message: "WhatsApp initializing..."
      });
    }

    // 🔥 Convert image to WhatsApp media
    const media = await MessageMedia.fromUrl(product.image);

    const caption = `
🛍️ *${product.name}*

💰 ₦${product.price}

${product.description || ""}

Reply *buy* to order 🚀
    `;

    // 🔥 Send to status
    await client.sendMessage("status@broadcast", media, {
      caption
    });

    res.json({ message: "Product posted to WhatsApp status with image" });

  } catch (err) {
    console.error("Status post error:", err);
    res.status(500).json({ message: "Failed to post status" });
  }
});

module.exports = router;
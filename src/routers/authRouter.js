const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

const router = express.Router();

// 🔐 Generate JWT Token
const generateToken = (vendor) => {
  return jwt.sign(
    { id: vendor._id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Test route
router.get('/', (req, res) => {
  res.send('Auth route working');
});


// =========================
// SIGNUP ROUTE
// =========================
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ email });

    if (existingVendor) {
      return res.status(409).json({
        message: 'Oops! This email is already in use.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new vendor
    const newVendor = new Vendor({
      email,
      password: hashedPassword,
    });

    await newVendor.save();

    // Generate token
    const token = generateToken(newVendor);

    res.status(201).json({
      message: 'Vendor account created successfully!',
      token,
      vendor: {
        id: newVendor._id,
        email: newVendor.email,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
});


// =========================
// SIGNIN ROUTE
// =========================
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required',
      });
    }

    // Check if vendor exists
    const vendor = await Vendor.findOne({ email });

    if (!vendor) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, vendor.password);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password',
      });
    }

    // Generate JWT
    const token = generateToken(vendor);

    res.status(200).json({
      message: 'Login successful',
      token,
      vendor: {
        id: vendor._id,
        email: vendor.email,
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
});

module.exports = router;
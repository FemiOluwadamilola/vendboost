const express = require('express');
const bcrypt = require('bcryptjs');
const Vendor = require('../models/Vendor');
const router = express.Router();
router.post('/signup', async (req, res) => {
  try {
    const { name, business_type, businessName, email, password } = req.body;

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
      name,
      business_type,
      email,
      businessName,
      password: hashedPassword,
    });

    await newVendor.save();
    res.status(201).json({
      message: 'Vendor registered successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Server error. Please try again later.',
    });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', {
        error: 'Email and password are required'
      });
    }

    const vendor = await Vendor.findOne({ email });

    if (!vendor) {
      return res.render('login', {
        error: 'Invalid email or password'
      });
    }

    const isMatch = await bcrypt.compare(password, vendor.password);

    if (!isMatch) {
      return res.render('login', {
        error: 'Invalid email or password'
      });
    }

    // Optional: account status check
    if (vendor.status && vendor.status !== "active") {
      return res.render('login', {
        error: 'Account is not active'
      });
    }

    // 🔐 Secure session creation
    req.session.regenerate((err) => {
      if (err) {
        console.error("Session error:", err);
        return res.render('/signin', {
          error: 'Something went wrong. Try again.'
        });
      }

      req.session.user = {
        id: vendor._id,
        role: vendor.role
      };

      // Optional: login tracking
      req.session.loginTime = Date.now();

      return res.redirect('/dashboard');
    });

  } catch (err) {
    console.error(err);

    return res.render('login', {
      error: 'Server error. Please try again later.'
    });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: 'Logout failed. Please try again.',
      });
    }
    res.clearCookie('vendboost.sid');
    res.redirect('/signin');
  })
});

module.exports = router;
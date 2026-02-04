const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const signToken = (id) => jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, vendorName } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }
    const isAdmin = role === 'admin';
    const user = await User.create({
      name,
      email,
      password,
      role: isAdmin ? 'admin' : 'vendor',
      vendorName: vendorName || undefined,
      approvalStatus: isAdmin ? 'approved' : 'pending',
    });
    const token = signToken(user._id);
    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        vendorName: user.vendorName,
        approvalStatus: user.approvalStatus,
        branchId: user.branchId?._id || user.branchId || null,
        branchName: user.branchId?.name || null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Registration failed.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated.' });
    }
    const u = await User.findById(user._id).populate('branchId', 'name').select('-password').lean();
    const branchId = u.branchId?._id || u.branchId || null;
    const branchName = u.branchId?.name || null;
    const userPayload = {
      id: u._id,
      name: u.name,
      email: u.email,
      role: u.role,
      vendorName: u.vendorName,
      approvalStatus: u.approvalStatus || (u.role === 'admin' ? 'approved' : 'pending'),
      branchId,
      branchName,
    };
    if (user.role === 'vendor' && user.approvalStatus !== 'approved') {
      const token = signToken(user._id);
      return res.json({ success: true, token, user: userPayload });
    }
    const token = signToken(user._id);
    res.json({ success: true, token, user: userPayload });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Login failed.' });
  }
});

router.get('/me', protect, (req, res) => {
  const approvalStatus = req.user.role === 'admin' ? 'approved' : (req.user.approvalStatus || 'pending');
  const branchId = req.user.branchId?._id || req.user.branchId || null;
  const branchName = req.user.branchId?.name || null;
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      vendorName: req.user.vendorName,
      approvalStatus,
      branchId,
      branchName,
    },
  });
});

// Update own profile (name, email, vendorName for vendor)
router.patch('/profile', protect, async (req, res) => {
  try {
    const { name, email, vendorName } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (name !== undefined) user.name = name;
    if (email !== undefined) {
      if (email && email !== user.email) {
        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ success: false, message: 'Email already in use.' });
        user.email = email;
      }
    }
    if (req.user.role === 'vendor' && vendorName !== undefined) user.vendorName = vendorName || '';
    await user.save();
    const u = await User.findById(user._id).populate('branchId', 'name').select('-password').lean();
    const branchId = u.branchId?._id || u.branchId || null;
    const branchName = u.branchId?.name || null;
    res.json({
      success: true,
      user: {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        vendorName: u.vendorName,
        approvalStatus: u.role === 'admin' ? 'approved' : (u.approvalStatus || 'pending'),
        branchId,
        branchName,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update profile.' });
  }
});

// Change own password
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findById(req.user._id).select('+password');
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update password.' });
  }
});

module.exports = router;

const express = require('express');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

/** GET /api/settings - get system settings (admin only) */
router.get('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    let doc = await Settings.findOne().lean();
    if (!doc) {
      doc = await Settings.create({});
      doc = doc.toObject();
    }
    res.json({
      success: true,
      settings: {
        revenuePercentage: doc.revenuePercentage ?? 10,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch settings.' });
  }
});

/** PATCH /api/settings - update system settings (admin only) */
router.patch('/', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only.' });
    }
    const { revenuePercentage } = req.body;
    const update = {};
    if (typeof revenuePercentage === 'number' && revenuePercentage >= 0 && revenuePercentage <= 100) {
      update.revenuePercentage = revenuePercentage;
    } else if (typeof revenuePercentage === 'string') {
      const n = parseFloat(revenuePercentage);
      if (!Number.isNaN(n) && n >= 0 && n <= 100) update.revenuePercentage = n;
    }
    const doc = await Settings.findOneAndUpdate(
      {},
      { $set: update },
      { new: true, upsert: true }
    ).lean();
    res.json({
      success: true,
      settings: {
        revenuePercentage: doc.revenuePercentage ?? 10,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update settings.' });
  }
});

module.exports = router;

const express = require('express');
const MembershipType = require('../models/MembershipType');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const types = await MembershipType.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({
      success: true,
      membershipTypes: types.map((t) => ({
        id: t._id,
        name: t.name,
        totalCredits: t.totalCredits,
        price: t.price,
        serviceCategory: t.serviceCategory,
        validityDays: t.validityDays,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch membership types.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, totalCredits, price, serviceCategory, validityDays } = req.body;
    if (!name || totalCredits == null)
      return res.status(400).json({ success: false, message: 'Name and totalCredits are required.' });
    const type = await MembershipType.create({
      name,
      totalCredits: Number(totalCredits),
      price: price != null ? Number(price) : 0,
      serviceCategory: serviceCategory || undefined,
      validityDays: validityDays != null ? Number(validityDays) : undefined,
    });
    res.status(201).json({
      success: true,
      membershipType: {
        id: type._id,
        name: type.name,
        totalCredits: type.totalCredits,
        price: type.price,
        serviceCategory: type.serviceCategory,
        validityDays: type.validityDays,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create membership type.' });
  }
});

module.exports = router;

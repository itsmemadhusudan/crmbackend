const express = require('express');
const mongoose = require('mongoose');
const Package = require('../models/Package');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(protect);

/** GET /api/packages - list packages. Default: active only (dropdown). ?all=true for admin: all */
router.get('/', async (req, res) => {
  try {
    const all = req.query.all === 'true' && req.user?.role === 'admin';
    const filter = all ? {} : { isActive: true };
    const list = await Package.find(filter).sort({ name: 1 }).lean();
    res.json({
      success: true,
      packages: list.map((p) => ({ id: p._id, name: p.name, price: p.price, isActive: p.isActive })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch packages.' });
  }
});

/** POST /api/packages - create (admin only) */
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return res.status(400).json({ success: false, message: 'Price must be a non-negative number.' });
    }
    const pkg = await Package.create({
      name: String(name).trim(),
      price: numPrice,
    });
    res.status(201).json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create package.' });
  }
});

/** PATCH /api/packages/:id - update (admin only) */
router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const pkg = await Package.findById(id);
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    const { name, price, isActive } = req.body;
    if (name !== undefined) pkg.name = String(name).trim();
    if (price !== undefined) {
      const num = Number(price);
      if (!isNaN(num) && num >= 0) pkg.price = num;
    }
    if (isActive !== undefined) pkg.isActive = !!isActive;
    await pkg.save();
    res.json({
      success: true,
      package: { id: pkg._id, name: pkg.name, price: pkg.price, isActive: pkg.isActive },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update package.' });
  }
});

/** DELETE /api/packages/:id - soft delete (admin only) */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const pkg = await Package.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!pkg) return res.status(404).json({ success: false, message: 'Package not found.' });
    res.json({ success: true, message: 'Package removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete package.' });
  }
});

module.exports = router;

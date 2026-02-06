const express = require('express');
const Branch = require('../models/Branch');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const allForSelection = req.query.all === '1' || req.query.all === 'true';
    if (req.user.role === 'vendor' && !allForSelection && bid) {
      const branch = await Branch.findById(bid).lean();
      if (!branch) return res.json({ success: true, branches: [] });
      return res.json({
        success: true,
        branches: [{ id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode }],
      });
    }
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({
      success: true,
      branches: branches.map((b) => ({ id: b._id, name: b.name, code: b.code, address: b.address, zipCode: b.zipCode })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch branches.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, code, address, zipCode } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required.' });
    const branch = await Branch.create({ name, code: code || undefined, address: address || undefined, zipCode: zipCode || undefined });
    res.status(201).json({
      success: true,
      branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create branch.' });
  }
});

router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const allowed = ['name', 'code', 'address', 'zipCode'];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const branch = await Branch.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address, zipCode: branch.zipCode } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update branch.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, message: 'Branch deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete branch.' });
  }
});

module.exports = router;

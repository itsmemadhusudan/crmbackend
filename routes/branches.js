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
    if (req.user.role === 'vendor') {
      const allForSelection = req.query.all === '1' || req.query.all === 'true';
      if (allForSelection || !bid) {
        const allBranches = await Branch.find({ isActive: true }).sort({ name: 1 }).lean();
        const currentUserId = req.user._id.toString();
        const assigned = await User.find({ role: 'vendor', branchId: { $ne: null } })
          .select('branchId')
          .lean();
        const takenByOthers = new Set(
          assigned
            .filter((u) => u.branchId && u._id.toString() !== currentUserId)
            .map((u) => (u.branchId && u.branchId._id ? u.branchId._id.toString() : u.branchId.toString()))
        );
        const myBranchId = bid ? bid.toString() : null;
        const available = allBranches.filter(
          (b) => !takenByOthers.has(b._id.toString()) || b._id.toString() === myBranchId
        );
        return res.json({
          success: true,
          branches: available.map((b) => ({ id: b._id, name: b.name, code: b.code, address: b.address })),
        });
      }
      const branch = await Branch.findById(bid).lean();
      if (!branch) return res.json({ success: true, branches: [] });
      return res.json({
        success: true,
        branches: [{ id: branch._id, name: branch.name, code: branch.code, address: branch.address }],
      });
    }
    const branches = await Branch.find({ isActive: true }).sort({ name: 1 }).lean();
    res.json({
      success: true,
      branches: branches.map((b) => ({ id: b._id, name: b.name, code: b.code, address: b.address })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch branches.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, code, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Branch name is required.' });
    const branch = await Branch.create({ name, code, address });
    res.status(201).json({
      success: true,
      branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create branch.' });
  }
});

router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const branch = await Branch.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).lean();
    if (!branch) return res.status(404).json({ success: false, message: 'Branch not found.' });
    res.json({ success: true, branch: { id: branch._id, name: branch.name, code: branch.code, address: branch.address } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update branch.' });
  }
});

module.exports = router;

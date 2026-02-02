const express = require('express');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { role: 'vendor' };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.approvalStatus = status;
    }
    const vendors = await User.find(filter)
      .select('name email vendorName approvalStatus branchId createdAt')
      .populate('branchId', 'name code')
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      vendors: vendors.map((v) => ({
        id: v._id,
        name: v.name,
        email: v.email,
        vendorName: v.vendorName,
        approvalStatus: v.approvalStatus || 'pending',
        branchId: v.branchId?._id || v.branchId,
        branchName: v.branchId?.name,
        createdAt: v.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch vendors.' });
  }
});

router.patch('/:id/approve', async (req, res) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }
    vendor.approvalStatus = 'approved';
    await vendor.save();
    res.json({
      success: true,
      message: 'Vendor approved.',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        vendorName: vendor.vendorName,
        approvalStatus: vendor.approvalStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to approve vendor.' });
  }
});

router.patch('/:id/reject', async (req, res) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found.' });
    }
    vendor.approvalStatus = 'rejected';
    await vendor.save();
    res.json({
      success: true,
      message: 'Vendor rejected.',
      vendor: {
        id: vendor._id,
        name: vendor.name,
        email: vendor.email,
        vendorName: vendor.vendorName,
        approvalStatus: vendor.approvalStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to reject vendor.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const vendor = await User.findOne({ _id: req.params.id, role: 'vendor' });
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found.' });
    if (req.body.branchId !== undefined) vendor.branchId = req.body.branchId || null;
    await vendor.save();
    const v = await User.findById(vendor._id).select('name email vendorName approvalStatus branchId').populate('branchId', 'name').lean();
    res.json({
      success: true,
      vendor: {
        id: v._id,
        name: v.name,
        email: v.email,
        vendorName: v.vendorName,
        approvalStatus: v.approvalStatus,
        branchId: v.branchId?._id,
        branchName: v.branchId?.name,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update vendor.' });
  }
});

module.exports = router;

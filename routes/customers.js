const express = require('express');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const filter = bid ? { primaryBranchId: bid } : {};
    const customers = await Customer.find(filter).populate('primaryBranchId', 'name').sort({ name: 1 }).lean();
    res.json({
      success: true,
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
        primaryBranch: c.primaryBranchId?.name,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, membershipCardId, primaryBranchId, notes } = req.body;
    if (!name || !phone)
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    const bid = req.user.role === 'admin' ? primaryBranchId : (req.user.branchId?._id || req.user.branchId);
    const customer = await Customer.create({
      name,
      phone,
      email: email || undefined,
      membershipCardId: membershipCardId || undefined,
      primaryBranchId: bid || primaryBranchId,
      notes: notes || undefined,
    });
    const c = await Customer.findById(customer._id).populate('primaryBranchId', 'name').lean();
    res.status(201).json({
      success: true,
      customer: {
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
        primaryBranch: c.primaryBranchId?.name,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create customer.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id).populate('primaryBranchId', 'name').lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranch: customer.primaryBranchId?.name,
        notes: customer.notes,
        createdAt: customer.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customer.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('primaryBranchId', 'name')
      .lean();
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranch: customer.primaryBranchId?.name,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer.' });
  }
});

module.exports = router;

const express = require('express');
const Customer = require('../models/Customer');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    let filter = {};
    if (req.user.role === 'vendor') {
      if (!bid) filter = { _id: { $in: [] } };
      else filter = { primaryBranchId: bid };
    } else if (bid) filter = { primaryBranchId: bid };
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
        customerPackage: c.customerPackage,
        customerPackagePrice: c.customerPackagePrice,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, membershipCardId, primaryBranchId, customerPackage, customerPackagePrice, notes } = req.body;
    if (!name || !phone)
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    const bid = req.user.role === 'admin' ? primaryBranchId : (req.user.branchId?._id || req.user.branchId);
    const customer = await Customer.create({
      name,
      phone,
      email: email || undefined,
      membershipCardId: membershipCardId || undefined,
      primaryBranchId: bid || primaryBranchId,
      customerPackage: customerPackage || undefined,
      customerPackagePrice: customerPackagePrice != null && customerPackagePrice !== '' ? Number(customerPackagePrice) : undefined,
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
        customerPackage: c.customerPackage,
        customerPackagePrice: c.customerPackagePrice,
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
    const bid = getBranchId(req.user);
    if (bid && String(customer.primaryBranchId?._id || customer.primaryBranchId) !== String(bid)) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranch: customer.primaryBranchId?.name,
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
        notes: customer.notes,
        createdAt: customer.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customer.' });
  }
});

router.get('/:id/visit-history', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const bid = getBranchId(req.user);
    if (bid && String(customer.primaryBranchId) !== String(bid)) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }

    const membershipIds = await Membership.find({ customerId: req.params.id }).distinct('_id');

    const [appointments, usageList] = await Promise.all([
      Appointment.find({ customerId: req.params.id, status: 'completed' })
        .populate('branchId', 'name')
        .populate('staffUserId', 'name')
        .populate('serviceId', 'name')
        .sort({ scheduledAt: -1 })
        .limit(200)
        .lean(),
      membershipIds.length
        ? MembershipUsage.find({ membershipId: { $in: membershipIds } })
            .populate('usedAtBranchId', 'name')
            .populate('usedByUserId', 'name')
            .sort({ usedAt: -1 })
            .limit(200)
            .lean()
        : [],
    ]);

    const timeline = [
      ...appointments.map((a) => ({
        type: 'appointment',
        id: a._id,
        date: a.scheduledAt,
        service: a.serviceId?.name,
        branch: a.branchId?.name,
        branchId: a.branchId?._id,
        staff: a.staffUserId?.name,
      })),
      ...usageList.map((u) => ({
        type: 'membership_usage',
        id: u._id,
        date: u.usedAt,
        service: 'Membership service',
        branch: u.usedAtBranchId?.name,
        branchId: u.usedAtBranchId?._id,
        staff: u.usedByUserId?.name,
        creditsUsed: u.creditsUsed,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, visitHistory: timeline });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch visit history.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await Customer.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, message: 'Customer not found.' });
    const bid = getBranchId(req.user);
    if (bid && String(existing.primaryBranchId) !== String(bid)) {
      return res.status(404).json({ success: false, message: 'Customer not found.' });
    }
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
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer.' });
  }
});

module.exports = router;

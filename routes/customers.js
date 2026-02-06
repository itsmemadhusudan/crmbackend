const express = require('express');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

/** Generate next card ID for a branch: prefix (first 3 letters of branch name) + 5-digit sequence, e.g. tes-00001 */
async function generateCardId(primaryBranchId) {
  let prefix = 'gen';
  let filter = { membershipCardId: { $regex: /^gen-\d+$/ } };
  if (primaryBranchId) {
    const branch = await Branch.findById(primaryBranchId).select('name').lean();
    if (branch && branch.name) {
      const letters = branch.name.replace(/[^a-zA-Z]/g, '').toLowerCase().slice(0, 3);
      prefix = letters || 'brn';
    }
    filter = { primaryBranchId, membershipCardId: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-\\d+$`) };
  }
  const existing = await Customer.find(filter).select('membershipCardId').lean();
  let maxNum = 0;
  for (const c of existing) {
    const match = (c.membershipCardId || '').match(/-(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  const nextNum = maxNum + 1;
  return `${prefix}-${String(nextNum).padStart(5, '0')}`;
}

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    let filter = {};
    if (req.user.role === 'vendor') {
      filter = { createdBy: req.user._id };
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
        customerPackageExpiry: c.customerPackageExpiry ? c.customerPackageExpiry.toISOString().split('T')[0] : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch customers.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, primaryBranchId, customerPackage, customerPackagePrice, customerPackageExpiry, notes } = req.body;
    if (!name || !phone)
      return res.status(400).json({ success: false, message: 'Name and phone are required.' });
    const bid = req.user.role === 'admin' ? primaryBranchId : (req.user.branchId?._id || req.user.branchId);
    const resolvedBranchId = bid || primaryBranchId || null;
    const membershipCardId = await generateCardId(resolvedBranchId);
    const customer = await Customer.create({
      name,
      phone,
      email: email || undefined,
      membershipCardId,
      primaryBranchId: resolvedBranchId,
      createdBy: req.user._id,
      customerPackage: customerPackage || undefined,
      customerPackagePrice: customerPackagePrice != null && customerPackagePrice !== '' ? Number(customerPackagePrice) : undefined,
      customerPackageExpiry: customerPackageExpiry ? new Date(customerPackageExpiry) : undefined,
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
        customerPackageExpiry: c.customerPackageExpiry ? c.customerPackageExpiry.toISOString().split('T')[0] : null,
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
    if (req.user.role === 'vendor') {
      if (!customer.createdBy || String(customer.createdBy) !== String(req.user._id)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
    } else {
      const bid = getBranchId(req.user);
      if (bid && String(customer.primaryBranchId?._id || customer.primaryBranchId) !== String(bid)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
    }
    res.json({
      success: true,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        membershipCardId: customer.membershipCardId,
        primaryBranchId: customer.primaryBranchId?._id?.toString() || customer.primaryBranchId?.toString() || null,
        primaryBranch: customer.primaryBranchId?.name,
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
        customerPackageExpiry: customer.customerPackageExpiry ? customer.customerPackageExpiry.toISOString().split('T')[0] : null,
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
    if (req.user.role === 'vendor') {
      if (!customer.createdBy || String(customer.createdBy) !== String(req.user._id)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
    } else {
      const bid = getBranchId(req.user);
      if (bid && String(customer.primaryBranchId) !== String(bid)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
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
    if (req.user.role === 'vendor') {
      if (!existing.createdBy || String(existing.createdBy) !== String(req.user._id)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
    } else {
      const bid = getBranchId(req.user);
      if (bid && String(existing.primaryBranchId) !== String(bid)) {
        return res.status(404).json({ success: false, message: 'Customer not found.' });
      }
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
        primaryBranchId: customer.primaryBranchId?._id?.toString() || customer.primaryBranchId?.toString() || null,
        primaryBranch: customer.primaryBranchId?.name,
        customerPackage: customer.customerPackage,
        customerPackagePrice: customer.customerPackagePrice,
        customerPackageExpiry: customer.customerPackageExpiry ? customer.customerPackageExpiry.toISOString().split('T')[0] : null,
        notes: customer.notes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update customer.' });
  }
});

module.exports = router;

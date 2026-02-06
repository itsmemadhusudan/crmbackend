const express = require('express');
const Membership = require('../models/Membership');
const MembershipType = require('../models/MembershipType');
const MembershipUsage = require('../models/MembershipUsage');
const InternalSettlement = require('../models/InternalSettlement');
const Settings = require('../models/Settings');
const AuditLog = require('../models/AuditLog');
const Customer = require('../models/Customer');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

async function getDefaultMembershipTypeId() {
  let type = await MembershipType.findOne({ isActive: true }).sort({ name: 1 }).lean();
  if (!type) {
    type = await MembershipType.create({ name: 'Default', totalCredits: 1 });
  }
  return type._id;
}

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { branchId, customerId, status } = req.query;
    const bid = getBranchId(req.user);
    const filter = {};
    if (req.user.role === 'admin') {
      if (branchId) filter.soldAtBranchId = branchId;
    } else if (req.user.role === 'vendor') {
      if (!bid) filter._id = { $in: [] };
      else filter.soldAtBranchId = bid;
    }
    if (customerId) filter.customerId = customerId;
    if (status) filter.status = status;

    const memberships = await Membership.find(filter)
      .populate('customerId', 'name phone email membershipCardId')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      memberships: memberships.map((m) => ({
        id: m._id,
        customer: m.customerId
          ? { id: m.customerId._id, name: m.customerId.name, phone: m.customerId.phone, email: m.customerId.email, membershipCardId: m.customerId.membershipCardId }
          : null,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        soldAtBranchId: m.soldAtBranchId?._id,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch memberships.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customerId, membershipTypeId, totalCredits, soldAtBranchId, expiryDate, customerPackage, customerPackagePrice, customerPackageExpiry, discountAmount } = req.body;
    if (!customerId || totalCredits == null)
      return res.status(400).json({ success: false, message: 'customerId and totalCredits are required.' });
    const bid = getBranchId(req.user);
    const soldAt = req.user.role === 'admin' ? soldAtBranchId : (bid || soldAtBranchId);
    if (!soldAt) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const packagePrice = customerPackagePrice != null && customerPackagePrice !== '' ? Number(customerPackagePrice) : undefined;
    const discount = discountAmount != null && discountAmount !== '' ? Math.max(0, Number(discountAmount)) : 0;
    const packageName = customerPackage && String(customerPackage).trim() ? String(customerPackage).trim() : undefined;
    const typeId = membershipTypeId || await getDefaultMembershipTypeId();
    const membership = await Membership.create({
      customerId,
      membershipTypeId: typeId,
      totalCredits: Number(totalCredits),
      usedCredits: 0,
      soldAtBranchId: soldAt,
      status: 'active',
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      packagePrice,
      discountAmount: discount,
      packageName,
    });

    const effectivePrice = (packagePrice != null ? packagePrice : 0) - discount;

    if (customerPackage != null || customerPackageExpiry != null) {
      const customerUpdates = {};
      if (customerPackage !== undefined) customerUpdates.customerPackage = customerPackage || null;
      if (customerPackagePrice != null && customerPackagePrice !== '') customerUpdates.customerPackagePrice = effectivePrice;
      if (customerPackageExpiry !== undefined) customerUpdates.customerPackageExpiry = customerPackageExpiry ? new Date(customerPackageExpiry) : null;
      if (Object.keys(customerUpdates).length > 0) {
        await Customer.findByIdAndUpdate(customerId, customerUpdates);
      }
    }

    const m = await Membership.findById(membership._id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      membership: {
        id: m._id,
        customer: m.customerId ? { id: m.customerId._id, name: m.customerId.name, phone: m.customerId.phone } : null,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        purchaseDate: m.purchaseDate,
        expiryDate: m.expiryDate,
        status: m.status,
        packagePrice: m.packagePrice,
        discountAmount: m.discountAmount ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create membership.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id)
      .populate('customerId', 'name phone email membershipCardId')
      .populate('membershipTypeId', 'name totalCredits serviceCategory')
      .populate('soldAtBranchId', 'name')
      .lean();
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const usages = await MembershipUsage.find({ membershipId: membership._id })
      .populate('usedAtBranchId', 'name')
      .populate('usedByUserId', 'name')
      .sort({ usedAt: -1 })
      .lean();

    res.json({
      success: true,
      membership: {
        id: membership._id,
        customer: membership.customerId,
        typeName: membership.membershipTypeId?.name,
        totalCredits: membership.totalCredits,
        usedCredits: membership.usedCredits,
        remainingCredits: membership.totalCredits - membership.usedCredits,
        soldAtBranch: membership.soldAtBranchId?.name,
        soldAtBranchId: membership.soldAtBranchId?._id?.toString(),
        purchaseDate: membership.purchaseDate,
        expiryDate: membership.expiryDate,
        status: membership.status,
        packagePrice: membership.packagePrice,
        discountAmount: membership.discountAmount ?? 0,
      },
      usageHistory: usages.map((u) => ({
        id: u._id,
        usedAtBranch: u.usedAtBranchId?.name,
        usedBy: u.usedByUserId?.name,
        creditsUsed: u.creditsUsed,
        usedAt: u.usedAt,
        notes: u.notes,
        serviceDetails: u.serviceDetails,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch membership.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id);
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const allowed = ['usedCredits', 'status', 'expiryDate'];
    const updates = {};
    allowed.forEach((k) => {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    });
    if (Object.keys(updates).length === 0)
      return res.status(400).json({ success: false, message: 'No allowed fields to update.' });

    const previous = { usedCredits: membership.usedCredits, status: membership.status };
    Object.assign(membership, updates);
    await membership.save();

    if (req.user.role === 'admin' && (updates.usedCredits !== undefined || updates.status !== undefined)) {
      await AuditLog.create({
        entity: 'Membership',
        entityId: membership._id,
        action: 'admin_edit',
        userId: req.user._id,
        changes: { previous, updates },
      });
    }

    const m = await Membership.findById(membership._id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.json({
      success: true,
      membership: {
        id: m._id,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        status: m.status,
        expiryDate: m.expiryDate,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update membership.' });
  }
});

router.post('/:id/use', async (req, res) => {
  try {
    const { creditsUsed = 1, notes, serviceDetails } = req.body;
    const bid = getBranchId(req.user);
    const usedAtBranchId = bid || req.body.usedAtBranchId;
    if (!usedAtBranchId) return res.status(400).json({ success: false, message: 'Branch (used at) is required.' });

    const membership = await Membership.findById(req.params.id)
      .populate('customerId', 'name phone')
      .populate('membershipTypeId', 'name price totalCredits')
      .populate('soldAtBranchId', 'name');
    if (!membership) return res.status(404).json({ success: false, message: 'Membership not found.' });

    const toUse = Number(creditsUsed) || 1;
    const remaining = membership.totalCredits - membership.usedCredits;
    if (toUse > remaining)
      return res.status(400).json({ success: false, message: `Only ${remaining} credit(s) remaining.` });

    membership.usedCredits += toUse;
    if (membership.usedCredits >= membership.totalCredits) membership.status = 'used';
    await membership.save();

    const usage = await MembershipUsage.create({
      membershipId: membership._id,
      usedAtBranchId,
      usedByUserId: req.user._id,
      creditsUsed: toUse,
      notes: notes || undefined,
      serviceDetails: serviceDetails ? String(serviceDetails).trim() : undefined,
    });

    const soldAtBranchId = membership.soldAtBranchId._id || membership.soldAtBranchId;
    if (String(soldAtBranchId) !== String(usedAtBranchId)) {
      const settingsDoc = await Settings.findOne().lean();
      const settlementPercentage = settingsDoc?.settlementPercentage ?? 100;
      const multiplier = settlementPercentage / 100;
      const price = membership.membershipTypeId?.price != null ? Number(membership.membershipTypeId.price) : (membership.packagePrice != null ? Number(membership.packagePrice) : 0);
      const totalCredits = membership.totalCredits || 1;
      const baseAmount = totalCredits > 0 ? (price / totalCredits) * toUse : 0;
      const amount = Math.round(baseAmount * multiplier * 100) / 100;
      await InternalSettlement.create({
        fromBranchId: soldAtBranchId,
        toBranchId: usedAtBranchId,
        amount,
        reason: `Membership usage: ${membership.membershipTypeId?.name || 'Membership'} - ${toUse} credit(s)`,
        membershipUsageId: usage._id,
        status: 'pending',
      });
    }

    const u = await MembershipUsage.findById(usage._id)
      .populate('usedAtBranchId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      usage: {
        id: u._id,
        usedAtBranch: u.usedAtBranchId?.name,
        creditsUsed: u.creditsUsed,
        usedAt: u.usedAt,
        remainingCredits: membership.totalCredits - membership.usedCredits,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to record usage.' });
  }
});

module.exports = router;

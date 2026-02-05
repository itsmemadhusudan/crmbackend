const express = require('express');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const Customer = require('../models/Customer');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

async function getOrCreateAccount(customerId) {
  let account = await LoyaltyAccount.findOne({ customerId });
  if (!account) {
    account = await LoyaltyAccount.create({ customerId, points: 0 });
  }
  return account;
}

// GET /api/loyalty/insights — repeated customers + customers who upgrade membership (must be before /:customerId)
router.get('/insights', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const isAdmin = req.user.role === 'admin';

    let appointmentFilter = { status: 'completed' };
    let membershipFilter = {};
    if (bid) {
      appointmentFilter.branchId = bid;
      membershipFilter.soldAtBranchId = bid;
    }

    const [repeatedAgg, membershipAgg] = await Promise.all([
      Appointment.aggregate([
        { $match: appointmentFilter },
        { $group: { _id: '$customerId', visitCount: { $sum: 1 }, lastVisitAt: { $max: '$scheduledAt' } } },
        { $match: { visitCount: { $gte: 2 } } },
        { $sort: { visitCount: -1 } },
        { $limit: 100 },
      ]),
      Membership.aggregate([
        { $match: membershipFilter },
        { $group: { _id: '$customerId', membershipCount: { $sum: 1 }, lastPurchaseAt: { $max: '$purchaseDate' } } },
        { $match: { membershipCount: { $gte: 2 } } },
        { $sort: { membershipCount: -1 } },
        { $limit: 100 },
      ]),
    ]);

    const customerIds = [...new Set([...repeatedAgg.map((r) => r._id), ...membershipAgg.map((m) => m._id)])];
    const customers = await Customer.find({ _id: { $in: customerIds } }).lean();
    const customerMap = Object.fromEntries(customers.map((c) => [c._id.toString(), c]));

    const repeatedCustomers = repeatedAgg.map((r) => {
      const c = customerMap[r._id.toString()];
      return {
        customerId: r._id.toString(),
        customerName: c?.name ?? '—',
        phone: c?.phone ?? '—',
        visitCount: r.visitCount,
        lastVisitAt: r.lastVisitAt,
      };
    });

    const membershipUpgraders = membershipAgg.map((m) => {
      const c = customerMap[m._id.toString()];
      return {
        customerId: m._id.toString(),
        customerName: c?.name ?? '—',
        phone: c?.phone ?? '—',
        membershipCount: m.membershipCount,
        lastPurchaseAt: m.lastPurchaseAt,
      };
    });

    res.json({
      success: true,
      repeatedCustomers,
      membershipUpgraders,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch loyalty insights.' });
  }
});

router.get('/:customerId', async (req, res) => {
  try {
    const account = await getOrCreateAccount(req.params.customerId);
    const transactions = await LoyaltyTransaction.find({ customerId: req.params.customerId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('branchId', 'name')
      .lean();
    res.json({
      success: true,
      points: account.points,
      transactions: transactions.map((t) => ({
        id: t._id,
        points: t.points,
        type: t.type,
        reason: t.reason,
        branchName: t.branchId?.name,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch loyalty.' });
  }
});

router.post('/:customerId/earn', async (req, res) => {
  try {
    const { points, reason } = req.body;
    const toAdd = Math.abs(Number(points)) || 0;
    if (toAdd <= 0) return res.status(400).json({ success: false, message: 'Points must be positive.' });
    const bid = getBranchId(req.user);
    const account = await getOrCreateAccount(req.params.customerId);
    account.points += toAdd;
    await account.save();
    await LoyaltyTransaction.create({
      customerId: req.params.customerId,
      points: toAdd,
      type: 'earn',
      reason: reason || 'Visit / spend',
      branchId: bid,
      createdByUserId: req.user._id,
    });
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const Appointment = require('../models/Appointment');
const Membership = require('../models/Membership');
const Customer = require('../models/Customer');
const Branch = require('../models/Branch');

const router = express.Router();
router.use(protect);

/** GET /api/loyalty/insights - repeated customers (2+ completed appointments) and membership upgraders (2+ memberships) */
router.get('/insights', async (req, res) => {
  try {
    const repeated = await Appointment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: '$customerId', count: { $sum: 1 }, lastAt: { $max: '$scheduledAt' } } },
      { $match: { count: { $gte: 2 } } },
      { $sort: { lastAt: -1 } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'cust' } },
      { $unwind: '$cust' },
      {
        $project: {
          customerId: { $toString: '$_id' },
          customerName: '$cust.name',
          phone: '$cust.phone',
          visitCount: '$count',
          lastVisitAt: '$lastAt',
        },
      },
    ]);

    const upgraders = await Membership.aggregate([
      { $group: { _id: '$customerId', count: { $sum: 1 }, lastAt: { $max: '$purchaseDate' } } },
      { $match: { count: { $gte: 2 } } },
      { $sort: { lastAt: -1 } },
      { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'cust' } },
      { $unwind: '$cust' },
      {
        $project: {
          customerId: { $toString: '$_id' },
          customerName: '$cust.name',
          phone: '$cust.phone',
          membershipCount: '$count',
          lastPurchaseAt: '$lastAt',
        },
      },
    ]);

    res.json({
      success: true,
      repeatedCustomers: repeated.map((r) => ({
        customerId: r.customerId,
        customerName: r.customerName,
        phone: r.phone || '',
        visitCount: r.visitCount,
        lastVisitAt: r.lastVisitAt ? new Date(r.lastVisitAt).toISOString() : null,
      })),
      membershipUpgraders: upgraders.map((u) => ({
        customerId: u.customerId,
        customerName: u.customerName,
        phone: u.phone || '',
        membershipCount: u.membershipCount,
        lastPurchaseAt: u.lastPurchaseAt ? new Date(u.lastPurchaseAt).toISOString() : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load loyalty insights.' });
  }
});

/** GET /api/loyalty/:customerId - points and transactions */
router.get('/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }
    let account = await LoyaltyAccount.findOne({ customerId }).lean();
    if (!account) {
      account = { points: 0, transactions: [] };
    }
    const branchIds = [...new Set((account.transactions || []).map((t) => t.branchId).filter(Boolean))];
    const branches = branchIds.length ? await Branch.find({ _id: { $in: branchIds } }).select('name').lean() : [];
    const branchMap = Object.fromEntries(branches.map((b) => [String(b._id), b.name]));
    const transactions = (account.transactions || []).map((t) => ({
      id: t._id,
      points: t.points,
      type: t.type,
      reason: t.reason,
      branchName: t.branchId ? branchMap[String(t.branchId)] : undefined,
      createdAt: t.createdAt,
    })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({
      success: true,
      points: account.points ?? 0,
      transactions,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load loyalty.' });
  }
});

/** POST /api/loyalty/:customerId/earn */
router.post('/:customerId/earn', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { points, reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }
    const num = parseInt(points, 10);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ success: false, message: 'Points must be a positive number.' });
    }
    let account = await LoyaltyAccount.findOne({ customerId });
    if (!account) {
      account = await LoyaltyAccount.create({ customerId, points: 0, transactions: [] });
    }
    account.points += num;
    account.transactions = account.transactions || [];
    account.transactions.push({
      points: num,
      type: 'earn',
      reason: reason || undefined,
      branchId: req.user.branchId || undefined,
    });
    await account.save();
    res.json({ success: true, points: account.points });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add points.' });
  }
});

router.post('/:customerId/redeem', async (req, res) => {
  try {
    const { points, reason } = req.body;
    const toRedeem = Math.abs(Number(points)) || 0;
    if (toRedeem <= 0) return res.status(400).json({ success: false, message: 'Points must be positive.' });
    const bid = getBranchId(req.user);
    const account = await getOrCreateAccount(req.params.customerId);
    if (account.points < toRedeem) {
      return res.status(400).json({ success: false, message: `Insufficient points. Balance: ${account.points}` });
    }
    account.points -= toRedeem;
    await account.save();
    await LoyaltyTransaction.create({
      customerId: req.params.customerId,
      points: -toRedeem,
      type: 'redeem',
      reason: reason || 'Redemption',
      branchId: bid,
      createdByUserId: req.user._id,
    });
/** POST /api/loyalty/:customerId/redeem */
router.post('/:customerId/redeem', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { points, reason } = req.body;
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: 'Invalid customer ID.' });
    }
    const num = parseInt(points, 10);
    if (isNaN(num) || num <= 0) {
      return res.status(400).json({ success: false, message: 'Points must be a positive number.' });
    }
    let account = await LoyaltyAccount.findOne({ customerId });
    if (!account) {
      return res.status(400).json({ success: false, message: 'Insufficient points.' });
    }
    if (account.points < num) {
      return res.status(400).json({ success: false, message: 'Insufficient points.' });
    }
    account.points -= num;
    account.transactions = account.transactions || [];
    account.transactions.push({
      points: -num,
      type: 'redeem',
      reason: reason || undefined,
      branchId: req.user.branchId || undefined,
    });
    await account.save();
    res.json({ success: true, points: account.points });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to redeem points.' });
  }
});

module.exports = router;

const express = require('express');
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

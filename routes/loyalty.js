const express = require('express');
const LoyaltyAccount = require('../models/LoyaltyAccount');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');
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
    res.json({ success: true, points: account.points });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to redeem points.' });
  }
});

module.exports = router;

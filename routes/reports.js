const express = require('express');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const Lead = require('../models/Lead');
const InternalSettlement = require('../models/InternalSettlement');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/sales-dashboard', async (req, res) => {
  try {
    const { branchId, from, to, serviceCategory } = req.query;
    const bid = getBranchId(req.user);
    const branchFilter = bid ? { soldAtBranchId: bid } : {};
    if (req.user.role === 'admin' && branchId) branchFilter.soldAtBranchId = branchId;

    const fromDate = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const toDate = to ? new Date(to) : new Date();

    const memberships = await Membership.find({
      ...branchFilter,
      purchaseDate: { $gte: fromDate, $lte: toDate },
    })
      .populate('membershipTypeId', 'name totalCredits price serviceCategory')
      .populate('soldAtBranchId', 'name')
      .lean();

    let totalRevenue = 0;
    const byBranch = {};
    const byService = {};
    memberships.forEach((m) => {
      const price = m.membershipTypeId?.price || 0;
      totalRevenue += price;
      const bName = m.soldAtBranchId?.name || 'Unknown';
      byBranch[bName] = (byBranch[bName] || 0) + price;
      const cat = m.membershipTypeId?.serviceCategory || 'Other';
      if (serviceCategory && cat !== serviceCategory) return;
      byService[cat] = (byService[cat] || 0) + price;
    });

    const branches = await Branch.find({ isActive: true }).lean();
    res.json({
      success: true,
      from: fromDate,
      to: toDate,
      totalRevenue,
      byBranch: Object.entries(byBranch).map(([name, revenue]) => ({ branch: name, revenue })),
      byService: Object.entries(byService).map(([name, revenue]) => ({ serviceCategory: name, revenue })),
      totalMemberships: memberships.length,
      branches: branches.map((b) => ({ id: b._id, name: b.name })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Report failed.' });
  }
});

router.get('/settlements', async (req, res) => {
  try {
    const bid = getBranchId(req.user);
    const filter = {};
    if (bid) filter.$or = [{ fromBranchId: bid }, { toBranchId: bid }];

    const settlements = await InternalSettlement.find(filter)
      .populate('fromBranchId', 'name')
      .populate('toBranchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const summary = {};
    settlements.forEach((s) => {
      const fromName = s.fromBranchId?.name || s.fromBranchId;
      const toName = s.toBranchId?.name || s.toBranchId;
      const key = `${fromName}->${toName}`;
      summary[key] = (summary[key] || 0) + (s.amount || 0);
    });

    res.json({
      success: true,
      settlements: settlements.map((s) => ({
        id: s._id,
        fromBranch: s.fromBranchId?.name,
        toBranch: s.toBranchId?.name,
        amount: s.amount,
        reason: s.reason,
        status: s.status,
        createdAt: s.createdAt,
      })),
      summary: Object.entries(summary).map(([key, amount]) => {
        const [from, to] = key.split('->');
        return { from, to, amount };
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Settlements failed.' });
  }
});

router.get('/owner-overview', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Owner overview is for admin only.' });
    }

    const branches = await Branch.find({ isActive: true }).lean();
    const branchIds = branches.map((b) => b._id);

    const [membershipCounts, leadCounts, appointmentCounts] = await Promise.all([
      Membership.aggregate([{ $match: { soldAtBranchId: { $in: branchIds } } }, { $group: { _id: '$soldAtBranchId', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: { branchId: { $in: branchIds } } }, { $group: { _id: '$branchId', count: { $sum: 1 }, booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } } } }]),
      Appointment.aggregate([
        { $match: { branchId: { $in: branchIds }, scheduledAt: { $gte: new Date(new Date().setDate(1)) } } },
        { $group: { _id: '$branchId', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
    ]);

    const branchMap = {};
    branches.forEach((b) => (branchMap[b._id] = b.name));

    const overview = branches.map((b) => {
      const m = membershipCounts.find((x) => String(x._id) === String(b._id));
      const l = leadCounts.find((x) => String(x._id) === String(b._id));
      const a = appointmentCounts.find((x) => String(x._id) === String(b._id));
      return {
        branchId: b._id,
        branchName: b.name,
        membershipsSold: m?.count || 0,
        leads: l?.count || 0,
        leadsBooked: l?.booked || 0,
        appointmentsThisMonth: a?.count || 0,
        appointmentsCompleted: a?.completed || 0,
      };
    });

    res.json({ success: true, overview, branches: branches.map((b) => ({ id: b._id, name: b.name })) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Overview failed.' });
  }
});

module.exports = router;

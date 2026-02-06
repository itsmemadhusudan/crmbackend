const express = require('express');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Membership = require('../models/Membership');
const MembershipUsage = require('../models/MembershipUsage');
const Lead = require('../models/Lead');
const InternalSettlement = require('../models/InternalSettlement');
const Appointment = require('../models/Appointment');
const Customer = require('../models/Customer');
const Settings = require('../models/Settings');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

/** GET /api/reports/branch-dashboard - vendor branch dashboard (from/to, KPIs, today appointments, leads to follow up) */
router.get('/branch-dashboard', async (req, res) => {
  try {
    const { from, to } = req.query;
    const bid = getBranchId(req.user);

    const fromDate = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const toDate = to ? new Date(to) : new Date();

    if (!bid) {
      return res.json({
        success: true,
        from: fromDate,
        to: toDate,
        totalSales: 0,
        activeMembershipCount: 0,
        expiredMembershipCount: 0,
        usedMembershipCount: 0,
        customersCount: 0,
        membershipSalesCount: 0,
        membershipSalesRevenue: 0,
        todayAppointments: [],
        leadsToFollowUp: [],
        servicesCompleted: 0,
        membershipUsageInBranch: 0,
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [allMembershipsForBranch, membershipsInPeriod, todayAppointments, leadsToFollowUp, completedAppointments, usageInBranch, activeMembershipCount, expiredMembershipCount, usedMembershipCount, customersCount] = await Promise.all([
      Membership.find({ soldAtBranchId: bid }).select('packagePrice discountAmount membershipTypeId').populate('membershipTypeId', 'price').lean(),
      Membership.find({ soldAtBranchId: bid, purchaseDate: { $gte: fromDate, $lte: toDate } })
        .populate('membershipTypeId', 'name price')
        .lean(),
      Appointment.find({ branchId: bid, scheduledAt: { $gte: todayStart, $lte: todayEnd } })
        .populate('customerId', 'name phone')
        .populate('staffUserId', 'name')
        .populate('serviceId', 'name')
        .sort({ scheduledAt: 1 })
        .lean(),
      Lead.find({ branchId: bid, status: { $in: ['Follow up', 'Contacted', 'Call not Connected'] } })
        .sort({ updatedAt: -1 })
        .limit(20)
        .lean(),
      Appointment.countDocuments({ branchId: bid, status: 'completed', scheduledAt: { $gte: fromDate, $lte: toDate } }),
      MembershipUsage.find({ usedAtBranchId: bid, usedAt: { $gte: fromDate, $lte: toDate } })
        .populate('membershipId')
        .lean(),
      Membership.countDocuments({ soldAtBranchId: bid, status: 'active' }),
      Membership.countDocuments({ soldAtBranchId: bid, status: 'expired' }),
      Membership.countDocuments({ soldAtBranchId: bid, status: 'used' }),
      Customer.countDocuments({ primaryBranchId: bid }),
    ]);

    const effectivePrice = (m) => (m.packagePrice != null ? Number(m.packagePrice) : (m.membershipTypeId?.price || 0)) - (m.discountAmount ?? 0);
    let totalSales = 0;
    allMembershipsForBranch.forEach((m) => { totalSales += effectivePrice(m); });

    let membershipSalesRevenue = 0;
    membershipsInPeriod.forEach((m) => { membershipSalesRevenue += effectivePrice(m); });

    res.json({
      success: true,
      from: fromDate,
      to: toDate,
      totalSales,
      activeMembershipCount,
      expiredMembershipCount,
      usedMembershipCount,
      customersCount,
      membershipSalesCount: membershipsInPeriod.length,
      membershipSalesRevenue,
      todayAppointments: todayAppointments.map((a) => ({
        id: a._id,
        customer: a.customerId ? { name: a.customerId.name, phone: a.customerId.phone } : null,
        staff: a.staffUserId?.name,
        service: a.serviceId?.name,
        scheduledAt: a.scheduledAt,
        status: a.status,
      })),
      leadsToFollowUp: leadsToFollowUp.map((l) => ({
        id: l._id,
        name: l.name,
        phone: l.phone,
        status: l.status,
        updatedAt: l.updatedAt,
      })),
      servicesCompleted: completedAppointments,
      membershipUsageInBranch: usageInBranch.length,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Branch dashboard failed.' });
  }
});

router.get('/sales-dashboard', async (req, res) => {
  try {
    const { branchId, from, to, serviceCategory, breakdownPage, breakdownLimit } = req.query;
    const bid = getBranchId(req.user);
    let branchFilter = {};
    if (req.user.role === 'admin' && branchId) branchFilter = { soldAtBranchId: branchId };
    else if (req.user.role === 'vendor') {
      if (!bid) branchFilter = { soldAtBranchId: { $in: [] } };
      else branchFilter = { soldAtBranchId: bid };
    }

    const fromDate = from ? new Date(from) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const toDate = to ? new Date(to) : new Date();
    const page = Math.max(1, parseInt(breakdownPage, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(breakdownLimit, 10) || 10));
    const skip = (page - 1) * limit;

    const [memberships, allMembershipsForSales, activeMembershipCount, breakdownTotal, breakdownMemberships, settingsDoc] = await Promise.all([
      Membership.find({
        ...branchFilter,
        purchaseDate: { $gte: fromDate, $lte: toDate },
      })
        .populate('membershipTypeId', 'name totalCredits price serviceCategory')
        .populate('soldAtBranchId', 'name')
        .lean(),
      Membership.find(branchFilter).select('packagePrice discountAmount membershipTypeId').populate('membershipTypeId', 'price').lean(),
      Membership.countDocuments({ ...branchFilter, status: 'active' }),
      Membership.countDocuments(branchFilter),
      Membership.find(branchFilter)
        .populate('customerId', 'name customerPackage')
        .populate('membershipTypeId', 'name price')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Settings.findOne().lean(),
    ]);

    const revenuePercentage = settingsDoc?.revenuePercentage ?? 10;
    const revenueMultiplier = revenuePercentage / 100;

    const effectivePrice = (m) => (m.packagePrice != null ? Number(m.packagePrice) : (m.membershipTypeId?.price || 0)) - (m.discountAmount ?? 0);
    let totalSales = 0;
    allMembershipsForSales.forEach((m) => { totalSales += effectivePrice(m); });

    const byBranchSales = {};
    const byBranchCount = {};
    const byServiceSales = {};
    memberships.forEach((m) => {
      const price = effectivePrice(m);
      const bName = m.soldAtBranchId?.name || 'Unknown';
      byBranchSales[bName] = (byBranchSales[bName] || 0) + price;
      byBranchCount[bName] = (byBranchCount[bName] || 0) + 1;
      const cat = m.membershipTypeId?.serviceCategory || 'Other';
      if (serviceCategory && cat !== serviceCategory) return;
      byServiceSales[cat] = (byServiceSales[cat] || 0) + price;
    });

    const totalRevenue = totalSales * revenueMultiplier;
    const byBranch = Object.entries(byBranchSales).map(([name, sales]) => ({
      branch: name,
      sales: sales,
      revenue: sales * revenueMultiplier,
      membershipCount: byBranchCount[name] || 0,
    }));
    const byService = Object.entries(byServiceSales).map(([name, sales]) => ({
      serviceCategory: name,
      revenue: sales * revenueMultiplier,
    }));

    const breakdown = breakdownMemberships.map((m) => {
      const price = effectivePrice(m);
      return {
        customerName: m.customerId?.name || '—',
        packageName: m.packageName || m.customerId?.customerPackage || m.membershipTypeId?.name || '—',
        price,
      };
    });

    const branches = await Branch.find({ isActive: true }).lean();
    res.json({
      success: true,
      from: fromDate,
      to: toDate,
      totalRevenue,
      totalSales,
      revenuePercentage,
      activeMembershipCount,
      breakdown,
      breakdownTotal,
      breakdownPage: page,
      breakdownLimit: limit,
      byBranch,
      byService,
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
      .limit(500)
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

    const [membershipCounts, leadCounts, appointmentCounts, settlementSummary] = await Promise.all([
      Membership.aggregate([{ $match: { soldAtBranchId: { $in: branchIds } } }, { $group: { _id: '$soldAtBranchId', count: { $sum: 1 } } }]),
      Lead.aggregate([{ $match: { branchId: { $in: branchIds } } }, { $group: { _id: '$branchId', count: { $sum: 1 }, booked: { $sum: { $cond: [{ $eq: ['$status', 'Booked'] }, 1, 0] } } } }]),
      Appointment.aggregate([
        { $match: { branchId: { $in: branchIds }, scheduledAt: { $gte: new Date(new Date().setDate(1)) } } },
        { $group: { _id: '$branchId', count: { $sum: 1 }, completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } },
      ]),
      InternalSettlement.aggregate([
        { $match: { fromBranchId: { $in: branchIds }, toBranchId: { $in: branchIds } } },
        { $group: { _id: { from: '$fromBranchId', to: '$toBranchId' }, amount: { $sum: '$amount' } } },
      ]),
    ]);

    const branchMap = {};
    branches.forEach((b) => (branchMap[b._id] = b.name));

    const overview = branches.map((b) => {
      const m = membershipCounts.find((x) => String(x._id) === String(b._id));
      const l = leadCounts.find((x) => String(x._id) === String(b._id));
      const a = appointmentCounts.find((x) => String(x._id) === String(b._id));
      const totalLeads = l?.count || 0;
      const booked = l?.booked || 0;
      return {
        branchId: b._id,
        branchName: b.name,
        membershipsSold: m?.count || 0,
        leads: totalLeads,
        leadsBooked: booked,
        leadConversion: totalLeads > 0 ? Math.round((booked / totalLeads) * 100) : 0,
        appointmentsThisMonth: a?.count || 0,
        appointmentsCompleted: a?.completed || 0,
      };
    });

    const settlementSummaryList = settlementSummary.map((s) => ({
      fromBranch: branchMap[s._id.from] || s._id.from,
      toBranch: branchMap[s._id.to] || s._id.to,
      fromBranchId: s._id.from,
      toBranchId: s._id.to,
      amount: s.amount,
    }));

    res.json({
      success: true,
      overview,
      branches: branches.map((b) => ({ id: b._id, name: b.name })),
      settlementSummary: settlementSummaryList,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Overview failed.' });
  }
});

module.exports = router;

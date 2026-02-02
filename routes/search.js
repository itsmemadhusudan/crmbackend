const express = require('express');
const Customer = require('../models/Customer');
const Membership = require('../models/Membership');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/customers-memberships', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || String(q).trim().length < 2) {
      return res.json({ success: true, customers: [], memberships: [] });
    }
    const term = String(q).trim();
    const isPhone = /^\d+$/.test(term);
    let customerFilter = {};
    const bid = getBranchId(req.user);
    if (bid) customerFilter.primaryBranchId = bid;

    let customers = [];
    if (isPhone) {
      customers = await Customer.find({ ...customerFilter, phone: new RegExp(term, 'i') })
        .limit(20)
        .lean();
    } else {
      customers = await Customer.find({
        ...customerFilter,
        $or: [
          { name: new RegExp(term, 'i') },
          { membershipCardId: new RegExp(term, 'i') },
          { email: new RegExp(term, 'i') },
        ],
      })
        .limit(20)
        .lean();
    }

    const customerIds = customers.map((c) => c._id);
    const memberships = await Membership.find({ customerId: { $in: customerIds }, status: 'active' })
      .populate('membershipTypeId', 'name totalCredits')
      .populate('soldAtBranchId', 'name')
      .lean();

    res.json({
      success: true,
      customers: customers.map((c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        membershipCardId: c.membershipCardId,
      })),
      memberships: memberships.map((m) => ({
        id: m._id,
        customerId: m.customerId,
        typeName: m.membershipTypeId?.name,
        totalCredits: m.totalCredits,
        usedCredits: m.usedCredits,
        remainingCredits: m.totalCredits - m.usedCredits,
        soldAtBranch: m.soldAtBranchId?.name,
        expiryDate: m.expiryDate,
        status: m.status,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Search failed.' });
  }
});

module.exports = router;

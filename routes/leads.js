const express = require('express');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

function leadFilter(req) {
  const bid = getBranchId(req.user);
  if (bid) return { branchId: bid };
  return {};
}

router.get('/', async (req, res) => {
  try {
    const { status, branchId } = req.query;
    const filter = leadFilter(req);
    if (req.user.role === 'admin' && branchId) filter.branchId = branchId;
    if (status) filter.status = status;

    const leads = await Lead.find(filter)
      .populate('branchId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      leads: leads.map((l) => ({
        id: l._id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        branch: l.branchId?.name,
        branchId: l.branchId?._id,
        status: l.status,
        followUps: l.followUps?.length || 0,
        notes: l.notes,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch leads.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, email, source, branchId, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Lead name is required.' });
    const bid = getBranchId(req.user) || branchId;
    if (!bid) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const lead = await Lead.create({
      name,
      phone: phone || undefined,
      email: email || undefined,
      source: source || 'other',
      branchId: bid,
      notes: notes || undefined,
    });

    const l = await Lead.findById(lead._id).populate('branchId', 'name').lean();
    res.status(201).json({
      success: true,
      lead: {
        id: l._id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        branch: l.branchId?.name,
        status: l.status,
        createdAt: l.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create lead.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id).populate('branchId', 'name').lean();
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId?._id) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    res.json({
      success: true,
      lead: {
        id: lead._id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        source: lead.source,
        branch: lead.branchId?.name,
        branchId: lead.branchId?._id,
        status: lead.status,
        followUps: lead.followUps || [],
        notes: lead.notes,
        createdAt: lead.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch lead.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    const { status, notes } = req.body;
    if (status !== undefined) lead.status = status;
    if (notes !== undefined) lead.notes = notes;
    await lead.save();

    const l = await Lead.findById(lead._id).populate('branchId', 'name').lean();
    res.json({ success: true, lead: { id: l._id, status: l.status, notes: l.notes } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update lead.' });
  }
});

router.post('/:id/follow-up', async (req, res) => {
  try {
    const { note } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found.' });
    const filter = leadFilter(req);
    if (filter.branchId && String(lead.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Lead not found.' });

    lead.followUps = lead.followUps || [];
    lead.followUps.push({ note: note || '', byUserId: req.user._id });
    await lead.save();

    res.json({ success: true, followUps: lead.followUps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add follow-up.' });
  }
});

module.exports = router;

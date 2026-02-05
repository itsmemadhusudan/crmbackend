const express = require('express');
const LeadStatus = require('../models/LeadStatus');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const statuses = await LeadStatus.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const LeadStatus = require('../models/LeadStatus');

const router = express.Router();
router.use(protect);

/** GET /api/lead-statuses - list all (admin only for consistency; vendors can read) */
router.get('/', async (req, res) => {
  try {
    let statuses = await LeadStatus.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    if (statuses.length === 0) {
      const defaults = [
        { name: 'new', order: 0, isDefault: true },
        { name: 'contacted', order: 1, isDefault: false },
        { name: 'qualified', order: 2, isDefault: false },
        { name: 'booked', order: 3, isDefault: false },
        { name: 'lost', order: 4, isDefault: false },
      ];
      await LeadStatus.insertMany(defaults);
      statuses = await LeadStatus.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
    }
    res.json({
      success: true,
      leadStatuses: statuses.map((s) => ({
        id: s._id,
        name: s.name,
        order: s.order,
        isDefault: s.isDefault,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch lead statuses.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, order, isDefault } = req.body;
    if (!name || !String(name).trim())
      return res.status(400).json({ success: false, message: 'Name is required.' });
    const status = await LeadStatus.create({
      name: String(name).trim(),
/** POST /api/lead-statuses - create (admin only) */
router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, order, isDefault } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }
    if (isDefault) {
      await LeadStatus.updateMany({}, { isDefault: false });
    }
    const status = await LeadStatus.create({
      name: String(name).trim().toLowerCase().replace(/\s+/g, '-'),
      order: order != null ? Number(order) : 0,
      isDefault: !!isDefault,
    });
    res.status(201).json({
      success: true,
      leadStatus: { id: status._id, name: status.name, order: status.order, isDefault: status.isDefault },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create lead status.' });
  }
});

router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const status = await LeadStatus.findById(req.params.id);
/** PATCH /api/lead-statuses/:id */
router.patch('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const status = await LeadStatus.findById(id);
    if (!status) return res.status(404).json({ success: false, message: 'Lead status not found.' });
    const { name, order, isDefault, isActive } = req.body;
    if (name !== undefined) status.name = String(name).trim();
    if (order !== undefined) status.order = Number(order);
    if (isDefault !== undefined) status.isDefault = !!isDefault;
    if (isDefault === true) {
      await LeadStatus.updateMany({ _id: { $ne: id } }, { isDefault: false });
      status.isDefault = true;
    } else if (isDefault === false) status.isDefault = false;
    if (isActive !== undefined) status.isActive = !!isActive;
    await status.save();
    res.json({
      success: true,
      leadStatus: { id: status._id, name: status.name, order: status.order, isDefault: status.isDefault, isActive: status.isActive },
      leadStatus: { id: status._id, name: status.name, order: status.order, isDefault: status.isDefault },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update lead status.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const status = await LeadStatus.findById(req.params.id);
    if (!status) return res.status(404).json({ success: false, message: 'Lead status not found.' });
    status.isActive = false;
    await status.save();
    res.json({ success: true, message: 'Lead status deactivated.' });
/** DELETE /api/lead-statuses/:id - soft delete (set isActive: false) */
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid ID.' });
    }
    const status = await LeadStatus.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!status) return res.status(404).json({ success: false, message: 'Lead status not found.' });
    res.json({ success: true, message: 'Lead status removed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete lead status.' });
  }
});

module.exports = router;

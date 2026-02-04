const express = require('express');
const LeadStatus = require('../models/LeadStatus');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const statuses = await LeadStatus.find({ isActive: true }).sort({ order: 1, name: 1 }).lean();
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
    if (!status) return res.status(404).json({ success: false, message: 'Lead status not found.' });
    const { name, order, isDefault, isActive } = req.body;
    if (name !== undefined) status.name = String(name).trim();
    if (order !== undefined) status.order = Number(order);
    if (isDefault !== undefined) status.isDefault = !!isDefault;
    if (isActive !== undefined) status.isActive = !!isActive;
    await status.save();
    res.json({
      success: true,
      leadStatus: { id: status._id, name: status.name, order: status.order, isDefault: status.isDefault, isActive: status.isActive },
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
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to delete lead status.' });
  }
});

module.exports = router;

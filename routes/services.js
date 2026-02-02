const express = require('express');
const Service = require('../models/Service');
const { protect, authorize } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { branchId } = req.query;
    const bid = getBranchId(req.user);
    const filter = { isActive: true };
    if (bid) filter.$or = [{ branchId: bid }, { branchId: null }];
    else if (branchId) filter.$or = [{ branchId: branchId }, { branchId: null }];

    const services = await Service.find(filter).populate('branchId', 'name').sort({ name: 1 }).lean();
    res.json({
      success: true,
      services: services.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
        branch: s.branchId?.name,
        durationMinutes: s.durationMinutes,
        price: s.price,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch services.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const { name, category, branchId, durationMinutes, price } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Service name is required.' });
    const service = await Service.create({
      name,
      category: category || undefined,
      branchId: branchId || undefined,
      durationMinutes: durationMinutes != null ? Number(durationMinutes) : undefined,
      price: price != null ? Number(price) : 0,
    });
    res.status(201).json({
      success: true,
      service: {
        id: service._id,
        name: service.name,
        category: service.category,
        branchId: service.branchId,
        durationMinutes: service.durationMinutes,
        price: service.price,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create service.' });
  }
});

module.exports = router;

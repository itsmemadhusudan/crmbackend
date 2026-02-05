const express = require('express');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');
const { getBranchId, branchFilter } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

function appointmentFilter(req) {
  return branchFilter(req.user);
}

router.get('/', async (req, res) => {
  try {
    const { branchId, date, from, to } = req.query;
    const filter = appointmentFilter(req);
    if (req.user.role === 'admin' && branchId) filter.branchId = branchId;
    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end = new Date(d.setHours(23, 59, 59, 999));
      filter.scheduledAt = { $gte: start, $lte: end };
    } else if (from && to) {
      filter.scheduledAt = { $gte: new Date(from), $lte: new Date(to) };
    }

    const appointments = await Appointment.find(filter)
      .populate('customerId', 'name phone')
      .populate('branchId', 'name')
      .populate('staffUserId', 'name')
      .populate('serviceId', 'name durationMinutes')
      .sort({ scheduledAt: 1 })
      .lean();

    res.json({
      success: true,
      appointments: appointments.map((a) => ({
        id: a._id,
        customer: a.customerId ? { id: a.customerId._id, name: a.customerId.name, phone: a.customerId.phone } : null,
        branch: a.branchId?.name,
        branchId: a.branchId?._id,
        staff: a.staffUserId?.name,
        service: a.serviceId?.name,
        scheduledAt: a.scheduledAt,
        status: a.status,
        notes: a.notes,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to fetch appointments.' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { customerId, branchId, staffUserId, serviceId, scheduledAt, notes } = req.body;
    if (!customerId || !scheduledAt) return res.status(400).json({ success: false, message: 'customerId and scheduledAt are required.' });
    const bid = getBranchId(req.user) || branchId;
    if (!bid) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const appointment = await Appointment.create({
      customerId,
      branchId: bid,
      staffUserId: staffUserId || undefined,
      serviceId: serviceId || undefined,
      scheduledAt: new Date(scheduledAt),
      status: 'pending',
      notes: notes || undefined,
    });

    const a = await Appointment.findById(appointment._id)
      .populate('customerId', 'name phone')
      .populate('branchId', 'name')
      .populate('serviceId', 'name')
      .lean();

    res.status(201).json({
      success: true,
      appointment: {
        id: a._id,
        customer: a.customerId,
        branch: a.branchId?.name,
        scheduledAt: a.scheduledAt,
        status: a.status,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to create appointment.' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only admins can update appointment status.' });
    }
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    const filter = appointmentFilter(req);
    if (filter.branchId && String(appointment.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Appointment not found.' });

    const { status } = req.body;
    if (status !== undefined) {
      const allowed = ['pending', 'accepted', 'rejected', 'completed'];
      if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status.' });
      appointment.status = status;
    }
    await appointment.save();

    const a = await Appointment.findById(appointment._id)
      .populate('customerId', 'name phone')
      .populate('branchId', 'name')
      .lean();

    res.json({
      success: true,
      appointment: {
        id: a._id,
        scheduledAt: a.scheduledAt,
        status: a.status,
        notes: a.notes,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to update appointment.' });
  }
});

module.exports = router;

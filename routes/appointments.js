const express = require('express');
const Appointment = require('../models/Appointment');
const { protect } = require('../middleware/auth');
const { getBranchId } = require('../middleware/branchFilter');

const router = express.Router();

router.use(protect);

function appointmentFilter(req) {
  const bid = getBranchId(req.user);
  if (bid) return { branchId: bid };
  return {};
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
    const { customerId, branchId, staffUserId, serviceId, scheduledAt, status, notes } = req.body;
    if (!customerId || !scheduledAt) return res.status(400).json({ success: false, message: 'customerId and scheduledAt are required.' });
    const bid = getBranchId(req.user) || branchId;
    if (!bid) return res.status(400).json({ success: false, message: 'Branch is required.' });

    const appointment = await Appointment.create({
      customerId,
      branchId: bid,
      staffUserId: staffUserId || undefined,
      serviceId: serviceId || undefined,
      scheduledAt: new Date(scheduledAt),
      status: status || 'scheduled',
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
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found.' });
    const filter = appointmentFilter(req);
    if (filter.branchId && String(appointment.branchId) !== String(filter.branchId))
      return res.status(404).json({ success: false, message: 'Appointment not found.' });

    const { scheduledAt, status, notes } = req.body;
    if (scheduledAt !== undefined) appointment.scheduledAt = new Date(scheduledAt);
    if (status !== undefined) appointment.status = status;
    if (notes !== undefined) appointment.notes = notes;
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

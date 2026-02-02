const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    staffUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
    scheduledAt: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'completed', 'no-show', 'cancelled', 'walk-in'], default: 'scheduled' },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

appointmentSchema.index({ branchId: 1, scheduledAt: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

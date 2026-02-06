const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    note: { type: String, trim: true },
    at: { type: Date, default: Date.now },
    byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    source: { type: String, enum: ['ad', 'website', 'call', 'walk-in', 'other'], default: 'other' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    status: { type: String, trim: true, default: 'New' },
    followUps: [followUpSchema],
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

leadSchema.index({ branchId: 1, createdAt: -1 });
leadSchema.index({ branchId: 1, status: 1 });
leadSchema.index({ branchId: 1, updatedAt: -1 });

module.exports = mongoose.model('Lead', leadSchema);

const mongoose = require('mongoose');

const leadStatusSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

leadStatusSchema.index({ order: 1 });

module.exports = mongoose.model('LeadStatus', leadStatusSchema);

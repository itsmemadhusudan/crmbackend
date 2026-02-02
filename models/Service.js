const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    durationMinutes: { type: Number },
    price: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);

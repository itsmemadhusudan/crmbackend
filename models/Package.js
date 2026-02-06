const mongoose = require('mongoose');

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

packageSchema.index({ name: 1 });
packageSchema.index({ isActive: 1 });

module.exports = mongoose.model('Package', packageSchema);

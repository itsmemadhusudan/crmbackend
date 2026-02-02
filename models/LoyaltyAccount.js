const mongoose = require('mongoose');

const loyaltyAccountSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    points: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

loyaltyAccountSchema.index({ customerId: 1 }, { unique: true });

module.exports = mongoose.model('LoyaltyAccount', loyaltyAccountSchema);

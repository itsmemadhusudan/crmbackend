const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    points: { type: Number, required: true },
    type: { type: String, enum: ['earn', 'redeem'], required: true },
    reason: { type: String, trim: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  },
  { timestamps: true }
);

const loyaltyAccountSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    points: { type: Number, default: 0, min: 0 },
    transactions: [loyaltyTransactionSchema],
  },
  { timestamps: true }
);

loyaltyAccountSchema.index({ customerId: 1 }, { unique: true });

module.exports = mongoose.model('LoyaltyAccount', loyaltyAccountSchema);

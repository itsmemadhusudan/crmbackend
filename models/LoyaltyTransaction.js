const mongoose = require('mongoose');

const loyaltyTransactionSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    points: { type: Number, required: true },
    type: { type: String, enum: ['earn', 'redeem'], required: true },
    reason: { type: String, trim: true },
    referenceType: { type: String, trim: true },
    referenceId: { type: mongoose.Schema.Types.Mixed },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

loyaltyTransactionSchema.index({ customerId: 1, createdAt: -1 });

module.exports = mongoose.model('LoyaltyTransaction', loyaltyTransactionSchema);

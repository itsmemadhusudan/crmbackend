const mongoose = require('mongoose');

const settlementSchema = new mongoose.Schema(
  {
    fromBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    toBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    amount: { type: Number, required: true },
    reason: { type: String, trim: true },
    membershipUsageId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipUsage' },
    status: { type: String, enum: ['pending', 'settled'], default: 'pending' },
  },
  { timestamps: true }
);

settlementSchema.index({ fromBranchId: 1, toBranchId: 1 });

module.exports = mongoose.model('InternalSettlement', settlementSchema);

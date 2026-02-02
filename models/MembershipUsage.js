const mongoose = require('mongoose');

const membershipUsageSchema = new mongoose.Schema(
  {
    membershipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
    usedAtBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
    usedByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    creditsUsed: { type: Number, default: 1, min: 1 },
    usedAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

membershipUsageSchema.index({ membershipId: 1 });
membershipUsageSchema.index({ usedAtBranchId: 1, usedAt: -1 });

module.exports = mongoose.model('MembershipUsage', membershipUsageSchema);

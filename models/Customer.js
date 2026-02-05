const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    membershipCardId: { type: String, trim: true },
    primaryBranchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
    customerPackage: { type: String, trim: true },
    customerPackagePrice: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

customerSchema.index({ phone: 1 });
customerSchema.index({ primaryBranchId: 1, name: 1 });
customerSchema.index({ name: 'text', membershipCardId: 'text' });

module.exports = mongoose.model('Customer', customerSchema);

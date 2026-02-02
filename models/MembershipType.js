const mongoose = require('mongoose');

const membershipTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    totalCredits: { type: Number, required: true, min: 1 },
    price: { type: Number, default: 0 },
    serviceCategory: { type: String, trim: true },
    validityDays: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MembershipType', membershipTypeSchema);

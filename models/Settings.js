const mongoose = require('mongoose');

/** Single-document system settings (admin-configured). */
const settingsSchema = new mongoose.Schema(
  {
    revenuePercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },
    settlementPercentage: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);

require('dotenv').config();
const mongoose = require('mongoose');
const LeadStatus = require('../models/LeadStatus');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mbm';

const defaultStatuses = [
  { name: 'New', order: 1, isDefault: true },
  { name: 'Contacted', order: 2, isDefault: false },
  { name: 'Call not Connected', order: 3, isDefault: false },
  { name: 'Follow up', order: 4, isDefault: false },
  { name: 'Booked', order: 5, isDefault: false },
  { name: 'Lost', order: 6, isDefault: false },
];

async function seedLeadStatuses() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB connected');

    const existing = await LeadStatus.countDocuments();
    if (existing > 0) {
      console.log('Lead statuses already exist. Skipping.');
      process.exit(0);
      return;
    }

    await LeadStatus.insertMany(defaultStatuses);
    console.log('Default lead statuses created:', defaultStatuses.map((s) => s.name).join(', '));
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
}

seedLeadStatuses();

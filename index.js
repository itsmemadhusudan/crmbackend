require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const vendorRoutes = require('./routes/vendors');
const branchRoutes = require('./routes/branches');
const customerRoutes = require('./routes/customers');
const searchRoutes = require('./routes/search');
const membershipTypeRoutes = require('./routes/membershipTypes');
const membershipRoutes = require('./routes/memberships');
const serviceRoutes = require('./routes/services');
const leadRoutes = require('./routes/leads');
const leadStatusRoutes = require('./routes/leadStatuses');
const appointmentRoutes = require('./routes/appointments');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const loyaltyRoutes = require('./routes/loyalty');
const packageRoutes = require('./routes/packages');

connectDB();

const app = express();
app.use(helmet());

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, origin ? origin : true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/membership-types', membershipTypeRoutes);
app.use('/api/memberships', membershipRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/lead-statuses', leadStatusRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/packages', packageRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});

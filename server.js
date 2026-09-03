const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

app.use(express.json());

// CORS configuration
app.use(cors({
    origin: ['https://devorbit-sigma.vercel.app', 'http://localhost:4200', 'http://localhost:4300'],
    credentials: true
}));

// ==========================================
// 1. IMPORT ROUTE FILES
// ==========================================
// Unified Auth
const authRoutes = require('./routes/auth'); 

// Billing Routes
const clientRoutes = require('./routes/billing/clients');
const companyRoutes = require('./routes/billing/company');
const dashboardRoutes = require('./routes/billing/dashboard');
const invoiceRoutes = require('./routes/billing/invoices');
const ledgerRoutes = require('./routes/billing/ledger');

// Lab Routes
const labSettingsRoutes = require('./routes/lab/settings');
const labReportsRoutes = require('./routes/lab/reports');
const labEntriesRoutes = require('./routes/lab/entries');

// ==========================================
// 2. MOUNT ROUTES
// ==========================================
// Mount Auth
app.use('/api/auth', authRoutes);

// Mount Billing
app.use('/api/billing/clients', clientRoutes);
app.use('/api/billing/company', companyRoutes);
app.use('/api/billing/dashboard', dashboardRoutes);
app.use('/api/billing/invoices', invoiceRoutes);
app.use('/api/billing/ledger', ledgerRoutes);

// Mount Lab
app.use('/api/lab/settings', labSettingsRoutes);
app.use('/api/lab/reports', labReportsRoutes);
app.use('/api/lab/entries', labEntriesRoutes);

// ==========================================
// 3. SERVER EXPORT & STARTUP
// ==========================================
module.exports = app;

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
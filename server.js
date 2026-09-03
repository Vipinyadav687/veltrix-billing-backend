const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());

// CORS configuration
app.use(cors({
    origin: ['https://devorbit-sigma.vercel.app', 'http://localhost:4200', 'http://localhost:4300'],
    credentials: true
}));

// ==========================================
// IMPORT ROUTE FILES
// ==========================================
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const companyRoutes = require('./routes/company');
const dashboardRoutes = require('./routes/dashboard');
const invoiceRoutes = require('./routes/invoices');
const ledgerRoutes = require('./routes/ledger');

// ==========================================
// MOUNT ROUTES
// ==========================================
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/ledger', ledgerRoutes);

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
module.exports = app;
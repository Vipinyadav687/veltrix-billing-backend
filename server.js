const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());

// CORS configuration for local development and Vercel production frontend
app.use(cors({
    origin: ['https://veltrix-billing-frontend.vercel.app', 'http://localhost:4200', 'http://localhost:4300'],
    credentials: true
}));

// Connect to your TiDB Cloud Database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 4000,
    ssl: { rejectUnauthorized: true },
});

// ==========================================
// 1. GET ALL CLIENTS
// ==========================================
app.get("/api/clients", (req, res) => {
    pool.query(
        "SELECT * FROM clients ORDER BY CompanyName ASC",
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        },
    );
});

// ==========================================
// SAVE NEW INVOICE & ITEMS (Sale Entry)
// ==========================================
app.post("/api/invoices", async (req, res) => {
    const {
        userId,
        clientId,
        invoiceNo,
        invoiceDate,
        dueDate,
        placeOfSupply,
        poRef,
        poDate,
        subTotal,
        sgst,
        cgst,
        igst,
        totalAmount,
        notes,
        terms,
        items,
    } = req.body;

    const connection = await pool.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1. Insert Invoice Header
        const invQuery = `INSERT INTO invoices 
            (UserId, ClientId, InvoiceNo, InvoiceDate, DueDate, PlaceOfSupply, SubTotal, SGSTAmount, CGSTAmount, IGSTAmount, TotalAmount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(invQuery, [
            userId, clientId, invoiceNo, invoiceDate, dueDate, 
            placeOfSupply, subTotal, sgst, cgst, igst, totalAmount
        ]);

        // 2. Insert Invoice Items
        const itemQuery = `INSERT INTO invoiceitems 
            (UserId, InvoiceNo, Description, HSNSAC, Qty, Rate, SGST_Perc, CGST_Perc, Amount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        for (const item of items) {
            await connection.execute(itemQuery, [
                userId,
                invoiceNo,
                item.description,
                item.hsn,
                item.qty,
                item.rate,
                item.sgstPerc,
                item.cgstPerc,
                item.amount,
            ]);
        }

        await connection.commit();
        res.status(201).json({ message: "Invoice saved successfully!" });
    } catch (err) {
        await connection.rollback();
        console.error('Invoice save error:', err);
        res.status(500).json({ error: "Database transaction failed", details: err });
    } finally {
        connection.release();
    }
});

// ==========================================
// 3. GET DASHBOARD STATISTICS
// ==========================================
app.get("/api/dashboard/stats", async (req, res) => {
    const userId = 1;
    const currentYear = new Date().getFullYear();

    const connection = await pool.promise().getConnection();

    try {
        const [revResult] = await connection.execute(
            "SELECT IFNULL(SUM(TotalAmount), 0) as total FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=?",
            [userId, currentYear],
        );

        const [recResult] = await connection.execute(
            "SELECT IFNULL(SUM(CreditAmount), 0) as total FROM clienttransactions WHERE UserID=? AND VchType='Receipt' AND YEAR(TransactionDate)=?",
            [userId, currentYear],
        );

        const [topClients] = await connection.execute(
            `SELECT c.CompanyName, SUM(i.TotalAmount) as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? AND YEAR(i.InvoiceDate)=? 
             GROUP BY c.CompanyName ORDER BY Amount DESC LIMIT 5`,
            [userId, currentYear],
        );

        const [recentInvoices] = await connection.execute(
            `SELECT DATE_FORMAT(InvoiceDate, '%d-%b') as Date, c.CompanyName as Client, TotalAmount as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? ORDER BY InvoiceDate DESC LIMIT 5`,
            [userId],
        );

        const [trendResult] = await connection.execute(
            "SELECT MONTH(InvoiceDate) as month, SUM(TotalAmount) as amount FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=? GROUP BY MONTH(InvoiceDate)",
            [userId, currentYear],
        );

        const monthlyRevenue = new Array(12).fill(0);
        trendResult.forEach((row) => {
            monthlyRevenue[row.month - 1] = row.amount;
        });

        const totalRevenue = parseFloat(revResult[0].total) || 0;
        const totalReceived = parseFloat(recResult[0].total) || 0;
        const outstanding = totalRevenue - totalReceived;

        res.json({
            kpis: {
                totalRevenue,
                totalReceived,
                outstanding,
                totalExpenses: totalRevenue * 0.3,
                netProfit: totalRevenue * 0.7,
            },
            monthlyRevenue,
            topClients,
            recentInvoices,
        });
    } catch (err) {
        console.error(err);
        res
            .status(500)
            .json({ error: "Failed to fetch dashboard stats", details: err });
    } finally {
        connection.release();
    }
});

// ==========================================
// CREATE NEW CLIENT
// ==========================================
app.post("/api/clients", async (req, res) => {
    const { userId, companyName, gstin, address, pincode, city, state } = req.body;
    try {
        const connection = await pool.promise().getConnection();
        const query = `INSERT INTO clients (UserId, CompanyName, GSTIN, Address, Pincode, City, State) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(query, [
            userId,
            companyName,
            gstin,
            address,
            pincode,
            city,
            state,
        ]);
        connection.release();
        res.status(201).json({ message: "Client added successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add client", details: err });
    }
});

// ==========================================
// UPDATE EXISTING CLIENT
// ==========================================
app.put("/api/clients/:id", async (req, res) => {
    const { companyName, gstin, address, pincode, city, state } = req.body;
    const clientId = req.params.id;
    try {
        const connection = await pool.promise().getConnection();
        const query = `UPDATE clients SET CompanyName=?, GSTIN=?, Address=?, Pincode=?, City=?, State=? WHERE ClientId=?`;
        await connection.execute(query, [
            companyName,
            gstin,
            address,
            pincode,
            city,
            state,
            clientId,
        ]);
        connection.release();
        res.json({ message: "Client updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update client", details: err });
    }
});

// ==========================================
// GET CLIENT LEDGER TRANSACTIONS
// ==========================================
app.get("/api/ledger/:userId/:clientId", async (req, res) => {
    const { userId, clientId } = req.params;
    try {
        const connection = await pool.promise().getConnection();
        const query = `SELECT TransactionDate AS Date, Particulars, VchType, VchNo, DebitAmount AS Debit, CreditAmount AS Credit 
                       FROM clienttransactions 
                       WHERE ClientID = ? AND UserID = ? 
                       ORDER BY TransactionDate ASC`;
        const [rows] = await connection.execute(query, [clientId, userId]);
        connection.release();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch ledger", details: err });
    }
});

// ==========================================
// SAVE PAYMENT RECEIPT (LEDGER ENTRY)
// ==========================================
app.post("/api/ledger", async (req, res) => {
    const {
        clientId,
        userId,
        transactionDate,
        particulars,
        vchType,
        vchNo,
        oldDr,
        creditAmount,
        debitAmount,
        currentDr,
    } = req.body;
    try {
        const connection = await pool.promise().getConnection();
        const query = `INSERT INTO clienttransactions 
                       (ClientID, UserID, TransactionDate, Particulars, VchType, VchNo, OldDr, CreditAmount, DebitAmount, CurrentDr) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(query, [
            clientId,
            userId,
            transactionDate,
            particulars,
            vchType,
            vchNo,
            oldDr,
            creditAmount,
            debitAmount,
            currentDr,
        ]);
        connection.release();
        res.status(201).json({ message: "Payment record saved successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save payment", details: err });
    }
});

// ==========================================
// GET COMPANY SETTINGS
// ==========================================
app.get("/api/company/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const connection = await pool.promise().getConnection();
        const [rows] = await connection.execute(
            "SELECT * FROM mycompany WHERE UserId = ?",
            [userId],
        );
        connection.release();

        if (rows.length > 0) {
            const company = rows[0];
            if (company.Logo) {
                company.Logo = Buffer.from(company.Logo).toString("base64");
            }
            res.json(company);
        } else {
            res.status(404).json({ message: "Company settings not found" });
        }
    } catch (err) {
        res
            .status(500)
            .json({ error: "Failed to fetch company settings", details: err });
    }
});

// ==========================================
// SAVE OR UPDATE COMPANY SETTINGS
// ==========================================
app.post("/api/company", async (req, res) => {
    const { userId, companyName, address, city, state, pin, gstin, logo } = req.body;
    try {
        const connection = await pool.promise().getConnection();

        const [checkRows] = await connection.execute(
            "SELECT COUNT(*) as count FROM mycompany WHERE UserId = ?",
            [userId],
        );
        const exists = checkRows[0].count > 0;

        const logoBuffer = logo ? Buffer.from(logo, "base64") : null;

        if (!exists) {
            const insertQuery = `INSERT INTO mycompany (UserId, CompanyName, Address, City, State, PIN, GSTIN, Logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            await connection.execute(insertQuery, [
                userId,
                companyName,
                address,
                city,
                state,
                pin,
                gstin,
                logoBuffer,
            ]);
        } else {
            const updateQuery = `UPDATE mycompany SET CompanyName=?, Address=?, City=?, State=?, PIN=?, GSTIN=?, Logo=? WHERE UserId=?`;
            await connection.execute(updateQuery, [
                companyName,
                address,
                city,
                state,
                pin,
                gstin,
                logoBuffer,
                userId,
            ]);
        }

        connection.release();
        res.status(200).json({ message: "Company settings saved successfully!" });
    } catch (err) {
        res
            .status(500)
            .json({ error: "Failed to save company settings", details: err });
    }
});

// ==========================================
// GET CLIENT HISTORY / LEDGER REPORT
// ==========================================
app.get("/api/ledger/history/:userId", async (req, res) => {
    const { userId } = req.params;
    const { clientId, fromDate, toDate } = req.query;

    try {
        const connection = await pool.promise().getConnection();

        const obQuery = `SELECT IFNULL(SUM(Debit), 0) - IFNULL(SUM(Credit), 0) AS OpeningBalance 
                         FROM (
                             SELECT TotalAmount AS Debit, 0.00 AS Credit FROM invoices WHERE (? = 0 OR ClientId = ?) AND InvoiceDate < ? 
                             UNION ALL 
                             SELECT 0.00 AS Debit, CreditAmount AS Credit FROM clienttransactions WHERE (? = 0 OR ClientID = ?) AND TransactionDate < ? AND VchType = 'Receipt'
                         ) AS OB`;

        const [obRows] = await connection.execute(obQuery, [
            clientId,
            clientId,
            fromDate,
            clientId,
            clientId,
            fromDate,
        ]);
        const openingBalance = obRows[0]?.OpeningBalance || 0;

        const query = `SELECT T.SortDate AS Date, T.Particulars, T.VchType, T.VchNo, T.Debit, T.Credit 
                       FROM (
                           SELECT i.InvoiceDate AS SortDate, 
                                  IF(? = 0, CONCAT('Sales Invoice - ', c.CompanyName), 'Sales Invoice') AS Particulars, 
                                  'Sales' AS VchType, i.InvoiceNo AS VchNo, i.TotalAmount AS Debit, 0.00 AS Credit 
                           FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
                           WHERE (? = 0 OR i.ClientId = ?) AND i.InvoiceDate >= ? AND i.InvoiceDate <= ? 
                           
                           UNION ALL 
                           
                           SELECT ct.TransactionDate AS SortDate, 
                                  IF(? = 0, CONCAT(ct.Particulars, ' - ', c.CompanyName), ct.Particulars) AS Particulars, 
                                  ct.VchType, ct.VchNo, 0.00 AS Debit, ct.CreditAmount AS Credit 
                           FROM clienttransactions ct JOIN clients c ON ct.ClientID = c.ClientId 
                           WHERE (? = 0 OR ct.ClientID = ?) AND ct.TransactionDate >= ? AND ct.TransactionDate <= ? AND ct.VchType = 'Receipt'
                       ) T ORDER BY T.SortDate ASC`;

        const [transactions] = await connection.execute(query, [
            clientId,
            clientId,
            clientId,
            fromDate,
            toDate,
            clientId,
            clientId,
            clientId,
            fromDate,
            toDate,
        ]);

        connection.release();
        res.json({ openingBalance, transactions });
    } catch (err) {
        res
            .status(500)
            .json({ error: "Failed to fetch client history report", details: err });
    }
});

// ==========================================
// USER LOGIN ROUTE (Plain text password check)
// ==========================================
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const connection = await pool.promise().getConnection();
        const [rows] = await connection.execute('SELECT UserId, Username, Password FROM users WHERE Username = ?', [username]);
        connection.release();

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        const user = rows[0];
        
        // Direct plain-text comparison
        if (password !== user.Password) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        res.json({
            userId: user.UserId,
            username: user.Username,
            token: 'secure-token-session-' + user.UserId
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
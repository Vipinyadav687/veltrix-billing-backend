const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Connect to your TiDB Cloud Database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 4000,
    ssl: { rejectUnauthorized: true }
});

// ==========================================
// 1. GET ALL CLIENTS
// ==========================================
app.get('/api/clients', (req, res) => {
    pool.query('SELECT * FROM clients ORDER BY CompanyName ASC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ==========================================
// 2. SAVE NEW INVOICE
// ==========================================
app.post('/api/invoices', async (req, res) => {
    const { 
        userId, clientId, invoiceNo, invoiceDate, dueDate, 
        placeOfSupply, subTotal, sgst, cgst, igst, totalAmount, items 
    } = req.body;

    const connection = await pool.promise().getConnection();
    
    try {
        await connection.beginTransaction();

        // Insert Invoice
        const invQuery = `INSERT INTO invoices 
            (UserId, ClientId, InvoiceNo, InvoiceDate, DueDate, PlaceOfSupply, SubTotal, SGSTAmount, CGSTAmount, IGSTAmount, TotalAmount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(invQuery, [
            userId, clientId, invoiceNo, invoiceDate, dueDate, placeOfSupply, 
            subTotal, sgst, cgst, igst, totalAmount
        ]);

        // Insert Items
        const itemQuery = `INSERT INTO invoiceitems 
            (UserId, InvoiceNo, Description, HSNSAC, Qty, Rate, SGST_Perc, CGST_Perc, Amount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        for (const item of items) {
            await connection.execute(itemQuery, [
                userId, invoiceNo, item.description, item.hsn, 
                item.qty, item.rate, item.sgstPerc, item.cgstPerc, item.amount
            ]);
        }

        await connection.commit();
        res.status(201).json({ message: 'Invoice saved successfully' });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ error: 'Database transaction failed', details: err });
    } finally {
        connection.release();
    }
});

// ==========================================
// 3. GET DASHBOARD STATISTICS (NEW)
// ==========================================
app.get('/api/dashboard/stats', async (req, res) => {
    // Hardcoded to user 1 for now (update later when you add a login system)
    const userId = 1; 
    const currentYear = new Date().getFullYear();

    const connection = await pool.promise().getConnection();
    
    try {
        // 1. YTD Revenue
        const [revResult] = await connection.execute(
            'SELECT IFNULL(SUM(TotalAmount), 0) as total FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=?', 
            [userId, currentYear]
        );
        
        // 2. YTD Received
        const [recResult] = await connection.execute(
            "SELECT IFNULL(SUM(CreditAmount), 0) as total FROM clienttransactions WHERE UserID=? AND VchType='Receipt' AND YEAR(TransactionDate)=?", 
            [userId, currentYear]
        );

        // 3. Top 5 Clients
        const [topClients] = await connection.execute(
            `SELECT c.CompanyName, SUM(i.TotalAmount) as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? AND YEAR(i.InvoiceDate)=? 
             GROUP BY c.CompanyName ORDER BY Amount DESC LIMIT 5`,
            [userId, currentYear]
        );

        // 4. Recent Invoices
        const [recentInvoices] = await connection.execute(
            `SELECT DATE_FORMAT(InvoiceDate, '%d-%b') as Date, c.CompanyName as Client, TotalAmount as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? ORDER BY InvoiceDate DESC LIMIT 5`,
            [userId]
        );

        // 5. Monthly Trend (Jan-Dec)
        const [trendResult] = await connection.execute(
            'SELECT MONTH(InvoiceDate) as month, SUM(TotalAmount) as amount FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=? GROUP BY MONTH(InvoiceDate)',
            [userId, currentYear]
        );

        // Format monthly data into an array of 12 (Jan - Dec)
        const monthlyRevenue = new Array(12).fill(0);
        trendResult.forEach(row => {
            monthlyRevenue[row.month - 1] = row.amount;
        });

        // Calculate Totals safely
        const totalRevenue = parseFloat(revResult[0].total) || 0;
        const totalReceived = parseFloat(recResult[0].total) || 0;
        const outstanding = totalRevenue - totalReceived;

        res.json({
            kpis: {
                totalRevenue,
                totalReceived,
                outstanding,
                totalExpenses: totalRevenue * 0.3, // Mocked 30% expense for new UI
                netProfit: totalRevenue * 0.7      // Mocked 70% profit for new UI
            },
            monthlyRevenue,
            topClients,
            recentInvoices
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats', details: err });
    } finally {
        connection.release();
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
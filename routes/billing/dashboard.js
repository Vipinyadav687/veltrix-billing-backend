const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET: /api/dashboard/stats
router.get("/stats", async (req, res) => {
    const userId = 1;
    const currentYear = new Date().getFullYear();

    try {
        const connection = await pool.promise().getConnection();

        const [revResult] = await connection.execute(
            "SELECT IFNULL(SUM(TotalAmount), 0) as total FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=?",
            [userId, currentYear]
        );

        const [recResult] = await connection.execute(
            "SELECT IFNULL(SUM(CreditAmount), 0) as total FROM clienttransactions WHERE UserID=? AND VchType='Receipt' AND YEAR(TransactionDate)=?",
            [userId, currentYear]
        );

        const [topClients] = await connection.execute(
            `SELECT c.CompanyName, SUM(i.TotalAmount) as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? AND YEAR(i.InvoiceDate)=? 
             GROUP BY c.CompanyName ORDER BY Amount DESC LIMIT 5`,
            [userId, currentYear]
        );

        const [recentInvoices] = await connection.execute(
            `SELECT DATE_FORMAT(InvoiceDate, '%d-%b') as Date, c.CompanyName as Client, TotalAmount as Amount 
             FROM invoices i JOIN clients c ON i.ClientId = c.ClientId 
             WHERE i.UserId=? ORDER BY InvoiceDate DESC LIMIT 5`,
            [userId]
        );

        const [trendResult] = await connection.execute(
            "SELECT MONTH(InvoiceDate) as month, SUM(TotalAmount) as amount FROM invoices WHERE UserId=? AND YEAR(InvoiceDate)=? GROUP BY MONTH(InvoiceDate)",
            [userId, currentYear]
        );
        connection.release();

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
        res.status(500).json({ error: "Failed to fetch dashboard stats", details: err });
    }
});

module.exports = router;
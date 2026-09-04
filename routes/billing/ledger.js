const express = require('express');
const router = express.Router();
const { billingPool } = require('../../db');

router.get("/history/:userId", async (req, res) => {
    const userId = parseInt(req.params.userId, 10) || 1;
    const clientId = parseInt(req.query.clientId, 10) || 0;
    const fromDate = req.query.fromDate || '2026-04-01';
    const toDate = req.query.toDate || '2026-08-29';

    try {
        // 1. Opening Balance Query
        let obQuery = `
            SELECT IFNULL(SUM(debit), 0) - IFNULL(SUM(credit), 0) AS openingBalance 
            FROM (
                SELECT CAST(TotalAmount AS DECIMAL(15,2)) AS debit, 0.00 AS credit 
                FROM invoices 
                WHERE UserId = ? AND DATE(InvoiceDate) < ?
        `;
        let obParams = [userId, fromDate];

        if (clientId > 0) {
            obQuery += ` AND ClientId = ?`;
            obParams.push(clientId);
        }

        obQuery += `
                UNION ALL 
                SELECT 0.00 AS debit, CAST(CreditAmount AS DECIMAL(15,2)) AS credit 
                FROM clienttransactions 
                WHERE UserID = ? AND DATE(TransactionDate) < ? AND VchType = 'Receipt'
        `;
        obParams.push(userId, fromDate);

        if (clientId > 0) {
            obQuery += ` AND ClientID = ?`;
            obParams.push(clientId);
        }
        obQuery += ` ) AS OB`;

        const [obRows] = await billingPool.execute(obQuery, obParams);
        const openingBalance = parseFloat(obRows[0]?.openingBalance) || 0;

        // 2. Transactions Query
        let txQuery = `
            SELECT 
                DATE_FORMAT(SortDate, '%Y-%m-%d') AS date,
                particulars,
                vchType,
                vchNo,
                CAST(debit AS DECIMAL(15,2)) AS debit,
                CAST(credit AS DECIMAL(15,2)) AS credit
            FROM (
                SELECT 
                    i.InvoiceDate AS SortDate, 
                    ${clientId === 0 ? "CONCAT('Sales Invoice - ', c.CompanyName)" : "'Sales Invoice'"} AS particulars, 
                    'Sales' AS vchType, 
                    i.InvoiceNo AS vchNo, 
                    i.TotalAmount AS debit, 
                    0.00 AS credit 
                FROM invoices i 
                JOIN clients c ON i.ClientId = c.ClientId 
                WHERE i.UserId = ? AND DATE(i.InvoiceDate) >= ? AND DATE(i.InvoiceDate) <= ?
        `;
        let txParams = [userId, fromDate, toDate];

        if (clientId > 0) {
            txQuery += ` AND i.ClientId = ?`;
            txParams.push(clientId);
        }

        txQuery += `
                UNION ALL 
                SELECT 
                    ct.TransactionDate AS SortDate, 
                    ${clientId === 0 ? "CONCAT(ct.Particulars, ' - ', c.CompanyName)" : "ct.Particulars"} AS particulars, 
                    ct.VchType AS vchType, 
                    ct.VchNo AS vchNo, 
                    0.00 AS debit, 
                    ct.CreditAmount AS credit 
                FROM clienttransactions ct 
                JOIN clients c ON ct.ClientID = c.ClientId 
                WHERE ct.UserID = ? AND DATE(ct.TransactionDate) >= ? AND DATE(ct.TransactionDate) <= ? AND ct.VchType = 'Receipt'
        `;
        txParams.push(userId, fromDate, toDate);

        if (clientId > 0) {
            txQuery += ` AND ct.ClientID = ?`;
            txParams.push(clientId);
        }

        txQuery += ` ) T ORDER BY SortDate ASC`;

        const [transactions] = await billingPool.execute(txQuery, txParams);

        res.json({
            openingBalance: openingBalance,
            transactions: transactions
        });

    } catch (err) {
        console.error("Ledger History Error:", err);
        res.status(500).json({ error: "Failed to fetch ledger report", details: err.message });
    }
});

// GET: /api/ledger/:userId/:clientId (Combined Invoices & Payment Receipts)
router.get("/:userId/:clientId", async (req, res) => {
    const userId = parseInt(req.params.userId, 10) || 1;
    const clientId = parseInt(req.params.clientId, 10);

    if (!clientId) {
        return res.status(400).json({ error: "Valid ClientId is required" });
    }

    try {
        const query = `
            SELECT 
                DATE_FORMAT(SortDate, '%Y-%m-%d') AS Date,
                Particulars,
                VchType,
                VchNo,
                CAST(Debit AS DECIMAL(15,2)) AS Debit,
                CAST(Credit AS DECIMAL(15,2)) AS Credit
            FROM (
                -- 1. Sales Invoices (Debits)
                SELECT 
                    InvoiceDate AS SortDate,
                    'Sales Invoice' AS Particulars,
                    'Sales' AS VchType,
                    InvoiceNo AS VchNo,
                    TotalAmount AS Debit,
                    0.00 AS Credit
                FROM invoices
                WHERE UserId = ? AND ClientId = ?

                UNION ALL

                -- 2. Payment Receipts (Credits)
                SELECT 
                    TransactionDate AS SortDate,
                    Particulars,
                    VchType,
                    VchNo,
                    DebitAmount AS Debit,
                    CreditAmount AS Credit
                FROM clienttransactions
                WHERE UserID = ? AND ClientID = ?
            ) T 
            ORDER BY SortDate ASC
        `;

        const [rows] = await billingPool.execute(query, [userId, clientId, userId, clientId]);

        res.json(rows);
    } catch (err) {
        console.error("Fetch client ledger error:", err);
        res.status(500).json({ error: "Failed to fetch ledger", details: err.message });
    }
});

// POST: /api/ledger (Save Payment Receipt)
router.post("/", async (req, res) => {
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
        currentDr
    } = req.body;

    try {
        const query = `
            INSERT INTO clienttransactions 
            (ClientID, UserID, TransactionDate, Particulars, VchType, VchNo, OldDr, CreditAmount, DebitAmount, CurrentDr) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await billingPool.execute(query, [
            clientId,
            userId,
            transactionDate,
            particulars || 'Payment Received',
            vchType || 'Receipt',
            vchNo,
            oldDr || 0.00,
            creditAmount || 0.00,
            debitAmount || 0.00,
            currentDr || 0.00
        ]);

        res.status(201).json({ message: "Payment recorded successfully!" });
    } catch (err) {
        console.error("Save payment error:", err);
        res.status(500).json({ error: "Failed to save payment", details: err.message });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET: /api/ledger/:userId/:clientId
router.get("/:userId/:clientId", async (req, res) => {
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

// POST: /api/ledger
router.post("/", async (req, res) => {
    const { clientId, userId, transactionDate, particulars, vchType, vchNo, oldDr, creditAmount, debitAmount, currentDr } = req.body;
    try {
        const connection = await pool.promise().getConnection();
        const query = `INSERT INTO clienttransactions 
                       (ClientID, UserID, TransactionDate, Particulars, VchType, VchNo, OldDr, CreditAmount, DebitAmount, CurrentDr) 
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(query, [clientId, userId, transactionDate, particulars, vchType, vchNo, oldDr, creditAmount, debitAmount, currentDr]);
        connection.release();
        res.status(201).json({ message: "Payment record saved successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save payment", details: err });
    }
});

// GET: /api/ledger/history/:userId
router.get("/history/:userId", async (req, res) => {
    const { userId } = req.params;
    const { clientId, fromDate, toDate } = req.query;

    const parsedClientId = parseInt(clientId, 10) || 0;
    const startOfFromDate = `${fromDate} 00:00:00`;
    const endOfToDate = `${toDate} 23:59:59`;

    try {
        const connection = await pool.promise().getConnection();

        const obQuery = `SELECT IFNULL(SUM(Debit), 0) - IFNULL(SUM(Credit), 0) AS OpeningBalance 
                         FROM (
                             SELECT TotalAmount AS Debit, 0.00 AS Credit FROM invoices WHERE (? = 0 OR ClientId = ?) AND InvoiceDate < ? 
                             UNION ALL 
                             SELECT 0.00 AS Debit, CreditAmount AS Credit FROM clienttransactions WHERE (? = 0 OR ClientID = ?) AND TransactionDate < ? AND VchType = 'Receipt'
                         ) AS OB`;

        const [obRows] = await connection.execute(obQuery, [parsedClientId, parsedClientId, startOfFromDate, parsedClientId, parsedClientId, startOfFromDate]);
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
            parsedClientId, parsedClientId, parsedClientId, startOfFromDate, endOfToDate,
            parsedClientId, parsedClientId, parsedClientId, startOfFromDate, endOfToDate,
        ]);

        connection.release();
        res.json({ openingBalance, transactions });
    } catch (err) {
        console.error("Ledger query failed:", err);
        res.status(500).json({ error: "Failed to fetch client history report", details: err });
    }
});

module.exports = router;
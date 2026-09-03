const express = require('express');
const router = express.Router();
const pool = require('../../db');

// POST: /api/invoices
router.post("/", async (req, res) => {
    const { userId, clientId, invoiceNo, invoiceDate, dueDate, placeOfSupply, poRef, poDate, subTotal, sgst, cgst, igst, totalAmount, notes, terms, items } = req.body;

    try {
        const connection = await pool.promise().getConnection();
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
                userId, invoiceNo, item.description, item.hsn, item.qty, 
                item.rate, item.sgstPerc, item.cgstPerc, item.amount
            ]);
        }

        await connection.commit();
        connection.release();
        res.status(201).json({ message: "Invoice saved successfully!" });
    } catch (err) {
        console.error('Invoice save error:', err);
        res.status(500).json({ error: "Database transaction failed", details: err });
    }
});

// GET: /api/invoices/single/:userId/:invoiceNo
router.get("/single/:userId/:invoiceNo", async (req, res) => {
    const { userId, invoiceNo } = req.params;

    try {
        const connection = await pool.promise().getConnection();

        // 1. Fetch Invoice + Client Details
        const invQuery = `
            SELECT i.*, c.CompanyName, c.GSTIN AS ClientGST, c.Address AS ClientAddr, 
                   c.Pincode AS ClientPin, c.State AS ClientState 
            FROM invoices i 
            JOIN clients c ON i.ClientId = c.ClientId 
            WHERE i.InvoiceNo = ? AND i.UserId = ?
        `;
        const [invRows] = await connection.execute(invQuery, [invoiceNo, userId]);

        if (invRows.length === 0) {
            connection.release();
            return res.status(404).json({ error: "Invoice not found" });
        }

        // 2. Fetch Line Items
        const itemQuery = `SELECT * FROM invoiceitems WHERE InvoiceNo = ? AND UserId = ?`;
        const [itemRows] = await connection.execute(itemQuery, [invoiceNo, userId]);

        // 3. Fetch Company Details (for header and logo)
        const [compRows] = await connection.execute(`SELECT * FROM mycompany WHERE UserId = ?`, [userId]);
        let company = compRows.length > 0 ? compRows[0] : null;
        if (company && company.Logo) {
            company.Logo = Buffer.from(company.Logo).toString("base64");
        }

        connection.release();

        res.json({
            invoice: invRows[0],
            items: itemRows,
            company: company
        });
    } catch (err) {
        console.error("Fetch invoice error:", err);
        res.status(500).json({ error: "Database query failed", details: err.message });
    }
});

module.exports = router;
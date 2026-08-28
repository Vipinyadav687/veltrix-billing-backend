const express = require('express');
const router = express.Router();
const pool = require('../db');

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

module.exports = router;
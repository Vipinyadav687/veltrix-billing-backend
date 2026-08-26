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

// Test Route to get all clients
// Get all clients for the dropdown
app.get('/api/clients', (req, res) => {
    pool.query('SELECT * FROM clients ORDER BY CompanyName ASC', (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// Save a new Sale Invoice & Items
app.post('/api/invoices', async (req, res) => {
    const { 
        userId, clientId, invoiceNo, invoiceDate, dueDate, 
        placeOfSupply, subTotal, sgst, cgst, igst, totalAmount, items 
    } = req.body;

    const connection = await pool.promise().getConnection();
    
    try {
        await connection.beginTransaction();

        // 1. Insert Invoice
        const invQuery = `INSERT INTO invoices 
            (UserId, ClientId, InvoiceNo, InvoiceDate, DueDate, PlaceOfSupply, SubTotal, SGSTAmount, CGSTAmount, IGSTAmount, TotalAmount) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(invQuery, [
            userId, clientId, invoiceNo, invoiceDate, dueDate, placeOfSupply, 
            subTotal, sgst, cgst, igst, totalAmount
        ]);

        // 2. Insert Items
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
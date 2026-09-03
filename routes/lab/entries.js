const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const labPool = mysql.createPool({
    host: process.env.LAB_DB_HOST,
    port: process.env.LAB_DB_PORT,
    database: process.env.LAB_DB_NAME,
    user: process.env.LAB_DB_USER,
    password: process.env.LAB_DB_PASS,
    ssl: { rejectUnauthorized: false }
});
// GET: Search Test Catalog
router.get('/tests', async (req, res) => {
    try {
        const search = req.query.search || '';
        const query = search 
            ? 'SELECT TestName, Price FROM testcatalog WHERE TestName LIKE ? ORDER BY TestName'
            : 'SELECT TestName, Price FROM testcatalog ORDER BY TestName';
        const [rows] = await labPool.query(query, [`%${search}%`]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Load Doctors
router.get('/doctors', async (req, res) => {
    try {
        const [rows] = await labPool.query('SELECT DoctorName FROM doctors ORDER BY DoctorName');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Save Bill & Details
router.post('/save-bill', async (req, res) => {
    const connection = await labPool.getConnection();
    try {
        await connection.beginTransaction();

        const { patientName, mobile, age, gender, refBy, subtotal, discount, totalAmount, discountBy, tests } = req.body;

        // 1. Insert into Bills
        const [billResult] = await connection.execute(
            `INSERT INTO bills (PatientName, Mobile, Age, Gender, RefBy, Subtotal, Discount, TotalAmount, DiscountBy, BillDate) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [patientName, mobile, age, gender, refBy, subtotal, discount, totalAmount, discountBy]
        );

        // Get the generated ReceiptNo
        const [receiptRows] = await connection.execute('SELECT MAX(ReceiptNo) as ReceiptNo FROM bills');
        const receiptNo = receiptRows[0].ReceiptNo;

        // 2. Insert into BillDetails
        for (let test of tests) {
            await connection.execute(
                `INSERT INTO billdetails (ReceiptNo, TestName, Price) VALUES (?, ?, ?)`,
                [receiptNo, test.TestName, test.Price]
            );
        }

        await connection.commit();
        connection.release();

        res.json({ success: true, receiptNo: receiptNo });
    } catch (err) {
        await connection.rollback();
        connection.release();
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
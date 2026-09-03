const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
// Import the shared labPool from your root db.js file

const labPool = mysql.createPool({
    host: process.env.LAB_DB_HOST,
    port: process.env.LAB_DB_PORT,
    database: process.env.LAB_DB_NAME,
    user: process.env.LAB_DB_USER,
    password: process.env.LAB_DB_PASS,
    ssl: { rejectUnauthorized: true }
});


// GET: Search Test Catalog (Matches /api/lab/entries/tests or similar depending on mount)
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

// POST: Save Bill remains the same...
module.exports = router;
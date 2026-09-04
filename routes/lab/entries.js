const express = require('express');
const router = express.Router();
const { labPool } = require('../../db');

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
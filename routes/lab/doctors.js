const express = require('express');
const router = express.Router();
const { labPool } = require('../../db');

// GET: Load all doctors
router.get('/', async (req, res) => {
    try {
        const [rows] = await labPool.query('SELECT DoctorId, DoctorName FROM doctors ORDER BY DoctorName');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Add a new doctor
router.post('/add', async (req, res) => {
    try {
        const { doctorName } = req.body;
        if (!doctorName || !doctorName.trim()) {
            return res.status(400).json({ error: 'Doctor name is required' });
        }

        await labPool.execute(
            'INSERT IGNORE INTO doctors (DoctorName) VALUES (?)',
            [doctorName.trim()]
        );
        
        res.json({ success: true, message: 'Doctor Added Successfully!' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
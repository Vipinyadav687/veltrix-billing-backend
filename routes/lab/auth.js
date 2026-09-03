const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// Dedicated database pool for pathology_lab
const labPool = mysql.createPool({
    host: process.env.LAB_DB_HOST,
    port: process.env.LAB_DB_PORT,
    database: process.env.LAB_DB_NAME,
    user: process.env.LAB_DB_USER,
    password: process.env.LAB_DB_PASS,
    ssl: { rejectUnauthorized: false }
});

// POST: /api/lab/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const [rows] = await labPool.execute('SELECT * FROM users WHERE Username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        const user = rows[0];

        // Direct plain-text comparison (matching your billing project pattern)
        if (password !== user.Password) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        res.json({
            userId: user.UserId || user.Id,
            username: user.Username,
            token: 'secure-lab-token-' + (user.UserId || user.Id),
            accessLevel: user.AccessLevel || 3, // Passes user role for your dashboard UI
            allowedApps: ['lab']               // Tells Angular frontend this is a Lab user
        });

    } catch (err) {
        console.error('Lab Login error:', err);
        res.status(500).json({ error: 'Internal server error during lab login' });
    }
});

module.exports = router;
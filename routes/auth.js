const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

// 1. Billing Database Pool
const billingPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 4000,
    ssl: { rejectUnauthorized: true },
});

// 2. Lab Database Pool
const labPool = mysql.createPool({
    host: process.env.LAB_DB_HOST,
    port: process.env.LAB_DB_PORT,
    database: process.env.LAB_DB_NAME,
    user: process.env.LAB_DB_USER,
    password: process.env.LAB_DB_PASS,
    ssl: { rejectUnauthorized: true }
});

// POST: /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password, targetApp } = req.body;
console.log("--- LOGIN ATTEMPT ---");
    console.log("Username received:", username);
    console.log("Target App received:", targetApp);
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // 🔀 DYNAMICALLY CHOOSE THE DATABASE POOL BASED ON targetApp
        let activePool = billingPool;
        if (targetApp === 'lab') {
            activePool = labPool;
        }

        const [rows] = await activePool.execute('SELECT * FROM users WHERE Username = ?', [username]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        const user = rows[0];

        if (password !== user.Password) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        // Return appropriate session info depending on the app
        res.json({
            userId: user.UserId || user.Id,
            username: user.Username,
            token: `secure-${targetApp || 'billing'}-token-` + (user.UserId || user.Id),
            accessLevel: user.AccessLevel || 3, // Handy if logging into Lab
            allowedApps: [targetApp || 'billing']
        });

    } catch (err) {
        console.error('Unified Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

module.exports = router;
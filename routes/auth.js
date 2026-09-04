const express = require('express');
const router = express.Router();
const { billingPool, labPool } = require('../db');

// POST: /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password, targetApp } = req.body;
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
            accessLevel: user.AccessLevel || 3, 
            allowedApps: [targetApp || 'billing']
        });

    } catch (err) {
        console.error('Unified Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

module.exports = router;
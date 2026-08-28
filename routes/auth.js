const express = require('express');
const router = express.Router();
const pool = require('../db'); // Only this require is needed here!

// POST: /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        const connection = await pool.promise().getConnection();
        const [rows] = await connection.execute('SELECT UserId, Username, Password FROM users WHERE Username = ?', [username]);
        connection.release();

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        const user = rows[0];

        // Direct plain-text comparison
        if (password !== user.Password) {
            return res.status(401).json({ error: 'Invalid Credentials' });
        }

        res.json({
            userId: user.UserId,
            username: user.Username,
            token: 'secure-token-session-' + user.UserId
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error during login' });
    }
});

module.exports = router;
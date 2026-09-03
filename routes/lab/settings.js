const express = require('express');
const router = express.Router();

// Placeholder route so it doesn't crash
router.get('/', (req, res) => {
    res.json({ message: "Route is working!" });
});

// THIS IS THE MOST IMPORTANT LINE!
module.exports = router;
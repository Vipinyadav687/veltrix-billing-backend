const express = require('express');
const router = express.Router();
const pool = require('../../db');

// GET: /api/company/:userId
router.get("/:userId", async (req, res) => {
    const { userId } = req.params;
    try {
        const connection = await pool.promise().getConnection();
        const [rows] = await connection.execute("SELECT * FROM mycompany WHERE UserId = ?", [userId]);
        connection.release();

        if (rows.length > 0) {
            const company = rows[0];
            if (company.Logo) {
                company.Logo = Buffer.from(company.Logo).toString("base64");
            }
            res.json(company);
        } else {
            res.status(404).json({ message: "Company settings not found" });
        }
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch company settings", details: err });
    }
});

// POST: /api/company
router.post("/", async (req, res) => {
    const { userId, companyName, address, city, state, pin, gstin, logo } = req.body;
    try {
        const connection = await pool.promise().getConnection();

        const [checkRows] = await connection.execute("SELECT COUNT(*) as count FROM mycompany WHERE UserId = ?", [userId]);
        const exists = checkRows[0].count > 0;
        const logoBuffer = logo ? Buffer.from(logo, "base64") : null;

        if (!exists) {
            const insertQuery = `INSERT INTO mycompany (UserId, CompanyName, Address, City, State, PIN, GSTIN, Logo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            await connection.execute(insertQuery, [userId, companyName, address, city, state, pin, gstin, logoBuffer]);
        } else {
            const updateQuery = `UPDATE mycompany SET CompanyName=?, Address=?, City=?, State=?, PIN=?, GSTIN=?, Logo=? WHERE UserId=?`;
            await connection.execute(updateQuery, [companyName, address, city, state, pin, gstin, logoBuffer, userId]);
        }

        connection.release();
        res.status(200).json({ message: "Company settings saved successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save company settings", details: err });
    }
});

module.exports = router;
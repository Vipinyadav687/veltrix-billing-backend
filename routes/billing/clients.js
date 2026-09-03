const express = require('express');
const router = express.Router();
const pool = require('../../db');

// GET: /api/clients
router.get("/", (req, res) => {
    pool.query(
        "SELECT * FROM clients ORDER BY CompanyName ASC",
        (err, results) => {
            if (err) return res.status(500).json(err);
            res.json(results);
        }
    );
});

// POST: /api/clients
router.post("/", async (req, res) => {
    const { userId, companyName, gstin, address, pincode, city, state } = req.body;
    try {
        const connection = await pool.promise().getConnection();
        const query = `INSERT INTO clients (UserId, CompanyName, GSTIN, Address, Pincode, City, State) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await connection.execute(query, [userId, companyName, gstin, address, pincode, city, state]);
        connection.release();
        res.status(201).json({ message: "Client added successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add client", details: err });
    }
});

// PUT: /api/clients/:id
router.put("/:id", async (req, res) => {
    const { companyName, gstin, address, pincode, city, state } = req.body;
    const clientId = req.params.id;
    try {
        const connection = await pool.promise().getConnection();
        const query = `UPDATE clients SET CompanyName=?, GSTIN=?, Address=?, Pincode=?, City=?, State=? WHERE ClientId=?`;
        await connection.execute(query, [companyName, gstin, address, pincode, city, state, clientId]);
        connection.release();
        res.json({ message: "Client updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update client", details: err });
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
// Import billingPool from the centralized db.js file
const { billingPool } = require('../../db'); // Adjust path based on your folder depth

// GET: /api/clients
router.get("/", async (req, res) => {
    try {
        const [rows] = await billingPool.query("SELECT * FROM clients ORDER BY CompanyName ASC");
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch clients", details: err.message });
    }
});

// POST: /api/clients
router.post("/", async (req, res) => {
    const { userId, companyName, gstin, address, pincode, city, state } = req.body;
    try {
        const query = `INSERT INTO clients (UserId, CompanyName, GSTIN, Address, Pincode, City, State) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await billingPool.execute(query, [userId, companyName, gstin, address, pincode, city, state]);
        
        res.status(201).json({ message: "Client added successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to add client", details: err.message });
    }
});

// PUT: /api/clients/:id
router.put("/:id", async (req, res) => {
    const { companyName, gstin, address, pincode, city, state } = req.body;
    const clientId = req.params.id;
    try {
        const query = `UPDATE clients SET CompanyName=?, GSTIN=?, Address=?, Pincode=?, City=?, State=? WHERE ClientId=?`;
        await billingPool.execute(query, [companyName, gstin, address, pincode, city, state, clientId]);
        
        res.json({ message: "Client updated successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to update client", details: err.message });
    }
});

module.exports = router;
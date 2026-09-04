const mysql = require("mysql2/promise"); // 👈 Must use mysql2/promise for async/await
require("dotenv").config();

const billingPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 4000,
    ssl: { rejectUnauthorized: false }, // 👈 Fixed from true
});

const labPool = mysql.createPool({
    host: process.env.LAB_DB_HOST,
    port: process.env.LAB_DB_PORT,
    database: process.env.LAB_DB_NAME,
    user: process.env.LAB_DB_USER,
    password: process.env.LAB_DB_PASS,
    ssl: { rejectUnauthorized: false } // 👈 Fixed from true
});

// Export both pools safely in a single object
module.exports = {
    billingPool,
    labPool
};
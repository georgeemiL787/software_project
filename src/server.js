// Import the express package
require('dotenv').config(); // Load environment variables from .env if present
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('./db'); // Import database connection

// Create an instance of express
const app = express();

// Middleware
app.use(express.json());

// CORS support
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Serve uploaded images statically from /uploads
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Serve frontend static files from /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Mount user routes
app.use('/api/users', require('./routes/userRoutes'));

// Mount patient and doctor feature routes
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/labs', require('./routes/labRoutes'));

// Mount upload routes
app.use('/api/upload', require('./routes/uploadRoutes'));

// Mount admin routes (protected by auth + admin role)
const { auth, authorize } = require('./middleware/auth');
app.use('/api/admin', auth, authorize('admin'), require('./routes/adminRoutes'));

// Define a "port" for our server to listen on
// process.env.PORT is for deployment (like on Heroku)
const PORT = process.env.PORT || 5000;

// Ensure revocation table exists
(async () => {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS revoked_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                token TEXT NOT NULL,
                expires_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB;
        `);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token TEXT NOT NULL,
                expires_at DATETIME,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_token (token(100))
            ) ENGINE=InnoDB;
        `);
        connection.release();
    } catch (e) {
        console.error('Failed to ensure revoked_tokens table:', e.message);
    }
})();

// Serve frontend at root (fallback if static file serving doesn't work)
app.get('/', (req, res, next) => {
    // If request is for API, skip this
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'), (err) => {
        if (err) {
            res.send('Hello from the NailedIT API! Frontend not found. API is running.');
        }
    });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        // Select only non-sensitive columns (do not return password hashes in API responses)
        const [rows] = await connection.query(
            'SELECT id, name, email, role, created_at FROM users'
        );
        connection.release();
        res.json({
            status: 'Connected to Database',
            users: rows
        });
    } catch (error) {
        res.status(500).json({
            status: 'Database Connection Failed',
            error: error.message
        });
    }
});

// Get all patients
app.get('/api/patients', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT u.id, u.name, u.email, p.date_of_birth 
            FROM users u 
            JOIN patients p ON u.id = p.user_id
        `);
        connection.release();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all doctors
app.get('/api/doctors', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT u.id, u.name, u.email, d.specialty, d.clinic_address 
            FROM users u 
            JOIN doctors d ON u.id = d.user_id
        `);
        connection.release();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all appointments
app.get('/api/appointments', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [rows] = await connection.query(`
            SELECT a.*, 
                   p.user_id as patient_user_id,
                   d.user_id as doctor_user_id
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
        `);
        connection.release();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Graceful shutdown helper reference
let server;

// Start the server and make it listen for requests on the specified port
server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Frontend UI: http://localhost:${PORT}`);
    console.log(`API Base: http://localhost:${PORT}/api`);
    console.log(`Test database at: http://localhost:${PORT}/api/test-db`);
});

// Shutdown route (protected by SHUTDOWN_TOKEN in env)
app.post('/__shutdown', async (req, res) => {
    const token = req.body && req.body.token;
    const expected = process.env.SHUTDOWN_TOKEN || '';
    if (!expected || token !== expected) {
        return res.status(403).json({ ok: false, message: 'Forbidden' });
    }

    res.json({ ok: true, message: 'Shutting down' });

    // Allow time for the response to be flushed
    setTimeout(async () => {
        try {
            await pool.end();
        } catch (e) {
            // ignore
        }
        server.close(() => {
            process.exit(0);
        });
    }, 500);
});

// Create patient (user + patient row). Example CRUD endpoint.
app.post('/api/patients', async (req, res) => {
    const { name, email, password, date_of_birth } = req.body || {};
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email and password are required' });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Hash password
        const hash = await bcrypt.hash(password, 10);

        // Insert user
        const [userResult] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hash, 'patient']
        );

        const userId = userResult.insertId;

        // Insert patient profile
        await connection.query(
            'INSERT INTO patients (user_id, date_of_birth) VALUES (?, ?)',
            [userId, date_of_birth || null]
        );

        await connection.commit();

        // Return created user (non-sensitive fields)
        res.status(201).json({
            id: userId,
            name,
            email,
            role: 'patient',
            date_of_birth: date_of_birth || null
        });
    } catch (err) {
        await connection.rollback();
        // Duplicate email handling
        if (err && err.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ error: 'Email already exists' });
        } else {
            res.status(500).json({ error: err.message });
        }
    } finally {
        connection.release();
    }
});

// Error handling middleware (must be after all routes)
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        msg: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 404 handler (must be last)
app.use((req, res) => {
    if (!req.path.startsWith('/api')) {
        // For non-API routes, try to serve index.html (SPA fallback)
        return res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
            if (err) {
                res.status(404).json({ msg: 'Route not found' });
            }
        });
    }
    res.status(404).json({ msg: 'API route not found' });
});

// Error handlers for unhandled exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
    process.exit(1);
});
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db'); // connection pool
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const requireRole = require('../middleware/requireRole');

// --- @route    POST /api/users/register ---
// --- @desc     Register a new patient ---
// --- @access   Public ---
router.post('/register',
    // validation
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    let connection;
    try {
        // 1. Get data from the request body
        const { name, email, password, date_of_birth } = req.body || {};

        // 2. Check if all fields are there
        if (!name || !email || !password) {
            return res.status(400).json({ msg: 'Please enter all fields' });
        }

        // 3. Check if user (email) already exists
        const [existingUserRows] = await db.query('SELECT email FROM users WHERE email = ?', [email]);
        if (existingUserRows.length > 0) {
            return res.status(400).json({ msg: 'User with this email already exists' });
        }

        // 4. Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // --- This is a TRANSACTION ---
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 5. Insert into 'users' table
        const [newUserResult] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'patient']
        );
        const newUserId = newUserResult.insertId;

        // 6. Insert into 'patients' table
        await connection.query('INSERT INTO patients (user_id, date_of_birth) VALUES (?, ?)', [newUserId, date_of_birth || null]);

        // 7. Commit the transaction
        await connection.commit();
        connection.release();

        // 8. Create a JWT Token (so they are logged in right after registering)
        const payload = {
            user: {
                id: newUserId,
                role: 'patient'
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', {
            expiresIn: '30d'
        });

        // Create a refresh token (expires in 90 days)
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', {
            expiresIn: '90d'
        });

        // Store refresh token in DB
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days
        await connection.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [newUserId, refreshToken, expiresAt]);

        // 9. Send the token back to the user
        res.status(201).json({ token, refreshToken });

    } catch (err) {
        console.error(err && err.message);
        // If we had a transaction, roll it back
        if (connection) {
            try {
                await connection.rollback();
                connection.release();
            } catch (e) {
                // ignore
            }
        }
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// (router will be exported at the end)

// --- @route    POST /api/users/login ---
// --- @desc     Login existing user (email + password) ---
// --- @access   Public ---
router.post('/login',
    body('email').isEmail(),
    body('password').isString().notEmpty(),
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ msg: 'Please provide email and password' });
        }

        const [rows] = await db.query('SELECT id, password, role FROM users WHERE email = ?', [email]);
        if (!rows || rows.length === 0) {
            // Do not reveal whether the email exists
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const user = rows[0];
        
        // Check if password is hashed (starts with $2a$, $2b$, or $2y$)
        const isHashed = user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$'));
        
        let match = false;
        if (isHashed) {
            // Compare with bcrypt
            match = await bcrypt.compare(password, user.password);
        } else {
            // Legacy: compare plain text (for old data)
            match = password === user.password;
        }
        
        if (!match) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '30d' });

        // Create and store refresh token (90 days)
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '90d' });
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        
        try {
            await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [user.id, refreshToken, expiresAt]);
        } catch (tokenError) {
            // If refresh token insert fails, log but don't fail login
            console.warn('Failed to store refresh token:', tokenError.message);
            // Continue with login anyway - access token is still valid
        }

        res.json({ token, refreshToken });
    } catch (err) {
        console.error('Login error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// --- @route    POST /api/users/register-doctor ---
// --- @desc     Register a new doctor ---
// --- @access   Public ---
router.post('/register-doctor',
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('specialty').isString().notEmpty(),
    body('clinic_address').isString().optional(),
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    let connection;
    try {
        const { name, email, password, specialty, clinic_address } = req.body || {};
        if (!name || !email || !password || !specialty) return res.status(400).json({ msg: 'Missing required fields' });

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing && existing.length) return res.status(400).json({ msg: 'User with this email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [newUser] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'doctor']
        );
        const newUserId = newUser.insertId;

        await connection.query('INSERT INTO doctors (user_id, specialty, clinic_address) VALUES (?, ?, ?)', [newUserId, specialty, clinic_address || null]);

        await connection.commit();
        connection.release();

        const payload = { user: { id: newUserId, role: 'doctor' } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '30d' });
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '90d' });
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [newUserId, refreshToken, expiresAt]);

        res.status(201).json({ token, refreshToken });
    } catch (err) {
        console.error(err && err.message);
        if (connection) {
            try { await connection.rollback(); connection.release(); } catch (e) {}
        }
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// --- @route    POST /api/users/register-lab ---
// --- @desc     Register a new lab ---
// --- @access   Public ---
router.post('/register-lab',
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isLength({ min: 6 }),
    body('lab_address').isString().optional(),
    body('available_tests').optional(),
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    let connection;
    try {
        const { name, email, password, lab_address, available_tests } = req.body || {};
        if (!name || !email || !password) return res.status(400).json({ msg: 'Missing required fields' });

        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing && existing.length) return res.status(400).json({ msg: 'User with this email already exists' });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [newUser] = await connection.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'lab']
        );
        const newUserId = newUser.insertId;

        const testsJson = Array.isArray(available_tests) ? JSON.stringify(available_tests) : (typeof available_tests === 'string' ? available_tests : JSON.stringify([]));
        await connection.query('INSERT INTO labs (user_id, lab_address, available_tests) VALUES (?, ?, ?)', [newUserId, lab_address || null, testsJson]);

        await connection.commit();
        connection.release();

        const payload = { user: { id: newUserId, role: 'lab' } };
        const token = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '30d' });
        const refreshToken = jwt.sign(payload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '90d' });
        const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)', [newUserId, refreshToken, expiresAt]);

        res.status(201).json({ token, refreshToken });
    } catch (err) {
        console.error(err && err.message);
        if (connection) {
            try { await connection.rollback(); connection.release(); } catch (e) {}
        }
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// --- @route    POST /api/users/refresh ---
// --- @desc     Refresh access token using stored refresh token ---
// --- @access   Public ---
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body || {};
        if (!refreshToken) return res.status(400).json({ msg: 'Refresh token required' });

        // Verify and decode the refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET || 'no_jwt_secret_set');
        } catch (err) {
            return res.status(401).json({ msg: 'Invalid or expired refresh token' });
        }

        const userId = decoded.user && decoded.user.id;
        // Check refresh token exists in DB and isn't expired
        const [rows] = await db.query('SELECT user_id FROM refresh_tokens WHERE token = ? AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1', [refreshToken]);
        if (!rows || rows.length === 0) return res.status(401).json({ msg: 'Refresh token not found or expired' });

        // Get current user for role
        const [userRows] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (!userRows || userRows.length === 0) return res.status(404).json({ msg: 'User not found' });

        // Issue a new access token
        const newPayload = { user: { id: userId, role: userRows[0].role } };
        const newAccessToken = jwt.sign(newPayload, process.env.JWT_SECRET || 'no_jwt_secret_set', { expiresIn: '30d' });

        res.json({ token: newAccessToken });
    } catch (err) {
        console.error(err && err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// --- @route    GET /api/users/me ---
// --- @desc     Get current user's profile (protected) ---
// --- @access   Private ---
router.get('/me', auth, async (req, res) => {
    try {
        // req.user is populated by auth middleware
        const userId = req.user && req.user.id;
        if (!userId) return res.status(401).json({ msg: 'Unauthorized' });

        const [rows] = await db.query('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [userId]);
        if (!rows || rows.length === 0) return res.status(404).json({ msg: 'User not found' });

        // Optionally include patient profile if role is patient
        const user = rows[0];
        if (user.role === 'patient') {
            const [prows] = await db.query('SELECT date_of_birth FROM patients WHERE user_id = ?', [user.id]);
            if (prows && prows.length) user.date_of_birth = prows[0].date_of_birth;
        }

        res.json({ user });
    } catch (err) {
        console.error(err && err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// Logout - revoke token
router.post('/logout', auth, async (req, res) => {
    try {
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) return res.status(400).json({ msg: 'No token provided' });

        // decode to get expiry
        const decoded = jwt.decode(token);
        const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : null;

        await db.query('INSERT INTO revoked_tokens (token, expires_at) VALUES (?, ?) ', [token, expiresAt]);
        res.json({ ok: true });
    } catch (err) {
        console.error(err && err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
});

// Example doctor-only protected route
router.get('/doctor-only', auth, requireRole('doctor'), async (req, res) => {
    res.json({ msg: 'Hello Doctor', user: req.user });
});

module.exports = router;

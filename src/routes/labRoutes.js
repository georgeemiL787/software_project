const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { auth, authorize } = require('../middleware/auth');

// --- Multer Configuration for Lab Result Uploads ---
// Set up storage for uploaded result files
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Ensure directory exists
        const fs = require('fs');
        const dir = path.join(__dirname, '..', '..', 'uploads', 'results');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); // Save files to 'uploads/results'
    },
    filename: (req, file, cb) => {
        // Create a unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'result-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (allow images and PDFs)
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/jpeg' ||
        file.mimetype === 'image/png' ||
        file.mimetype === 'image/jpg' ||
        file.mimetype === 'application/pdf'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Only .jpg, .png, or .pdf files are allowed!'), false);
    }
};

// Initialize multer upload object
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 }, // 10MB file size limit
    fileFilter: fileFilter
});

// --- @route    GET /api/labs/queue ---
// --- @desc     Get all scheduled tests for the logged-in lab (their "to-do list") ---
// --- @access   Private (Lab) ---
router.get('/queue', [auth, authorize('lab')], async (req, res) => {
    try {
        // Get the lab_id from the logged-in user's ID
        const [lab] = await db.query('SELECT id FROM labs WHERE user_id = ?', [req.user.id]);
        if (lab.length === 0) {
            return res.status(404).json({ msg: 'Lab profile not found' });
        }

        const lab_id = lab[0].id;

        // Get all tests that are "scheduled" or "requested" at this lab
        const [tests] = await db.query(
            `SELECT lt.id, lt.test_type, lt.status, lt.requested_at, lt.results_url,
             p.id AS patient_id, u.name AS patient_name, u.email AS patient_email
             FROM lab_tests lt
             JOIN patients p ON lt.patient_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE lt.lab_id = ? AND lt.status IN ('scheduled', 'requested', 'completed')
             ORDER BY lt.requested_at DESC`,
            [lab_id]
        );

        res.json(tests || []);
    } catch (err) {
        console.error('Lab queue error:', err);
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// --- @route    GET /api/labs/appointments ---
// --- @desc     Get lab appointments booked by patients ---
// --- @access   Private (Lab) ---
router.get('/appointments', [auth, authorize('lab')], async (req, res) => {
    try {
        const [labRows] = await db.query('SELECT id FROM labs WHERE user_id = ? LIMIT 1', [req.user.id]);
        if (!labRows || labRows.length === 0) {
            return res.status(404).json({ msg: 'Lab profile not found' });
        }

        const lab_id = labRows[0].id;
        const [appointments] = await db.query(
            `SELECT a.*, u.name AS patient_name, u.email AS patient_email
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE a.lab_id = ?
             ORDER BY a.appointment_time DESC`,
            [lab_id]
        );

        res.json(appointments || []);
    } catch (err) {
        console.error('Lab appointments error:', err);
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// --- @route    PUT /api/labs/appointments/:appointment_id ---
// --- @desc     Update status of a lab appointment (confirm/complete/cancel) ---
// --- @access   Private (Lab) ---
router.put('/appointments/:appointment_id', [auth, authorize('lab')], async (req, res) => {
    try {
        const { appointment_id } = req.params;
        const { status, notes } = req.body || {};

        const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        const nextStatus = status && allowedStatuses.includes(status) ? status : 'confirmed';

        const [labRows] = await db.query('SELECT id FROM labs WHERE user_id = ? LIMIT 1', [req.user.id]);
        if (!labRows || labRows.length === 0) {
            return res.status(404).json({ msg: 'Lab profile not found' });
        }
        const lab_id = labRows[0].id;

        // Ensure this appointment belongs to this lab
        const [apptRows] = await db.query('SELECT * FROM appointments WHERE id = ? AND lab_id = ? LIMIT 1', [appointment_id, lab_id]);
        if (!apptRows || apptRows.length === 0) {
            return res.status(404).json({ msg: 'Appointment not found for this lab' });
        }

        // Update appointment with status and optional notes
        if (notes !== undefined) {
            await db.query('UPDATE appointments SET status = ?, notes = ? WHERE id = ? AND lab_id = ?', 
                [nextStatus, notes, appointment_id, lab_id]);
        } else {
            await db.query('UPDATE appointments SET status = ? WHERE id = ? AND lab_id = ?', 
                [nextStatus, appointment_id, lab_id]);
        }

        const [updatedRows] = await db.query(
            `SELECT a.*, u.name AS patient_name, u.email AS patient_email
             FROM appointments a
             JOIN patients p ON a.patient_id = p.id
             JOIN users u ON p.user_id = u.id
             WHERE a.id = ?`,
            [appointment_id]
        );

        res.json(updatedRows && updatedRows[0] ? updatedRows[0] : { id: appointment_id, status: nextStatus });
    } catch (err) {
        console.error('Lab appointment update error:', err);
        res.status(500).json({ msg: err.message || 'Server Error' });
    }
});

// --- @route    POST /api/labs/tests/:test_id/upload ---
// --- @desc     Upload a result file for a specific lab test ---
// --- @access   Private (Lab) ---
router.post(
    '/tests/:test_id/upload',
    [auth, authorize('lab')],
    upload.single('resultFile'), // 'resultFile' must match the form-data key
    async (req, res) => {
        const { test_id } = req.params;
        try {
            // 1. Check if file was uploaded
            if (!req.file) {
                return res.status(400).json({ msg: 'No file uploaded' });
            }

            // 2. Get Lab ID
            const [lab] = await db.query('SELECT id FROM labs WHERE user_id = ?', [req.user.id]);
            if (lab.length === 0) {
                return res.status(404).json({ msg: 'Lab profile not found' });
            }

            const lab_id = lab[0].id;

        // 3. Security Check: Verify this test belongs to this lab and is in a modifiable state
            const [test] = await db.query(
            `SELECT * FROM lab_tests 
             WHERE id = ? AND lab_id = ? AND status IN ('scheduled', 'requested')`,
            [test_id, lab_id]
            );

            if (test.length === 0) {
            return res.status(403).json({ msg: 'Test not found for this lab or status not allowed (must be requested/scheduled)' });
            }

            // 4. Get the file path (relative to project root)
            const resultsUrl = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');

            // 5. Update the lab test with the result URL and set status to 'completed'
            await db.query(
                'UPDATE lab_tests SET results_url = ?, status = ? WHERE id = ?',
                [resultsUrl, 'completed', test_id]
            );

            res.json({
                msg: 'Lab test result uploaded successfully',
                results_url: resultsUrl,
                test_id: parseInt(test_id)
            });
        } catch (err) {
            console.error('Lab upload error:', err);
            if (err.message && err.message.includes('files are allowed')) {
                return res.status(400).json({ msg: err.message });
            }
            res.status(500).json({ msg: err.message || 'Server Error' });
        }
    }
);

// --- @route    POST /api/labs/appointments/:appointment_id/upload ---
// --- @desc     Upload a result file for a specific lab appointment (fallback) ---
// --- @access   Private (Lab) ---
router.post(
    '/appointments/:appointment_id/upload',
    [auth, authorize('lab')],
    upload.single('resultFile'),
    async (req, res) => {
        const { appointment_id } = req.params;
        try {
            if (!req.file) {
                return res.status(400).json({ msg: 'No file uploaded' });
            }

            const [lab] = await db.query('SELECT id FROM labs WHERE user_id = ?', [req.user.id]);
            if (lab.length === 0) {
                return res.status(404).json({ msg: 'Lab profile not found' });
            }
            const lab_id = lab[0].id;

            const [appt] = await db.query(
                'SELECT * FROM appointments WHERE id = ? AND lab_id = ? LIMIT 1',
                [appointment_id, lab_id]
            );

            if (!appt || appt.length === 0) {
                return res.status(403).json({ msg: 'Appointment not found for this lab' });
            }

            const resultsUrl = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');

            await db.query(
                'UPDATE appointments SET status = ?, notes = ? WHERE id = ?',
                ['completed', `Lab result: ${resultsUrl}`, appointment_id]
            );

            res.json({
                msg: 'Lab appointment result uploaded successfully',
                results_url: resultsUrl,
                appointment_id: parseInt(appointment_id, 10),
                status: 'completed'
            });
        } catch (err) {
            console.error('Lab appointment upload error:', err);
            res.status(500).json({ msg: err.message || 'Server Error' });
        }
    }
);

module.exports = router;


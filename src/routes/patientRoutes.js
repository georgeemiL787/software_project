const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, authorize } = require('../middleware/auth');

// --- @route    GET /api/patients/doctors ---
// --- @desc     Get all doctors (for booking) ---
// --- @access   Private (Patient) ---
router.get('/doctors', [auth, authorize('patient')], async (req, res) => {
  try {
    const [doctors] = await db.query(
      `SELECT d.id AS doctor_id, u.name, d.specialty, d.clinic_address 
       FROM doctors d
       JOIN users u ON d.user_id = u.id`
    );
    res.json(doctors);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).send('Server Error');
  }
});

// --- @route    GET /api/patients/labs ---
// --- @desc     Get all labs (for booking) ---
// --- @access   Private (Patient) ---
router.get('/labs', [auth, authorize('patient')], async (req, res) => {
  try {
    const [labs] = await db.query(
      `SELECT l.id AS lab_id, u.name, l.lab_address, l.available_tests 
       FROM labs l
       JOIN users u ON l.user_id = u.id`
    );

    const labsWithParsedTests = labs.map(lab => ({
      ...lab,
      available_tests: (() => {
        try { return JSON.parse(lab.available_tests || '[]'); } catch (e) { return []; }
      })()
    }));

    res.json(labsWithParsedTests);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).send('Server Error');
  }
});

// --- @route    GET /api/patients/my-appointments ---
// --- @desc     Get current patient's appointments ---
// --- @access   Private (Patient) ---
router.get('/my-appointments', [auth, authorize('patient')], async (req, res) => {
  try {
    const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
    const patient_id = patientRows[0].id;

    const [appointments] = await db.query(`
      SELECT 
        a.*,
        d.specialty,
        du.name as doctor_name,
        du.email as doctor_email,
        lu.name as lab_name,
        lu.email as lab_email,
        l.lab_address
      FROM appointments a
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users du ON d.user_id = du.id
      LEFT JOIN labs l ON a.lab_id = l.id
      LEFT JOIN users lu ON l.user_id = lu.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_time DESC
    `, [patient_id]);

    res.json(appointments || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).send('Server Error');
  }
});

// --- @route    GET /api/patients/my-submissions ---
// --- @desc     Get current patient's nail submissions ---
// --- @access   Private (Patient) ---
router.get('/my-submissions', [auth, authorize('patient')], async (req, res) => {
  try {
    const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
    const patient_id = patientRows[0].id;

    const [submissions] = await db.query(
      'SELECT * FROM nail_submissions WHERE patient_id = ? ORDER BY submitted_at DESC',
      [patient_id]
    );

    res.json(submissions || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).send('Server Error');
  }
});

// --- @route    POST /api/patients/appointments ---
// --- @desc     Book an appointment with a doctor or lab ---
// --- @access   Private (Patient) ---
router.post('/appointments', [auth, authorize('patient')], async (req, res) => {
  try {
    const { doctor_id, lab_id, appointment_time } = req.body || {};
    
    // Validate that either doctor_id or lab_id is provided, but not both
    const doctorId = doctor_id ? parseInt(doctor_id) : null;
    const labId = lab_id ? parseInt(lab_id) : null;
    
    if (!doctor_id && !lab_id) {
      return res.status(400).json({ msg: 'Please provide either a doctor ID or lab ID' });
    }
    
    if (doctor_id && lab_id) {
      return res.status(400).json({ msg: 'Please provide either a doctor ID or lab ID, not both' });
    }
    
    if (doctor_id && (isNaN(doctorId) || doctorId <= 0)) {
      return res.status(400).json({ msg: 'Please provide a valid doctor ID' });
    }
    
    if (lab_id && (isNaN(labId) || labId <= 0)) {
      return res.status(400).json({ msg: 'Please provide a valid lab ID' });
    }
    
    // Validate appointment_time is provided and not empty
    if (!appointment_time || typeof appointment_time !== 'string' || appointment_time.trim() === '') {
      return res.status(400).json({ msg: 'Please provide a valid appointment time' });
    }

    const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
    const patient_id = patientRows[0].id;

    // Check if appointments table supports lab_id, if not use doctor_id field for labs
    // First, try to insert with lab_id if provided
    let newAppointment;
    if (lab_id) {
      // Check if lab_id column exists, if not we'll need to use a workaround
      try {
        // Try inserting with lab_id (if column exists after migration)
        [newAppointment] = await db.query(
          'INSERT INTO appointments (patient_id, lab_id, appointment_time) VALUES (?, ?, ?)',
          [patient_id, labId, appointment_time]
        );
      } catch (err) {
        // If lab_id column doesn't exist, we need to handle it differently
        // For now, we'll create a separate lab_appointments approach or modify schema
        // Let's check if we can use doctor_id field temporarily (not ideal but works)
        return res.status(400).json({ msg: 'Lab appointments require database schema update. Please contact administrator.' });
      }
    } else {
      [newAppointment] = await db.query(
        'INSERT INTO appointments (patient_id, doctor_id, appointment_time) VALUES (?, ?, ?)',
        [patient_id, doctorId, appointment_time]
      );
    }

    res.status(201).json({
      id: newAppointment.insertId,
      patient_id,
      doctor_id: doctorId,
      lab_id: labId,
      appointment_time,
      status: 'pending'
    });
  } catch (err) {
    console.error(err && err.message);
    if (err && err.sql && err.sql.includes('FOREIGN KEY')) {
      const errorMsg = lab_id ? 'Lab not found' : 'Doctor not found';
      return res.status(404).json({ msg: errorMsg });
    }
    res.status(500).send('Server Error');
  }
});

// --- @route    POST /api/patients/lab-appointments ---
// --- @desc     Book an appointment with a lab ---
// --- @access   Private (Patient) ---
router.post('/lab-appointments', [auth, authorize('patient')], async (req, res) => {
  try {
    const { lab_id, appointment_time } = req.body || {};
    
    // Validate lab_id is a valid positive integer
    const labId = parseInt(lab_id);
    if (!lab_id || isNaN(labId) || labId <= 0) {
      return res.status(400).json({ msg: 'Please provide a valid lab ID' });
    }
    
    // Validate appointment_time is provided and not empty
    if (!appointment_time || typeof appointment_time !== 'string' || appointment_time.trim() === '') {
      return res.status(400).json({ msg: 'Please provide a valid appointment time' });
    }

    const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
    const patient_id = patientRows[0].id;

    // Check if appointments table has lab_id column
    const [columns] = await db.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'appointments' 
      AND COLUMN_NAME = 'lab_id'
    `);
    
    if (columns && columns.length > 0) {
      // lab_id column exists, use it
      const [newAppointment] = await db.query(
        'INSERT INTO appointments (patient_id, lab_id, appointment_time) VALUES (?, ?, ?)',
        [patient_id, labId, appointment_time]
      );
      
      res.status(201).json({
        id: newAppointment.insertId,
        patient_id,
        lab_id: labId,
        appointment_time,
        status: 'pending'
      });
    } else {
      // lab_id column doesn't exist - try to add it dynamically (not recommended for production)
      // For production, use the migration script
      try {
        await db.query('ALTER TABLE appointments ADD COLUMN lab_id INT NULL AFTER doctor_id');
        await db.query('ALTER TABLE appointments MODIFY COLUMN doctor_id INT NULL');
        await db.query('ALTER TABLE appointments ADD CONSTRAINT fk_appointments_lab FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE');
        
        const [newAppointment] = await db.query(
          'INSERT INTO appointments (patient_id, lab_id, appointment_time) VALUES (?, ?, ?)',
          [patient_id, labId, appointment_time]
        );
        
        res.status(201).json({
          id: newAppointment.insertId,
          patient_id,
          lab_id: labId,
          appointment_time,
          status: 'pending'
        });
      } catch (alterErr) {
        return res.status(501).json({ 
          msg: 'Lab appointments require database schema update. Please run migrations/add_lab_appointments.sql' 
        });
      }
    }
  } catch (err) {
    console.error(err && err.message);
    if (err && err.sql && err.sql.includes('FOREIGN KEY')) return res.status(404).json({ msg: 'Lab not found' });
    res.status(500).send('Server Error');
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, authorize } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Helper function to convert ISO datetime to MySQL datetime format
function convertToMySQLDateTime(isoDateTime) {
  if (!isoDateTime) return null;
  
  // If it's already in MySQL format (YYYY-MM-DD HH:MM:SS), return as is
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(isoDateTime)) {
    return isoDateTime;
  }
  
  // Convert ISO format (2025-12-11T07:30:00.000Z) to MySQL format (2025-12-11 07:30:00)
  const date = new Date(isoDateTime);
  if (isNaN(date.getTime())) {
    throw new Error('Invalid datetime format');
  }
  
  // Format as YYYY-MM-DD HH:MM:SS
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// --- @route    GET /api/patients/doctors ---
// --- @desc     Get all doctors (for booking) ---
// --- @access   Private (Patient) ---
router.get('/doctors', [auth, authorize('patient')], async (req, res) => {
  try {
    const [doctors] = await db.query(
      `SELECT d.id AS doctor_id, u.name, d.specialty, d.clinic_address 
       FROM doctors d
       JOIN users u ON d.user_id = u.id
       WHERE d.verified = TRUE AND d.is_active = TRUE`
    );
    res.json(doctors);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
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
       JOIN users u ON l.user_id = u.id
       WHERE l.verified = TRUE AND l.is_active = TRUE`
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
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/patients/doctors/:doctorId/availability ---
// --- @desc     Get available time slots for a specific doctor ---
// --- @access   Private (Patient) ---
router.get('/doctors/:doctorId/availability', [auth, authorize('patient')], async (req, res) => {
  try {
    const doctorId = parseInt(req.params.doctorId);
    if (isNaN(doctorId) || doctorId <= 0) {
      return res.status(400).json({ msg: 'Invalid doctor ID' });
    }

    const [availability] = await db.query(
      `SELECT 
        a.id,
        a.available_time,
        a.duration_minutes,
        DATE_FORMAT(a.available_time, '%Y-%m-%d') AS date,
        DATE_FORMAT(a.available_time, '%h:%i %p') AS time_12hr
       FROM availability a
       LEFT JOIN appointments ap ON ap.doctor_id = ? 
         AND ap.appointment_time = a.available_time 
         AND ap.status IN ('pending', 'confirmed')
       WHERE a.doctor_id = ? 
       AND a.is_available = TRUE 
       AND a.available_time >= NOW()
       AND ap.id IS NULL
       ORDER BY a.available_time ASC`,
      [doctorId, doctorId]
    );

    res.json(availability || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/patients/labs/:labId/availability ---
// --- @desc     Get available time slots for a specific lab ---
// --- @access   Private (Patient) ---
router.get('/labs/:labId/availability', [auth, authorize('patient')], async (req, res) => {
  try {
    const labId = parseInt(req.params.labId);
    if (isNaN(labId) || labId <= 0) {
      return res.status(400).json({ msg: 'Invalid lab ID' });
    }

    const [availability] = await db.query(
      `SELECT 
        a.id,
        a.available_time,
        a.duration_minutes,
        DATE_FORMAT(a.available_time, '%Y-%m-%d') AS date,
        DATE_FORMAT(a.available_time, '%h:%i %p') AS time_12hr
       FROM availability a
       LEFT JOIN appointments ap ON ap.lab_id = ? 
         AND ap.appointment_time = a.available_time 
         AND ap.status IN ('pending', 'confirmed')
       WHERE a.lab_id = ? 
       AND a.is_available = TRUE 
       AND a.available_time >= NOW()
       AND ap.id IS NULL
       ORDER BY a.available_time ASC`,
      [labId, labId]
    );

    res.json(availability || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
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

    // Check if lab_id column exists in appointments table
    let hasLabIdColumn = false;
    try {
      const [columns] = await db.query(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'appointments' 
        AND COLUMN_NAME = 'lab_id'
      `);
      hasLabIdColumn = columns && columns.length > 0;
    } catch (checkErr) {
      console.warn('Could not check for lab_id column:', checkErr.message);
    }

    let appointments;
    if (hasLabIdColumn) {
      // Query with lab support
      [appointments] = await db.query(`
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
    } else {
      // Query without lab support (backward compatibility)
      [appointments] = await db.query(`
        SELECT 
          a.*,
          d.specialty,
          du.name as doctor_name,
          du.email as doctor_email,
          NULL as lab_name,
          NULL as lab_email,
          NULL as lab_address
        FROM appointments a
        LEFT JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN users du ON d.user_id = du.id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_time DESC
      `, [patient_id]);
    }

    res.json(appointments || []);
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ 
      msg: 'Server Error', 
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
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
    res.status(500).json({ msg: 'Server Error', error: err.message });
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

    // Convert ISO datetime format to MySQL datetime format
    let mysqlDateTime;
    try {
      mysqlDateTime = convertToMySQLDateTime(appointment_time);
    } catch (err) {
      return res.status(400).json({ msg: 'Invalid datetime format. Please select a valid time slot.' });
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
          [patient_id, labId, mysqlDateTime]
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
        [patient_id, doctorId, mysqlDateTime]
      );
    }

    const appointmentId = newAppointment.insertId;

    // Send notifications
    try {
      if (doctorId) {
        // Notify doctor about new appointment booking
        const [doctorRows] = await db.query('SELECT user_id FROM doctors WHERE id = ?', [doctorId]);
        if (doctorRows && doctorRows.length > 0) {
          const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
          const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';
          await notificationService.notifyDoctorPatientAppointmentBooked(
            doctorRows[0].user_id,
            appointmentId,
            patientName
          );
        }
      } else if (labId) {
        // Notify lab about new appointment booking
        const [labRows] = await db.query('SELECT user_id FROM labs WHERE id = ?', [labId]);
        if (labRows && labRows.length > 0) {
          const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
          const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';
          await notificationService.notifyLabPatientAppointmentBooked(
            labRows[0].user_id,
            appointmentId,
            patientName
          );
        }
      }
    } catch (notifErr) {
      console.error('Error sending notification:', notifErr);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      id: appointmentId,
      patient_id,
      doctor_id: doctorId,
      lab_id: labId,
      appointment_time: mysqlDateTime,
      status: 'pending'
    });
  } catch (err) {
    console.error(err && err.message);
    if (err && err.sql && err.sql.includes('FOREIGN KEY')) {
      const errorMsg = lab_id ? 'Lab not found' : 'Doctor not found';
      return res.status(404).json({ msg: errorMsg });
    }
    res.status(500).json({ msg: 'Server Error', error: err.message });
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

    // Convert ISO datetime format to MySQL datetime format
    let mysqlDateTime;
    try {
      mysqlDateTime = convertToMySQLDateTime(appointment_time);
    } catch (err) {
      return res.status(400).json({ msg: 'Invalid datetime format. Please select a valid time slot.' });
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
        [patient_id, labId, mysqlDateTime]
      );
      
      const appointmentId = newAppointment.insertId;

      // Send notification to lab
      try {
        const [labRows] = await db.query('SELECT user_id FROM labs WHERE id = ?', [labId]);
        if (labRows && labRows.length > 0) {
          const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
          const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';
          await notificationService.notifyLabPatientAppointmentBooked(
            labRows[0].user_id,
            appointmentId,
            patientName
          );
        }
      } catch (notifErr) {
        console.error('Error sending notification:', notifErr);
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        id: appointmentId,
        patient_id,
        lab_id: labId,
        appointment_time: mysqlDateTime,
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
          [patient_id, labId, mysqlDateTime]
        );
        
        const appointmentId = newAppointment.insertId;

        // Send notification to lab
        try {
          const [labRows] = await db.query('SELECT user_id FROM labs WHERE id = ?', [labId]);
          if (labRows && labRows.length > 0) {
            const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
            const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';
            await notificationService.notifyLabPatientAppointmentBooked(
              labRows[0].user_id,
              appointmentId,
              patientName
            );
          }
        } catch (notifErr) {
          console.error('Error sending notification:', notifErr);
          // Don't fail the request if notification fails
        }

        res.status(201).json({
          id: appointmentId,
          patient_id,
          lab_id: labId,
          appointment_time: mysqlDateTime,
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
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/patients/notifications ---
// --- @desc     Get notifications for the current patient ---
// --- @access   Private (Patient) ---
router.get('/notifications', [auth, authorize('patient')], async (req, res) => {
  try {
    const { unread_only } = req.query;
    const unreadOnly = unread_only === 'true' || unread_only === '1';
    
    const notifications = await notificationService.getNotifications(req.user.id, unreadOnly);
    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/patients/notifications/unread-count ---
// --- @desc     Get unread notification count for the current patient ---
// --- @access   Private (Patient) ---
router.get('/notifications/unread-count', [auth, authorize('patient')], async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    PUT /api/patients/notifications/:notificationId/read ---
// --- @desc     Mark a notification as read ---
// --- @access   Private (Patient) ---
router.put('/notifications/:notificationId/read', [auth, authorize('patient')], async (req, res) => {
  try {
    const { notificationId } = req.params;
    const success = await notificationService.markAsRead(parseInt(notificationId), req.user.id);
    
    if (success) {
      res.json({ msg: 'Notification marked as read' });
    } else {
      res.status(404).json({ msg: 'Notification not found' });
    }
  } catch (err) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    PUT /api/patients/notifications/read-all ---
// --- @desc     Mark all notifications as read for the current patient ---
// --- @access   Private (Patient) ---
router.put('/notifications/read-all', [auth, authorize('patient')], async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json({ msg: 'All notifications marked as read', count });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    POST /api/patients/submissions/:submission_id/request-feedback ---
// --- @desc     Request feedback from doctor on a submission ---
// --- @access   Private (Patient) ---
router.post('/submissions/:submission_id/request-feedback', [auth, authorize('patient')], async (req, res) => {
  try {
    const { submission_id } = req.params;
    const { doctor_id } = req.body || {};

    // Get patient info
    const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
    const patient_id = patientRows[0].id;

    // Verify submission belongs to patient
    const [submissionRows] = await db.query(
      'SELECT * FROM nail_submissions WHERE id = ? AND patient_id = ?',
      [submission_id, patient_id]
    );
    if (!submissionRows || submissionRows.length === 0) {
      return res.status(404).json({ msg: 'Submission not found' });
    }

    // If doctor_id is provided, notify that specific doctor
    if (doctor_id) {
      const doctorId = parseInt(doctor_id);
      const [doctorRows] = await db.query('SELECT user_id FROM doctors WHERE id = ?', [doctorId]);
      if (doctorRows && doctorRows.length > 0) {
        const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
        const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';
        await notificationService.notifyDoctorPatientFeedbackRequest(
          doctorRows[0].user_id,
          parseInt(submission_id),
          patientName
        );
        return res.json({ msg: 'Feedback request sent to doctor' });
      } else {
        return res.status(404).json({ msg: 'Doctor not found' });
      }
    } else {
      // Notify all doctors linked to this patient via appointments
      const [doctorRows] = await db.query(
        `SELECT DISTINCT d.user_id 
         FROM doctors d
         JOIN appointments a ON d.id = a.doctor_id
         WHERE a.patient_id = ?`,
        [patient_id]
      );

      const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
      const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';

      for (const doctorRow of doctorRows) {
        try {
          await notificationService.notifyDoctorPatientFeedbackRequest(
            doctorRow.user_id,
            parseInt(submission_id),
            patientName
          );
        } catch (notifErr) {
          console.error(`Error notifying doctor ${doctorRow.user_id}:`, notifErr);
        }
      }

      res.json({ msg: 'Feedback request sent to all linked doctors' });
    }
  } catch (err) {
    console.error('Error requesting feedback:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

module.exports = router;

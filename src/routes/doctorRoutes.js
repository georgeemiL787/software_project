const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth, authorize } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// --- @route    GET /api/doctors/patients ---
// --- @desc     Get all patients linked to this doctor via appointments ---
// --- @access   Private (Doctor) ---
router.get('/patients', [auth, authorize('doctor')], async (req, res) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!doctorRows || doctorRows.length === 0) return res.status(404).json({ msg: 'Doctor profile not found' });
    const doctor_id = doctorRows[0].id;

    const [patients] = await db.query(
      `SELECT DISTINCT p.id, u.name, u.email
       FROM patients p
       JOIN users u ON p.user_id = u.id
       JOIN appointments a ON p.id = a.patient_id
       WHERE a.doctor_id = ?`,
      [doctor_id]
    );

    res.json(patients);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/doctors/submissions/:patient_id ---
// --- @desc     Get all nail submissions for a specific patient ---
// --- @access   Private (Doctor) ---
router.get('/submissions/:patient_id', [auth, authorize('doctor')], async (req, res) => {
  try {
    const { patient_id } = req.params;
    const [submissions] = await db.query(
      'SELECT * FROM nail_submissions WHERE patient_id = ? ORDER BY submitted_at DESC',
      [patient_id]
    );

    // Return empty array if no submissions found (200 OK, not an error)
    res.json(submissions || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/doctors/pending-reviews ---
// --- @desc     Get submissions needing feedback ---
// --- @access   Private (Doctor) ---
router.get('/pending-reviews', [auth, authorize('doctor')], async (req, res) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!doctorRows || doctorRows.length === 0) return res.status(404).json({ msg: 'Doctor profile not found' });
    const doctor_id = doctorRows[0].id;

    // Get all patients linked to this doctor
    const [patientRows] = await db.query(
      `SELECT DISTINCT p.id as patient_id
       FROM patients p
       JOIN appointments a ON p.id = a.patient_id
       WHERE a.doctor_id = ?`,
      [doctor_id]
    );

    if (!patientRows || patientRows.length === 0) {
      return res.json([]);
    }

    const patientIds = patientRows.map(p => p.patient_id);
    const placeholders = patientIds.map(() => '?').join(',');

    // Get submissions without feedback from linked patients
    const [submissions] = await db.query(
      `SELECT ns.*, u.name as patient_name, u.email as patient_email
       FROM nail_submissions ns
       JOIN patients p ON ns.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ns.patient_id IN (${placeholders}) 
       AND (ns.doctor_feedback IS NULL OR ns.doctor_feedback = '')
       ORDER BY ns.submitted_at DESC`,
      patientIds
    );

    res.json(submissions || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/doctors/analytics ---
// --- @desc     Get quick analytics for the current doctor ---
// --- @access   Private (Doctor) ---
router.get('/analytics', [auth, authorize('doctor')], async (req, res) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!doctorRows || doctorRows.length === 0) return res.status(404).json({ msg: 'Doctor profile not found' });
    const doctor_id = doctorRows[0].id;

    const [patientRows] = await db.query(
      `SELECT DISTINCT p.id
       FROM patients p
       JOIN appointments a ON p.id = a.patient_id
       WHERE a.doctor_id = ?`,
      [doctor_id]
    );

    if (!patientRows || patientRows.length === 0) {
      return res.json({
        patient_count: 0,
        submission_count: 0,
        pending_reviews: 0,
        recent_submissions: []
      });
    }

    const patientIds = patientRows.map(p => p.id);
    const placeholders = patientIds.map(() => '?').join(',');

    const [[submissionCount]] = await db.query(
      `SELECT COUNT(*) AS total FROM nail_submissions WHERE patient_id IN (${placeholders})`,
      patientIds
    );

    const [[pendingCount]] = await db.query(
      `SELECT COUNT(*) AS pending 
       FROM nail_submissions 
       WHERE patient_id IN (${placeholders}) 
       AND (doctor_feedback IS NULL OR doctor_feedback = '')`,
      patientIds
    );

    const [recentSubs] = await db.query(
      `SELECT ns.*, u.name AS patient_name
       FROM nail_submissions ns
       JOIN patients p ON ns.patient_id = p.id
       JOIN users u ON p.user_id = u.id
       WHERE ns.patient_id IN (${placeholders})
       ORDER BY ns.submitted_at DESC
       LIMIT 5`,
      patientIds
    );

    res.json({
      patient_count: patientRows.length,
      submission_count: submissionCount?.total || 0,
      pending_reviews: pendingCount?.pending || 0,
      recent_submissions: recentSubs || []
    });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/doctors/my-appointments ---
// --- @desc     Get current doctor's appointments ---
// --- @access   Private (Doctor) ---
router.get('/my-appointments', [auth, authorize('doctor')], async (req, res) => {
  try {
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!doctorRows || doctorRows.length === 0) return res.status(404).json({ msg: 'Doctor profile not found' });
    const doctor_id = doctorRows[0].id;

    const [appointments] = await db.query(`
      SELECT 
        a.*,
        u.name as patient_name,
        u.email as patient_email
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE a.doctor_id = ?
      ORDER BY a.appointment_time DESC
    `, [doctor_id]);

    res.json(appointments || []);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    PUT /api/doctors/submissions/:submission_id/feedback ---
// --- @desc     Add or update feedback on a nail submission ---
// --- @access   Private (Doctor) ---
router.put('/submissions/:submission_id/feedback', [auth, authorize('doctor')], async (req, res) => {
  try {
    const { submission_id } = req.params;
    const { feedback } = req.body || {};
    if (!feedback) return res.status(400).json({ msg: 'Feedback text is required' });

    // Get submission details to find patient
    const [submissionRows] = await db.query(
      `SELECT ns.patient_id, p.user_id as patient_user_id 
       FROM nail_submissions ns 
       JOIN patients p ON ns.patient_id = p.id 
       WHERE ns.id = ?`,
      [submission_id]
    );
    
    if (!submissionRows || submissionRows.length === 0) {
      return res.status(404).json({ msg: 'Submission not found' });
    }

    const [result] = await db.query('UPDATE nail_submissions SET doctor_feedback = ? WHERE id = ?', [feedback, submission_id]);
    if (result.affectedRows === 0) return res.status(404).json({ msg: 'Submission not found' });

    // Send notification to patient
    try {
      const [doctorUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
      const doctorName = doctorUser && doctorUser.length > 0 ? doctorUser[0].name : 'Your doctor';
      await notificationService.notifyPatientDoctorFeedback(
        submissionRows[0].patient_user_id,
        parseInt(submission_id),
        doctorName
      );
    } catch (notifErr) {
      console.error('Error sending notification:', notifErr);
      // Don't fail the request if notification fails
    }

    res.json({ msg: 'Feedback updated successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    PUT /api/doctors/appointments/:appointment_id/status ---
// --- @desc     Accept or refuse a patient appointment ---
// --- @access   Private (Doctor) ---
router.put('/appointments/:appointment_id/status', [auth, authorize('doctor')], async (req, res) => {
  try {
    const { appointment_id } = req.params;
    const { status, notes } = req.body || {};
    
    // Validate status
    const validStatuses = ['confirmed', 'cancelled'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ msg: 'Status must be "confirmed" (accept) or "cancelled" (refuse)' });
    }

    // Verify the doctor owns this appointment
    const [doctorRows] = await db.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [req.user.id]);
    if (!doctorRows || doctorRows.length === 0) return res.status(404).json({ msg: 'Doctor profile not found' });
    const doctor_id = doctorRows[0].id;

    // Check if appointment exists and belongs to this doctor
    const [appointmentRows] = await db.query(
      'SELECT * FROM appointments WHERE id = ? AND doctor_id = ?',
      [appointment_id, doctor_id]
    );
    
    if (!appointmentRows || appointmentRows.length === 0) {
      return res.status(404).json({ msg: 'Appointment not found or you do not have permission to modify it' });
    }

    // Update appointment status
    const updateQuery = notes 
      ? 'UPDATE appointments SET status = ?, notes = ? WHERE id = ? AND doctor_id = ?'
      : 'UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?';
    
    const updateParams = notes 
      ? [status, notes, appointment_id, doctor_id]
      : [status, appointment_id, doctor_id];

    const [result] = await db.query(updateQuery, updateParams);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ msg: 'Appointment not found or could not be updated' });
    }

    // Send notification to patient if appointment is confirmed
    if (status === 'confirmed') {
      try {
        const [appointmentData] = await db.query(
          `SELECT a.patient_id, p.user_id as patient_user_id 
           FROM appointments a 
           JOIN patients p ON a.patient_id = p.id 
           WHERE a.id = ?`,
          [appointment_id]
        );
        
        if (appointmentData && appointmentData.length > 0) {
          const [doctorUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
          const doctorName = doctorUser && doctorUser.length > 0 ? doctorUser[0].name : 'Your doctor';
          await notificationService.notifyPatientDoctorAppointmentApproval(
            appointmentData[0].patient_user_id,
            parseInt(appointment_id),
            doctorName
          );
        }
      } catch (notifErr) {
        console.error('Error sending notification:', notifErr);
        // Don't fail the request if notification fails
      }
    }

    // If notes are provided, also send appointment feedback notification
    if (notes && notes.trim() !== '') {
      try {
        const [appointmentData] = await db.query(
          `SELECT a.patient_id, p.user_id as patient_user_id 
           FROM appointments a 
           JOIN patients p ON a.patient_id = p.id 
           WHERE a.id = ?`,
          [appointment_id]
        );
        
        if (appointmentData && appointmentData.length > 0) {
          const [doctorUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
          const doctorName = doctorUser && doctorUser.length > 0 ? doctorUser[0].name : 'Your doctor';
          await notificationService.notifyPatientAppointmentFeedback(
            appointmentData[0].patient_user_id,
            parseInt(appointment_id),
            doctorName
          );
        }
      } catch (notifErr) {
        console.error('Error sending notification:', notifErr);
        // Don't fail the request if notification fails
      }
    }

    res.json({ 
      msg: status === 'confirmed' ? 'Appointment accepted successfully' : 'Appointment refused successfully',
      appointment_id: parseInt(appointment_id),
      status 
    });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    GET /api/doctors/notifications ---
// --- @desc     Get notifications for the current doctor ---
// --- @access   Private (Doctor) ---
router.get('/notifications', [auth, authorize('doctor')], async (req, res) => {
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

// --- @route    GET /api/doctors/notifications/unread-count ---
// --- @desc     Get unread notification count for the current doctor ---
// --- @access   Private (Doctor) ---
router.get('/notifications/unread-count', [auth, authorize('doctor')], async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.user.id);
    res.json({ count });
  } catch (err) {
    console.error('Error fetching unread count:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

// --- @route    PUT /api/doctors/notifications/:notificationId/read ---
// --- @desc     Mark a notification as read ---
// --- @access   Private (Doctor) ---
router.put('/notifications/:notificationId/read', [auth, authorize('doctor')], async (req, res) => {
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

// --- @route    PUT /api/doctors/notifications/read-all ---
// --- @desc     Mark all notifications as read for the current doctor ---
// --- @access   Private (Doctor) ---
router.put('/notifications/read-all', [auth, authorize('doctor')], async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.user.id);
    res.json({ msg: 'All notifications marked as read', count });
  } catch (err) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ msg: 'Server Error', error: err.message });
  }
});

module.exports = router;

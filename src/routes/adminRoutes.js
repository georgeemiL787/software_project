const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { auth, authorize } = require('../middleware/auth');

// All routes in this file require admin authentication
// This is handled by the middleware in server.js

// ============================================
// 1. USER MANAGEMENT & VERIFICATION
// ============================================

// --- @route    GET /api/admin/users ---
// --- @desc     Get all users with their roles and status ---
// --- @access   Private (Admin) ---
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        CASE 
          WHEN u.role = 'patient' THEN (SELECT id FROM patients WHERE user_id = u.id LIMIT 1)
          WHEN u.role = 'doctor' THEN (SELECT id FROM doctors WHERE user_id = u.id LIMIT 1)
          WHEN u.role = 'lab' THEN (SELECT id FROM labs WHERE user_id = u.id LIMIT 1)
          ELSE NULL
        END as profile_id
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json(users);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    GET /api/admin/users/:id ---
// --- @desc     Get detailed info about a specific user ---
// --- @access   Private (Admin) ---
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [users] = await db.query('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?', [id]);
    if (!users || users.length === 0) return res.status(404).json({ msg: 'User not found' });
    
    const user = users[0];
    let profile = null;
    
    // Get role-specific profile
    if (user.role === 'patient') {
      const [patients] = await db.query('SELECT * FROM patients WHERE user_id = ?', [id]);
      profile = patients[0] || null;
    } else if (user.role === 'doctor') {
      const [doctors] = await db.query('SELECT * FROM doctors WHERE user_id = ?', [id]);
      profile = doctors[0] || null;
    } else if (user.role === 'lab') {
      const [labs] = await db.query('SELECT * FROM labs WHERE user_id = ?', [id]);
      profile = labs[0] || null;
    }
    
    res.json({ ...user, profile });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/users/:id ---
// --- @desc     Update user information ---
// --- @access   Private (Admin) ---
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, is_active } = req.body;
    
    const updates = [];
    const values = [];
    
    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    
    if (updates.length === 0) return res.status(400).json({ msg: 'No fields to update' });
    
    values.push(id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ msg: 'User updated successfully' });
  } catch (err) {
    console.error(err && err.message);
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(409).json({ msg: 'Email already exists' });
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    DELETE /api/admin/users/:id ---
// --- @desc     Delete a user (soft delete by deactivating) ---
// --- @access   Private (Admin) ---
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Soft delete: deactivate user
    await db.query('UPDATE users SET is_active = FALSE WHERE id = ?', [id]);
    
    res.json({ msg: 'User deactivated successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/users/:id/reset-password ---
// --- @desc     Reset a user's password ---
// --- @access   Private (Admin) ---
router.put('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);
    
    res.json({ msg: 'Password reset successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    GET /api/admin/pending-verifications ---
// --- @desc     Get all unverified doctors and labs ---
// --- @access   Private (Admin) ---
router.get('/pending-verifications', async (req, res) => {
  try {
    const [doctors] = await db.query(`
      SELECT 
        d.id,
        d.user_id,
        d.specialty,
        d.clinic_address,
        d.verified,
        d.is_active,
        u.name,
        u.email,
        u.created_at
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      WHERE d.verified = FALSE
      ORDER BY u.created_at ASC
    `);
    
    const [labs] = await db.query(`
      SELECT 
        l.id,
        l.user_id,
        l.lab_address,
        l.available_tests,
        l.verified,
        l.is_active,
        u.name,
        u.email,
        u.created_at
      FROM labs l
      JOIN users u ON l.user_id = u.id
      WHERE l.verified = FALSE
      ORDER BY u.created_at ASC
    `);
    
    res.json({ doctors, labs });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/doctors/:id/verify ---
// --- @desc     Verify/approve a doctor ---
// --- @access   Private (Admin) ---
router.put('/doctors/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    await db.query(
      'UPDATE doctors SET verified = TRUE, verified_at = NOW(), verified_by = ? WHERE id = ?',
      [adminId, id]
    );
    
    res.json({ msg: 'Doctor verified successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/labs/:id/verify ---
// --- @desc     Verify/approve a lab ---
// --- @access   Private (Admin) ---
router.put('/labs/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    
    await db.query(
      'UPDATE labs SET verified = TRUE, verified_at = NOW(), verified_by = ? WHERE id = ?',
      [adminId, id]
    );
    
    res.json({ msg: 'Lab verified successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// ============================================
// 2. SYSTEM DATA & DISPUTE RESOLUTION
// ============================================

// --- @route    GET /api/admin/patients/:id/history ---
// --- @desc     Get complete patient history ---
// --- @access   Private (Admin) ---
router.get('/patients/:id/history', async (req, res) => {
  try {
    const { id } = req.params; // patient_id (not user_id)
    
    // Get patient info
    const [patients] = await db.query(`
      SELECT p.*, u.name, u.email, u.created_at as account_created
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);
    
    if (!patients || patients.length === 0) {
      return res.status(404).json({ msg: 'Patient not found' });
    }
    
    const patient = patients[0];
    
    // Get all nail submissions
    const [submissions] = await db.query(
      'SELECT * FROM nail_submissions WHERE patient_id = ? ORDER BY submitted_at DESC',
      [id]
    );
    
    // Get all appointments
    const [appointments] = await db.query(`
      SELECT 
        a.*,
        d.specialty,
        u.name as doctor_name,
        u.email as doctor_email
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      WHERE a.patient_id = ?
      ORDER BY a.appointment_time DESC
    `, [id]);
    
    // Get all lab tests
    const [labTests] = await db.query(`
      SELECT 
        lt.*,
        d.specialty,
        u.name as doctor_name,
        l.lab_address,
        lu.name as lab_name
      FROM lab_tests lt
      JOIN doctors d ON lt.requested_by_doctor_id = d.id
      JOIN users u ON d.user_id = u.id
      LEFT JOIN labs l ON lt.lab_id = l.id
      LEFT JOIN users lu ON l.user_id = lu.id
      WHERE lt.patient_id = ?
      ORDER BY lt.requested_at DESC
    `, [id]);
    
    res.json({
      patient,
      submissions,
      appointments,
      lab_tests: labTests
    });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    DELETE /api/admin/submissions/:id ---
// --- @desc     Delete a nail submission ---
// --- @access   Private (Admin) ---
router.delete('/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM nail_submissions WHERE id = ?', [id]);
    res.json({ msg: 'Submission deleted successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/appointments/:id ---
// --- @desc     Update an appointment ---
// --- @access   Private (Admin) ---
router.put('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { appointment_time, status, notes } = req.body;
    
    const updates = [];
    const values = [];
    
    if (appointment_time !== undefined) {
      updates.push('appointment_time = ?');
      values.push(appointment_time);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (notes !== undefined) {
      updates.push('notes = ?');
      values.push(notes);
    }
    
    if (updates.length === 0) return res.status(400).json({ msg: 'No fields to update' });
    
    values.push(id);
    await db.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ msg: 'Appointment updated successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    DELETE /api/admin/appointments/:id ---
// --- @desc     Delete an appointment ---
// --- @access   Private (Admin) ---
router.delete('/appointments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM appointments WHERE id = ?', [id]);
    res.json({ msg: 'Appointment deleted successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    PUT /api/admin/lab-tests/:id ---
// --- @desc     Update a lab test (e.g., remove corrupt results_url) ---
// --- @access   Private (Admin) ---
router.put('/lab-tests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { test_type, status, results_url, lab_id } = req.body;
    
    const updates = [];
    const values = [];
    
    if (test_type !== undefined) {
      updates.push('test_type = ?');
      values.push(test_type);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }
    if (results_url !== undefined) {
      updates.push('results_url = ?');
      values.push(results_url);
    }
    if (lab_id !== undefined) {
      updates.push('lab_id = ?');
      values.push(lab_id);
    }
    
    if (updates.length === 0) return res.status(400).json({ msg: 'No fields to update' });
    
    values.push(id);
    await db.query(`UPDATE lab_tests SET ${updates.join(', ')} WHERE id = ?`, values);
    
    res.json({ msg: 'Lab test updated successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    DELETE /api/admin/lab-tests/:id ---
// --- @desc     Delete a lab test ---
// --- @access   Private (Admin) ---
router.delete('/lab-tests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM lab_tests WHERE id = ?', [id]);
    res.json({ msg: 'Lab test deleted successfully' });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// ============================================
// 3. SYSTEM HEALTH & MONITORING (DASHBOARD)
// ============================================

// --- @route    GET /api/admin/dashboard ---
// --- @desc     Get dashboard statistics ---
// --- @access   Private (Admin) ---
router.get('/dashboard', async (req, res) => {
  try {
    // User signups by role
    const [userStats] = await db.query(`
      SELECT 
        role,
        COUNT(*) as count,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as week_count
      FROM users
      GROUP BY role
    `);
    
    // Total nail submissions
    const [submissionStats] = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN DATE(submitted_at) = CURDATE() THEN 1 ELSE 0 END) as today_count,
        SUM(CASE WHEN DATE(submitted_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as week_count
      FROM nail_submissions
    `);
    
    // Pending lab tests
    const [pendingTests] = await db.query(`
      SELECT COUNT(*) as count
      FROM lab_tests
      WHERE status = 'requested' OR status = 'scheduled'
    `);
    
    // Pending verifications
    const [pendingDoctors] = await db.query(`
      SELECT COUNT(*) as count
      FROM doctors
      WHERE verified = FALSE
    `);
    
    const [pendingLabs] = await db.query(`
      SELECT COUNT(*) as count
      FROM labs
      WHERE verified = FALSE
    `);
    
    // Active vs inactive users
    const [activeUsers] = await db.query(`
      SELECT 
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive
      FROM users
    `);
    
    // Recent activity (last 10 submissions)
    const [recentSubmissions] = await db.query(`
      SELECT 
        ns.id,
        ns.submitted_at,
        ns.ai_prediction,
        u.name as patient_name,
        u.email as patient_email
      FROM nail_submissions ns
      JOIN patients p ON ns.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY ns.submitted_at DESC
      LIMIT 10
    `);
    
    res.json({
      user_stats: userStats,
      submission_stats: {
        total: submissionStats[0]?.total || 0,
        today: submissionStats[0]?.today_count || 0,
        this_week: submissionStats[0]?.week_count || 0
      },
      pending_lab_tests: pendingTests[0]?.count || 0,
      pending_verifications: {
        doctors: pendingDoctors[0]?.count || 0,
        labs: pendingLabs[0]?.count || 0,
        total: (pendingDoctors[0]?.count || 0) + (pendingLabs[0]?.count || 0)
      },
      user_status: {
        active: activeUsers[0]?.active || 0,
        inactive: activeUsers[0]?.inactive || 0
      },
      recent_submissions: recentSubmissions
    });
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    GET /api/admin/all-submissions ---
// --- @desc     Get all nail submissions in the system ---
// --- @access   Private (Admin) ---
router.get('/all-submissions', async (req, res) => {
  try {
    const [submissions] = await db.query(`
      SELECT 
        ns.*,
        u.name as patient_name,
        u.email as patient_email
      FROM nail_submissions ns
      JOIN patients p ON ns.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      ORDER BY ns.submitted_at DESC
    `);
    res.json(submissions);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    GET /api/admin/all-appointments ---
// --- @desc     Get all appointments in the system ---
// --- @access   Private (Admin) ---
router.get('/all-appointments', async (req, res) => {
  try {
    const [appointments] = await db.query(`
      SELECT 
        a.*,
        pu.name as patient_name,
        pu.email as patient_email,
        du.name as doctor_name,
        du.email as doctor_email,
        d.specialty
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      JOIN users pu ON p.user_id = pu.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users du ON d.user_id = du.id
      ORDER BY a.appointment_time DESC
    `);
    res.json(appointments);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

// --- @route    GET /api/admin/all-lab-tests ---
// --- @desc     Get all lab tests in the system ---
// --- @access   Private (Admin) ---
router.get('/all-lab-tests', async (req, res) => {
  try {
    const [labTests] = await db.query(`
      SELECT 
        lt.*,
        pu.name as patient_name,
        pu.email as patient_email,
        du.name as doctor_name,
        du.email as doctor_email,
        lu.name as lab_name,
        lu.email as lab_email
      FROM lab_tests lt
      JOIN patients p ON lt.patient_id = p.id
      JOIN users pu ON p.user_id = pu.id
      JOIN doctors d ON lt.requested_by_doctor_id = d.id
      JOIN users du ON d.user_id = du.id
      LEFT JOIN labs l ON lt.lab_id = l.id
      LEFT JOIN users lu ON l.user_id = lu.id
      ORDER BY lt.requested_at DESC
    `);
    res.json(labTests);
  } catch (err) {
    console.error(err && err.message);
    res.status(500).json({ msg: 'Server Error' });
  }
});

module.exports = router;


const db = require('../db');

/**
 * Notification Service
 * Handles creating and managing notifications for users
 */

// Notification types
const NOTIFICATION_TYPES = {
  // Patient notifications
  DOCTOR_FEEDBACK: 'doctor_feedback',
  LAB_APPROVAL: 'lab_approval',
  DOCTOR_APPOINTMENT_APPROVAL: 'doctor_appointment_approval',
  APPOINTMENT_FEEDBACK: 'appointment_feedback',
  DOCTOR_RESULT_FEEDBACK: 'doctor_result_feedback',
  LAB_RESULT: 'lab_result',
  DOCTOR_FEEDBACK_REQUEST: 'doctor_feedback_request',
  LAB_APPOINTMENT_REQUEST: 'lab_appointment_request',
  
  // Doctor notifications
  PATIENT_APPOINTMENT_BOOKED: 'patient_appointment_booked',
  MODEL_PREDICTION: 'model_prediction',
  PATIENT_FEEDBACK_REQUEST: 'patient_feedback_request',
  
  // Lab notifications
  PATIENT_APPOINTMENT_BOOKED_LAB: 'patient_appointment_booked_lab',
};

/**
 * Create a notification for a user
 * @param {number} userId - The user ID to notify
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number} relatedId - Optional related entity ID
 * @param {string} relatedType - Optional related entity type
 */
async function createNotification(userId, type, title, message, relatedId = null, relatedType = null) {
  try {
    const [result] = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, related_id, related_type) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, type, title, message, relatedId, relatedType]
    );
    return result.insertId;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Get notifications for a user
 * @param {number} userId - The user ID
 * @param {boolean} unreadOnly - If true, only return unread notifications
 * @param {number} limit - Maximum number of notifications to return
 */
async function getNotifications(userId, unreadOnly = false, limit = 50) {
  try {
    let query = `SELECT * FROM notifications WHERE user_id = ?`;
    const params = [userId];
    
    if (unreadOnly) {
      query += ` AND is_read = FALSE`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
    
    const [notifications] = await db.query(query, params);
    return notifications || [];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 * @param {number} notificationId - The notification ID
 * @param {number} userId - The user ID (for security)
 */
async function markAsRead(notificationId, userId) {
  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
      [notificationId, userId]
    );
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * @param {number} userId - The user ID
 */
async function markAllAsRead(userId) {
  try {
    const [result] = await db.query(
      `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );
    return result.affectedRows;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
}

/**
 * Get unread notification count for a user
 * @param {number} userId - The user ID
 */
async function getUnreadCount(userId) {
  try {
    const [[result]] = await db.query(
      `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );
    return result?.count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    throw error;
  }
}

/**
 * Notify patient when doctor provides feedback on submission
 */
async function notifyPatientDoctorFeedback(patientUserId, submissionId, doctorName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.DOCTOR_FEEDBACK,
    'Doctor Feedback Received',
    `Dr. ${doctorName} has provided feedback on your nail submission.`,
    submissionId,
    'submission'
  );
}

/**
 * Notify patient when lab approves a test
 */
async function notifyPatientLabApproval(patientUserId, labTestId, labName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.LAB_APPROVAL,
    'Lab Test Approved',
    `${labName} has approved your lab test request.`,
    labTestId,
    'lab_test'
  );
}

/**
 * Notify patient when doctor approves appointment
 */
async function notifyPatientDoctorAppointmentApproval(patientUserId, appointmentId, doctorName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.DOCTOR_APPOINTMENT_APPROVAL,
    'Appointment Confirmed',
    `Dr. ${doctorName} has confirmed your appointment.`,
    appointmentId,
    'appointment'
  );
}

/**
 * Notify patient when doctor provides appointment feedback
 */
async function notifyPatientAppointmentFeedback(patientUserId, appointmentId, doctorName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.APPOINTMENT_FEEDBACK,
    'Appointment Feedback',
    `Dr. ${doctorName} has provided feedback on your appointment.`,
    appointmentId,
    'appointment'
  );
}

/**
 * Notify patient when doctor provides feedback on lab results
 */
async function notifyPatientDoctorResultFeedback(patientUserId, labTestId, doctorName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.DOCTOR_RESULT_FEEDBACK,
    'Doctor Feedback on Lab Results',
    `Dr. ${doctorName} has provided feedback on your lab test results.`,
    labTestId,
    'lab_test'
  );
}

/**
 * Notify patient when lab uploads results
 */
async function notifyPatientLabResult(patientUserId, labTestId, labName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.LAB_RESULT,
    'Lab Results Available',
    `Your lab test results from ${labName} are now available.`,
    labTestId,
    'lab_test'
  );
}

/**
 * Notify patient when doctor requests feedback
 */
async function notifyPatientDoctorFeedbackRequest(patientUserId, submissionId, doctorName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.DOCTOR_FEEDBACK_REQUEST,
    'Feedback Requested',
    `Dr. ${doctorName} is requesting feedback on your submission.`,
    submissionId,
    'submission'
  );
}

/**
 * Notify patient when lab requests appointment booking
 */
async function notifyPatientLabAppointmentRequest(patientUserId, labName) {
  return await createNotification(
    patientUserId,
    NOTIFICATION_TYPES.LAB_APPOINTMENT_REQUEST,
    'Lab Appointment Request',
    `${labName} is requesting you to book an appointment.`,
    null,
    null
  );
}

/**
 * Notify doctor when patient books appointment
 */
async function notifyDoctorPatientAppointmentBooked(doctorUserId, appointmentId, patientName) {
  return await createNotification(
    doctorUserId,
    NOTIFICATION_TYPES.PATIENT_APPOINTMENT_BOOKED,
    'New Appointment Booking',
    `${patientName} has booked an appointment with you.`,
    appointmentId,
    'appointment'
  );
}

/**
 * Notify doctor when model prediction is made (patient uploads nail image)
 */
async function notifyDoctorModelPrediction(doctorUserId, submissionId, patientName, prediction) {
  return await createNotification(
    doctorUserId,
    NOTIFICATION_TYPES.MODEL_PREDICTION,
    'New Nail Analysis Submission',
    `${patientName} has uploaded a nail image. AI prediction: ${prediction}`,
    submissionId,
    'submission'
  );
}

/**
 * Notify doctor when patient requests feedback
 */
async function notifyDoctorPatientFeedbackRequest(doctorUserId, submissionId, patientName) {
  return await createNotification(
    doctorUserId,
    NOTIFICATION_TYPES.PATIENT_FEEDBACK_REQUEST,
    'Feedback Requested',
    `${patientName} is requesting feedback on their submission.`,
    submissionId,
    'submission'
  );
}

/**
 * Notify lab when patient books appointment
 */
async function notifyLabPatientAppointmentBooked(labUserId, appointmentId, patientName) {
  return await createNotification(
    labUserId,
    NOTIFICATION_TYPES.PATIENT_APPOINTMENT_BOOKED_LAB,
    'New Appointment Booking',
    `${patientName} has booked an appointment with your lab.`,
    appointmentId,
    'appointment'
  );
}

module.exports = {
  createNotification,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  notifyPatientDoctorFeedback,
  notifyPatientLabApproval,
  notifyPatientDoctorAppointmentApproval,
  notifyPatientAppointmentFeedback,
  notifyPatientDoctorResultFeedback,
  notifyPatientLabResult,
  notifyPatientDoctorFeedbackRequest,
  notifyPatientLabAppointmentRequest,
  notifyDoctorPatientAppointmentBooked,
  notifyDoctorModelPrediction,
  notifyDoctorPatientFeedbackRequest,
  notifyLabPatientAppointmentBooked,
  NOTIFICATION_TYPES
};


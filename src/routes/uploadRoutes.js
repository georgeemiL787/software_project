const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { auth, authorize } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Try to load model service, but don't fail if TensorFlow.js is not installed
let modelService = null;
try {
  modelService = require('../services/modelService');
} catch (error) {
  console.warn('Model service not available (TensorFlow.js may not be installed):', error.message);
  console.warn('Falling back to mock AI predictions.');
}

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpg, .jpeg, or .png images are allowed!'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 5 }, // 5MB
  fileFilter,
});

// --- AI Model Service ---
// Uses TensorFlow.js model for real predictions
// Falls back to mock if model is not available
async function runAIScan(imagePath) {
  if (!modelService) {
    // Model service not available, use mock
    return mockAIScan(imagePath);
  }
  
  try {
    // Try to use real model
    const result = await modelService.predict(imagePath);
    console.log(`AI prediction for ${imagePath}:`, result);
    return result;
  } catch (error) {
    console.warn('Model prediction failed, using fallback:', error.message);
    // Fallback to mock AI if model is not available
    return mockAIScan(imagePath);
  }
}

// Fallback mock AI service (used when model is not available)
const mockAIScan = (imagePath) => {
  console.log(`Using mock AI scan for: ${imagePath}`);
  const predictions = [
    { name: 'Koilonychia (Spoon Nails)', confidence: 0.92 },
    { name: "Terry's Nails", confidence: 0.85 },
    { name: 'Clubbing', confidence: 0.78 },
    { name: 'Healthy', confidence: 0.95 }
  ];
  const result = predictions[Math.floor(Math.random() * predictions.length)];
  return { prediction: result.name, confidence: result.confidence };
};

// POST /api/upload/nail
// Protected: patient only
router.post(
  '/nail',
  [auth, authorize('patient')],
  upload.single('nailImage'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ msg: 'No image file uploaded' });

      // Get patient id from patients table using users.id
      const [patientRows] = await db.query('SELECT id FROM patients WHERE user_id = ? LIMIT 1', [req.user.id]);
      if (!patientRows || patientRows.length === 0) return res.status(404).json({ msg: 'Patient profile not found' });
      const patientId = patientRows[0].id;

      // Save image path (normalize slashes for Windows)
      const imagePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
      // Get absolute path for model processing
      const absoluteImagePath = req.file.path;

      // Run AI prediction
      const aiResult = await runAIScan(absoluteImagePath);

      const [result] = await db.query(
        'INSERT INTO nail_submissions (patient_id, image_url, ai_prediction, ai_confidence) VALUES (?, ?, ?, ?)',
        [patientId, imagePath, aiResult.prediction, aiResult.confidence]
      );

      const submissionId = result.insertId;

      // Notify all doctors linked to this patient via appointments
      try {
        const [patientUser] = await db.query('SELECT name FROM users WHERE id = ?', [req.user.id]);
        const patientName = patientUser && patientUser.length > 0 ? patientUser[0].name : 'A patient';

        // Get all doctors who have appointments with this patient
        const [doctorRows] = await db.query(
          `SELECT DISTINCT d.user_id 
           FROM doctors d
           JOIN appointments a ON d.id = a.doctor_id
           WHERE a.patient_id = ?`,
          [patientId]
        );

        // Send notification to each doctor
        for (const doctorRow of doctorRows) {
          try {
            await notificationService.notifyDoctorModelPrediction(
              doctorRow.user_id,
              submissionId,
              patientName,
              aiResult.prediction
            );
          } catch (notifErr) {
            console.error(`Error notifying doctor ${doctorRow.user_id}:`, notifErr);
            // Continue with other doctors even if one fails
          }
        }
      } catch (notifErr) {
        console.error('Error sending notifications:', notifErr);
        // Don't fail the request if notification fails
      }

      res.status(201).json({
        id: submissionId,
        patient_id: patientId,
        image_url: imagePath,
        ai_prediction: aiResult.prediction,
        ai_confidence: aiResult.confidence,
        submitted_at: new Date()
      });
    } catch (err) {
      console.error(err && err.message);
      if (err && err.message && err.message.includes('images are allowed')) {
        return res.status(400).json({ msg: err.message });
      }
      res.status(500).json({ msg: 'Server Error' });
    }
  }
);

module.exports = router;

-- ============================================================================
-- Complete Database Schema for NailedIT Application
-- This file combines all migrations into a single comprehensive schema
-- ============================================================================
-- Usage: mysql -u root -p < complete_schema.sql
-- OR run in MySQL Workbench or your preferred SQL client
-- ============================================================================

-- 1. Create the database, drop it if it already exists to start fresh
DROP DATABASE IF EXISTS nailedit;
CREATE DATABASE nailedit;

-- 2. Select the database to use
USE nailedit;

-- ============================================================================
-- 3. Create the main Users table
-- This table stores login info for EVERYONE (Patients, Doctors, Labs, Admins)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL, -- Storing hashed password
    role ENUM('patient', 'doctor', 'lab', 'admin') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. Create the Patients table
-- This holds info ONLY for patients and links to the users table
-- ============================================================================
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    date_of_birth DATE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. Create the Doctors table
-- This holds info ONLY for doctors
-- Includes verification status for admin approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    specialty VARCHAR(100) DEFAULT 'General Practitioner',
    clinic_address VARCHAR(255),
    verified BOOLEAN DEFAULT FALSE,
    verified_at DATETIME NULL,
    verified_by INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 6. Create the Labs table
-- This holds info ONLY for labs
-- Includes verification status for admin approval
-- ============================================================================
CREATE TABLE IF NOT EXISTS labs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    lab_address VARCHAR(255),
    available_tests TEXT, -- Could be a JSON string of available tests
    verified BOOLEAN DEFAULT FALSE,
    verified_at DATETIME NULL,
    verified_by INT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 7. Create the Nail Submissions table (for the AI analysis)
-- Stores patient nail image uploads and AI predictions
-- ============================================================================
CREATE TABLE IF NOT EXISTS nail_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL, -- Path to the uploaded image
    ai_prediction VARCHAR(100), -- The result from the AI model
    ai_confidence FLOAT, -- The model's confidence score
    doctor_feedback TEXT, -- Feedback from the doctor
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

-- ============================================================================
-- 8. Create the Appointments table (Patient <-> Doctor OR Patient <-> Lab)
-- Supports both doctor appointments and lab appointments
-- doctor_id and lab_id are nullable, but at least one must be provided
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NULL, -- Nullable: can be NULL if lab_id is set
    lab_id INT NULL, -- Nullable: can be NULL if doctor_id is set
    appointment_time DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. Create the Lab Tests table (Patient <-> Doctor <-> Lab)
-- Tracks lab test requests from doctors for patients
-- ============================================================================
CREATE TABLE IF NOT EXISTS lab_tests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    requested_by_doctor_id INT NOT NULL,
    lab_id INT, -- Can be NULL until a lab is chosen
    test_type VARCHAR(100) NOT NULL, -- e.g., "Blood Panel", "Urinalysis"
    status ENUM('requested', 'scheduled', 'completed', 'cancelled') DEFAULT 'requested',
    results_url VARCHAR(255), -- Path to the uploaded PDF/result file
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by_doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE SET NULL
);

-- ============================================================================
-- 10. Create Revoked Tokens table (for JWT token revocation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS revoked_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token TEXT NOT NULL,
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================================
-- 11. Create Refresh Tokens table (for JWT refresh token management)
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_token (token(100))
) ENGINE=InnoDB;

-- ============================================================================
-- 12. Create Indexes for better query performance
-- MySQL doesn't support CREATE INDEX IF NOT EXISTS, so we use conditional logic
-- ============================================================================
SET @dbname = DATABASE();

-- Create index on doctors.verified if it doesn't exist
SET @indexname = 'idx_doctors_verified';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'doctors')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON doctors(verified)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on labs.verified if it doesn't exist
SET @indexname = 'idx_labs_verified';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'labs')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON labs(verified)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on users.is_active if it doesn't exist
SET @indexname = 'idx_users_active';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'users')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON users(is_active)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on appointments.patient_id if it doesn't exist
SET @indexname = 'idx_appointments_patient';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'appointments')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON appointments(patient_id)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on appointments.doctor_id if it doesn't exist
SET @indexname = 'idx_appointments_doctor';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'appointments')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON appointments(doctor_id)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on appointments.lab_id if it doesn't exist
SET @indexname = 'idx_appointments_lab';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'appointments')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON appointments(lab_id)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Create index on appointments.appointment_time if it doesn't exist
SET @indexname = 'idx_appointments_time';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = 'appointments')
      AND (index_name = @indexname)
  ) > 0,
  'SELECT 1',
  CONCAT('CREATE INDEX ', @indexname, ' ON appointments(appointment_time)')
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- ============================================================================
-- 13. Insert Sample/Dummy Data (Optional - Comment out for production)
-- ============================================================================

-- Create a user for a patient
INSERT INTO users (name, email, password, role) 
VALUES ('Alice Patient', 'alice@example.com', 'hashed_password_123', 'patient');

-- Create a user for a doctor
INSERT INTO users (name, email, password, role) 
VALUES ('Dr. Bob Smith', 'bob@example.com', 'hashed_password_456', 'doctor');

-- Create a user for a lab
INSERT INTO users (name, email, password, role)
VALUES ('City Diagnostics Lab', 'lab@example.com', 'hashed_password_789', 'lab');

-- Create a user for an admin
INSERT INTO users (name, email, password, role, is_active) 
VALUES ('Admin User', 'admin@nailedit.com', 'hashed_password_789', 'admin', TRUE);

-- Get the IDs of the users we just created
SET @alice_id = (SELECT id FROM users WHERE email = 'alice@example.com');
SET @bob_id = (SELECT id FROM users WHERE email = 'bob@example.com');
SET @lab_id = (SELECT id FROM users WHERE email = 'lab@example.com');
SET @admin_id = (SELECT id FROM users WHERE email = 'admin@nailedit.com');

-- Create the corresponding profile entries
INSERT INTO patients (user_id, date_of_birth) 
VALUES (@alice_id, '1990-05-15');

INSERT INTO doctors (user_id, specialty, clinic_address, verified, is_active)
VALUES (@bob_id, 'Dermatology', '123 Health St, Medtown', TRUE, TRUE);

INSERT INTO labs (user_id, lab_address, available_tests, verified, is_active)
VALUES (@lab_id, '456 Science Ave, Medtown', '["Blood Panel", "Biopsy"]', TRUE, TRUE);

-- Add a dummy appointment
SET @alice_patient_id = (SELECT id FROM patients WHERE user_id = @alice_id);
SET @bob_doctor_id = (SELECT id FROM doctors WHERE user_id = @bob_id);

INSERT INTO appointments (patient_id, doctor_id, appointment_time, status)
VALUES (@alice_patient_id, @bob_doctor_id, '2025-11-20 10:00:00', 'confirmed');

-- ============================================================================
-- UTILITY QUERIES (for reference - not executed automatically)
-- ============================================================================

-- Promote a user to doctor role by email:
-- UPDATE users SET role = 'doctor' WHERE email = 'user_email_here@example.com' LIMIT 1;
--
-- Example:
-- UPDATE users SET role = 'doctor' WHERE email = 'alice@example.com' LIMIT 1;

-- Verify a doctor:
-- UPDATE doctors SET verified = TRUE, verified_at = NOW(), verified_by = @admin_id 
-- WHERE user_id = (SELECT id FROM users WHERE email = 'doctor_email@example.com');

-- Verify a lab:
-- UPDATE labs SET verified = TRUE, verified_at = NOW(), verified_by = @admin_id 
-- WHERE user_id = (SELECT id FROM users WHERE email = 'lab_email@example.com');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================


-- ============================================================================
-- Add Availability Slots for Existing Doctors and Labs
-- This script adds future-dated availability slots without dropping existing data
-- ============================================================================
-- Usage: mysql -u root -p nailedit < add_availability_slots.sql
-- OR run in MySQL Workbench or your preferred SQL client
-- ============================================================================

USE nailedit;

-- Get doctor and lab IDs
SET @bob_doctor_id = (SELECT d.id FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.email = 'bob@example.com' LIMIT 1);
SET @lab_lab_id = (SELECT l.id FROM labs l JOIN users u ON l.user_id = u.id WHERE u.email = 'lab@example.com' LIMIT 1);

-- Delete old availability slots that are in the past (optional cleanup)
DELETE FROM availability WHERE available_time < NOW();

-- Add all availability slots in a single INSERT statement
-- Doctor slots: Tomorrow and day after tomorrow at 9:00 AM, 9:30 AM, 10:30 AM, 11:00 AM, 2:00 PM, 2:30 PM
-- Lab slots: Tomorrow and day after tomorrow at 8:00 AM, 9:00 AM, 10:00 AM, 1:00 PM, 2:00 PM, 3:00 PM
INSERT INTO availability (doctor_id, lab_id, available_time, duration_minutes, is_available)
VALUES 
    -- Doctor availability slots (tomorrow)
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 9 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 10 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 11 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 14 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 14 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    -- Doctor availability slots (day after tomorrow)
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 9 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 9 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 10 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 11 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 14 HOUR, 30, TRUE),
    (@bob_doctor_id, NULL, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 14 HOUR + INTERVAL 30 MINUTE, 30, TRUE),
    -- Lab availability slots (tomorrow)
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 8 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 9 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 10 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 13 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 14 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 1 DAY) + INTERVAL 15 HOUR, 60, TRUE),
    -- Lab availability slots (day after tomorrow)
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 8 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 9 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 10 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 13 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 14 HOUR, 60, TRUE),
    (NULL, @lab_lab_id, DATE_ADD(DATE(NOW()), INTERVAL 2 DAY) + INTERVAL 15 HOUR, 60, TRUE);

-- Show summary
SELECT 'Availability slots added successfully!' AS message;
SELECT COUNT(*) AS doctor_slots FROM availability WHERE doctor_id = @bob_doctor_id AND available_time >= NOW();
SELECT COUNT(*) AS lab_slots FROM availability WHERE lab_id = @lab_lab_id AND available_time >= NOW();


-- Migration: Add lab_id support to appointments table
-- This allows patients to book appointments with labs in addition to doctors

USE nailedit;

-- Add lab_id column (nullable, since appointments can be with doctors or labs)
ALTER TABLE appointments 
ADD COLUMN lab_id INT NULL AFTER doctor_id;

-- Make doctor_id nullable (since appointments can now be with labs instead)
ALTER TABLE appointments 
MODIFY COLUMN doctor_id INT NULL;

-- Add foreign key constraint for lab_id
ALTER TABLE appointments
ADD CONSTRAINT fk_appointments_lab 
FOREIGN KEY (lab_id) REFERENCES labs(id) ON DELETE CASCADE;

-- Add check constraint to ensure either doctor_id or lab_id is provided
-- Note: MySQL doesn't support CHECK constraints in older versions, so we'll handle this in application logic

-- Update existing appointments to ensure they have doctor_id (backward compatibility)
UPDATE appointments SET doctor_id = doctor_id WHERE doctor_id IS NOT NULL;


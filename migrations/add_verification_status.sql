-- Migration: Add verification status to doctors and labs tables
-- This allows admins to approve/verify doctors and labs before they can use the system
-- Run this migration if you have an existing database

USE nailedit;

-- Add verification status to doctors table (check if columns exist first)
SET @dbname = DATABASE();
SET @tablename = 'doctors';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'verified')
  ) > 0,
  'SELECT 1',
  'ALTER TABLE doctors ADD COLUMN verified BOOLEAN DEFAULT FALSE, ADD COLUMN verified_at DATETIME NULL, ADD COLUMN verified_by INT NULL, ADD COLUMN is_active BOOLEAN DEFAULT TRUE, ADD FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add verification status to labs table
SET @tablename = 'labs';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'verified')
  ) > 0,
  'SELECT 1',
  'ALTER TABLE labs ADD COLUMN verified BOOLEAN DEFAULT FALSE, ADD COLUMN verified_at DATETIME NULL, ADD COLUMN verified_by INT NULL, ADD COLUMN is_active BOOLEAN DEFAULT TRUE, ADD FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add is_active to users table
SET @tablename = 'users';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = 'is_active')
  ) > 0,
  'SELECT 1',
  'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes (check if they exist first)
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


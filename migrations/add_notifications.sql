    -- ============================================================================
    -- Add Notifications Table
    -- This table stores notifications for patients, doctors, and labs
    -- ============================================================================

    USE nailedit;

    CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(50) NOT NULL, -- e.g., 'appointment_booked', 'doctor_feedback', 'lab_approval', 'model_prediction', etc.
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        related_id INT NULL, -- ID of related entity (appointment_id, submission_id, lab_test_id, etc.)
        related_type VARCHAR(50) NULL, -- Type of related entity ('appointment', 'submission', 'lab_test', etc.)
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at),
        INDEX idx_type (type)
    ) ENGINE=InnoDB;


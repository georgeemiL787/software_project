const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    try {
        // Create connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'nailedit',
            multipleStatements: true
        });

        console.log('Connected to database. Running migration...\n');

        // Read and execute migration SQL
        const fs = require('fs');
        const path = require('path');
        const migrationSQL = fs.readFileSync(
            path.join(__dirname, '..', 'migrations', 'add_lab_appointments.sql'),
            'utf8'
        );

        // Execute migration
        await connection.query(migrationSQL);
        
        console.log('✓ Migration completed successfully!');
        console.log('✓ Added lab_id column to appointments table');
        console.log('✓ Made doctor_id nullable');
        console.log('✓ Added foreign key constraint for lab_id');
        console.log('\nLab appointments are now supported!');

    } catch (error) {
        console.error('Migration failed:', error.message);
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('\nNote: Migration may have already been run. Lab appointments should already be supported.');
        } else {
            process.exit(1);
        }
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

runMigration();


// Script to hash all plain text passwords in the database
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nailedit'
};

async function fixPasswords() {
    console.log('\n🔐 Fixing passwords in database...\n');
    
    let connection;
    try {
        connection = await mysql.createConnection(config);
        
        // Get all users
        const [users] = await connection.query('SELECT id, email, password FROM users');
        console.log(`Found ${users.length} users\n`);
        
        let fixed = 0;
        let skipped = 0;
        
        for (const user of users) {
            // Check if password is already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$') || user.password.startsWith('$2y$')) {
                console.log(`✓ ${user.email} - Already hashed, skipping`);
                skipped++;
                continue;
            }
            
            // Hash the password
            console.log(`🔧 Hashing password for ${user.email}...`);
            const hashedPassword = await bcrypt.hash(user.password, 10);
            
            // Update in database
            await connection.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
            console.log(`✅ Updated password for ${user.email}`);
            fixed++;
        }
        
        console.log(`\n✅ Done! Fixed ${fixed} passwords, skipped ${skipped} already hashed.\n`);
        
        await connection.end();
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (connection) await connection.end();
        process.exit(1);
    }
}

fixPasswords();


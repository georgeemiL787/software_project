require('dotenv').config();
const db = require('../db');

(async () => {
  try {
    const email = process.argv[2] || 'testadmin@nailedit.com';
    
    console.log(`Updating user ${email} to admin role...`);
    
    const [result] = await db.query(
      'UPDATE users SET role = ? WHERE email = ?',
      ['admin', email]
    );
    
    if (result.affectedRows > 0) {
      console.log(`✓ Successfully updated ${email} to admin role`);
    } else {
      console.log(`⚠ No user found with email: ${email}`);
      console.log('Available users:');
      const [users] = await db.query('SELECT id, email, role FROM users LIMIT 10');
      users.forEach(u => console.log(`  - ${u.email} (${u.role})`));
    }
    
    await db.end();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();


// Test database connection script
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nailedit',
    port: 3306
};

async function testConnection() {
    console.log('\n🔍 Testing MySQL Database Connection...\n');
    console.log('Connection Settings:');
    console.log(`  Host: ${config.host}`);
    console.log(`  User: ${config.user}`);
    console.log(`  Database: ${config.database}`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Password: ${config.password ? '***' : '(empty)'}\n`);

    let connection;
    try {
        // Test connection
        console.log('⏳ Attempting to connect...');
        connection = await mysql.createConnection(config);
        console.log('✅ Successfully connected to MySQL!\n');

        // Test database exists
        console.log('📊 Checking database...');
        const [databases] = await connection.query('SHOW DATABASES LIKE ?', [config.database]);
        if (databases.length === 0) {
            console.log(`❌ Database '${config.database}' does not exist!`);
            console.log(`   Run: CREATE DATABASE ${config.database};`);
            await connection.end();
            return;
        }
        console.log(`✅ Database '${config.database}' exists\n`);

        // Test tables
        console.log('📋 Checking tables...');
        await connection.query(`USE ${config.database}`);
        const [tables] = await connection.query('SHOW TABLES');
        console.log(`✅ Found ${tables.length} tables:`);
        tables.forEach((table, index) => {
            const tableName = Object.values(table)[0];
            console.log(`   ${index + 1}. ${tableName}`);
        });
        console.log('');

        // Count records
        console.log('📈 Checking data...');
        const [users] = await connection.query('SELECT COUNT(*) as count FROM users');
        const [patients] = await connection.query('SELECT COUNT(*) as count FROM patients');
        const [doctors] = await connection.query('SELECT COUNT(*) as count FROM doctors');
        const [labs] = await connection.query('SELECT COUNT(*) as count FROM labs');
        
        console.log(`   Users: ${users[0].count}`);
        console.log(`   Patients: ${patients[0].count}`);
        console.log(`   Doctors: ${doctors[0].count}`);
        console.log(`   Labs: ${labs[0].count}`);
        console.log('');

        // Test query
        console.log('🧪 Testing sample query...');
        const [sampleUsers] = await connection.query(
            'SELECT id, name, email, role FROM users LIMIT 3'
        );
        console.log('✅ Sample users:');
        sampleUsers.forEach(user => {
            console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
        });
        console.log('');

        console.log('✅ All tests passed! Database is ready to use.\n');
        console.log('💡 You can now connect MySQL Workbench using these settings:');
        console.log(`   Host: ${config.host}`);
        console.log(`   Port: ${config.port}`);
        console.log(`   Username: ${config.user}`);
        console.log(`   Default Schema: ${config.database}\n`);

        await connection.end();
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Connection failed!\n');
        console.error('Error:', error.message);
        console.error('\n💡 Troubleshooting:');
        
        if (error.code === 'ECONNREFUSED') {
            console.error('   - MySQL server is not running');
            console.error('   - Start MySQL service: net start MySQL80');
        } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   - Wrong username or password');
            console.error('   - Check your .env file or db.js configuration');
        } else if (error.code === 'ER_BAD_DB_ERROR') {
            console.error(`   - Database '${config.database}' does not exist`);
            console.error(`   - Run: CREATE DATABASE ${config.database};`);
            console.error(`   - Then run: mysql -u root -p ${config.database} < schema.sql`);
        } else {
            console.error('   - Check MySQL is installed and running');
            console.error('   - Verify connection settings in db.js or .env');
        }
        
        console.error('');
        process.exit(1);
    }
}

testConnection();


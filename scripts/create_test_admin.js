const http = require('http');

function request(method, path, body, token = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (body) headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  try {
    console.log('Creating test admin account...\n');
    
    const email = process.env.ADMIN_EMAIL || 'testadmin@nailedit.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123456';
    const name = process.env.ADMIN_NAME || 'Test Admin';
    
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Name: ${name}\n`);
    
    // First, try to register as a regular user
    console.log('Step 1: Registering user...');
    const registerRes = await request('POST', '/api/users/register', {
      name,
      email,
      password,
      date_of_birth: null
    });
    
    if (registerRes.status === 201) {
      console.log('✓ User registered successfully');
      console.log('Step 2: Updating role to admin...');
      console.log('\n⚠ NOTE: You need to manually update the role in the database:');
      console.log(`  UPDATE users SET role = 'admin' WHERE email = '${email}';`);
      console.log('\nOr use the admin panel (if you have another admin account) to update this user.');
      console.log('\nAfter updating the role, you can login with:');
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
    } else if (registerRes.status === 400 && registerRes.data.msg && registerRes.data.msg.includes('already exists')) {
      console.log('⚠ User already exists');
      console.log('\nTo make this user an admin, run in MySQL:');
      console.log(`  UPDATE users SET role = 'admin' WHERE email = '${email}';`);
      console.log('\nThen you can login with:');
      console.log(`  Email: ${email}`);
      console.log(`  Password: ${password}`);
    } else {
      console.log('❌ Registration failed:');
      console.log(`  Status: ${registerRes.status}`);
      console.log(`  Response: ${JSON.stringify(registerRes.data)}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();


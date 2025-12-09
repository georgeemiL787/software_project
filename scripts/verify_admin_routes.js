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
    console.log('Verifying admin routes are loaded...\n');
    
    // Test 1: Without token (should get 401, not 404)
    console.log('Test 1: Accessing /api/admin/users without token...');
    const noTokenRes = await request('GET', '/api/admin/users', null, null);
    console.log(`   Status: ${noTokenRes.status}`);
    
    if (noTokenRes.status === 404) {
      console.log('   ❌ Route not found (404) - Server needs to be restarted!');
      console.log('\n   The admin routes are not loaded. Please:');
      console.log('   1. Stop the server (Ctrl+C)');
      console.log('   2. Start it again: node server.js');
      console.log('   3. Run this script again to verify');
      process.exit(1);
    } else if (noTokenRes.status === 401) {
      console.log('   ✓ Route exists! (Got 401 Unauthorized as expected)');
    } else {
      console.log(`   ⚠ Unexpected status: ${noTokenRes.status}`);
    }
    
    // Test 2: With invalid token (should get 401)
    console.log('\nTest 2: Accessing /api/admin/users with invalid token...');
    const invalidTokenRes = await request('GET', '/api/admin/users', null, 'invalid_token');
    console.log(`   Status: ${invalidTokenRes.status}`);
    
    if (invalidTokenRes.status === 401) {
      console.log('   ✓ Route exists! (Got 401 as expected)');
    }
    
    // Test 3: Try to login and test with valid admin token
    console.log('\nTest 3: Testing with valid admin credentials...');
    const loginRes = await request('POST', '/api/users/login', {
      email: 'testadmin@nailedit.com',
      password: 'admin123456'
    });
    
    if (loginRes.status === 200 && loginRes.data.token) {
      const token = loginRes.data.token;
      console.log('   ✓ Login successful');
      
      const usersRes = await request('GET', '/api/admin/users', null, token);
      console.log(`   Status: ${usersRes.status}`);
      
      if (usersRes.status === 200) {
        console.log('   ✓✓✓ Admin routes are working correctly!');
        console.log(`   Found ${Array.isArray(usersRes.data) ? usersRes.data.length : 0} users`);
      } else if (usersRes.status === 403) {
        console.log('   ⚠ Got 403 Forbidden - User might not have admin role');
      } else {
        console.log(`   ⚠ Unexpected status: ${usersRes.status}`);
        console.log(`   Response: ${JSON.stringify(usersRes.data).substring(0, 200)}`);
      }
    } else {
      console.log('   ⚠ Could not login (rate limit or wrong credentials)');
    }
    
    console.log('\n✅ Verification complete!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();


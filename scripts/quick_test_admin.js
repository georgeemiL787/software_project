const http = require('http');

// First, login to get a token
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
    console.log('Testing admin route access...\n');
    
    // Login
    console.log('1. Logging in as admin...');
    const loginRes = await request('POST', '/api/users/login', {
      email: 'testadmin@nailedit.com',
      password: 'admin123456'
    });
    
    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.log('❌ Login failed:', loginRes);
      process.exit(1);
    }
    
    const token = loginRes.data.token;
    console.log('✓ Login successful\n');
    
    // Test admin route
    console.log('2. Testing /api/admin/dashboard...');
    const dashboardRes = await request('GET', '/api/admin/dashboard', null, token);
    console.log(`   Status: ${dashboardRes.status}`);
    console.log(`   Response: ${JSON.stringify(dashboardRes.data).substring(0, 200)}`);
    
    if (dashboardRes.status === 404) {
      console.log('\n❌ Route not found! The server needs to be restarted.');
      console.log('   The admin routes were added after the server started.');
      console.log('   Please restart your server:');
      console.log('   1. Stop the current server (Ctrl+C)');
      console.log('   2. Run: node server.js');
    } else if (dashboardRes.status === 200) {
      console.log('\n✓ Admin routes are working!');
    } else {
      console.log(`\n⚠ Unexpected status: ${dashboardRes.status}`);
    }
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();


const http = require('http');

// Simple HTTP request helper
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// Color output
const green = '\x1b[32m';
const red = '\x1b[31m';
const yellow = '\x1b[33m';
const cyan = '\x1b[36m';
const reset = '\x1b[0m';
const bright = '\x1b[1m';

function logTest(name, status, details = '') {
  const statusColor = status >= 200 && status < 300 ? green : status === 429 ? yellow : red;
  const statusText = status >= 200 && status < 300 ? '✓ PASS' : status === 429 ? '⚠ RATE LIMITED' : '✗ FAIL';
  console.log(`${statusColor}${statusText}${reset} ${name.padEnd(50)} [${status}] ${details}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log(`\n${bright}${cyan}═══════════════════════════════════════════════════════════════${reset}`);
  console.log(`${bright}${cyan}           NailedIT API Test Suite${reset}`);
  console.log(`${bright}${cyan}═══════════════════════════════════════════════════════════════${reset}\n`);

  try {
    // Test 1: Health Check
    console.log(`${bright}1. Testing Health Check${reset}`);
    let res = await request('GET', '/');
    logTest('GET /', res.status, res.body);

    // Test 2: Database Connection
    console.log(`\n${bright}2. Testing Database Connection${reset}`);
    res = await request('GET', '/api/test-db');
    logTest('GET /api/test-db', res.status, `Users in DB: ${res.body.users?.length || 0}`);

    // Test 3: Register Patient (with delay to avoid rate limit)
    console.log(`\n${bright}3. Testing Patient Registration${reset}`);
    await sleep(2000); // Wait 2 seconds to avoid rate limit
    const patientEmail = 'test_patient_' + Date.now() + '@test.com';
    res = await request('POST', '/api/users/register', {
      name: 'Test Patient',
      email: patientEmail,
      password: 'TestPass123',
      date_of_birth: '1990-05-15'
    });
    logTest('POST /api/users/register', res.status, res.status === 201 ? 'Patient created' : res.body.msg || '');
    const patientToken = res.body.token;
    const patientRefreshToken = res.body.refreshToken;

    if (!patientToken) {
      console.log(`${red}✗ Cannot continue - patient registration failed${reset}`);
      process.exit(1);
    }

    // Test 4: Get Current User Profile
    console.log(`\n${bright}4. Testing Authentication${reset}`);
    res = await request('GET', '/api/users/me', null, patientToken);
    logTest('GET /api/users/me', res.status, res.body.user?.name || '');

    // Test 5: Login
    console.log(`\n${bright}5. Testing Login${reset}`);
    await sleep(2000);
    res = await request('POST', '/api/users/login', {
      email: patientEmail,
      password: 'TestPass123'
    });
    logTest('POST /api/users/login', res.status, res.status === 200 ? 'Login successful' : res.body.msg || '');

    // Test 6: Refresh Token
    console.log(`\n${bright}6. Testing Token Refresh${reset}`);
    res = await request('POST', '/api/users/refresh', {
      refreshToken: patientRefreshToken
    });
    logTest('POST /api/users/refresh', res.status, res.status === 200 ? 'Token refreshed' : res.body.msg || '');

    // Test 7: Browse Doctors
    console.log(`\n${bright}7. Testing Patient Marketplace${reset}`);
    res = await request('GET', '/api/patients/doctors', null, patientToken);
    logTest('GET /api/patients/doctors', res.status, Array.isArray(res.body) ? `${res.body.length} doctors` : '');

    res = await request('GET', '/api/patients/labs', null, patientToken);
    logTest('GET /api/patients/labs', res.status, Array.isArray(res.body) ? `${res.body.length} labs` : '');

    // Test 8: Register Doctor (if not rate limited)
    console.log(`\n${bright}8. Testing Doctor Registration${reset}`);
    await sleep(2000);
    const doctorEmail = 'test_doctor_' + Date.now() + '@test.com';
    res = await request('POST', '/api/users/register-doctor', {
      name: 'Test Doctor',
      email: doctorEmail,
      password: 'TestPass123',
      specialty: 'Dermatology',
      clinic_address: '123 Medical Plaza'
    });
    logTest('POST /api/users/register-doctor', res.status, 
      res.status === 201 ? 'Doctor created' : 
      res.status === 429 ? 'Rate limited (wait 15 min)' : 
      res.body.msg || '');
    const doctorToken = res.body.token;

    if (doctorToken) {
      // Test 9: Doctor Endpoints
      console.log(`\n${bright}9. Testing Doctor Workflow${reset}`);
      res = await request('GET', '/api/doctors/patients', null, doctorToken);
      logTest('GET /api/doctors/patients', res.status, Array.isArray(res.body) ? `${res.body.length} patients` : '');

      // Test 10: Role-Based Access Control
      console.log(`\n${bright}10. Testing Role-Based Access Control${reset}`);
      res = await request('GET', '/api/doctors/patients', null, patientToken);
      logTest('Patient accessing doctor endpoint', res.status, res.status === 403 ? 'Correctly blocked ✓' : 'Should be 403');
    }

    // Test 11: Logout
    console.log(`\n${bright}11. Testing Logout${reset}`);
    res = await request('POST', '/api/users/logout', null, patientToken);
    logTest('POST /api/users/logout', res.status, res.status === 200 ? 'Token revoked' : '');

    // Summary
    console.log(`\n${bright}${cyan}═══════════════════════════════════════════════════════════════${reset}`);
    console.log(`${bright}${green}✓ API Testing Complete!${reset}`);
    console.log(`${bright}${cyan}═══════════════════════════════════════════════════════════════${reset}\n`);
    console.log(`${bright}Note:${reset} Some endpoints may return 429 (Rate Limited) if you run tests`);
    console.log(`multiple times quickly. Rate limit: 5 requests per 15 minutes on auth endpoints.\n`);

  } catch (err) {
    console.error(`\n${red}✗ ERROR: ${err.message}${reset}`);
    console.error(`\nMake sure the server is running on port 5000:`);
    console.error(`  node server.js\n`);
    process.exit(1);
  }
})();


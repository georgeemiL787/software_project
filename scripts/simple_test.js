const http = require('http');

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
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
    req.write(bodyStr);
    req.end();
  });
}

(async () => {
  console.log('Starting tests...');
  await new Promise(r => setTimeout(r, 500));
  
  try {
    console.log('\n[TEST 1] Register Patient');
    const p1 = await makeRequest('POST', '/api/users/register', {
      name: 'Patient 1',
      email: 'p' + Date.now() + '@test.com',
      password: 'Pass1234'
    });
    console.log('Status:', p1.status);
    const pToken = p1.body.token;
    console.log('Token:', pToken ? 'YES' : 'NO');

    console.log('\n[TEST 2] Register Doctor');
    const d1 = await makeRequest('POST', '/api/users/register-doctor', {
      name: 'Dr. John',
      email: 'd' + Date.now() + '@test.com',
      password: 'Pass1234',
      specialty: 'Cardiology'
    });
    console.log('Status:', d1.status);
    const dToken = d1.body.token;
    console.log('Token:', dToken ? 'YES' : 'NO');

    console.log('\n[TEST 3] Register Lab');
    const l1 = await makeRequest('POST', '/api/users/register-lab', {
      name: 'Lab ABC',
      email: 'l' + Date.now() + '@test.com',
      password: 'Pass1234',
      lab_address: '789 Lab St',
      available_tests: ['COVID Test']
    });
    console.log('Status:', l1.status);
    console.log('Lab:', l1.body.token ? 'Registered' : 'Failed');

    console.log('\nAll tests complete');
  } catch (err) {
    console.error('Error:', err.message);
  }
  
  process.exit(0);
})();

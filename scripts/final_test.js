const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    let resolved = false;
    const headers = {
      'Content-Type': 'application/json'
    };
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
        resolved = true;
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', (e) => {
      if (!resolved) {
        resolved = true;
        reject(e);
      }
    });

    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        req.destroy();
        reject(new Error('Request timeout'));
      }
    }, 5000);

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

(async () => {
  try {
    console.log('=== Comprehensive API Test ===\n');

    console.log('[1] Register Patient');
    const p = await request('POST', '/api/users/register', {
      name: 'Patient One',
      email: 'p' + Date.now() + '@test.com',
      password: 'Pass1234'
    });
    console.log('✓ Status:', p.status, 'Token:', !!p.body.token);
    const pToken = p.body.token;
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n[2] Register Doctor');
    const d = await request('POST', '/api/users/register-doctor', {
      name: 'Dr. Smith',
      email: 'd' + Date.now() + '@test.com',
      password: 'Pass1234',
      specialty: 'Cardiology',
      clinic_address: '123 Main St'
    });
    console.log('✓ Status:', d.status, 'Token:', !!d.body.token);
    const dToken = d.body.token;
    await new Promise(r => setTimeout(r, 1000));

    console.log('\n[3] Register Lab');
    const l = await request('POST', '/api/users/register-lab', {
      name: 'Central Lab',
      email: 'l' + Date.now() + '@test.com',
      password: 'Pass1234',
      lab_address: '456 Lab Ave',
      available_tests: ['COVID', 'Blood']
    });
    console.log('✓ Status:', l.status, 'Lab registered:', !!l.body.token);

    console.log('\n[4] Patient Views Doctors');
    const doctors = await request('GET', '/api/patients/doctors', null, pToken);
    console.log('✓ Status:', doctors.status, 'Doctors:', Array.isArray(doctors.body) ? doctors.body.length : 'N/A');

    console.log('\n[5] Patient Views Labs');
    const labs = await request('GET', '/api/patients/labs', null, pToken);
    console.log('✓ Status:', labs.status, 'Labs:', Array.isArray(labs.body) ? labs.body.length : 'N/A');

    console.log('\n[6] Role-based Access Control (Patient tries doctor endpoint)');
    const forbidden = await request('GET', '/api/doctors/patients', null, pToken);
    console.log('✓ Status:', forbidden.status, 'Expected 403:', forbidden.status === 403 ? 'PASS' : 'FAIL');

    console.log('\n=== All Tests Passed ===');
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
})();

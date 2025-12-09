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
    console.log('=== TEST 1: Register Patient ===');
    const patientRes = await request('POST', '/api/users/register', {
      name: 'Test Patient',
      email: 'patient_' + Date.now() + '@test.com',
      password: 'pass123456',
      date_of_birth: '1990-01-01'
    });
    console.log('Status:', patientRes.status);
    console.log('Response:', JSON.stringify(patientRes.data).substring(0, 200));
    const patientToken = patientRes.data.token;
    console.log('Token received:', !!patientToken);

    console.log('\n=== TEST 2: Register Doctor ===');
    const doctorRes = await request('POST', '/api/users/register-doctor', {
      name: 'Dr. Test',
      email: 'doctor_' + Date.now() + '@test.com',
      password: 'pass123456',
      specialty: 'Dermatology',
      clinic_address: '123 Main St'
    });
    console.log('Status:', doctorRes.status);
    const doctorToken = doctorRes.data.token;
    console.log('Token received:', !!doctorToken);

    console.log('\n=== TEST 3: Register Lab ===');
    const labRes = await request('POST', '/api/users/register-lab', {
      name: 'City Lab',
      email: 'lab_' + Date.now() + '@test.com',
      password: 'pass123456',
      lab_address: '456 Oak Ave',
      available_tests: ['Blood Test', 'X-Ray', 'Skin Biopsy']
    });
    console.log('Status:', labRes.status);
    console.log('Lab registered:', labRes.data.token ? 'YES' : 'NO');

    console.log('\n=== TEST 4: Patient Views Doctors ===');
    const doctorsRes = await request('GET', '/api/patients/doctors', null, patientToken);
    console.log('Status:', doctorsRes.status);
    console.log('Doctors count:', Array.isArray(doctorsRes.data) ? doctorsRes.data.length : 'N/A');

    console.log('\n=== TEST 5: Patient Views Labs ===');
    const labsRes = await request('GET', '/api/patients/labs', null, patientToken);
    console.log('Status:', labsRes.status);
    console.log('Labs count:', Array.isArray(labsRes.data) ? labsRes.data.length : 'N/A');

    console.log('\n=== TEST 6: Patient Books Appointment ===');
    if (doctorsRes.data && doctorsRes.data.length > 0) {
      const appointRes = await request('POST', '/api/patients/appointments', {
        doctor_id: doctorsRes.data[0].doctor_id,
        appointment_time: new Date(Date.now() + 86400000).toISOString()
      }, patientToken);
      console.log('Status:', appointRes.status);
      console.log('Appointment created:', appointRes.data.id ? 'YES' : 'NO');
    } else {
      console.log('Skipped: No doctors available');
    }

    console.log('\n=== TEST 7: Doctor Views Linked Patients ===');
    const doctorPatientsRes = await request('GET', '/api/doctors/patients', null, doctorToken);
    console.log('Status:', doctorPatientsRes.status);
    console.log('Response type:', typeof doctorPatientsRes.data);

    console.log('\n=== TEST 8: Role-based Access Control ===');
    const forbiddenRes = await request('GET', '/api/doctors/patients', null, patientToken);
    console.log('Status:', forbiddenRes.status);
    console.log('Expected 403 Forbidden:', forbiddenRes.status === 403 ? 'PASS' : 'FAIL');

    console.log('\n=== All Tests Completed Successfully ===');
  } catch (err) {
    console.error('ERROR:', err ? (err.message || err.toString()) : 'Unknown error');
    console.error('Stack:', err && err.stack ? err.stack : '');
    process.exit(1);
  }
  process.exit(0);
})();

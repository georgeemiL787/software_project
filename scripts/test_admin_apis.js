const http = require('http');

const API_BASE = 'http://localhost:5000';

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

function log(testName, status, expected, result) {
  const pass = status === expected ? '✓ PASS' : '✗ FAIL';
  console.log(`${pass} - ${testName} (Status: ${status}, Expected: ${expected})`);
  if (status !== expected || process.env.VERBOSE) {
    console.log(`  Response: ${JSON.stringify(result).substring(0, 200)}`);
  }
}

(async () => {
  try {
    console.log('========================================');
    console.log('ADMIN API COMPREHENSIVE TEST SUITE');
    console.log('========================================\n');

    // Step 1: Get admin token
    console.log('=== STEP 1: Admin Authentication ===');
    
    let adminToken = process.env.ADMIN_TOKEN; // Allow token to be passed directly
    
    if (!adminToken) {
      console.log('No ADMIN_TOKEN env variable found, attempting login...');
      console.log('Options:');
      console.log('  1. Set ADMIN_TOKEN env variable with your admin JWT token');
      console.log('  2. Set ADMIN_EMAIL and ADMIN_PASSWORD to login automatically');
      console.log('  3. Create admin: Run "node scripts/create_test_admin.js" then update role in DB\n');
      
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@nailedit.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      
      console.log(`Attempting to login as: ${adminEmail}`);
      const adminLoginRes = await request('POST', '/api/users/login', {
        email: adminEmail,
        password: adminPassword
      });
      
      if (adminLoginRes.status === 200 && adminLoginRes.data && adminLoginRes.data.token) {
        adminToken = adminLoginRes.data.token;
        console.log('✓ Admin login successful\n');
      } else {
        console.log('❌ Admin login failed!');
        console.log(`  Status: ${adminLoginRes.status}`);
        console.log(`  Response: ${JSON.stringify(adminLoginRes.data)}`);
        console.log('\nTo fix this:');
        console.log('  1. Create a test admin: node scripts/create_test_admin.js');
        console.log('  2. Update role in database: UPDATE users SET role = "admin" WHERE email = "your@email.com"');
        console.log('  3. Or login via frontend and set ADMIN_TOKEN env variable');
        console.log('\nExample usage:');
        console.log('  ADMIN_TOKEN=your_jwt_token_here node scripts/test_admin_apis.js');
        console.log('  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=password123 node scripts/test_admin_apis.js');
        process.exit(1);
      }
    } else {
      console.log('✓ Using provided ADMIN_TOKEN\n');
    }

    if (!adminToken) {
      console.log('❌ No admin token available. Cannot proceed with tests.');
      process.exit(1);
    }

    console.log('\n=== STEP 2: Dashboard & Statistics ===');
    
    // Test Dashboard
    const dashboardRes = await request('GET', '/api/admin/dashboard', null, adminToken);
    log('GET /api/admin/dashboard', dashboardRes.status, 200, dashboardRes.data);

    console.log('\n=== STEP 3: User Management ===');
    
    // Get all users
    const allUsersRes = await request('GET', '/api/admin/users', null, adminToken);
    log('GET /api/admin/users', allUsersRes.status, 200, allUsersRes.data);
    
    let testUserId = null;
    if (allUsersRes.status === 200 && Array.isArray(allUsersRes.data) && allUsersRes.data.length > 0) {
      testUserId = allUsersRes.data[0].id;
      console.log(`  Using user ID ${testUserId} for testing`);
    }

    // Get user details
    if (testUserId) {
      const userDetailsRes = await request('GET', `/api/admin/users/${testUserId}`, null, adminToken);
      log(`GET /api/admin/users/${testUserId}`, userDetailsRes.status, 200, userDetailsRes.data);
    } else {
      console.log('⚠ Skipping user details test - no users found');
    }

    // Update user (if we have a user)
    if (testUserId) {
      const updateUserRes = await request('PUT', `/api/admin/users/${testUserId}`, {
        name: 'Updated Test User'
      }, adminToken);
      log(`PUT /api/admin/users/${testUserId}`, updateUserRes.status, 200, updateUserRes.data);
    }

    // Test with invalid user ID
    const invalidUserRes = await request('GET', '/api/admin/users/99999', null, adminToken);
    log('GET /api/admin/users/99999 (invalid)', invalidUserRes.status, 404, invalidUserRes.data);

    console.log('\n=== STEP 4: Verification Management ===');
    
    // Get pending verifications
    const pendingVerRes = await request('GET', '/api/admin/pending-verifications', null, adminToken);
    log('GET /api/admin/pending-verifications', pendingVerRes.status, 200, pendingVerRes.data);
    
    let doctorId = null;
    let labId = null;
    
    if (pendingVerRes.status === 200 && pendingVerRes.data) {
      if (pendingVerRes.data.doctors && pendingVerRes.data.doctors.length > 0) {
        doctorId = pendingVerRes.data.doctors[0].id;
        console.log(`  Found unverified doctor ID: ${doctorId}`);
      }
      if (pendingVerRes.data.labs && pendingVerRes.data.labs.length > 0) {
        labId = pendingVerRes.data.labs[0].id;
        console.log(`  Found unverified lab ID: ${labId}`);
      }
    }

    // Verify doctor (if we have one)
    if (doctorId) {
      const verifyDoctorRes = await request('PUT', `/api/admin/doctors/${doctorId}/verify`, null, adminToken);
      log(`PUT /api/admin/doctors/${doctorId}/verify`, verifyDoctorRes.status, 200, verifyDoctorRes.data);
    } else {
      console.log('⚠ No unverified doctors found to test verification');
    }

    // Verify lab (if we have one)
    if (labId) {
      const verifyLabRes = await request('PUT', `/api/admin/labs/${labId}/verify`, null, adminToken);
      log(`PUT /api/admin/labs/${labId}/verify`, verifyLabRes.status, 200, verifyLabRes.data);
    } else {
      console.log('⚠ No unverified labs found to test verification');
    }

    console.log('\n=== STEP 5: Patient History ===');
    
    // Get patient history (using patient ID 1 if exists)
    const patientHistoryRes = await request('GET', '/api/admin/patients/1/history', null, adminToken);
    log('GET /api/admin/patients/1/history', patientHistoryRes.status, 200, patientHistoryRes.data);
    
    // Test with invalid patient ID
    const invalidPatientRes = await request('GET', '/api/admin/patients/99999/history', null, adminToken);
    log('GET /api/admin/patients/99999/history (invalid)', invalidPatientRes.status, 404, invalidPatientRes.data);

    console.log('\n=== STEP 6: System Data Viewing ===');
    
    // Get all submissions
    const allSubmissionsRes = await request('GET', '/api/admin/all-submissions', null, adminToken);
    log('GET /api/admin/all-submissions', allSubmissionsRes.status, 200, allSubmissionsRes.data);
    
    let submissionId = null;
    if (allSubmissionsRes.status === 200 && Array.isArray(allSubmissionsRes.data) && allSubmissionsRes.data.length > 0) {
      submissionId = allSubmissionsRes.data[0].id;
      console.log(`  Found submission ID: ${submissionId}`);
    }

    // Get all appointments
    const allAppointmentsRes = await request('GET', '/api/admin/all-appointments', null, adminToken);
    log('GET /api/admin/all-appointments', allAppointmentsRes.status, 200, allAppointmentsRes.data);
    
    let appointmentId = null;
    if (allAppointmentsRes.status === 200 && Array.isArray(allAppointmentsRes.data) && allAppointmentsRes.data.length > 0) {
      appointmentId = allAppointmentsRes.data[0].id;
      console.log(`  Found appointment ID: ${appointmentId}`);
    }

    // Get all lab tests
    const allLabTestsRes = await request('GET', '/api/admin/all-lab-tests', null, adminToken);
    log('GET /api/admin/all-lab-tests', allLabTestsRes.status, 200, allLabTestsRes.data);
    
    let labTestId = null;
    if (allLabTestsRes.status === 200 && Array.isArray(allLabTestsRes.data) && allLabTestsRes.data.length > 0) {
      labTestId = allLabTestsRes.data[0].id;
      console.log(`  Found lab test ID: ${labTestId}`);
    }

    console.log('\n=== STEP 7: Data Management (Update/Delete) ===');
    
    // Update appointment (if we have one)
    if (appointmentId) {
      const updateAppointmentRes = await request('PUT', `/api/admin/appointments/${appointmentId}`, {
        notes: 'Admin updated note'
      }, adminToken);
      log(`PUT /api/admin/appointments/${appointmentId}`, updateAppointmentRes.status, 200, updateAppointmentRes.data);
    } else {
      console.log('⚠ No appointments found to test update');
    }

    // Update lab test (if we have one)
    if (labTestId) {
      const updateLabTestRes = await request('PUT', `/api/admin/lab-tests/${labTestId}`, {
        status: 'completed'
      }, adminToken);
      log(`PUT /api/admin/lab-tests/${labTestId}`, updateLabTestRes.status, 200, updateLabTestRes.data);
    } else {
      console.log('⚠ No lab tests found to test update');
    }

    // Note: We'll skip actual deletion tests to preserve data, but test the endpoint structure
    console.log('\n⚠ Skipping DELETE tests to preserve data');
    console.log('  DELETE /api/admin/submissions/:id - Available');
    console.log('  DELETE /api/admin/appointments/:id - Available');
    console.log('  DELETE /api/admin/lab-tests/:id - Available');
    console.log('  DELETE /api/admin/users/:id - Available (deactivates user)');

    console.log('\n=== STEP 8: Password Reset ===');
    
    // Test password reset (if we have a test user)
    if (testUserId) {
      const resetPasswordRes = await request('PUT', `/api/admin/users/${testUserId}/reset-password`, {
        new_password: 'newpassword123'
      }, adminToken);
      log(`PUT /api/admin/users/${testUserId}/reset-password`, resetPasswordRes.status, 200, resetPasswordRes.data);
    } else {
      console.log('⚠ No test user available for password reset test');
    }

    // Test with invalid password (too short)
    if (testUserId) {
      const invalidPasswordRes = await request('PUT', `/api/admin/users/${testUserId}/reset-password`, {
        new_password: '123'
      }, adminToken);
      log(`PUT /api/admin/users/${testUserId}/reset-password (invalid)`, invalidPasswordRes.status, 400, invalidPasswordRes.data);
    }

    console.log('\n=== STEP 9: Authorization Tests ===');
    
    // Test that non-admin cannot access admin routes
    console.log('Testing authorization (should fail for non-admin)...');
    
    // Try to register a patient and use their token
    const patientRegRes = await request('POST', '/api/users/register', {
      name: 'Test Patient Auth',
      email: 'testpatient_' + Date.now() + '@test.com',
      password: 'pass123456'
    });
    
    if (patientRegRes.status === 201 && patientRegRes.data.token) {
      const patientToken = patientRegRes.data.token;
      const unauthorizedRes = await request('GET', '/api/admin/dashboard', null, patientToken);
      log('GET /api/admin/dashboard (as patient - should fail)', unauthorizedRes.status, 403, unauthorizedRes.data);
    }

    // Test without token
    const noTokenRes = await request('GET', '/api/admin/dashboard', null, null);
    log('GET /api/admin/dashboard (no token - should fail)', noTokenRes.status, 401, noTokenRes.data);

    console.log('\n========================================');
    console.log('ADMIN API TEST SUITE COMPLETED');
    console.log('========================================');
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
})();


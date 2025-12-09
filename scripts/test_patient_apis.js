const fetch = require('node-fetch');
require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

// Test patient APIs
async function testPatientAPIs() {
    console.log('=== Testing Patient APIs ===\n');
    
    // You'll need to provide a valid patient token
    const patientToken = process.env.PATIENT_TOKEN || '';
    
    if (!patientToken) {
        console.log('⚠️  PATIENT_TOKEN not provided. Set it in .env or as environment variable.');
        console.log('   To get a token, login as a patient and copy the token from localStorage.\n');
        return;
    }
    
    const headers = {
        'Authorization': `Bearer ${patientToken}`,
        'Content-Type': 'application/json'
    };
    
    try {
        // Test 1: Get Doctors
        console.log('1. Testing GET /api/patients/doctors');
        const doctorsRes = await fetch(`${API_BASE}/api/patients/doctors`, { headers });
        const doctors = await doctorsRes.json();
        console.log(`   Status: ${doctorsRes.status}`);
        console.log(`   Response: ${Array.isArray(doctors) ? `${doctors.length} doctors found` : JSON.stringify(doctors)}`);
        if (Array.isArray(doctors) && doctors.length > 0) {
            console.log(`   Sample: ${doctors[0].name} (ID: ${doctors[0].doctor_id || doctors[0].id})`);
        }
        console.log('');
        
        // Test 2: Get Labs
        console.log('2. Testing GET /api/patients/labs');
        const labsRes = await fetch(`${API_BASE}/api/patients/labs`, { headers });
        const labs = await labsRes.json();
        console.log(`   Status: ${labsRes.status}`);
        console.log(`   Response: ${Array.isArray(labs) ? `${labs.length} labs found` : JSON.stringify(labs)}`);
        if (Array.isArray(labs) && labs.length > 0) {
            console.log(`   Sample: ${labs[0].name} (ID: ${labs[0].lab_id || labs[0].id})`);
        }
        console.log('');
        
        // Test 3: Get My Appointments
        console.log('3. Testing GET /api/patients/my-appointments');
        const appointmentsRes = await fetch(`${API_BASE}/api/patients/my-appointments`, { headers });
        const appointments = await appointmentsRes.json();
        console.log(`   Status: ${appointmentsRes.status}`);
        console.log(`   Response: ${Array.isArray(appointments) ? `${appointments.length} appointments found` : JSON.stringify(appointments)}`);
        if (Array.isArray(appointments) && appointments.length > 0) {
            const apt = appointments[0];
            console.log(`   Sample: ${apt.doctor_name || apt.lab_name} - ${new Date(apt.appointment_time).toLocaleString()}`);
        }
        console.log('');
        
        // Test 4: Get My Submissions
        console.log('4. Testing GET /api/patients/my-submissions');
        const submissionsRes = await fetch(`${API_BASE}/api/patients/my-submissions`, { headers });
        const submissions = await submissionsRes.json();
        console.log(`   Status: ${submissionsRes.status}`);
        console.log(`   Response: ${Array.isArray(submissions) ? `${submissions.length} submissions found` : JSON.stringify(submissions)}`);
        if (Array.isArray(submissions) && submissions.length > 0) {
            console.log(`   Sample: Submission #${submissions[0].id} - ${submissions[0].ai_prediction || 'N/A'}`);
        }
        console.log('');
        
        // Test 5: Book Appointment with Doctor (if doctors exist)
        if (Array.isArray(doctors) && doctors.length > 0) {
            const doctorId = doctors[0].doctor_id || doctors[0].id;
            console.log(`5. Testing POST /api/patients/appointments (with doctor ID: ${doctorId})`);
            const appointmentTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
            const bookRes = await fetch(`${API_BASE}/api/patients/appointments`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    doctor_id: doctorId,
                    appointment_time: appointmentTime
                })
            });
            const bookData = await bookRes.json();
            console.log(`   Status: ${bookRes.status}`);
            console.log(`   Response: ${JSON.stringify(bookData)}`);
            console.log('');
        }
        
        // Test 6: Book Appointment with Lab (if labs exist)
        if (Array.isArray(labs) && labs.length > 0) {
            const labId = labs[0].lab_id || labs[0].id;
            console.log(`6. Testing POST /api/patients/lab-appointments (with lab ID: ${labId})`);
            const appointmentTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
            const labBookRes = await fetch(`${API_BASE}/api/patients/lab-appointments`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    lab_id: labId,
                    appointment_time: appointmentTime
                })
            });
            const labBookData = await labBookRes.json();
            console.log(`   Status: ${labBookRes.status}`);
            console.log(`   Response: ${JSON.stringify(labBookData)}`);
            console.log('');
        }
        
        console.log('✅ All patient API tests completed!');
        
    } catch (error) {
        console.error('❌ Error testing patient APIs:', error.message);
    }
}

testPatientAPIs();


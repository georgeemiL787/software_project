const API_BASE = window.location.origin;
let selectedRole = null;
let currentUserRole = null;

// JWT Decoding (without verification - client-side only)
function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

// Get current user role from token
function getUserRole() {
    const token = getToken();
    if (!token) return null;
    const decoded = decodeJWT(token);
    return decoded?.user?.role || null;
}

// Update navigation based on auth state
function updateNavigation() {
    const token = getToken();
    const role = getUserRole();
    currentUserRole = role;
    
    const navTabs = document.querySelector('.nav-tabs');
    if (!navTabs) return;
    
    // Get all nav tabs
    const homeTab = navTabs.querySelector('button[onclick*="home"]');
    const signupTab = navTabs.querySelector('button[onclick*="signup"]');
    const loginTab = navTabs.querySelector('button[onclick*="login"]');
    const patientTab = navTabs.querySelector('button[onclick*="patient"]');
    const doctorTab = navTabs.querySelector('button[onclick*="doctor"]');
    const uploadTab = navTabs.querySelector('button[onclick*="upload"]');
    
    // Update logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.style.display = token ? 'inline-block' : 'none';
    }
    
    // Update notification container
    const notificationContainer = document.getElementById('notificationContainer');
    if (notificationContainer) {
        notificationContainer.style.display = token ? 'block' : 'none';
        if (token) {
            loadNotifications();
            // Refresh notifications every 30 seconds
            if (window.notificationInterval) {
                clearInterval(window.notificationInterval);
            }
            window.notificationInterval = setInterval(loadNotifications, 30000);
        } else {
            if (window.notificationInterval) {
                clearInterval(window.notificationInterval);
            }
        }
    }
    
    if (!token || !role) {
        // Not logged in - show only Home, Sign Up, Login
        if (homeTab) homeTab.style.display = 'inline-block';
        if (signupTab) signupTab.style.display = 'inline-block';
        if (loginTab) loginTab.style.display = 'inline-block';
        if (patientTab) patientTab.style.display = 'none';
        if (doctorTab) doctorTab.style.display = 'none';
        if (uploadTab) uploadTab.style.display = 'none';
    } else {
        // Logged in - show role-specific tabs
        if (homeTab) homeTab.style.display = 'inline-block';
        if (signupTab) signupTab.style.display = 'none';
        if (loginTab) loginTab.style.display = 'none';
        
        // Show role-specific dashboard tab
        if (role === 'patient') {
            if (patientTab) {
                patientTab.style.display = 'inline-block';
                patientTab.textContent = 'My Dashboard';
                patientTab.setAttribute('onclick', "showPage('patient-dashboard'); return false;");
            }
            if (doctorTab) doctorTab.style.display = 'none';
            if (uploadTab) uploadTab.style.display = 'none';
        } else if (role === 'doctor') {
            if (doctorTab) {
                doctorTab.style.display = 'inline-block';
                doctorTab.textContent = 'My Dashboard';
                doctorTab.setAttribute('onclick', "showPage('doctor-dashboard'); return false;");
            }
            if (patientTab) patientTab.style.display = 'none';
            if (uploadTab) uploadTab.style.display = 'none';
        } else if (role === 'lab') {
            if (patientTab) patientTab.style.display = 'none';
            if (doctorTab) {
                doctorTab.style.display = 'inline-block';
                doctorTab.textContent = 'Lab Dashboard';
                doctorTab.setAttribute('onclick', "showPage('lab-dashboard'); return false;");
            }
            if (uploadTab) uploadTab.style.display = 'none';
        } else if (role === 'admin') {
            if (patientTab) patientTab.style.display = 'none';
            if (doctorTab) {
                doctorTab.style.display = 'inline-block';
                doctorTab.textContent = 'Admin Dashboard';
                doctorTab.setAttribute('onclick', "showPage('admin-dashboard'); return false;");
            }
            if (uploadTab) uploadTab.style.display = 'none';
        }
    }
}

// Redirect to appropriate dashboard after login
function redirectToDashboard() {
    const role = getUserRole();
    if (!role) {
        showPage('home');
        return;
    }
    
    if (role === 'patient') {
        showPage('patient-dashboard');
    } else if (role === 'doctor') {
        showPage('doctor-dashboard');
    } else if (role === 'lab') {
        showPage('lab-dashboard');
    } else if (role === 'admin') {
        showPage('admin-dashboard');
    } else {
        showPage('home');
    }
}

// Page Navigation
function showPage(pageId) {
    const role = getUserRole();
    const token = getToken();
    
    // Role-based access control - prevent unauthorized access to dashboards
    if (pageId === 'lab-dashboard') {
        if (!token || role !== 'lab') {
            alert('Access denied. Lab dashboard is only available for lab users.');
            if (role === 'patient') {
                showPage('patient-dashboard');
            } else if (role === 'doctor') {
                showPage('doctor-dashboard');
            } else if (role === 'admin') {
                showPage('admin-dashboard');
            } else {
                showPage('home');
            }
            return;
        }
    } else if (pageId === 'doctor-dashboard') {
        if (!token || role !== 'doctor') {
            alert('Access denied. Doctor dashboard is only available for doctor users.');
            if (role === 'patient') {
                showPage('patient-dashboard');
            } else if (role === 'lab') {
                showPage('lab-dashboard');
            } else if (role === 'admin') {
                showPage('admin-dashboard');
            } else {
                showPage('home');
            }
            return;
        }
    } else if (pageId === 'admin-dashboard') {
        if (!token || role !== 'admin') {
            alert('Access denied. Admin dashboard is only available for admin users.');
            if (role === 'patient') {
                showPage('patient-dashboard');
            } else if (role === 'doctor') {
                showPage('doctor-dashboard');
            } else if (role === 'lab') {
                showPage('lab-dashboard');
            } else {
                showPage('home');
            }
            return;
        }
    } else if (pageId === 'patient-dashboard') {
        if (!token || role !== 'patient') {
            alert('Access denied. Patient dashboard is only available for patient users.');
            if (role === 'doctor') {
                showPage('doctor-dashboard');
            } else if (role === 'lab') {
                showPage('lab-dashboard');
            } else if (role === 'admin') {
                showPage('admin-dashboard');
            } else {
                showPage('home');
            }
            return;
        }
    }
    
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
    }
    
    // Find and activate the corresponding nav-tab button
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        if (tab.getAttribute('onclick') && tab.getAttribute('onclick').includes(`'${pageId}'`)) {
            tab.classList.add('active');
        }
    });
    
    // Load dashboard data when dashboard pages are shown
    if (pageId === 'patient-dashboard') {
        loadPatientAppointments();
        loadPatientSubmissions();
        populateDoctorDropdown();
        populateLabDropdown();
    } else if (pageId === 'doctor-dashboard') {
        loadPendingReviews();
        loadDoctorAppointments();
        loadDoctorAnalytics();
    } else if (pageId === 'lab-dashboard') {
        loadLabTestRequests();
        loadLabQueue();
    } else if (pageId === 'admin-dashboard') {
        loadAdminDashboard();
        loadAllUsers();
        loadPendingVerifications();
    }
    
    updateTokenDisplay();
}

// Role Selection
function selectRole(role) {
    selectedRole = role;
    
    // Update button states
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    document.querySelector(`.role-btn[data-role="${role}"]`).classList.add('selected');
    
    // Show signup form
    document.getElementById('signupForm').classList.remove('hidden');
    
    // Hide all role-specific fields
    document.querySelectorAll('.role-specific-fields').forEach(field => {
        field.classList.add('hidden');
    });
    
    // Show relevant fields based on role
    if (role === 'patient') {
        document.getElementById('patientFields').classList.remove('hidden');
    } else if (role === 'doctor') {
        document.getElementById('doctorFields').classList.remove('hidden');
    } else if (role === 'lab') {
        document.getElementById('labFields').classList.remove('hidden');
    }
    
    // Scroll to form
    document.getElementById('signupForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Token Management
function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
    updateTokenDisplay();
}

async function logout() {
    const token = getToken();
    if (token) {
        try {
            await fetch(`${API_BASE}/api/users/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    clearToken();
}

function clearToken() {
    localStorage.removeItem('token');
    currentUserRole = null;
    if (window.notificationInterval) {
        clearInterval(window.notificationInterval);
    }
    updateTokenDisplay();
    showPage('home');
}

function updateTokenDisplay() {
    updateNavigation();
}

// Notification Functions
let notificationDropdownOpen = false;

function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notificationDropdown');
    if (!dropdown) return;
    
    notificationDropdownOpen = !notificationDropdownOpen;
    if (notificationDropdownOpen) {
        dropdown.classList.add('show');
        loadNotifications();
    } else {
        dropdown.classList.remove('show');
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const container = document.getElementById('notificationContainer');
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    
    if (container && bell && dropdown && notificationDropdownOpen) {
        if (!container.contains(event.target)) {
            dropdown.classList.remove('show');
            notificationDropdownOpen = false;
        }
    }
});

async function loadNotifications() {
    const token = getToken();
    if (!token) return;
    
    const role = getUserRole();
    if (!role) return;
    
    const notificationList = document.getElementById('notificationList');
    const notificationBadge = document.getElementById('notificationBadge');
    
    if (!notificationList) return;
    
    try {
        // Get unread count
        const countResponse = await fetch(`${API_BASE}/api/${role}s/notifications/unread-count`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (countResponse.ok) {
            const countData = await countResponse.json();
            const unreadCount = countData.count || 0;
            
            if (notificationBadge) {
                if (unreadCount > 0) {
                    notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    notificationBadge.style.display = 'flex';
                } else {
                    notificationBadge.style.display = 'none';
                }
            }
        }
        
        // Get notifications
        const response = await fetch(`${API_BASE}/api/${role}s/notifications?unread_only=false&limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load notifications');
        }
        
        const notifications = await response.json();
        displayNotifications(notifications);
    } catch (error) {
        console.error('Error loading notifications:', error);
        if (notificationList) {
            notificationList.innerHTML = '<div class="notification-empty">Failed to load notifications</div>';
        }
    }
}

function displayNotifications(notifications) {
    const notificationList = document.getElementById('notificationList');
    if (!notificationList) return;
    
    if (!notifications || notifications.length === 0) {
        notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
        return;
    }
    
    notificationList.innerHTML = notifications.map(notification => {
        const timeAgo = getTimeAgo(notification.created_at);
        const unreadClass = notification.is_read ? '' : 'unread';
        
        return `
            <div class="notification-item ${unreadClass}" onclick="handleNotificationClick(${notification.id}, ${!notification.is_read})">
                <div class="notification-title">${escapeHtml(notification.title)}</div>
                <div class="notification-message">${escapeHtml(notification.message)}</div>
                <div class="notification-time">${timeAgo}</div>
            </div>
        `;
    }).join('');
}

function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function handleNotificationClick(notificationId, isUnread) {
    const token = getToken();
    if (!token) return;
    
    const role = getUserRole();
    if (!role) return;
    
    // Mark as read if unread
    if (isUnread) {
        try {
            await fetch(`${API_BASE}/api/${role}s/notifications/${notificationId}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Reload notifications to update UI
            loadNotifications();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    // Close dropdown
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
        notificationDropdownOpen = false;
    }
}

async function markAllNotificationsAsRead() {
    const token = getToken();
    if (!token) return;
    
    const role = getUserRole();
    if (!role) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/${role}s/notifications/read-all`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            loadNotifications();
        }
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
    }
}

function showAllNotifications() {
    // Close dropdown
    const dropdown = document.getElementById('notificationDropdown');
    if (dropdown) {
        dropdown.classList.remove('show');
        notificationDropdownOpen = false;
    }
    
    // You can navigate to a dedicated notifications page here
    // For now, just reload all notifications
    loadNotifications();
}

// Connection Test (kept for internal use, removed from UI)
async function testConnection() {
    try {
        const response = await fetch(`${API_BASE}/api/test-db`);
        const data = await response.json();
        const statusBadge = document.getElementById('connectionStatus');
        if (response.ok) {
            statusBadge.textContent = 'Connected';
            statusBadge.className = 'status-badge connected';
        } else {
            statusBadge.textContent = 'Connection Failed';
            statusBadge.className = 'status-badge';
        }
    } catch (error) {
        const statusBadge = document.getElementById('connectionStatus');
        if (statusBadge) {
            statusBadge.textContent = 'Connection Failed';
        }
    }
}

// Response Display
function showResponse(elementId, data, type = 'info') {
    const element = document.getElementById(elementId);
    if (!element) return;
    // If the payload looks like an analysis result, render it as a rich card
    if (data && (data.ai_prediction || data.ai_confidence || data.image_url)) {
        renderAnalysisCards(data, elementId);
        return;
    }
    // If it looks like an appointment payload, render as appointment card(s)
    if (isAppointmentPayload(data)) {
        renderAppointmentCards(data, elementId);
        return;
    }
    // Friendly render for common error/success shapes
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const message = data.error || data.msg || data.message;
        if (message) {
            element.innerHTML = `<div class="error-message">${message}</div>`;
            element.className = `response-box ${type}`;
            element.classList.remove('hidden');
            return;
        }
    }
    // Primitives or fallback
    element.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    element.className = `response-box ${type}`;
    element.classList.remove('hidden');
}

// Human-friendly display for nail analysis responses (patients, doctors, labs, admin)
function renderAnalysisCards(payload, targetId, options = {}) {
    const container = document.getElementById(targetId);
    if (!container) return;

    const entries = Array.isArray(payload) ? payload : [payload];
    const existing = container.className || '';
    if (!existing.includes('analysis-card-grid')) {
        container.className = `${existing} analysis-card-grid`.trim();
    }
    container.classList.remove('hidden');

    container.innerHTML = entries.map(item => `
        <div class="analysis-card">
            <div class="analysis-meta">
                <span class="pill">#${item.id || 'N/A'}</span>
                ${item.submitted_at ? `<span class="pill subtle">${new Date(item.submitted_at).toLocaleString()}</span>` : ''}
                ${item.patient_name ? `<span class="pill subtle">Patient: ${item.patient_name}</span>` : ''}
                ${item.doctor_name ? `<span class="pill subtle">Doctor: ${item.doctor_name}</span>` : ''}
                ${item.lab_name ? `<span class="pill subtle">Lab: ${item.lab_name}</span>` : ''}
            </div>
            <h4>${item.ai_prediction || 'Awaiting Prediction'}</h4>
            <p class="confidence">
                Confidence: ${item.ai_confidence ? `${(item.ai_confidence * 100).toFixed(1)}%` : 'N/A'}
            </p>
            ${item.image_url ? `<a href="${API_BASE}/${item.image_url}" class="image-link" target="_blank">View Image</a>` : ''}
            ${item.doctor_feedback ? `<div class="feedback-display"><p><strong>Doctor Feedback</strong></p><p class="feedback-text">${item.doctor_feedback}</p></div>` : '<p class="no-feedback"><em>Feedback pending</em></p>'}
            ${options.renderActions ? `<div class="analysis-actions">${options.renderActions(item) || ''}</div>` : ''}
        </div>
    `).join('');
}

function isAppointmentPayload(payload) {
    const entry = Array.isArray(payload) ? payload[0] : payload;
    if (!entry || typeof entry !== 'object') return false;
    return (
        Object.prototype.hasOwnProperty.call(entry, 'appointment_time') &&
        (Object.prototype.hasOwnProperty.call(entry, 'doctor_id') || Object.prototype.hasOwnProperty.call(entry, 'lab_id'))
    );
}

function renderAppointmentCards(payload, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;
    const entries = Array.isArray(payload) ? payload : [payload];
    const existing = container.className || '';
    if (!existing.includes('appointment-card-grid')) {
        container.className = `${existing} appointment-card-grid`.trim();
    }
    container.classList.remove('hidden');

    container.innerHTML = entries.map(item => {
        const isLab = !!item.lab_id && !item.doctor_id;
        const label = isLab ? 'Lab Appointment' : 'Doctor Appointment';
        return `
            <div class="appointment-card">
                <div class="analysis-meta">
                    <span class="pill">#${item.id || 'N/A'}</span>
                    ${item.appointment_time ? `<span class="pill subtle">${new Date(item.appointment_time).toLocaleString()}</span>` : ''}
                </div>
                <h4>${label}</h4>
                <p><strong>Patient:</strong> ${item.patient_id || 'N/A'}</p>
                ${item.doctor_id ? `<p><strong>Doctor ID:</strong> ${item.doctor_id}</p>` : ''}
                ${item.lab_id ? `<p><strong>Lab ID:</strong> ${item.lab_id}</p>` : ''}
                <p><strong>Status:</strong> <span class="status-badge ${item.status || 'pending'}">${item.status || 'pending'}</span></p>
            </div>
        `;
    }).join('');
}

// Authentication Functions
async function registerPatient() {
    try {
        const response = await fetch(`${API_BASE}/api/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('regPatientName').value,
                email: document.getElementById('regPatientEmail').value,
                password: document.getElementById('regPatientPassword').value,
                date_of_birth: document.getElementById('regPatientDOB').value || null
            })
        });
        const data = await response.json();
        if (response.ok && data.token) {
            setToken(data.token);
            showResponse('regPatientResponse', data, 'success');
        } else {
            showResponse('regPatientResponse', data, 'error');
        }
    } catch (error) {
        showResponse('regPatientResponse', { error: error.message }, 'error');
    }
}

async function registerDoctor() {
    try {
        const response = await fetch(`${API_BASE}/api/users/register-doctor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('regDoctorName').value,
                email: document.getElementById('regDoctorEmail').value,
                password: document.getElementById('regDoctorPassword').value,
                specialty: document.getElementById('regDoctorSpecialty').value,
                clinic_address: document.getElementById('regDoctorAddress').value || null
            })
        });
        const data = await response.json();
        if (response.ok && data.token) {
            setToken(data.token);
            showResponse('regDoctorResponse', data, 'success');
        } else {
            showResponse('regDoctorResponse', data, 'error');
        }
    } catch (error) {
        showResponse('regDoctorResponse', { error: error.message }, 'error');
    }
}

async function registerLab() {
    try {
        const response = await fetch(`${API_BASE}/api/users/register-lab`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: document.getElementById('regLabName').value,
                email: document.getElementById('regLabEmail').value,
                password: document.getElementById('regLabPassword').value,
                lab_address: document.getElementById('regLabAddress').value || null
            })
        });
        const data = await response.json();
        if (response.ok && data.token) {
            setToken(data.token);
            showResponse('regLabResponse', data, 'success');
        } else {
            showResponse('regLabResponse', data, 'error');
        }
    } catch (error) {
        showResponse('regLabResponse', { error: error.message }, 'error');
    }
}

async function login() {
    try {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showResponse('loginResponse', { error: 'Please enter email and password' }, 'error');
            return;
        }
        
        const response = await fetch(`${API_BASE}/api/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok && data.token) {
            setToken(data.token);
            showResponse('loginResponse', { 
                success: true, 
                message: 'Login successful!',
                token: data.token 
            }, 'success');
            // Redirect to appropriate dashboard after 1 second
            setTimeout(() => {
                redirectToDashboard();
            }, 1000);
        } else {
            showResponse('loginResponse', data, 'error');
        }
    } catch (error) {
        showResponse('loginResponse', { error: error.message }, 'error');
    }
}

// Patient Functions
async function getAllDoctors() {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    try {
        console.log('Fetching doctors...');
        const response = await fetch(`${API_BASE}/api/patients/doctors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('Doctors response:', response.status, data);
        
        if (response.ok) {
            if (Array.isArray(data) && data.length > 0) {
                displayDoctors(data);
            } else {
                alert('No doctors found');
            }
        } else {
            alert('Error: ' + (data.msg || JSON.stringify(data)));
        }
    } catch (error) {
        console.error('Error fetching doctors:', error);
        alert('Error: ' + error.message);
    }
}

async function getAllLabs() {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    try {
        console.log('Fetching labs...');
        const response = await fetch(`${API_BASE}/api/patients/labs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        console.log('Labs response:', response.status, data);
        
        if (response.ok) {
            if (Array.isArray(data) && data.length > 0) {
                displayLabs(data);
            } else {
                alert('No labs found');
            }
        } else {
            alert('Error: ' + (data.msg || JSON.stringify(data)));
        }
    } catch (error) {
        console.error('Error fetching labs:', error);
        alert('Error: ' + error.message);
    }
}

function displayDoctors(doctors) {
    // Find all containers with this ID (there might be duplicates on different pages)
    const containers = document.querySelectorAll('#doctorsList');
    if (!containers || containers.length === 0) {
        console.error('doctorsList container not found');
        return;
    }
    
    const doctorHTML = doctors.map(d => {
        const doctorId = d.doctor_id || d.id; // Support both field names
        
        return `
        <div class="list-item">
            <h3>${d.name || 'Unknown Doctor'}</h3>
            <p><strong>ID:</strong> ${doctorId} | <strong>Specialty:</strong> ${d.specialty || 'N/A'}</p>
            <p><strong>Clinic:</strong> ${d.clinic_address || 'N/A'}</p>
        </div>
    `;
    }).join('');
    
    // Update all containers (in case there are duplicates)
    containers.forEach(container => {
        container.innerHTML = doctorHTML;
    });
    
    // Show all patientDoctors sections
    const doctorsSections = document.querySelectorAll('#patientDoctors');
    doctorsSections.forEach(section => {
        section.classList.remove('hidden');
    });
    
    console.log(`Displayed ${doctors.length} doctors`);
}

function displayLabs(labs) {
    // Find all containers with this ID (there might be duplicates on different pages)
    const containers = document.querySelectorAll('#labsList');
    if (!containers || containers.length === 0) {
        console.error('labsList container not found');
        return;
    }
    
    const labHTML = labs.map(l => {
        const labId = l.lab_id || l.id; // Support both field names
        let testsDisplay = 'N/A';
        
        if (l.available_tests) {
            if (Array.isArray(l.available_tests)) {
                testsDisplay = l.available_tests.join(', ');
            } else if (typeof l.available_tests === 'string') {
                try {
                    const parsed = JSON.parse(l.available_tests);
                    testsDisplay = Array.isArray(parsed) ? parsed.join(', ') : l.available_tests;
                } catch (e) {
                    testsDisplay = l.available_tests;
                }
            }
        }
        
        return `
        <div class="list-item">
            <h3>${l.name || 'Unknown Lab'}</h3>
            <p><strong>ID:</strong> ${labId} | <strong>Address:</strong> ${l.lab_address || 'N/A'}</p>
            <p><strong>Tests:</strong> ${testsDisplay}</p>
        </div>
    `;
    }).join('');
    
    // Update all containers (in case there are duplicates)
    containers.forEach(container => {
        container.innerHTML = labHTML;
    });
    
    // Show all patientLabs sections
    const labsSections = document.querySelectorAll('#patientLabs');
    labsSections.forEach(section => {
        section.classList.remove('hidden');
    });
    
    console.log(`Displayed ${labs.length} labs`);
}

// Populate doctor dropdown for appointment booking
async function populateDoctorDropdown() {
    const token = getToken();
    if (!token) return;
    
    const select = document.getElementById('appointmentDoctorSelect');
    if (!select) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/patients/doctors`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const doctors = await response.json();
        
        if (response.ok && Array.isArray(doctors)) {
            select.innerHTML = '<option value="">-- Select a Doctor --</option>';
            doctors.forEach(doctor => {
                const option = document.createElement('option');
                option.value = doctor.doctor_id || doctor.id;
                option.textContent = `${doctor.name} - ${doctor.specialty || 'General Practitioner'}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error populating doctor dropdown:', error);
    }
}

// Populate lab dropdown for appointment booking
async function populateLabDropdown() {
    const token = getToken();
    if (!token) return;
    
    const select = document.getElementById('appointmentLabSelect');
    if (!select) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/patients/labs`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const labs = await response.json();
        
        if (response.ok && Array.isArray(labs)) {
            select.innerHTML = '<option value="">-- Select a Lab --</option>';
            labs.forEach(lab => {
                const option = document.createElement('option');
                option.value = lab.lab_id || lab.id;
                option.textContent = lab.name || 'Unknown Lab';
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error populating lab dropdown:', error);
    }
}

// Load available time slots for selected doctor
async function loadDoctorAvailability() {
    const token = getToken();
    if (!token) return;
    
    const doctorSelect = document.getElementById('appointmentDoctorSelect');
    const timeSelect = document.getElementById('appointmentDoctorTimeSelect');
    
    if (!doctorSelect || !timeSelect) return;
    
    const doctorId = doctorSelect.value;
    if (!doctorId) {
        timeSelect.innerHTML = '<option value="">-- Select Doctor First --</option>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/patients/doctors/${doctorId}/availability`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const availability = await response.json();
        
        if (response.ok && Array.isArray(availability)) {
            if (availability.length === 0) {
                timeSelect.innerHTML = '<option value="">No available time slots</option>';
            } else {
                timeSelect.innerHTML = '<option value="">-- Select a Time --</option>';
                availability.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot.available_time;
                    option.textContent = `${slot.date} at ${slot.time_12hr} (${slot.duration_minutes} min)`;
                    timeSelect.appendChild(option);
                });
            }
        } else {
            timeSelect.innerHTML = '<option value="">Error loading availability</option>';
        }
    } catch (error) {
        console.error('Error loading doctor availability:', error);
        timeSelect.innerHTML = '<option value="">Error loading availability</option>';
    }
}

// Load available time slots for selected lab
async function loadLabAvailability() {
    const token = getToken();
    if (!token) return;
    
    const labSelect = document.getElementById('appointmentLabSelect');
    const timeSelect = document.getElementById('appointmentLabTimeSelect');
    
    if (!labSelect || !timeSelect) return;
    
    const labId = labSelect.value;
    if (!labId) {
        timeSelect.innerHTML = '<option value="">-- Select Lab First --</option>';
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/patients/labs/${labId}/availability`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const availability = await response.json();
        
        if (response.ok && Array.isArray(availability)) {
            if (availability.length === 0) {
                timeSelect.innerHTML = '<option value="">No available time slots</option>';
            } else {
                timeSelect.innerHTML = '<option value="">-- Select a Time --</option>';
                availability.forEach(slot => {
                    const option = document.createElement('option');
                    option.value = slot.available_time;
                    option.textContent = `${slot.date} at ${slot.time_12hr} (${slot.duration_minutes} min)`;
                    timeSelect.appendChild(option);
                });
            }
        } else {
            timeSelect.innerHTML = '<option value="">Error loading availability</option>';
        }
    } catch (error) {
        console.error('Error loading lab availability:', error);
        timeSelect.innerHTML = '<option value="">Error loading availability</option>';
    }
}

// New separate booking flows (doctor vs lab) for clarity in the UI
async function parseJsonSafe(response) {
    // Clone the response so we can read it multiple times if needed
    const clonedResponse = response.clone();
    try {
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return await response.json();
        } else {
            // Not JSON, read as text from cloned response
            const text = await clonedResponse.text();
            return { error: text || 'Unexpected response format' };
        }
    } catch (e) {
        // If JSON parsing fails, try to read as text from cloned response
        try {
            const text = await clonedResponse.text();
            // Try to parse as JSON if it looks like JSON
            if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                try {
                    return JSON.parse(text);
                } catch (parseError) {
                    return { error: text || 'Unexpected response format' };
                }
            }
            return { error: text || 'Unexpected response format' };
        } catch (textError) {
            return { error: 'Unexpected response format' };
        }
    }
}

async function bookDoctorAppointment() {
    const token = getToken();
    if (!token) {
        showResponse('appointmentDoctorResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const doctorSelect = document.getElementById('appointmentDoctorSelect');
    const timeSelect = document.getElementById('appointmentDoctorTimeSelect');
    
    const doctorId = doctorSelect?.value;
    const appointmentTime = timeSelect?.value;
    
    if (!doctorId) {
        showResponse('appointmentDoctorResponse', { error: 'Please select a doctor' }, 'error');
        return;
    }
    if (!appointmentTime) {
        showResponse('appointmentDoctorResponse', { error: 'Please select an available time slot' }, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/patients/appointments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                doctor_id: parseInt(doctorId),
                appointment_time: appointmentTime
            })
        });
        const data = await parseJsonSafe(response);
        showResponse('appointmentDoctorResponse', data, response.ok ? 'success' : 'error');
        if (response.ok) {
            // Reset dropdowns
            if (doctorSelect) doctorSelect.value = '';
            if (timeSelect) {
                timeSelect.innerHTML = '<option value="">-- Select Doctor First --</option>';
                timeSelect.value = '';
            }
            // Mark the availability slot as unavailable
            await loadDoctorAvailability();
            setTimeout(() => {
                if (typeof loadPatientAppointments === 'function') {
                    loadPatientAppointments();
                }
            }, 800);
        }
    } catch (error) {
        showResponse('appointmentDoctorResponse', { error: error.message }, 'error');
    }
}

async function bookLabAppointment() {
    const token = getToken();
    if (!token) {
        showResponse('appointmentLabResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const labSelect = document.getElementById('appointmentLabSelect');
    const timeSelect = document.getElementById('appointmentLabTimeSelect');
    
    const labId = labSelect?.value;
    const appointmentTime = timeSelect?.value;
    
    if (!labId) {
        showResponse('appointmentLabResponse', { error: 'Please select a lab' }, 'error');
        return;
    }
    if (!appointmentTime) {
        showResponse('appointmentLabResponse', { error: 'Please select an available time slot' }, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/patients/lab-appointments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                lab_id: parseInt(labId),
                appointment_time: appointmentTime
            })
        });
        const data = await parseJsonSafe(response);
        showResponse('appointmentLabResponse', data, response.ok ? 'success' : 'error');
        if (response.ok) {
            // Reset dropdowns
            if (labSelect) labSelect.value = '';
            if (timeSelect) {
                timeSelect.innerHTML = '<option value="">-- Select Lab First --</option>';
                timeSelect.value = '';
            }
            // Mark the availability slot as unavailable
            await loadLabAvailability();
            setTimeout(() => {
                if (typeof loadPatientAppointments === 'function') {
                    loadPatientAppointments();
                }
            }, 800);
        }
    } catch (error) {
        showResponse('appointmentLabResponse', { error: error.message }, 'error');
    }
}

async function bookAppointmentOld() {
    const token = getToken();
    if (!token) {
        showResponse('appointmentResponseOld', { error: 'Please login first' }, 'error');
        return;
    }
    
    const appointmentType = document.getElementById('appointmentTypeOld').value;
    const doctorId = document.getElementById('appointmentDoctorIdOld')?.value;
    const labId = document.getElementById('appointmentLabIdOld')?.value;
    const appointmentTime = document.getElementById('appointmentTimeOld')?.value;
    
    if (appointmentType === 'doctor' && !doctorId) {
        showResponse('appointmentResponseOld', { error: 'Please enter a doctor ID' }, 'error');
        return;
    }
    
    if (appointmentType === 'lab' && !labId) {
        showResponse('appointmentResponseOld', { error: 'Please enter a lab ID' }, 'error');
        return;
    }
    
    if (!appointmentTime) {
        showResponse('appointmentResponseOld', { error: 'Please select an appointment time' }, 'error');
        return;
    }
    
    try {
        let endpoint = `${API_BASE}/api/patients/appointments`;
        let body = {
            appointment_time: appointmentTime
        };
        
        if (appointmentType === 'lab') {
            endpoint = `${API_BASE}/api/patients/lab-appointments`;
            body.lab_id = parseInt(labId);
        } else {
            body.doctor_id = parseInt(doctorId);
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        const data = await response.json();
        showResponse('appointmentResponseOld', data, response.ok ? 'success' : 'error');
        
        if (response.ok) {
            if (document.getElementById('appointmentDoctorIdOld')) {
                document.getElementById('appointmentDoctorIdOld').value = '';
            }
            if (document.getElementById('appointmentLabIdOld')) {
                document.getElementById('appointmentLabIdOld').value = '';
            }
            if (document.getElementById('appointmentTimeOld')) {
                document.getElementById('appointmentTimeOld').value = '';
            }
        }
    } catch (error) {
        showResponse('appointmentResponseOld', { error: error.message }, 'error');
    }
}

// Doctor Functions
async function getDoctorPatients() {
    const token = getToken();
    if (!token) {
        showResponse('doctorResponse', { error: 'Please login first' }, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/doctors/patients`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayPatients(data);
            showResponse('doctorResponse', data, 'success');
        } else {
            showResponse('doctorResponse', data, 'error');
        }
    } catch (error) {
        showResponse('doctorResponse', { error: error.message }, 'error');
    }
}

function displayPatients(patients) {
    const container = document.getElementById('patientsList');
    container.innerHTML = patients.map(p => `
        <div class="list-item">
            <h3>${p.name}</h3>
            <p><strong>Patient ID:</strong> ${p.patient_id} | <strong>Email:</strong> ${p.email || 'N/A'}</p>
        </div>
    `).join('');
    document.getElementById('doctorPatients').classList.remove('hidden');
}

// Function for doctor dashboard
async function getPatientSubmissionsFromDashboard() {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    
    const patientIdInput = document.getElementById('doctorDashboardPatientId');
    const patientId = patientIdInput ? patientIdInput.value.trim() : '';
    
    if (!patientId) {
        alert('Please enter a patient ID');
        return;
    }
    
    const container = document.getElementById('doctorDashboardSubmissionsList');
    if (!container) {
        console.error('doctorDashboardSubmissionsList container not found');
        alert('Error: Submissions container not found');
        return;
    }
    
    // Show loading state
    container.innerHTML = '<p>Loading submissions...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/doctors/submissions/${patientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await parseJsonSafe(response);
        
        if (response.ok) {
            if (!data || data.length === 0) {
                container.innerHTML = '<p>No submissions found for this patient.</p>';
                return;
            }
            renderAnalysisCards(data, 'doctorDashboardSubmissionsList', {
                renderActions: (s) => {
                    const prediction = (s.ai_prediction || 'N/A').replace(/'/g, "\\'");
                    const patientName = (s.patient_name || 'Patient').replace(/'/g, "\\'");
                    const feedbackVal = s.doctor_feedback ? `'${s.doctor_feedback.replace(/'/g, "\\'")}'` : 'null';
                    if (!s.doctor_feedback) {
                        return `<button class="btn btn-primary btn-small" onclick="openFeedbackModal(${s.id}, '${patientName}', '${prediction}')">Add Feedback</button>`;
                    }
                    return `<button class="btn btn-secondary btn-small" onclick="openFeedbackModal(${s.id}, '${patientName}', '${prediction}', ${feedbackVal})">Update Feedback</button>`;
                }
            });
        } else {
            const errorMsg = data.error || data.msg || 'Failed to load submissions';
            container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${errorMsg}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${error.message}</div>`;
        console.error('Error fetching patient submissions:', error);
    }
}

// Function for doctor page (legacy)
async function getPatientSubmissions() {
    const token = getToken();
    if (!token) {
        showResponse('doctorResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const patientIdInput = document.getElementById('submissionPatientId');
    const patientId = patientIdInput ? patientIdInput.value.trim() : '';
    
    if (!patientId) {
        showResponse('doctorResponse', { error: 'Please enter patient ID' }, 'error');
        return;
    }
    
    // Determine which container to use for displaying results
    const targetId = document.getElementById('doctorPageSubmissionsList') 
        ? 'doctorPageSubmissionsList' 
        : 'submissionsList';
    
    const container = document.getElementById(targetId);
    if (!container) {
        console.error('Submissions container not found');
        showResponse('doctorResponse', { error: 'Submissions container not found' }, 'error');
        return;
    }
    
    container.innerHTML = '<p>Loading submissions...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/doctors/submissions/${patientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const data = await parseJsonSafe(response);
        
        if (response.ok) {
            if (!data || data.length === 0) {
                container.innerHTML = '<p>No submissions found for this patient.</p>';
                return;
            }
            renderAnalysisCards(data, targetId, {
                renderActions: (s) => {
                    const prediction = (s.ai_prediction || 'N/A').replace(/'/g, "\\'");
                    const patientName = (s.patient_name || 'Patient').replace(/'/g, "\\'");
                    const feedbackVal = s.doctor_feedback ? `'${s.doctor_feedback.replace(/'/g, "\\'")}'` : 'null';
                    if (!s.doctor_feedback) {
                        return `<button class="btn btn-primary btn-small" onclick="openFeedbackModal(${s.id}, '${patientName}', '${prediction}')">Add Feedback</button>`;
                    }
                    return `<button class="btn btn-secondary btn-small" onclick="openFeedbackModal(${s.id}, '${patientName}', '${prediction}', ${feedbackVal})">Update Feedback</button>`;
                }
            });
        } else {
            const errorMsg = data.error || data.msg || 'Failed to load submissions';
            container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${errorMsg}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${error.message}</div>`;
        console.error('Error fetching patient submissions:', error);
    }
}

// Legacy addFeedback function - now uses modal
async function addFeedback() {
    const submissionId = document.getElementById('feedbackSubmissionId')?.value;
    if (!submissionId) {
        alert('Please enter a submission ID');
        return;
    }
    openFeedbackModal(submissionId, 'Patient', 'N/A');
}

// Patient Dashboard Functions
async function loadPatientAppointments() {
    const token = getToken();
    if (!token) {
        showResponse('patientUploadResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const container = document.getElementById('patientAppointmentsList');
    if (!container) {
        console.error('patientAppointmentsList container not found');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/patients/my-appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            displayPatientAppointments(data);
        } else {
            const errorMsg = data.error || data.msg || 'Failed to load appointments';
            container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${errorMsg}${data.details ? `<br><small>${data.details}</small>` : ''}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${error.message}</div>`;
    }
}

function displayPatientAppointments(appointments) {
    const container = document.getElementById('patientAppointmentsList');
    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<p>No appointments found.</p>';
        return;
    }
    container.innerHTML = appointments.map(apt => {
        const isLabAppointment = apt.lab_id && !apt.doctor_id;
        const providerName = isLabAppointment ? apt.lab_name : apt.doctor_name;
        const providerType = isLabAppointment ? 'Lab' : 'Doctor';
        const specialty = isLabAppointment ? apt.lab_address : (apt.specialty || 'N/A');
        const resultLink = extractResultLink(apt);
        
        return `
        <div class="appointment-item">
            <h4>Appointment with ${providerName} (${providerType})</h4>
            <p><strong>Date & Time:</strong> ${new Date(apt.appointment_time).toLocaleString()}</p>
            <p><strong>${isLabAppointment ? 'Lab Address' : 'Specialty'}:</strong> ${specialty}</p>
            <p><strong>Status:</strong> <span class="status-badge ${apt.status}">${apt.status}</span></p>
            ${apt.notes ? `<p><strong>Notes:</strong> ${formatNotes(apt.notes)}</p>` : ''}
            ${resultLink ? `<p><strong>Result:</strong> <a href="${API_BASE}/${resultLink}" target="_blank">View Result</a></p>` : ''}
        </div>
    `;
    }).join('');
}

async function loadPatientSubmissions() {
    const token = getToken();
    if (!token) {
        showResponse('patientUploadResponse', { error: 'Please login first' }, 'error');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/patients/my-submissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayPatientSubmissions(data);
        } else {
            document.getElementById('patientSubmissionsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('patientSubmissionsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayPatientSubmissions(submissions) {
    const container = document.getElementById('patientSubmissionsList');
    if (!submissions || submissions.length === 0) {
        container.innerHTML = '<p>No submissions found.</p>';
        return;
    }
    container.innerHTML = submissions.map(sub => `
        <div class="submission-item">
            <h4>Submission #${sub.id}</h4>
            <p><strong>Date:</strong> ${new Date(sub.submitted_at).toLocaleString()}</p>
            <p><strong>AI Prediction:</strong> ${sub.ai_prediction || 'N/A'} (${sub.ai_confidence ? (sub.ai_confidence * 100).toFixed(1) + '%' : 'N/A'})</p>
            <p><strong>Image:</strong> <a href="${API_BASE}/${sub.image_url}" target="_blank">View Image</a></p>
            ${sub.doctor_feedback ? `<p><strong>Doctor Feedback:</strong> ${sub.doctor_feedback}</p>` : '<p><strong>Doctor Feedback:</strong> <em>Pending review</em></p>'}
        </div>
    `).join('');
}

function handlePatientFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('patientPreviewImg').src = e.target.result;
            document.getElementById('patientImagePreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

async function uploadPatientNailImage() {
    const token = getToken();
    if (!token) {
        showResponse('patientUploadResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const fileInput = document.getElementById('patientNailImage');
    if (!fileInput.files || !fileInput.files[0]) {
        showResponse('patientUploadResponse', { error: 'Please select an image' }, 'error');
        return;
    }
    try {
        const formData = new FormData();
        formData.append('nailImage', fileInput.files[0]);
        const response = await fetch(`${API_BASE}/api/upload/nail`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            renderAnalysisCards(data, 'patientUploadResponse');
        } else {
            showResponse('patientUploadResponse', data, 'error');
        }
        if (response.ok) {
            // Refresh submissions list
            setTimeout(() => loadPatientSubmissions(), 1000);
            // Clear file input
            fileInput.value = '';
            document.getElementById('patientImagePreview').classList.add('hidden');
        }
    } catch (error) {
        showResponse('patientUploadResponse', { error: error.message }, 'error');
    }
}

// Doctor Dashboard Functions
async function loadPendingReviews() {
    const token = getToken();
    if (!token) {
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/doctors/pending-reviews`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayPendingReviews(data);
        } else {
            document.getElementById('pendingReviewsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('pendingReviewsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayPendingReviews(reviews) {
    const container = document.getElementById('pendingReviewsList');
    if (!reviews || reviews.length === 0) {
        container.innerHTML = '<p>No pending reviews.</p>';
        return;
    }
    container.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <div>
                    <h4>Submission #${review.id} - ${review.patient_name}</h4>
                    <p><strong>Date:</strong> ${new Date(review.submitted_at).toLocaleString()}</p>
                    <p><strong>AI Prediction:</strong> ${review.ai_prediction || 'N/A'} (${review.ai_confidence ? (review.ai_confidence * 100).toFixed(1) + '%' : 'N/A'})</p>
                    <p><strong>Image:</strong> <a href="${API_BASE}/${review.image_url}" target="_blank" class="image-link">View Image</a></p>
                </div>
                <button class="btn btn-primary" onclick="openFeedbackModal(${review.id}, '${review.patient_name.replace(/'/g, "\\'")}', '${(review.ai_prediction || 'N/A').replace(/'/g, "\\'")}')">
                    Add Feedback
                </button>
            </div>
        </div>
    `).join('');
}

// Feedback Modal Functions
function openFeedbackModal(submissionId, patientName, prediction, existingFeedback = null) {
    document.getElementById('modalFeedbackSubmissionId').value = submissionId;
    document.getElementById('modalFeedbackPatientName').value = patientName;
    document.getElementById('modalFeedbackPrediction').value = prediction || 'N/A';
    document.getElementById('modalFeedbackText').value = existingFeedback || '';
    document.getElementById('modalFeedbackResponse').classList.add('hidden');
    
    // Update modal header text
    const modalHeader = document.querySelector('#feedbackModal .modal-header h3');
    if (modalHeader) {
        modalHeader.textContent = existingFeedback ? 'Update Medical Feedback' : 'Add Medical Feedback';
    }
    
    // Update button text
    const submitBtn = document.querySelector('#feedbackModal .modal-footer .btn-primary');
    if (submitBtn) {
        submitBtn.textContent = existingFeedback ? 'Update Feedback' : 'Submit Feedback';
    }
    
    document.getElementById('feedbackModal').classList.remove('hidden');
    // Focus on textarea
    setTimeout(() => {
        document.getElementById('modalFeedbackText').focus();
    }, 100);
}

function closeFeedbackModal() {
    document.getElementById('feedbackModal').classList.add('hidden');
    document.getElementById('modalFeedbackText').value = '';
    document.getElementById('modalFeedbackResponse').classList.add('hidden');
}

async function submitModalFeedback() {
    const token = getToken();
    if (!token) {
        showResponse('modalFeedbackResponse', { error: 'Please login first' }, 'error');
        return;
    }
    
    const submissionId = document.getElementById('modalFeedbackSubmissionId').value;
    const feedbackText = document.getElementById('modalFeedbackText').value.trim();
    
    if (!feedbackText) {
        showResponse('modalFeedbackResponse', { error: 'Please enter feedback' }, 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/doctors/submissions/${submissionId}/feedback`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ feedback: feedbackText })
        });
        const data = await response.json();
        if (response.ok) {
            showResponse('modalFeedbackResponse', { success: true, message: 'Feedback submitted successfully!' }, 'success');
            // Close modal after 1.5 seconds and refresh
            setTimeout(() => {
                closeFeedbackModal();
                loadPendingReviews();
                // Also refresh patient submissions if on that page
                const role = getUserRole();
                if (role === 'doctor') {
                    const patientId = document.getElementById('submissionPatientId')?.value;
                    if (patientId) {
                        getPatientSubmissions();
                    }
                }
            }, 1500);
        } else {
            showResponse('modalFeedbackResponse', data, 'error');
        }
    } catch (error) {
        showResponse('modalFeedbackResponse', { error: error.message }, 'error');
    }
}

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('feedbackModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeFeedbackModal();
            }
        });
    }
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeFeedbackModal();
        }
    });
});

async function loadDoctorAppointments() {
    const token = getToken();
    if (!token) return;
    const container = document.getElementById('doctorAppointmentsList');
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/api/doctors/my-appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            displayDoctorAppointments(data);
        } else {
            const errorMsg = data.error || data.msg || 'Failed to load appointments';
            container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${errorMsg}</div>`;
        }
    } catch (error) {
        container.innerHTML = `<div class="response-box error"><strong>Error:</strong> ${error.message}</div>`;
    }
}

async function acceptAppointment(appointmentId) {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    
    if (!confirm('Are you sure you want to accept this appointment?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/doctors/appointments/${appointmentId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'confirmed' })
        });
        
        const data = await parseJsonSafe(response);
        if (response.ok) {
            alert('Appointment accepted successfully!');
            loadDoctorAppointments();
        } else {
            alert('Error: ' + (data.error || data.msg || 'Failed to accept appointment'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function refuseAppointment(appointmentId) {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    
    const reason = prompt('Please provide a reason for refusing this appointment (optional):');
    if (reason === null) {
        // User cancelled the prompt
        return;
    }
    
    if (!confirm('Are you sure you want to refuse this appointment?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/doctors/appointments/${appointmentId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: 'cancelled',
                notes: reason ? `Refused: ${reason}` : 'Appointment refused by doctor'
            })
        });
        
        const data = await parseJsonSafe(response);
        if (response.ok) {
            alert('Appointment refused successfully!');
            loadDoctorAppointments();
        } else {
            alert('Error: ' + (data.error || data.msg || 'Failed to refuse appointment'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function displayDoctorAppointments(appointments) {
    const container = document.getElementById('doctorAppointmentsList');
    if (!container) {
        console.error('doctorAppointmentsList container not found');
        return;
    }
    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<p>No appointments found.</p>';
        return;
    }
    console.log('Displaying appointments:', appointments);
    container.innerHTML = appointments.map(apt => {
        const isPending = apt.status === 'pending';
        console.log(`Appointment ${apt.id}: status=${apt.status}, isPending=${isPending}`);
        const actionButtons = isPending ? `
            <div class="appointment-actions mt-1">
                <button class="btn btn-success btn-small" onclick="acceptAppointment(${apt.id})" type="button">Accept</button>
                <button class="btn btn-danger btn-small" onclick="refuseAppointment(${apt.id})" type="button">Refuse</button>
            </div>
        ` : '';
        
        return `
        <div class="appointment-item">
            <h4>Appointment with ${apt.patient_name || 'Unknown Patient'}</h4>
            <p><strong>Patient Email:</strong> ${apt.patient_email || 'N/A'}</p>
            <p><strong>Date & Time:</strong> ${new Date(apt.appointment_time).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="status-badge ${apt.status}">${apt.status}</span></p>
            ${apt.notes ? `<p><strong>Notes:</strong> ${apt.notes}</p>` : ''}
            ${actionButtons}
        </div>
    `;
    }).join('');
}

async function loadDoctorAnalytics() {
    const token = getToken();
    if (!token) return;
    const container = document.getElementById('doctorAnalytics');
    container.innerHTML = `<p>Loading analytics...</p>`;
    try {
        const response = await fetch(`${API_BASE}/api/doctors/analytics`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
            container.innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
            return;
        }

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>Patients</h4>
                    <p><strong>Total:</strong> ${data.patient_count || 0}</p>
                </div>
                <div class="stat-card">
                    <h4>Submissions</h4>
                    <p><strong>Total:</strong> ${data.submission_count || 0}</p>
                </div>
                <div class="stat-card">
                    <h4>Pending Reviews</h4>
                    <p><strong>Needs Feedback:</strong> ${data.pending_reviews || 0}</p>
                </div>
            </div>
            ${data.recent_submissions && data.recent_submissions.length > 0 ? `
                <div class="mt-2">
                    <h4>Recent Submissions</h4>
                    ${data.recent_submissions.map(s => `
                        <div class="submission-item">
                            <p><strong>${s.patient_name || 'Patient'}</strong> - ${s.ai_prediction || 'N/A'} (${new Date(s.submitted_at).toLocaleString()})</p>
                        </div>
                    `).join('')}
                </div>
            ` : '<p class="mt-2">No recent submissions.</p>'}
        `;
    } catch (error) {
        container.innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

// Lab Dashboard Functions
async function loadLabTestRequests() {
    const token = getToken();
    if (!token) {
        console.error('No token found');
        return;
    }
    const container = document.getElementById('labTestRequestsList');
    if (!container) {
        console.error('labTestRequestsList container not found');
        return;
    }
    setLabState(container, 'Loading lab appointments...');
    try {
        const response = await fetch(`${API_BASE}/api/labs/appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            displayLabAppointments(data);
        } else {
            showLabError(container, data);
        }
    } catch (error) {
        console.error('Error loading lab appointments:', error);
        showLabError(container, { msg: error.message });
    }
}

async function loadLabQueue() {
    const token = getToken();
    if (!token) {
        console.error('No token found');
        return;
    }
    const container = document.getElementById('labQueueList');
    if (!container) {
        console.error('labQueueList container not found');
        return;
    }
    setLabState(container, 'Loading test queue...');
    try {
        const response = await fetch(`${API_BASE}/api/labs/queue`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            displayLabQueue(data);
            renderLabStats(data);
            renderLabLinkedPatients(data);
            renderLabPendingTests(data);
        } else {
            showLabError(container, data);
        }
    } catch (error) {
        console.error('Error loading lab queue:', error);
        showLabError(container, { msg: error.message });
    }
}

function displayLabAppointments(appointments) {
    const container = document.getElementById('labTestRequestsList');
    if (!container) {
        console.error('labTestRequestsList container not found');
        return;
    }
    if (!appointments || appointments.length === 0) {
        setLabState(container, 'No lab appointments found.');
        return;
    }
    container.classList.add('lab-card-grid');
    container.innerHTML = appointments.map(apt => {
        const isPending = apt.status === 'pending';
        const actionButtons = isPending ? `
            <div class="analysis-actions">
                <button class="btn btn-small btn-success" onclick="acceptLabAppointment(${apt.id})">Accept</button>
                <button class="btn btn-small btn-danger" onclick="refuseLabAppointment(${apt.id})">Refuse</button>
            </div>
        ` : apt.status === 'confirmed' ? `
            <div class="analysis-actions">
                <button class="btn btn-small btn-primary" onclick="updateLabAppointmentStatus(${apt.id}, 'completed')">Mark Complete</button>
                <button class="btn btn-small btn-danger" onclick="updateLabAppointmentStatus(${apt.id}, 'cancelled')">Cancel</button>
            </div>
        ` : '';
        
        return `
        <div class="lab-card">
            <div class="analysis-meta">
                <span class="pill">#${apt.id}</span>
                ${apt.appointment_time ? `<span class="pill subtle">${new Date(apt.appointment_time).toLocaleString()}</span>` : ''}
                ${apt.patient_name ? `<span class="pill subtle">Patient: ${apt.patient_name}</span>` : ''}
                ${apt.patient_email ? `<span class="pill subtle">${apt.patient_email}</span>` : ''}
            </div>
            <h4>Lab Appointment</h4>
            <p><strong>Status:</strong> <span class="status-badge ${apt.status}">${apt.status}</span></p>
            ${apt.notes ? `<p><strong>Notes:</strong> ${apt.notes}</p>` : ''}
            ${actionButtons}
            ${apt.status === 'confirmed' || apt.status === 'completed' ? `
            <div class="form-group mt-1">
                <label>Upload Result (PDF/JPG/PNG)</label>
                <input type="file" id="labApptResultFile-${apt.id}" accept=".pdf,image/jpeg,image/png" class="lab-file-input">
            </div>
            <div class="analysis-actions">
                <button class="btn btn-primary btn-small" onclick="uploadLabAppointmentResult(${apt.id}, 'labApptResultFile-${apt.id}', 'labApptResultResp-${apt.id}')">Upload Result</button>
            </div>
            <div id="labApptResultResp-${apt.id}" class="response-box hidden"></div>
            ` : ''}
        </div>
    `;
    }).join('');
}

function displayLabQueue(tests) {
    const container = document.getElementById('labQueueList');
    if (!container) return;
    if (!tests || tests.length === 0) {
        setLabState(container, 'No scheduled lab tests.');
        return;
    }
    container.classList.add('lab-card-grid');
    container.innerHTML = tests.map(test => {
        const isCompleted = test.status === 'completed';
        const canUpload = test.status === 'scheduled' || test.status === 'requested';
        
        return `
        <div class="lab-card">
            <div class="analysis-meta">
                <span class="pill">#${test.id}</span>
                ${test.requested_at ? `<span class="pill subtle">${new Date(test.requested_at).toLocaleString()}</span>` : ''}
                ${test.patient_name ? `<span class="pill subtle">Patient: ${test.patient_name}</span>` : ''}
                ${test.patient_email ? `<span class="pill subtle">${test.patient_email}</span>` : ''}
            </div>
            <h4>${test.test_type || 'Lab Test'}</h4>
            <p><strong>Status:</strong> <span class="status-badge ${test.status}">${test.status}</span></p>
            ${test.results_url ? `<p><strong>Result:</strong> <a href="${API_BASE}/${test.results_url}" target="_blank">View Result</a></p>` : ''}
            ${canUpload ? `
            <div class="form-group mt-1">
                <label>Upload Result (PDF/JPG/PNG)</label>
                <input type="file" id="labResultFile-${test.id}" accept=".pdf,image/jpeg,image/png" class="lab-file-input">
            </div>
            <div class="analysis-actions">
                <button class="btn btn-primary btn-small" onclick="uploadLabResult(${test.id}, 'labResultFile-${test.id}', 'labResultResp-${test.id}')">Upload Result</button>
            </div>
            <div id="labResultResp-${test.id}" class="response-box hidden"></div>
            ` : ''}
        </div>
    `;
    }).join('');
}

async function uploadLabResult(testId, inputId, respId) {
    const token = getToken();
    if (!token) {
        const respEl = document.getElementById(respId);
        if (respEl) {
            respEl.innerHTML = '<div class="response-box error">Please login first</div>';
            respEl.classList.remove('hidden');
        }
        return;
    }
    const input = document.getElementById(inputId);
    if (!input || !input.files || !input.files[0]) {
        const respEl = document.getElementById(respId);
        if (respEl) {
            respEl.innerHTML = '<div class="response-box error">Please choose a file to upload</div>';
            respEl.classList.remove('hidden');
        }
        return;
    }
    const formData = new FormData();
    formData.append('resultFile', input.files[0]);
    
    const respEl = document.getElementById(respId);
    if (respEl) {
        respEl.innerHTML = '<div class="response-box info">Uploading...</div>';
        respEl.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/labs/tests/${testId}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            if (respEl) {
                respEl.innerHTML = '<div class="response-box success">Result uploaded successfully!</div>';
            }
            input.value = '';
            setTimeout(() => {
                loadLabQueue();
            }, 1000);
        } else {
            const errorMsg = data.error || data.msg || 'Upload failed';
            if (respEl) {
                respEl.innerHTML = `<div class="response-box error">${errorMsg}</div>`;
            }
        }
    } catch (error) {
        if (respEl) {
            respEl.innerHTML = `<div class="response-box error">${error.message}</div>`;
        }
        console.error('Upload error:', error);
    }
}

async function uploadLabAppointmentResult(appointmentId, inputId, respId) {
    const token = getToken();
    if (!token) {
        const respEl = document.getElementById(respId);
        if (respEl) {
            respEl.innerHTML = '<div class="response-box error">Please login first</div>';
            respEl.classList.remove('hidden');
        }
        return;
    }
    const input = document.getElementById(inputId);
    if (!input || !input.files || !input.files[0]) {
        const respEl = document.getElementById(respId);
        if (respEl) {
            respEl.innerHTML = '<div class="response-box error">Please choose a file to upload</div>';
            respEl.classList.remove('hidden');
        }
        return;
    }
    const formData = new FormData();
    formData.append('resultFile', input.files[0]);
    
    const respEl = document.getElementById(respId);
    if (respEl) {
        respEl.innerHTML = '<div class="response-box info">Uploading...</div>';
        respEl.classList.remove('hidden');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/labs/appointments/${appointmentId}/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            if (respEl) {
                respEl.innerHTML = '<div class="response-box success">Result uploaded successfully!</div>';
            }
            input.value = '';
            setTimeout(() => {
                loadLabTestRequests();
            }, 1000);
        } else {
            const errorMsg = data.error || data.msg || 'Upload failed';
            if (respEl) {
                respEl.innerHTML = `<div class="response-box error">${errorMsg}</div>`;
            }
        }
    } catch (error) {
        if (respEl) {
            respEl.innerHTML = `<div class="response-box error">${error.message}</div>`;
        }
        console.error('Upload error:', error);
    }
}

// Helpers to extract result links from notes/fields
function extractResultLink(apt) {
    if (apt.results_url) {
        return apt.results_url.replace(/^\/+/, '');
    }
    if (apt.notes && typeof apt.notes === 'string') {
        const match = apt.notes.match(/(uploads\/results\/[^\s]+)/);
        if (match && match[1]) return match[1];
    }
    return null;
}

function formatNotes(notes) {
    if (typeof notes !== 'string') return notes;
    return notes.replace(/(uploads\/results\/[^\s]+)/g, (m) => `<a href="${API_BASE}/${m}" target="_blank">${m}</a>`);
}

function renderLabStats(tests) {
    const statsEl = document.getElementById('labTestStatistics');
    if (!statsEl) return;
    if (!tests || tests.length === 0) {
        statsEl.innerHTML = '<div class="empty-state">No lab tests yet.</div>';
        return;
    }
    const totals = tests.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
    }, {});
    statsEl.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><h4>Requested</h4><p>${totals.requested || 0}</p></div>
            <div class="stat-card"><h4>Scheduled</h4><p>${totals.scheduled || 0}</p></div>
            <div class="stat-card"><h4>Completed</h4><p>${totals.completed || 0}</p></div>
            <div class="stat-card"><h4>Cancelled</h4><p>${totals.cancelled || 0}</p></div>
            <div class="stat-card"><h4>Total</h4><p>${tests.length}</p></div>
        </div>
    `;
}

function renderLabLinkedPatients(tests) {
    const linkedEl = document.getElementById('labLinkedPatients');
    if (!linkedEl) return;
    if (!tests || tests.length === 0) {
        linkedEl.innerHTML = '<div class="empty-state">No patients linked yet.</div>';
        return;
    }
    const patients = Array.from(new Set(tests.map(t => t.patient_name || `Patient ${t.patient_id || ''}`)));
    linkedEl.innerHTML = patients.map(p => `<div class="list-item"><strong>${p}</strong></div>`).join('');
}

function renderLabPendingTests(tests) {
    const pendingEl = document.getElementById('labPendingTests');
    if (!pendingEl) return;
    if (!tests || tests.length === 0) {
        pendingEl.innerHTML = '<div class="empty-state">No pending tests.</div>';
        return;
    }
    const pendingTests = tests.filter(t => t.status === 'requested' || t.status === 'scheduled');
    if (pendingTests.length === 0) {
        pendingEl.innerHTML = '<div class="empty-state">No pending tests.</div>';
        return;
    }
    pendingEl.innerHTML = pendingTests.map(test => `
        <div class="list-item">
            <strong>${test.test_type || 'Lab Test'}</strong> - Patient: ${test.patient_name || 'Unknown'}
            <span class="status-badge ${test.status}">${test.status}</span>
        </div>
    `).join('');
}

// Lab UI helpers
function setLabState(container, message) {
    if (!container) return;
    container.classList.remove('lab-card-grid');
    container.innerHTML = `<div class="empty-state">${message}</div>`;
}

function showLabError(container, data) {
    if (!container) return;
    const msg = data?.msg || data?.error || 'Something went wrong';
    container.classList.remove('lab-card-grid');
    container.innerHTML = `<div class="response-box error">${msg}</div>`;
}

async function acceptLabAppointment(appointmentId) {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    
    if (!confirm('Are you sure you want to accept this appointment?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/labs/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'confirmed' })
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            alert('Appointment accepted successfully!');
            loadLabTestRequests();
        } else {
            alert('Error: ' + (data.error || data.msg || 'Failed to accept appointment'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function refuseLabAppointment(appointmentId) {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    
    const reason = prompt('Please provide a reason for refusing this appointment (optional):');
    if (reason === null) {
        // User cancelled the prompt
        return;
    }
    
    if (!confirm('Are you sure you want to refuse this appointment?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/labs/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                status: 'cancelled',
                notes: reason ? `Refused: ${reason}` : 'Appointment refused by lab'
            })
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            alert('Appointment refused successfully!');
            loadLabTestRequests();
        } else {
            alert('Error: ' + (data.error || data.msg || 'Failed to refuse appointment'));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function updateLabAppointmentStatus(appointmentId, status) {
    const token = getToken();
    if (!token) {
        alert('Please login first as lab');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/labs/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        const data = await parseJsonSafe(response);
        if (response.ok) {
            loadLabTestRequests();
            loadLabQueue();
        } else {
            alert(data.msg || data.error || 'Update failed');
        }
    } catch (error) {
        alert(error.message);
    }
}

// Admin Dashboard Functions
async function loadAdminDashboard() {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/admin/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayAdminStats(data);
        } else {
            document.getElementById('adminStats').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('adminStats').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayAdminStats(stats) {
    const container = document.getElementById('adminStats');
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card">
                <h4>User Statistics</h4>
                ${stats.user_stats ? stats.user_stats.map(u => `
                    <p><strong>${u.role}:</strong> ${u.count} total (${u.today_count} today, ${u.week_count} this week)</p>
                `).join('') : '<p>No data</p>'}
            </div>
            <div class="stat-card">
                <h4>Submission Statistics</h4>
                <p><strong>Total:</strong> ${stats.submission_stats?.total || 0}</p>
                <p><strong>Today:</strong> ${stats.submission_stats?.today || 0}</p>
                <p><strong>This Week:</strong> ${stats.submission_stats?.this_week || 0}</p>
            </div>
            <div class="stat-card">
                <h4>Pending Items</h4>
                <p><strong>Lab Tests:</strong> ${stats.pending_lab_tests || 0}</p>
                <p><strong>Doctors to Verify:</strong> ${stats.pending_verifications?.doctors || 0}</p>
                <p><strong>Labs to Verify:</strong> ${stats.pending_verifications?.labs || 0}</p>
                <p><strong>Total Verifications:</strong> ${stats.pending_verifications?.total || 0}</p>
            </div>
            <div class="stat-card">
                <h4>User Status</h4>
                <p><strong>Active:</strong> ${stats.user_status?.active || 0}</p>
                <p><strong>Inactive:</strong> ${stats.user_status?.inactive || 0}</p>
            </div>
        </div>
        ${stats.recent_submissions && stats.recent_submissions.length > 0 ? `
            <div class="mt-2">
                <h4>Recent Submissions</h4>
                ${stats.recent_submissions.map(s => `
                    <div class="submission-item">
                        <p><strong>${s.patient_name}</strong> - ${s.ai_prediction || 'N/A'} (${new Date(s.submitted_at).toLocaleString()})</p>
                    </div>
                `).join('')}
            </div>
        ` : ''}
    `;
}

let allUsersData = [];

async function loadAllUsers() {
    const token = getToken();
    if (!token) {
        alert('Please login first');
        return;
    }
    try {
        const response = await fetch(`${API_BASE}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            allUsersData = data;
            displayAllUsers(data);
        } else {
            document.getElementById('usersList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('usersList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayAllUsers(users) {
    const container = document.getElementById('usersList');
    if (!users || users.length === 0) {
        container.innerHTML = '<p>No users found.</p>';
        return;
    }
    container.innerHTML = users.map(user => `
        <div class="user-item">
            <div class="user-header">
                <h4>${user.name} (${user.role})</h4>
                <span class="status-badge ${user.is_active ? 'confirmed' : 'cancelled'}">${user.is_active ? 'Active' : 'Inactive'}</span>
            </div>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>ID:</strong> ${user.id} | <strong>Profile ID:</strong> ${user.profile_id || 'N/A'}</p>
            <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleString()}</p>
            <div class="btn-group mt-1">
                <button class="btn btn-small" onclick="viewUserDetails(${user.id})">View Details</button>
                <button class="btn btn-small" onclick="editUser(${user.id})">Edit</button>
                <button class="btn btn-small" onclick="resetUserPassword(${user.id})">Reset Password</button>
                <button class="btn btn-small ${user.is_active ? 'btn-warning' : 'btn-primary'}" onclick="toggleUserStatus(${user.id}, ${!user.is_active})">
                    ${user.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        </div>
    `).join('');
}

function filterUsers() {
    const searchTerm = document.getElementById('userSearch').value.toLowerCase();
    const filtered = allUsersData.filter(user => 
        user.name.toLowerCase().includes(searchTerm) || 
        user.email.toLowerCase().includes(searchTerm)
    );
    displayAllUsers(filtered);
}

async function viewUserDetails(userId) {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            const modal = document.getElementById('userDetailsModal');
            const content = document.getElementById('userDetailsContent');
            
            // Format user details nicely
            let html = `
                <div style="margin-bottom: 1rem;">
                    <h4 style="color: var(--dark-color); margin-bottom: 0.5rem;">Basic Information</h4>
                    <p><strong>Name:</strong> ${escapeHtml(data.name || 'N/A')}</p>
                    <p><strong>Email:</strong> ${escapeHtml(data.email || 'N/A')}</p>
                    <p><strong>Role:</strong> ${escapeHtml(data.role || 'N/A')}</p>
                    <p><strong>Status:</strong> <span class="status-badge ${data.is_active ? 'confirmed' : 'cancelled'}">${data.is_active ? 'Active' : 'Inactive'}</span></p>
                    <p><strong>User ID:</strong> ${data.id}</p>
                    <p><strong>Created:</strong> ${new Date(data.created_at).toLocaleString()}</p>
                </div>
            `;
            
            if (data.profile) {
                html += `
                    <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid var(--secondary-color);">
                        <h4 style="color: var(--dark-color); margin-bottom: 0.5rem;">Profile Information</h4>
                        <pre style="background: var(--main-color); padding: 1rem; border-radius: 6px; overflow-x: auto; font-size: 0.85rem;">${JSON.stringify(data.profile, null, 2)}</pre>
                    </div>
                `;
            }
            
            content.innerHTML = html;
            modal.classList.remove('hidden');
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeUserDetailsModal() {
    document.getElementById('userDetailsModal').classList.add('hidden');
}

async function editUser(userId) {
    const token = getToken();
    if (!token) return;
    
    try {
        // Fetch current user data
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const userData = await response.json();
        
        if (!response.ok) {
            alert('Error loading user: ' + JSON.stringify(userData));
            return;
        }
        
        // Populate modal with current data
        document.getElementById('editUserId').value = userId;
        document.getElementById('editUserName').value = userData.name || '';
        document.getElementById('editUserEmail').value = userData.email || '';
        document.getElementById('editUserRole').value = userData.role || 'patient';
        document.getElementById('editUserIsActive').checked = userData.is_active === true || userData.is_active === 1;
        document.getElementById('editUserResponse').classList.add('hidden');
        
        // Show modal
        document.getElementById('editUserModal').classList.remove('hidden');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.add('hidden');
    document.getElementById('editUserResponse').classList.add('hidden');
}

async function submitEditUser() {
    const token = getToken();
    if (!token) return;
    
    const userId = document.getElementById('editUserId').value;
    const name = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();
    const role = document.getElementById('editUserRole').value;
    const isActive = document.getElementById('editUserIsActive').checked;
    
    const responseDiv = document.getElementById('editUserResponse');
    responseDiv.classList.add('hidden');
    
    if (!name || !email) {
        showResponse('editUserResponse', { error: 'Name and email are required' }, 'error');
        return;
    }
    
    const updates = {
        name,
        email,
        role,
        is_active: isActive
    };
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        if (response.ok) {
            showResponse('editUserResponse', { success: true, message: 'User updated successfully!' }, 'success');
            setTimeout(() => {
                closeEditUserModal();
                loadAllUsers();
            }, 1500);
        } else {
            showResponse('editUserResponse', data, 'error');
        }
    } catch (error) {
        showResponse('editUserResponse', { error: error.message }, 'error');
    }
}

async function resetUserPassword(userId) {
    const token = getToken();
    if (!token) return;
    
    try {
        // Fetch user data to show name
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const userData = await response.json();
        
        if (!response.ok) {
            alert('Error loading user: ' + JSON.stringify(userData));
            return;
        }
        
        // Populate modal
        document.getElementById('resetPasswordUserId').value = userId;
        document.getElementById('resetPasswordUserName').value = userData.name || 'User';
        document.getElementById('resetPasswordNewPassword').value = '';
        document.getElementById('resetPasswordConfirmPassword').value = '';
        document.getElementById('resetPasswordResponse').classList.add('hidden');
        
        // Show modal
        document.getElementById('resetPasswordModal').classList.remove('hidden');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

function closeResetPasswordModal() {
    document.getElementById('resetPasswordModal').classList.add('hidden');
    document.getElementById('resetPasswordResponse').classList.add('hidden');
    document.getElementById('resetPasswordNewPassword').value = '';
    document.getElementById('resetPasswordConfirmPassword').value = '';
}

async function submitResetPassword() {
    const token = getToken();
    if (!token) return;
    
    const userId = document.getElementById('resetPasswordUserId').value;
    const newPassword = document.getElementById('resetPasswordNewPassword').value;
    const confirmPassword = document.getElementById('resetPasswordConfirmPassword').value;
    
    const responseDiv = document.getElementById('resetPasswordResponse');
    responseDiv.classList.add('hidden');
    
    if (!newPassword || newPassword.length < 6) {
        showResponse('resetPasswordResponse', { error: 'Password must be at least 6 characters' }, 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showResponse('resetPasswordResponse', { error: 'Passwords do not match' }, 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_password: newPassword })
        });
        const data = await response.json();
        if (response.ok) {
            showResponse('resetPasswordResponse', { success: true, message: 'Password reset successfully!' }, 'success');
            setTimeout(() => {
                closeResetPasswordModal();
            }, 1500);
        } else {
            showResponse('resetPasswordResponse', data, 'error');
        }
    } catch (error) {
        showResponse('resetPasswordResponse', { error: error.message }, 'error');
    }
}

async function toggleUserStatus(userId, isActive) {
    const token = getToken();
    if (!token) return;
    
    if (!confirm(`Are you sure you want to ${isActive ? 'activate' : 'deactivate'} this user?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });
        const data = await response.json();
        if (response.ok) {
            alert(`User ${isActive ? 'activated' : 'deactivated'} successfully!`);
            loadAllUsers();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadPendingVerifications() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/api/admin/pending-verifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayPendingVerifications(data);
        } else {
            document.getElementById('pendingVerificationsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('pendingVerificationsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayPendingVerifications(data) {
    const container = document.getElementById('pendingVerificationsList');
    let html = '';
    
    if (data.doctors && data.doctors.length > 0) {
        html += '<h4>Pending Doctors</h4>';
        html += data.doctors.map(doctor => `
            <div class="review-item">
                <h4>${doctor.name}</h4>
                <p><strong>Email:</strong> ${doctor.email}</p>
                <p><strong>Specialty:</strong> ${doctor.specialty || 'N/A'}</p>
                <p><strong>Clinic:</strong> ${doctor.clinic_address || 'N/A'}</p>
                <p><strong>ID:</strong> ${doctor.id}</p>
                <button class="btn btn-primary mt-1" onclick="verifyDoctor(${doctor.id})">Verify Doctor</button>
            </div>
        `).join('');
    } else {
        html += '<p>No pending doctors.</p>';
    }
    
    if (data.labs && data.labs.length > 0) {
        html += '<h4 class="mt-2">Pending Labs</h4>';
        html += data.labs.map(lab => `
            <div class="review-item">
                <h4>${lab.name}</h4>
                <p><strong>Email:</strong> ${lab.email}</p>
                <p><strong>Address:</strong> ${lab.lab_address || 'N/A'}</p>
                <p><strong>Tests:</strong> ${lab.available_tests || 'N/A'}</p>
                <p><strong>ID:</strong> ${lab.id}</p>
                <button class="btn btn-primary mt-1" onclick="verifyLab(${lab.id})">Verify Lab</button>
            </div>
        `).join('');
    } else {
        html += '<p>No pending labs.</p>';
    }
    
    if ((!data.doctors || data.doctors.length === 0) && (!data.labs || data.labs.length === 0)) {
        html = '<p>No pending verifications.</p>';
    }
    
    container.innerHTML = html;
}

async function verifyDoctor(doctorId) {
    const token = getToken();
    if (!token) return;
    if (!confirm('Are you sure you want to verify this doctor?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/doctors/${doctorId}/verify`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            alert('Doctor verified successfully!');
            loadPendingVerifications();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function verifyLab(labId) {
    const token = getToken();
    if (!token) return;
    if (!confirm('Are you sure you want to verify this lab?')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/labs/${labId}/verify`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            alert('Lab verified successfully!');
            loadPendingVerifications();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadAllSubmissions() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/api/admin/all-submissions`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            if (!data || data.length === 0) {
                document.getElementById('allSubmissionsList').innerHTML = '<p>No submissions found.</p>';
                return;
            }
            renderAnalysisCards(data, 'allSubmissionsList', {
                renderActions: (s) => `
                    <button class="btn btn-small btn-warning" onclick="deleteSubmission(${s.id})">Delete</button>
                `
            });
        } else {
            document.getElementById('allSubmissionsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('allSubmissionsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

async function deleteSubmission(submissionId) {
    const token = getToken();
    if (!token) return;
    if (!confirm('Are you sure you want to delete this submission? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/submissions/${submissionId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            alert('Submission deleted successfully!');
            loadAllSubmissions();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadAllAppointments() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/api/admin/all-appointments`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayAllAppointments(data);
        } else {
            document.getElementById('allAppointmentsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('allAppointmentsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayAllAppointments(appointments) {
    const container = document.getElementById('allAppointmentsList');
    if (!appointments || appointments.length === 0) {
        container.innerHTML = '<p>No appointments found.</p>';
        return;
    }
    container.innerHTML = appointments.map(apt => `
        <div class="appointment-item">
            <h4>Appointment #${apt.id}</h4>
            <p><strong>Patient:</strong> ${apt.patient_name} (${apt.patient_email})</p>
            <p><strong>Doctor:</strong> ${apt.doctor_name} - ${apt.specialty || 'N/A'}</p>
            <p><strong>Date & Time:</strong> ${new Date(apt.appointment_time).toLocaleString()}</p>
            <p><strong>Status:</strong> <span class="status-badge ${apt.status}">${apt.status}</span></p>
            ${apt.notes ? `<p><strong>Notes:</strong> ${apt.notes}</p>` : ''}
            <div class="btn-group mt-1">
                <button class="btn btn-small" onclick="editAppointment(${apt.id})">Edit</button>
                <button class="btn btn-small btn-warning" onclick="deleteAppointment(${apt.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editAppointment(appointmentId) {
    const token = getToken();
    if (!token) return;
    const appointmentTime = prompt('Enter new appointment time (YYYY-MM-DD HH:MM:SS) or leave empty to skip:');
    const status = prompt('Enter new status (pending/confirmed/completed/cancelled) or leave empty to skip:');
    const notes = prompt('Enter notes or leave empty to skip:');
    
    const updates = {};
    if (appointmentTime) updates.appointment_time = appointmentTime;
    if (status) updates.status = status;
    if (notes !== null) updates.notes = notes;
    
    if (Object.keys(updates).length === 0) {
        alert('No changes made');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        if (response.ok) {
            alert('Appointment updated successfully!');
            loadAllAppointments();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteAppointment(appointmentId) {
    const token = getToken();
    if (!token) return;
    if (!confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/appointments/${appointmentId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            alert('Appointment deleted successfully!');
            loadAllAppointments();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadAllLabTests() {
    const token = getToken();
    if (!token) return;
    try {
        const response = await fetch(`${API_BASE}/api/admin/all-lab-tests`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayAllLabTests(data);
        } else {
            document.getElementById('allLabTestsList').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('allLabTestsList').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayAllLabTests(labTests) {
    const container = document.getElementById('allLabTestsList');
    if (!labTests || labTests.length === 0) {
        container.innerHTML = '<p>No lab tests found.</p>';
        return;
    }
    container.innerHTML = labTests.map(test => `
        <div class="appointment-item">
            <h4>Lab Test #${test.id}</h4>
            <p><strong>Patient:</strong> ${test.patient_name} (${test.patient_email})</p>
            <p><strong>Doctor:</strong> ${test.doctor_name}</p>
            <p><strong>Lab:</strong> ${test.lab_name || 'Not assigned'}</p>
            <p><strong>Test Type:</strong> ${test.test_type}</p>
            <p><strong>Status:</strong> <span class="status-badge ${test.status}">${test.status}</span></p>
            <p><strong>Requested:</strong> ${new Date(test.requested_at).toLocaleString()}</p>
            ${test.results_url ? `<p><strong>Results:</strong> <a href="${API_BASE}/${test.results_url}" target="_blank">View</a></p>` : ''}
            <div class="btn-group mt-1">
                <button class="btn btn-small" onclick="editLabTest(${test.id})">Edit</button>
                <button class="btn btn-small btn-warning" onclick="deleteLabTest(${test.id})">Delete</button>
            </div>
        </div>
    `).join('');
}

async function editLabTest(testId) {
    const token = getToken();
    if (!token) return;
    const testType = prompt('Enter new test type or leave empty to skip:');
    const status = prompt('Enter new status (requested/scheduled/completed/cancelled) or leave empty to skip:');
    const resultsUrl = prompt('Enter results URL or leave empty to skip:');
    const labId = prompt('Enter lab ID or leave empty to skip:');
    
    const updates = {};
    if (testType) updates.test_type = testType;
    if (status) updates.status = status;
    if (resultsUrl !== null) updates.results_url = resultsUrl;
    if (labId) updates.lab_id = parseInt(labId);
    
    if (Object.keys(updates).length === 0) {
        alert('No changes made');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/lab-tests/${testId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        const data = await response.json();
        if (response.ok) {
            alert('Lab test updated successfully!');
            loadAllLabTests();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function deleteLabTest(testId) {
    const token = getToken();
    if (!token) return;
    if (!confirm('Are you sure you want to delete this lab test? This action cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/lab-tests/${testId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            alert('Lab test deleted successfully!');
            loadAllLabTests();
        } else {
            alert('Error: ' + JSON.stringify(data));
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

async function loadPatientHistory() {
    const token = getToken();
    if (!token) return;
    const patientId = document.getElementById('patientHistoryId').value;
    if (!patientId) {
        alert('Please enter a patient ID');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/admin/patients/${patientId}/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (response.ok) {
            displayPatientHistory(data);
        } else {
            document.getElementById('patientHistoryDetails').innerHTML = `<div class="response-box error">${JSON.stringify(data, null, 2)}</div>`;
        }
    } catch (error) {
        document.getElementById('patientHistoryDetails').innerHTML = `<div class="response-box error">${error.message}</div>`;
    }
}

function displayPatientHistory(history) {
    const container = document.getElementById('patientHistoryDetails');
    container.innerHTML = `
        <div class="patient-history">
            <h4>Patient Information</h4>
            <p><strong>Name:</strong> ${history.patient.name}</p>
            <p><strong>Email:</strong> ${history.patient.email}</p>
            <p><strong>Date of Birth:</strong> ${history.patient.date_of_birth || 'N/A'}</p>
            <p><strong>Account Created:</strong> ${new Date(history.patient.account_created).toLocaleString()}</p>
            
            <h4 class="mt-2">Submissions (${history.submissions?.length || 0})</h4>
            ${history.submissions && history.submissions.length > 0 ? history.submissions.map(s => `
                <div class="submission-item">
                    <p><strong>#${s.id}</strong> - ${s.ai_prediction || 'N/A'} (${new Date(s.submitted_at).toLocaleString()})</p>
                    <p><a href="${API_BASE}/${s.image_url}" target="_blank">View Image</a></p>
                </div>
            `).join('') : '<p>No submissions</p>'}
            
            <h4 class="mt-2">Appointments (${history.appointments?.length || 0})</h4>
            ${history.appointments && history.appointments.length > 0 ? history.appointments.map(a => `
                <div class="appointment-item">
                    <p><strong>#${a.id}</strong> - ${a.doctor_name} (${new Date(a.appointment_time).toLocaleString()})</p>
                    <p>Status: <span class="status-badge ${a.status}">${a.status}</span></p>
                </div>
            `).join('') : '<p>No appointments</p>'}
            
            <h4 class="mt-2">Lab Tests (${history.lab_tests?.length || 0})</h4>
            ${history.lab_tests && history.lab_tests.length > 0 ? history.lab_tests.map(t => `
                <div class="appointment-item">
                    <p><strong>#${t.id}</strong> - ${t.test_type} (${t.status})</p>
                    <p>Requested by: ${t.doctor_name}</p>
                </div>
            `).join('') : '<p>No lab tests</p>'}
        </div>
    `;
}

// Upload Functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

async function uploadNailImage() {
    const token = getToken();
    if (!token) {
        showResponse('uploadResponse', { error: 'Please login first' }, 'error');
        return;
    }
    const fileInput = document.getElementById('nailImage');
    if (!fileInput.files || !fileInput.files[0]) {
        showResponse('uploadResponse', { error: 'Please select an image' }, 'error');
        return;
    }
    try {
        const formData = new FormData();
        formData.append('nailImage', fileInput.files[0]);
        const response = await fetch(`${API_BASE}/api/upload/nail`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });
        const data = await response.json();
        if (response.ok) {
            renderAnalysisCards(data, 'uploadResponse');
        } else {
            showResponse('uploadResponse', data, 'error');
        }
    } catch (error) {
        showResponse('uploadResponse', { error: error.message }, 'error');
    }
}

// Signup Form Handler
document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!selectedRole) {
                showResponse('signupResponse', { error: 'Please select a role first' }, 'error');
                return;
            }
            
            const name = document.getElementById('signupName').value;
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            
            if (!name || !email || !password) {
                showResponse('signupResponse', { error: 'Please fill in all required fields' }, 'error');
                return;
            }
            
            try {
                let response;
                let body = { name, email, password };
                
                if (selectedRole === 'patient') {
                    body.date_of_birth = document.getElementById('signupDOB').value || null;
                    response = await fetch(`${API_BASE}/api/users/register`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                } else if (selectedRole === 'doctor') {
                    body.specialty = document.getElementById('signupSpecialty').value;
                    body.clinic_address = document.getElementById('signupClinicAddress').value || null;
                    response = await fetch(`${API_BASE}/api/users/register-doctor`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                } else if (selectedRole === 'lab') {
                    body.lab_address = document.getElementById('signupLabAddress').value || null;
                    response = await fetch(`${API_BASE}/api/users/register-lab`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body)
                    });
                }
                
                const data = await response.json();
                if (response.ok && data.token) {
                    setToken(data.token);
                    showResponse('signupResponse', { 
                        success: true, 
                        message: 'Account created successfully!',
                        token: data.token 
                    }, 'success');
                    // Redirect to appropriate dashboard after 2 seconds
                    setTimeout(() => {
                        redirectToDashboard();
                    }, 2000);
                } else {
                    showResponse('signupResponse', data, 'error');
                }
            } catch (error) {
                showResponse('signupResponse', { error: error.message }, 'error');
            }
        });
    }
    
    // Drag and Drop for main upload area
    const uploadArea = document.getElementById('uploadArea');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });
        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                document.getElementById('nailImage').files = e.dataTransfer.files;
                handleFileSelect({ target: { files: [file] } });
            }
        });
    }

    // Drag and Drop for patient dashboard upload area
    const patientUploadArea = document.getElementById('patientUploadArea');
    if (patientUploadArea) {
        patientUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            patientUploadArea.classList.add('dragover');
        });
        patientUploadArea.addEventListener('dragleave', () => {
            patientUploadArea.classList.remove('dragover');
        });
        patientUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            patientUploadArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                document.getElementById('patientNailImage').files = e.dataTransfer.files;
                handlePatientFileSelect({ target: { files: [file] } });
            }
        });
    }

    // Initialize
    updateTokenDisplay();
    testConnection();
    
    // Check if user is logged in and redirect to dashboard
    const role = getUserRole();
    if (role) {
        redirectToDashboard();
    }
});


## NailedIT Healthcare Portal

Full-stack Node/Express + MySQL app that lets patients, doctors, labs, and admins collaborate on nail-health diagnosis, appointments, and lab workflows. The SPA lives in `public/`, the API in `src/`.

### Stack
- Node 18+, Express 5, MySQL 8 (mysql2/promise)
- JWT auth with access + refresh tokens, bcrypt password hashing
- File uploads via Multer (images & PDFs), optional TensorFlow.js model for AI predictions

### Quick Start
1. Install deps: `npm install`
2. Create `.env` with at least:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpass
   DB_NAME=nailedit
   JWT_SECRET=change_me
   ```
3. Bootstrap DB: run `migrations/schema.sql`, then (optional) `migrations/add_lab_appointments.sql` to allow lab appointments.
4. Start API/UI: `npm run dev` (nodemon) or `npm start` and open `http://localhost:5000`.
5. Uploaded files live in `uploads/` (exposed at `/uploads`). Lab results go to `uploads/results/`.
6. Optional AI: place converted TFJS model at `model/tfjs_model/model.json` (see `src/services/modelService.js`). Otherwise a mock prediction is used.

### Authentication & Roles
- Public endpoints: register/login for patient/doctor/lab, token refresh.
- Bearer token required elsewhere. Middleware: `auth` (verify token + revocation), `authorize(role)` for role checks.
- Roles: `patient`, `doctor`, `lab`, `admin`. Admin routes are additionally mounted under `/api/admin` and double-protected in `server.js`.

### Data Model (tables)
- `users` (all accounts, role, is_active)
- `patients`, `doctors` (with specialty, clinic, verification), `labs` (address, available_tests, verification)
- `appointments` (patient ↔ doctor or lab, status, notes)
- `nail_submissions` (patient uploads, AI prediction, doctor_feedback)
- `lab_tests` (doctor requests, scheduled with labs, results_url)
- `revoked_tokens`, `refresh_tokens` (auth support)

### Use Cases by Role

**Patient**
- Register/login as patient; fetch own profile `/api/users/me`.
- Browse doctors `/api/patients/doctors` and labs `/api/patients/labs`.
- Book visits: doctor or lab `/api/patients/appointments`; lab-only helper `/api/patients/lab-appointments`.
- View my bookings `/api/patients/my-appointments`.
- Upload nail image for AI triage `/api/upload/nail` (stores image, predicts condition, creates `nail_submissions` row).
- View my submissions `/api/patients/my-submissions`.

**Doctor**
- Register as doctor (await admin verification).
- See patients with appointments to this doctor `/api/doctors/patients`.
- Review a patient’s nail submissions `/api/doctors/submissions/:patient_id`.
- Work queue of submissions needing feedback `/api/doctors/pending-reviews`; add/update feedback `/api/doctors/submissions/:submission_id/feedback`.
- Track own appointments `/api/doctors/my-appointments`.
- Quick analytics (patient count, submission counts, pending reviews, recent subs) `/api/doctors/analytics`.

**Lab**
- Register as lab (await admin verification).
- See scheduled lab tests for this lab `/api/labs/queue` (from `lab_tests`).
- See patient lab appointments `/api/labs/appointments`.
- Update appointment status (confirm/complete/cancel) `/api/labs/appointments/:appointment_id`.
- Upload results for lab tests `/api/labs/tests/:test_id/upload` (preferred) or for appointments `/api/labs/appointments/:appointment_id/upload` (fallback). Accepts image/PDF.

**Admin**
- User management: list `/api/admin/users`, detail `/api/admin/users/:id`, update `/api/admin/users/:id`, deactivate `/api/admin/users/:id` (soft delete), reset password `/api/admin/users/:id/reset-password`.
- Verification queue: `/api/admin/pending-verifications`; approve doctor `/api/admin/doctors/:id/verify`; approve lab `/api/admin/labs/:id/verify`.
- Patient history (submissions, appointments, lab tests) `/api/admin/patients/:id/history`.
- Moderation: delete submission `/api/admin/submissions/:id`; update/delete appointments `/api/admin/appointments/:id`; update/delete lab tests `/api/admin/lab-tests/:id`.
- System dashboards: stats `/api/admin/dashboard`; all submissions `/api/admin/all-submissions`; all appointments `/api/admin/all-appointments`; all lab tests `/api/admin/all-lab-tests`.

### Frontend Highlights
- Single-page UI in `public/index.html` with logic in `public/js/app.js`; adapts navigation based on JWT role.
- Supports patient sign-up/login, uploads, appointment booking; doctor review dashboards; lab queues; admin dashboards (users, verifications, system stats).

### FRUPS+ (Quality Attributes in This Project)
- **Functionality:** End-to-end flows per role (patient uploads/appointments, doctor review/feedback, lab queues/results, admin governance) with role-based access enforced by `auth` + `authorize`.
- **Reliability:** MySQL transactions for registrations; revocation + refresh-token tables; error middleware; graceful shutdown route; schema migrations for lab appointments.
- **Usability:** SPA navigation adapts to JWT role; dashboard loaders for each role; card-style renderers for submissions/appointments; inline validation and friendly error messaging.
- **Performance:** Connection pool (`mysql2/promise`); limited payloads (non-sensitive columns); pagination-ready queries (ordered, scoped by user); 5–10 MB upload caps.
- **Supportability/Security:** `.env` driven config; bcrypt hashing; JWT secrets; soft-delete for users; admin tools for resets/verifications; static uploads segregated; CORS permissive for demo but centralized.
- **Plus (AI Assist):** Optional TensorFlow.js model (`modelService`) with mock fallback to keep patient flow working even without the model; uploads normalized and stored with recorded prediction/confidence.

### Scripts & Utilities
- DB/migration helpers under `migrations/`.
- Dev/test helpers in `scripts/` (admin creation, quick API smoke tests, migrations runner).

### API Base & Health
- Base: `http://localhost:5000/api`
- DB connectivity check: `GET /api/test-db`



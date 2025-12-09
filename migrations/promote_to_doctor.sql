-- Promote a user to doctor role by email
-- Usage: mysql -u root -p nailedit < promote_to_doctor.sql
-- OR edit the email below and run in a SQL client

UPDATE users SET role = 'doctor' WHERE email = 'user_email_here@example.com' LIMIT 1;

-- Example (replace with actual email):
-- UPDATE users SET role = 'doctor' WHERE email = 'alice@example.com' LIMIT 1;

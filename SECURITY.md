# CampusHub security guidance

## Supabase controls

- Supabase Auth identifies users; the campushub_documents table stores application records as JSONB.
- Row-level security is enabled on campushub_documents and policies separate private student records, public directory profiles, module ownership, enrolments, work, notes and chat rooms.
- New public registrations are student-only. A student cannot change their own role through the client.
- Teacher writes are restricted to modules they own. Notes and published work are checked against module ownership.
- The campushub-notes Storage bucket is private, accepts PDF files up to 20 MB, and uses RLS to limit uploads, downloads and deletion.
- Download links are signed and short-lived. Do not make the notes bucket public.
- General chat is available to authenticated users; course chat is checked against the student's programme; direct messages are limited to the participants.

## Secrets and privacy

- The Supabase project URL and publishable key are intended for browser use. Never expose a Supabase secret/service-role key.
- Do not commit service-role keys, database passwords, Firebase Admin credentials, or exported student data.
- Keep phone, email, registration number, date of birth and guardian/emergency details in private student records, not publicProfiles.
- Assign the initial administrator role only through a trusted Supabase SQL Editor/admin process.
- Back up the database and Storage objects and test restoration.
- Publish a privacy notice and establish account deletion, data correction, retention and incident-response procedures.

## Known migration constraints

Firebase users/passwords and existing records are not migrated automatically by the frontend code. Use a trusted export/import process and require password reset/invitation for migrated users. The SQL schema must be run in the intended Supabase project before the new frontend is used.

# CampusHub deployment and Supabase migration

## Before switching production traffic

1. Back up the existing Firebase Auth users, Firestore collections and Storage files.
2. In the Supabase project configured in supabase-client.js, open SQL Editor and run supabase-schema.sql.
3. Confirm the campushub_documents table exists and row-level security is enabled.
4. Confirm the private campushub-notes bucket exists with a 20 MB PDF-only limit.
5. Add the deployed website URL and local development URL to Supabase Authentication → URL Configuration.
6. If instant sign-up is required, disable email confirmation in Supabase Authentication. If confirmation remains enabled, implement and test the email-confirmation profile completion flow before production.
7. Verify that at least one trusted administrator account has been assigned the admin role using a trusted SQL Editor/admin process. Never expose role selection on public registration.

## Data and account migration

Firebase accounts and passwords are not copied automatically. Export the Firebase users and data using a trusted server-side process, map the records into the campushub_documents table, and use a password-reset/invitation flow for users. Do not put Firebase Admin credentials or Supabase service-role keys in this repository or browser code.

Expected collection names include students, publicProfiles, modules, moduleEnrollments, work, notes and chatRooms. Nested chat messages use chatRooms/{roomId}/messages.

PDF files belong in the private campushub-notes bucket at moduleNotes/{moduleId}/{filename}. The client requests short-lived signed download URLs after Supabase Storage authorizes the user.

## Validation checklist

- Register a test student and verify their students and publicProfiles records are created.
- Sign in and sign out, reset a password, and test the chosen email-confirmation setting.
- Verify a student cannot read another student's private record or promote their own role.
- Verify a teacher can create and manage only their own modules, work and notes.
- Verify a student can see/download notes only for modules they are enrolled in.
- Verify non-PDF files and files larger than 20 MB are rejected.
- Verify admin, teacher and student route separation.
- Verify general chat, course chat and direct messages; a third account must not read a DM.
- Test notes deletion and confirm both the storage object and metadata are removed.
- Test on a staging Supabase project before switching production traffic.

## Rollback

Keep the previous site release and Firebase backups until Supabase login, database access, notes upload/download and chat have been verified. Roll back the website and restore from backups if critical workflows fail. Do not disable row-level security to work around permission errors.

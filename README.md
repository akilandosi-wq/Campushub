# CampusHub

CampusHub is a browser-based campus portal built with vanilla HTML, CSS and JavaScript. Supabase Auth handles sign-in, PostgreSQL stores campus records, and a private Supabase Storage bucket stores uploaded PDF notes.

## Main features

- Student registration, sign-in and password reset
- Student academic profile and public directory profile
- Module browsing and self-enrolment
- Assignment and test announcements
- Lecturer PDF notes upload to private Supabase Storage with module-based student access
- General, course and direct-message chat
- Lecturer module and student-roster management
- Separate teacher and administrator workspaces
- Administrator role management

## Run locally

This is a static frontend; there is no build step.

1. Create a Supabase project.
2. Enable **Email** sign-in in Supabase Authentication.
3. Add your local and production hostnames to Supabase Authentication URL Configuration.
4. Open Supabase SQL Editor and run `supabase-schema.sql` to create the database table, row-level security policies and private notes bucket.
5. Check the Supabase project URL and publishable key in `supabase-client.js`.
6. Verify the `campushub-notes` bucket is private and limited to PDF files up to 20 MB.
7. Serve this directory through a local HTTP server (not by opening the HTML file directly). For example:

   ```bash
   python -m http.server 8000
   ```

7. Open `http://localhost:8000`.

Do not disable Supabase row-level security or expose a service-role key in the browser.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the required migration and release sequence. Run `supabase-schema.sql` in the Supabase project before publishing the website.

## Supabase setup

1. Open the Supabase SQL Editor and run `supabase-schema.sql`.
2. Confirm the private Storage bucket `campushub-notes` was created by the SQL script.
3. In Authentication → URL Configuration, add the deployed site URL and local development URL.
4. For immediate registration without email confirmation, turn off email confirmation in Authentication settings. If confirmation is enabled, complete the email-confirmation flow before expecting a profile to be created.
5. Existing Firebase users and records are not copied automatically. Export/import the data and have users set/reset their passwords before switching production traffic.

The browser uses the Supabase project URL and publishable key in `supabase-client.js`. Never put a Supabase secret/service-role key in frontend code.

## Important data model

| Collection | Purpose |
| --- | --- |
| `students` | Private student record; owner and administrators only |
| `publicProfiles` | Directory-safe profile fields; authenticated users can read |
| `modules` | Published modules and lecturer ownership |
| `moduleEnrollments` | Student/module relationship and lecturer roster metadata |
| `work` | Published assignments and tests |
| `notes` | PDF note metadata; file bytes are stored in the private Supabase bucket under `moduleNotes/{moduleId}/` |
| `chatRooms/{roomId}/messages` | General, course and direct-message history |

Supabase stores these logical collections as JSONB records in `campushub_documents`; row-level security controls access. PDF notes are stored in the private `campushub-notes` bucket and served with short-lived signed URLs.

The public profile collection must not contain phone numbers, email addresses, registration numbers, birth dates, or guardian/emergency contact details.

## Roles

New self-registered accounts are always created as `student`. Only an existing administrator can change a user's role. Do not grant roles by editing browser code or accepting a role value from a registration form.

## Security notes

- Firebase web configuration (including the API key) is client-visible by design. It is not an authorization boundary. Restrict the key where practical and rely on Authentication, Firestore rules and Firebase project controls.
- Never put service-account credentials or Admin SDK private keys in this repository or browser code.
- Review [SECURITY.md](SECURITY.md) before using real student information.
- The application is a static frontend; production use should add monitored backups, error reporting, automated tests and an appropriate privacy notice.

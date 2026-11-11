# CampusHub

CampusHub is a browser-based campus portal built with vanilla HTML, CSS and JavaScript. Supabase Auth handles sign-in, PostgreSQL stores campus records, and a private Supabase Storage bucket stores uploaded PDF notes.

## Main features

- Student registration, sign-in and password reset
- Student academic profile and public directory profile
- Module browsing and self-enrolment
- Assignment and test announcements
- Lecturer PDF notes upload to Firebase Storage with module-based student access
- General, course and direct-message chat
- Lecturer module and student-roster management
- Separate teacher and administrator workspaces
- Administrator role management

## Run locally

This is a static frontend; there is no build step.

1. Create a Supabase project.
2. Enable **Email** sign-in in Supabase Authentication.
3. Add your local and production hostnames to Supabase Authentication URL Configuration.
4. Create a Supabase PostgreSQL database and enable Firebase Storage.
5. Check the Supabase project URL and publishable key in `supabase-client.js`.
6. Deploy both security rule sets: `firebase deploy --only firestore:rules,storage`.
7. Serve this directory through a local HTTP server (not by opening the HTML file directly). For example:

   ```bash
   python -m http.server 8000
   ```

7. Open `http://localhost:8000`.

Do not deploy with test or permissive Firestore rules.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the required migration and release sequence. Run `supabase-schema.sql` in the Supabase project before publishing the website.

## Important data model

| Collection | Purpose |
| --- | --- |
| `students` | Private student record; owner and administrators only |
| `publicProfiles` | Directory-safe profile fields; authenticated users can read |
| `modules` | Published modules and lecturer ownership |
| `moduleEnrollments` | Student/module relationship and lecturer roster metadata |
| `work` | Published assignments and tests |
| `notes` | PDF note metadata; file bytes are stored in Firebase Storage under `moduleNotes/{moduleId}/` |
| `chatRooms/{roomId}/messages` | General, course and direct-message history |

The public profile collection must not contain phone numbers, email addresses, registration numbers, birth dates, or guardian/emergency contact details.

## Roles

New self-registered accounts are always created as `student`. Only an existing administrator can change a user's role. Do not grant roles by editing browser code or accepting a role value from a registration form.

## Security notes

- Firebase web configuration (including the API key) is client-visible by design. It is not an authorization boundary. Restrict the key where practical and rely on Authentication, Firestore rules and Firebase project controls.
- Never put service-account credentials or Admin SDK private keys in this repository or browser code.
- Review [SECURITY.md](SECURITY.md) before using real student information.
- The application is a static frontend; production use should add monitored backups, error reporting, automated tests and an appropriate privacy notice.

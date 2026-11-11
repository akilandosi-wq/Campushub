# CampusHub

CampusHub is a browser-based campus portal built with vanilla HTML, CSS and JavaScript. Firebase Authentication handles sign-in, and Cloud Firestore stores student profiles, modules, enrolments, published academic work and chat messages.

## Main features

- Student registration, sign-in and password reset
- Student academic profile and public directory profile
- Module browsing and self-enrolment
- Assignment and test announcements
- General, course and direct-message chat
- Lecturer module and student-roster management
- Administrator role management

## Run locally

This is a static frontend; there is no build step.

1. Create or select a Firebase project.
2. Enable **Email/Password** in Firebase Authentication.
3. Add your local development hostname and production hostname to Authentication's authorized domains.
4. Create a Cloud Firestore database.
5. Review `firebase-config.js` and set it to your Firebase web-app configuration.
6. Serve this directory through a local HTTP server (not by opening the HTML file directly). For example:

   ```bash
   python -m http.server 8000
   ```

7. Open `http://localhost:8000`.

Do not deploy with test or permissive Firestore rules.

## Deploy

See [DEPLOYMENT.md](DEPLOYMENT.md) for the required migration and release sequence. The Firestore rules in `firestore.rules` must be deployed to the same Firebase project used by `firebase-config.js`.

## Important data model

| Collection | Purpose |
| --- | --- |
| `students` | Private student record; owner and administrators only |
| `publicProfiles` | Directory-safe profile fields; authenticated users can read |
| `modules` | Published modules and lecturer ownership |
| `moduleEnrollments` | Student/module relationship and lecturer roster metadata |
| `work` | Published assignments and tests |
| `chatRooms/{roomId}/messages` | General, course and direct-message history |

The public profile collection must not contain phone numbers, email addresses, registration numbers, birth dates, or guardian/emergency contact details.

## Roles

New self-registered accounts are always created as `student`. Only an existing administrator can change a user's role. Do not grant roles by editing browser code or accepting a role value from a registration form.

## Security notes

- Firebase web configuration (including the API key) is client-visible by design. It is not an authorization boundary. Restrict the key where practical and rely on Authentication, Firestore rules and Firebase project controls.
- Never put service-account credentials or Admin SDK private keys in this repository or browser code.
- Review [SECURITY.md](SECURITY.md) before using real student information.
- The application is a static frontend; production use should add monitored backups, error reporting, automated tests and an appropriate privacy notice.

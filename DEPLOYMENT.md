# Deployment and migration guide

## Before deploying

1. Back up the existing Firestore database.
2. Confirm that the Firebase project ID in `firebase-config.js` is the intended project.
3. Ensure at least one trusted administrator account already exists. If no administrator exists, stop and establish one securely using a trusted server-side Firebase Admin SDK process. Do not make a student promote themselves.
4. Review `firestore.rules` and test it against a non-production Firebase project first.

## Deploy Firestore rules

Install the Firebase CLI and authenticate:

```bash
npm install -g firebase-tools
firebase login
firebase use <YOUR_FIREBASE_PROJECT_ID>
firebase deploy --only firestore:rules
```

This repository does not include a Firebase project alias. Select the project deliberately; do not assume the CLI's currently selected project is correct.

## Migrate existing public directory profiles

The application now separates private `students` records from directory-safe `publicProfiles` records. Existing accounts need a one-time migration:

1. Deploy the new rules.
2. Sign in to the staff portal using an administrator account.
3. Open **Manage Users**.
4. Click **Sync public profiles** and wait for the success notification.

This copies only full name, programme, year, bio and social links. It does not copy phone, email, registration number, date of birth or guardian information.

New registrations create their public profile automatically. Existing users also refresh their own public profile on next sign-in.

## Validate after deployment

- Register a test student and verify the private and public profile documents are created.
- Sign in as that student and confirm the directory and own profile work.
- Confirm one student cannot read another student's `students/{uid}` document.
- Confirm one student cannot change their role, programme, year or registration number.
- Confirm students can only enrol themselves in real modules and cannot forge a lecturer ID.
- Confirm a lecturer can manage only their own modules, work and enrolment roster.
- Confirm an administrator can manage users and modules as intended.
- Test general chat, same-course chat and a direct message between two accounts; verify a third account cannot read the DM.
- Verify public profiles contain no private contact or guardian fields.
- Check existing course chat history. The updated room ID uses the exact programme string (for example, `course_Computer Engineering`); older rooms created with the previous normalized/lowercase ID may need a planned migration if their history must be retained.

## Rollback

If an essential workflow fails, restore the previously backed-up rules and application commit together. Do not leave the database with open rules as a workaround. Diagnose the failing rule/query in the Firebase Emulator Suite before re-deploying.

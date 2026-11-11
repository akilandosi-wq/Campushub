# Security review and operating guidance

## Changes in this branch

- Restores a restrictive Firestore rules file in the repository.
- Restricts private `students` documents to their owner and administrators.
- Adds `publicProfiles` for directory-safe information.
- Prevents self-service role escalation and locks registration number, programme and year from student edits.
- Validates enrolment ownership against the referenced module and the signed-in student's profile.
- Restricts lecturer writes to modules and academic work they own; administrators can administer the wider system.
- Restricts course chat to the matching course and direct messages to the two participants.
- Limits message creation to the authenticated sender and a maximum 1,000-character message.
- Adds a one-time administrator migration action for existing public directory profiles.

## Important limitations and decisions

1. **Published work visibility:** signed-in users can read all published work. This is deliberate in this iteration because Firestore rules are not query filters, and the existing student client queries work by module ID without a rule-provable enrolment filter. To make work private to enrolled students, introduce a server-mediated read path or a student-specific materialized work collection, then update the client and rules together.
2. **Enrolment roster metadata:** the enrolment document contains registration number and phone so the assigned lecturer can manage a class roster. Only the student, the lecturer recorded on the enrolment, and administrators can read it. Review whether lecturers should see phone numbers before production.
3. **Course identity:** class-room membership currently relies on the course string in the student's private profile. Keep programme values normalized and consistent. A future version should use immutable course IDs and explicit membership records.
4. **No automated runtime verification:** this is a static source change. Run the Firebase Emulator Suite and the manual checks in [DEPLOYMENT.md](DEPLOYMENT.md) before production.
5. **Existing data:** the public-profile migration is a one-time administrator action. Back up Firestore before running it.
6. **Admin bootstrap:** administrator creation must be performed through a trusted process. Never expose an admin registration option in the public client.

## Operational checklist

- Restrict Firebase API key usage to expected websites/APIs where compatible with Firebase services.
- Configure authorized authentication domains.
- Enable Firebase App Check after validating the chosen web provider and rollout strategy.
- Set budget alerts and monitor Authentication/Firestore usage.
- Schedule and test Firestore backups.
- Establish a process for account removal, student record correction, incident response and data retention.
- Publish a privacy notice explaining which profile fields are public and which are private.
- Keep dependencies/CDN versions reviewed and pinned; add a Content Security Policy appropriate to the deployed domains.

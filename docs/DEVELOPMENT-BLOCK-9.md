# OPDesk Development Block 9 — Operations + Chat Integration

## Delivered in source
- Removed duplicate `mobile/opdesk_mobile` Flutter project.
- Added distinct `EMPLOYEE` role while retaining `INTERN_EMPLOYEE`.
- Added chat read-state (`conversation_members.last_read_at`).
- Direct-chat de-duplication.
- Chat API now returns members and unread counts.
- Message API returns sender names and marks conversations read.
- Web chat upgraded with new conversation creation for Direct / Group / Space, member picker, unread badges and 5-second refresh.
- Flutter chat upgraded with conversation creation, unread badges, sender-aware bubbles and polling.
- Flutter bottom navigation changed to Home / Tasks / Attendance / Chats / More.
- Mobile and web continue using the same REST API and PostgreSQL data model.

## Migration
Run `npm run db:migrate` against the target database before deploying the V9 application.

## Provider integrations
The existing SMTP, Google Calendar, Twilio WhatsApp, Web Push and mobile Bearer-JWT foundations remain in the project. Provider credentials must be configured in the deployment environment; source code cannot safely embed those secrets.

# OPDesk — Workforce Operations

Bharat Infotechs internal workforce and operations platform.

## Features included

- Authentication and role model
- Multi-tenant PostgreSQL schema
- People and teams foundation
- Task creation/listing and workflow foundation
- Meetings/attendance/daily-updates/warnings/report surfaces
- Database-backed notifications
- Idempotent automation foundation
- SMTP email adapter
- Google Calendar OAuth adapter
- Twilio WhatsApp adapter
- Training Coming Soon
- Responsive dashboard
- Demo mode for preview

## Quick start

1. Extract the project.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. For a no-database preview keep `DEMO_MODE=true`.
5. Run `npm run dev`.
6. Open http://localhost:3000.

Demo login:
admin@opdesk.local
OPDesk@123

## PostgreSQL

Set DATABASE_URL and DEMO_MODE=false, create the database, then:

npm run db:push
npm run db:seed

## Important

External integrations require their own credentials. Never commit `.env`.

## OPDesk integrated communication & approvals
The platform now includes the data/API foundation for Direct Chats, Groups, Spaces, message history, and controlled warning approvals. Warning issuance can be routed through an approver instead of being immediately finalised. Apply migration `0006_communication_approvals.sql` before using these endpoints.


## Canonical mobile app
The only Flutter application is `mobile/`. Do not create or restore a nested `mobile/opdesk_mobile/` project.

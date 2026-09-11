# OPDesk integrations

## Email
SMTP via Nodemailer. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD and EMAIL_FROM.

## Google Calendar
Optional OAuth connection endpoint: /api/integrations/google/connect. Configure Google OAuth credentials and redirect URI.

## WhatsApp
Optional Twilio WhatsApp adapter in src/services/integrations/twilio-whatsapp.ts. Set TWILIO_* variables and TWILIO_ENABLED=true.

## Browser notifications
The notification model is database-backed. A web-push adapter can be added using the VAPID variables already present in .env.example.

## Automation
POST /api/automation/run with x-automation-secret when AUTOMATION_SECRET is configured. Schedule this endpoint from a server cron provider in production.

## Database
PostgreSQL + Drizzle. DEMO_MODE=true allows the login/task preview without a database.

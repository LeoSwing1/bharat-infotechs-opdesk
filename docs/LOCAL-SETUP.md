# OPDesk local setup

The web/API and Flutter clients use the same PostgreSQL database.

1. Copy `.env.example` to `.env.local`.
2. Set `DATABASE_URL` to the same Neon/PostgreSQL database used by the deployment.
3. Set a strong `AUTH_SECRET`.
4. Use `DEMO_MODE=true` only when you intentionally want the demo accounts. Live attendance/chat require PostgreSQL.
5. Run `npm run db:migrate`.
6. Run `npm run dev`.
7. Run Flutter with `--dart-define=API_BASE_URL=http://10.0.2.2:3000` for an Android emulator or your LAN/deployed URL for a physical device.

If DATABASE_URL is missing, API routes now return a controlled configuration response instead of crashing during import.

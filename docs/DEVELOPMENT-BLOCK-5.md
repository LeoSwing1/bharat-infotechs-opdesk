# OPDesk Development Block 5 — Workforce Compliance Loop

Implemented:
- Mandatory daily-update review endpoint for management.
- Daily workforce compliance API showing attendance + daily-update status per person.
- Management-triggered compliance reminders with notification deduplication.
- Shared OPDESK_TIMEZONE helper (default Asia/Kolkata) for attendance and daily-update dates/hours.
- Automation sweep now uses organization timezone for daily-update reminders and missing clock-out dates.
- Existing task submit/review notification loop retained.

Next:
- Manager review queues UI.
- Employee daily-update edit/correction workflow.
- Attendance adherence calculations against assigned shifts.
- Quality/performance scoring model.
- Leave requests and approvals.
- Full chat/group/space UI parity and file attachments.

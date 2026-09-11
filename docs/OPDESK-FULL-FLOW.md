# OPDesk — Full Operating Flow

## 1. Core principle

OPDesk is one workforce operating system. Web and mobile are clients of the same API, database, identity, permissions, notifications and audit trail.

Every action should answer three questions:
1. Who is allowed to do it?
2. Who is affected?
3. What record/notification/audit event proves it happened?

## 2. Organization lifecycle

Super Admin
→ Organization setup
→ Departments
→ Teams
→ Shifts
→ Roles + permissions
→ Integrations
→ Managers / Team Leads
→ Employees / Interns

When a person is created:
- generate permanent employee ID
- assign employment type, department, team and shift
- assign reporting manager
- assign role and effective permissions
- create login credentials
- optionally send welcome email/WhatsApp
- create audit event
- surface onboarding notification

## 3. Permission model

There are three layers:

### Role defaults
Super Admin controls what each role can do.

### Team-scoped authorities
Super Admin can grant a Team Lead/HR/manager an extra authority for a specific team.

### Record ownership/scope
Even with a permission, a user only sees records allowed by organization/team/ownership rules.

Super Admin has organization-wide control and can manage permissions.

## 4. Employee daily loop

Login
→ Dashboard
→ Clock In
→ Work / Tasks
→ Meetings
→ Daily Update
→ Clock Out
→ Notifications / next-day follow-up

The dashboard should always expose what requires attention rather than being only a statistics page.

## 5. Task lifecycle

Creator/Manager/TL creates task
→ assign employee/team
→ employee receives notification
→ ASSIGNED
→ STARTED
→ work/progress/comments
→ SUBMITTED
→ reviewer checks submission
→ APPROVED
or REJECTED → employee sees reason → REOPEN → STARTED

Deadline automation:
- reminder before deadline
- overdue detection
- notification to employee
- management visibility

## 6. Attendance lifecycle

Employee clocks in
→ raw attendance event is recorded
→ daily attendance rollup is updated
→ break start/end events
→ clock out
→ worked minutes calculated
→ shift/grace rules determine adherence
→ missing clock-out / late events create alerts

Managers/HR see team attendance; employees see their own attendance unless broader permission is granted.

## 7. Daily update lifecycle

Every active employee is expected to submit one update per day.

Update contains:
- worked on
- completed
- next work
- blockers
- optional project/task context

Before deadline: reminder
After deadline: missing/late compliance state
Manager/TL: team overview
HR/Super Admin: organization reporting

## 8. Meetings

Organizer creates meeting
→ participants/team selected
→ invitation notification
→ optional Google Calendar sync
→ reminder
→ meeting attendance
→ meeting notes/outcome
→ activity history

## 9. Warning lifecycle

Authorized TL/manager/HR identifies an issue
→ creates warning request with reason + evidence/context
→ if approval is required, manager receives approval task
→ APPROVE / REJECT
→ approved warning becomes an employee-facing warning
→ employee notification
→ HR/Admin visibility
→ acknowledgement/resolution
→ permanent audit history

A Team Lead must not silently issue an approval-required warning outside the configured authority chain.

## 10. Communication

Chats contain:
- Direct conversations
- Groups
- Spaces
- Team/project conversations

Communication permissions determine who can create, manage and message in each scope.

Operational events should deep-link into chat/records where useful (for example, task review or warning discussion), without bypassing record permissions.

## 11. Notifications

One notification service feeds:
- in-app notifications
- browser push where configured
- mobile push when FCM/APNs is added
- email where SMTP is configured
- WhatsApp where Twilio is configured

Notifications are deduplicated and linked to the relevant record.

## 12. Management command center

### Super Admin
Organization health
→ people
→ teams
→ attendance adherence
→ task pipeline
→ daily-update compliance
→ warnings/approvals
→ meetings
→ integrations
→ permissions
→ audit activity

### HR
People + onboarding
→ attendance
→ leave/warnings
→ compliance
→ reports
→ organization policies

### Manager
My teams
→ today's attendance
→ task pipeline
→ daily updates
→ meetings
→ review queue
→ warning approvals
→ performance/quality

### Team Lead
My team
→ tasks
→ submissions
→ attendance
→ daily updates
→ meetings
→ warning requests
→ team chat

### Employee / Intern
My day
→ clock in/out
→ tasks
→ submit work
→ daily update
→ meetings
→ chats
→ notifications
→ own records

## 13. Integration architecture

All integrations must be optional and fail gracefully.

- Google Calendar: meeting synchronization
- SMTP: welcome emails, task/review/warning notifications
- Twilio WhatsApp: operational messages where enabled
- Web Push: browser notifications
- Mobile push: native device notifications
- Secure token storage: Flutter secure storage
- Audit log: every important administrative/workflow change

No integration should create a second source of truth. OPDesk remains authoritative for workforce records.

## 14. Automation engine

Scheduled automation checks:
- task reminders
- overdue tasks
- meeting reminders
- missing clock-outs
- daily-update compliance
- future adherence rules

Every automated action must be idempotent through a dedupe key.

## 15. Non-negotiable rules

- Organization isolation on every database query.
- Never expose password hashes or integration tokens.
- Permission checks belong on the server, not only in UI.
- Mobile uses the same API and authorization rules as web.
- Important workflow actions create notifications and audit records.
- Approval workflows must preserve requester, approver, decision and timestamp.
- Deactivation should not erase historical workforce records.

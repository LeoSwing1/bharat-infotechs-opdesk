# OPDesk Development Block 7 — Management Control Center

This block turns the management/review APIs into an operational control center.

## Added
- `/management` web control center.
- Scoped people list for Super Admin, HR, Manager and Team Lead.
- Per-employee operational API combining attendance, events, tasks, daily updates, leave, warnings, quality and activity history.
- Management navigation entry.
- Supporting indexes for common management queries.

## Scope
- Super Admin / HR: organization.
- Manager: direct reports plus self.
- Team Lead: members of active teams led by the user plus self.
- Others: self only.

## Next
The next block should turn the employee record into an actionable management workspace: approve/reject leave, review daily updates, task review, quality entry, warning request/approval, attendance corrections and a unified activity timeline.

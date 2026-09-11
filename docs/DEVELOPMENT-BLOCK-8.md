# Development Block 8 — Employee 360° Action Center

The management center now has an actionable Employee 360° view at `/management/[id]`.

It consolidates:
- attendance and attendance events
- tasks
- daily updates
- leave requests
- warnings
- quality/performance scores
- meetings
- activity history

Management actions currently exposed from the view:
- review a daily update
- approve/reject pending leave (when the signed-in role has the existing leave approval permission)
- enter an overall performance score
- jump to the full employee profile and task detail

The API remains the source of truth for authorization and organization/manager/team scope; the page does not trust client-side role checks.

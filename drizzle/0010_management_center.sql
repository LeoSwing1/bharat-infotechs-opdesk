-- OPDesk Block 7: management control center indexes.
CREATE INDEX IF NOT EXISTS tasks_assignee_updated_idx ON tasks (assignee_id, updated_at);
CREATE INDEX IF NOT EXISTS attendance_org_user_date_idx ON attendance (organization_id, user_id, attendance_date);
CREATE INDEX IF NOT EXISTS daily_updates_org_user_date_idx ON daily_updates (organization_id, user_id, update_date);
CREATE INDEX IF NOT EXISTS quality_org_user_created_idx ON quality_scores (organization_id, user_id, created_at);
CREATE INDEX IF NOT EXISTS activity_entity_created_idx ON activity_logs (entity_id, created_at);

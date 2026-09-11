-- Employee 360° block: indexes supporting management lookups.
CREATE INDEX IF NOT EXISTS tasks_assignee_updated_idx ON tasks (assignee_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS daily_updates_user_date_idx ON daily_updates (user_id, update_date DESC);
CREATE INDEX IF NOT EXISTS leave_requests_user_created_idx ON leave_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS warnings_user_created_idx ON warnings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quality_scores_user_created_idx ON quality_scores (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attendance_user_date_idx ON attendance (user_id, attendance_date DESC);
CREATE INDEX IF NOT EXISTS activity_logs_entity_created_idx ON activity_logs (entity_id, created_at DESC);

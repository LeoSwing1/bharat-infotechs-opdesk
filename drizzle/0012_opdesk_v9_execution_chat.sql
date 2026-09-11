-- OPDesk V9: complete workforce role model + chat read state
ALTER TYPE "role" ADD VALUE IF NOT EXISTS 'EMPLOYEE';
ALTER TABLE "conversation_members" ADD COLUMN IF NOT EXISTS "last_read_at" timestamptz;
CREATE INDEX IF NOT EXISTS conversation_member_user_read_idx ON conversation_members(user_id,last_read_at);

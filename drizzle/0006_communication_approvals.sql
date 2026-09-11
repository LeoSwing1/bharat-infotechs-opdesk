DO $$ BEGIN CREATE TYPE conversation_type AS ENUM ('DIRECT','GROUP','SPACE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_type AS ENUM ('TEXT','SYSTEM','FILE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE approval_status AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type conversation_type NOT NULL, name text, description text, created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversation_org_idx ON conversations(organization_id);
CREATE TABLE IF NOT EXISTS conversation_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'MEMBER', joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversation_member_unique_idx UNIQUE(conversation_id,user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id), type message_type NOT NULL DEFAULT 'TEXT', body text NOT NULL,
  attachment_url text, created_at timestamptz NOT NULL DEFAULT now(), edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS message_conversation_idx ON messages(conversation_id,created_at);
CREATE TABLE IF NOT EXISTS warning_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  warning_id uuid NOT NULL REFERENCES warnings(id) ON DELETE CASCADE, requested_by uuid NOT NULL REFERENCES users(id),
  approver_id uuid NOT NULL REFERENCES users(id), status approval_status NOT NULL DEFAULT 'PENDING', comments text,
  decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS warning_approval_org_idx ON warning_approvals(organization_id);
CREATE INDEX IF NOT EXISTS warning_approval_approver_idx ON warning_approvals(approver_id,status);

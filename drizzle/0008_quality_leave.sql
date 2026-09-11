DO $$ BEGIN CREATE TYPE "leave_status" AS ENUM ('PENDING','APPROVED','REJECTED','CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "leave_type" AS ENUM ('CASUAL','SICK','ANNUAL','UNPAID','OTHER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "quality_category" AS ENUM ('TASK','ATTENDANCE','COMMUNICATION','DELIVERY','CODE_QUALITY','OVERALL'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "type" "leave_type" NOT NULL,
  "start_date" date NOT NULL, "end_date" date NOT NULL, "days" integer NOT NULL, "reason" text NOT NULL,
  "status" "leave_status" NOT NULL DEFAULT 'PENDING', "reviewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "review_note" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "leave_org_idx" ON "leave_requests"("organization_id");
CREATE INDEX IF NOT EXISTS "leave_user_idx" ON "leave_requests"("user_id");
CREATE INDEX IF NOT EXISTS "leave_status_idx" ON "leave_requests"("status");
CREATE TABLE IF NOT EXISTS "quality_scores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE, "scored_by" uuid NOT NULL REFERENCES "users"("id"),
  "category" "quality_category" NOT NULL, "score" integer NOT NULL, "period" text NOT NULL, "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "quality_org_user_idx" ON "quality_scores"("organization_id","user_id");
CREATE INDEX IF NOT EXISTS "quality_period_idx" ON "quality_scores"("period");

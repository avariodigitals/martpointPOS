-- Customer success / project delivery columns on leads
-- Won leads become customers; all their feedback and checklist lives here.

-- PostgreSQL / Supabase migration: each ALTER is idempotent and self-contained.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS relationship TEXT NOT NULL DEFAULT 'neutral';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS testimonial TEXT NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS feedback_token UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tickets JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS checks JSONB NOT NULL DEFAULT '{"deployment":{"done":false,"remarks":""},"configuration":{"done":false,"remarks":""},"testing":{"done":false,"remarks":""},"training":{"done":false,"remarks":""},"handover":{"done":false,"remarks":""}}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS feedback JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Unique token for public feedback links
CREATE UNIQUE INDEX IF NOT EXISTS leads_feedback_token_idx ON leads (feedback_token);

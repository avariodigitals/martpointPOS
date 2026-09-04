-- Audit logging foundation
-- Reusable, append-only audit trail for the MartPoint Control Centre.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMIN','SYSTEM','PARTNER')),
  actor_id UUID,
  actor_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side only)
DROP POLICY IF EXISTS "sr_audit_logs_all" ON audit_logs;
CREATE POLICY "sr_audit_logs_all" ON audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_type, actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);

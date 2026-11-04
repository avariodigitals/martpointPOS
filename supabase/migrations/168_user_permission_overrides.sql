-- Per-user exceptions layered over the shared role permission baseline.
CREATE TABLE IF NOT EXISTS user_permission_overrides (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,
  effect TEXT NOT NULL CHECK(effect IN ('allow','deny')),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, permission_key)
);
ALTER TABLE user_permission_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_permission_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON user_permission_overrides TO service_role;
DROP POLICY IF EXISTS sr_user_permission_overrides_all ON user_permission_overrides;
CREATE POLICY sr_user_permission_overrides_all ON user_permission_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);
NOTIFY pgrst,'reload schema';

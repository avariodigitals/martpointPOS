-- Editable role-wide permission rules. Personal user_permission_overrides take precedence.
CREATE TABLE IF NOT EXISTS role_permission_overrides (
  role_name TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  effect TEXT NOT NULL CHECK (effect IN ('allow','deny')),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_name, permission_key)
);

ALTER TABLE role_permission_overrides ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON role_permission_overrides FROM PUBLIC, anon, authenticated;
GRANT ALL ON role_permission_overrides TO service_role;
DROP POLICY IF EXISTS sr_role_permission_overrides_all ON role_permission_overrides;
CREATE POLICY sr_role_permission_overrides_all ON role_permission_overrides FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Creator-authorized social accounts and one-time OAuth state for automated
-- performance snapshots. Tokens are encrypted by the application before write.
CREATE TABLE IF NOT EXISTS creator_social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('TIKTOK','INSTAGRAM','YOUTUBE')),
  platform_user_id TEXT NOT NULL,
  display_name TEXT,
  username TEXT,
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (status IN ('CONNECTED','REAUTH_REQUIRED','DISCONNECTED')),
  last_synced_at TIMESTAMPTZ,
  last_sync_error TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (creator_id, platform),
  UNIQUE (platform, platform_user_id)
);
CREATE INDEX IF NOT EXISTS creator_social_connections_sync_idx
  ON creator_social_connections (platform, status, access_token_expires_at);

CREATE TABLE IF NOT EXISTS creator_social_oauth_states (
  state_hash TEXT PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('TIKTOK')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_social_oauth_states_expiry_idx
  ON creator_social_oauth_states (expires_at);

ALTER TABLE creator_social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE creator_social_oauth_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_creator_social_connections ON creator_social_connections;
CREATE POLICY sr_creator_social_connections ON creator_social_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_creator_social_oauth_states ON creator_social_oauth_states;
CREATE POLICY sr_creator_social_oauth_states ON creator_social_oauth_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON creator_social_connections, creator_social_oauth_states FROM anon, authenticated;
GRANT ALL ON creator_social_connections, creator_social_oauth_states TO service_role;

COMMENT ON TABLE creator_social_connections IS
  'OAuth connections used to read creator-authorized social performance metrics. Never expose token ciphertext to clients.';

-- Azera routing, triage queues, and explicit agent presence.
-- A user is not an agent merely because they can open the admin portal: they
-- must have an azera_agents row and explicitly be online.

ALTER TABLE azera_conversations
  ADD COLUMN IF NOT EXISTS queue TEXT NOT NULL DEFAULT 'customer_support',
  ADD COLUMN IF NOT EXISTS triage_state TEXT NOT NULL DEFAULT 'needs_triage',
  ADD COLUMN IF NOT EXISTS waiting_for_agent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE azera_conversations DROP CONSTRAINT IF EXISTS azera_conversations_queue_check;
ALTER TABLE azera_conversations
  ADD CONSTRAINT azera_conversations_queue_check
  CHECK (queue IN ('sales', 'support', 'customer_support'));

ALTER TABLE azera_conversations DROP CONSTRAINT IF EXISTS azera_conversations_triage_state_check;
ALTER TABLE azera_conversations
  ADD CONSTRAINT azera_conversations_triage_state_check
  CHECK (triage_state IN ('needs_triage', 'sales', 'support', 'customer_support', 'resolved'));

CREATE INDEX IF NOT EXISTS azera_conversations_queue_idx ON azera_conversations (queue, status);
CREATE INDEX IF NOT EXISTS azera_conversations_waiting_idx
  ON azera_conversations (waiting_for_agent, last_message_at)
  WHERE waiting_for_agent = true;

ALTER TABLE azera_agents
  ADD COLUMN IF NOT EXISTS queues TEXT[] NOT NULL DEFAULT ARRAY['customer_support']::TEXT[],
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS azera_agents_online_queue_idx
  ON azera_agents USING GIN (queues) WHERE is_online = true;

-- Global admin-portal presence. This is separate from the per-business agent
-- assignment table because an agent can cover multiple merchant businesses.
CREATE TABLE IF NOT EXISTS azera_agent_presence (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  queues TEXT[] NOT NULL DEFAULT ARRAY['customer_support']::TEXT[],
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE azera_agent_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_azera_agent_presence_all" ON azera_agent_presence;
CREATE POLICY "sr_azera_agent_presence_all" ON azera_agent_presence FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS azera_agent_presence_online_idx ON azera_agent_presence (is_online, last_seen_at);

CREATE TABLE IF NOT EXISTS azera_conversation_participants (
  conversation_id UUID NOT NULL REFERENCES azera_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  participant_role TEXT NOT NULL DEFAULT 'collaborator',
  status TEXT NOT NULL DEFAULT 'invited',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE azera_conversation_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_azera_conversation_participants_all" ON azera_conversation_participants;
CREATE POLICY "sr_azera_conversation_participants_all" ON azera_conversation_participants FOR ALL TO service_role USING (true) WITH CHECK (true);

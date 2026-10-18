-- Azera Live Chat — customer-facing chat + agent console + WhatsApp bridge
-- Additive only. All tables use CREATE TABLE IF NOT EXISTS so re-runs are safe.
-- RLS is enabled; service_role bypasses it (same pattern as whatsapp_messages).

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA CONVERSATIONS
-- One row per active/inactive chat thread. A conversation can be website chat
-- or WhatsApp (channel). Linked to a support_ticket when converted to a ticket.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  channel TEXT NOT NULL DEFAULT 'website'
    CHECK (channel IN ('website', 'whatsapp')),

  -- For WhatsApp: the customer's wa_id / phone number.
  -- For website: an anonymous session id generated client-side.
  external_id TEXT NOT NULL,

  customer_name TEXT,
  customer_phone TEXT,

  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'assigned', 'closed')),

  assigned_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,

  ai_enabled BOOLEAN NOT NULL DEFAULT true,

  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id, channel, external_id)
);

CREATE INDEX IF NOT EXISTS azera_conversations_business_idx ON azera_conversations (business_id);
CREATE INDEX IF NOT EXISTS azera_conversations_status_idx ON azera_conversations (status) WHERE status IN ('open','assigned');
CREATE INDEX IF NOT EXISTS azera_conversations_assigned_idx ON azera_conversations (assigned_admin_user_id) WHERE assigned_admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_conversations_external_idx ON azera_conversations (external_id);
CREATE INDEX IF NOT EXISTS azera_conversations_ticket_idx ON azera_conversations (ticket_id) WHERE ticket_id IS NOT NULL;

ALTER TABLE azera_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_conversations_all" ON azera_conversations;
CREATE POLICY "sr_azera_conversations_all" ON azera_conversations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA MESSAGES
-- Individual messages within a conversation. direction = inbound (customer ->
-- business) or outbound (business -> customer).
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  conversation_id UUID NOT NULL REFERENCES azera_conversations(id) ON DELETE CASCADE,

  author_type TEXT NOT NULL DEFAULT 'customer'
    CHECK (author_type IN ('customer', 'agent', 'ai', 'system')),

  author_id UUID REFERENCES users(id) ON DELETE SET NULL,

  message TEXT NOT NULL,

  direction TEXT NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_messages_conversation_idx ON azera_messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS azera_messages_direction_idx ON azera_messages (direction);

ALTER TABLE azera_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_messages_all" ON azera_messages;
CREATE POLICY "sr_azera_messages_all" ON azera_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA AGENTS
-- Which admin users can take live chats, per business.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  is_online BOOLEAN NOT NULL DEFAULT false,
  auto_assign BOOLEAN NOT NULL DEFAULT true,
  max_concurrent INTEGER NOT NULL DEFAULT 5,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id, user_id)
);

CREATE INDEX IF NOT EXISTS azera_agents_business_idx ON azera_agents (business_id);
CREATE INDEX IF NOT EXISTS azera_agents_user_idx ON azera_agents (user_id);

ALTER TABLE azera_agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_agents_all" ON azera_agents;
CREATE POLICY "sr_azera_agents_all" ON azera_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA SETTINGS
-- Per-business live-chat widget configuration.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_settings (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,

  widget_enabled BOOLEAN NOT NULL DEFAULT true,
  widget_title TEXT NOT NULL DEFAULT 'Chat with us',
  widget_greeting TEXT NOT NULL DEFAULT 'Hello! How can we help you today?',
  brand_color TEXT NOT NULL DEFAULT '#0057FF',
  position TEXT NOT NULL DEFAULT 'bottom-right'
    CHECK (position IN ('bottom-right', 'bottom-left')),

  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ai_prompt TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE azera_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_settings_all" ON azera_settings;
CREATE POLICY "sr_azera_settings_all" ON azera_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA KNOWLEDGE
-- Per-business knowledge base articles that the AI can reference when answering.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_knowledge_business_idx ON azera_knowledge (business_id);

ALTER TABLE azera_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_knowledge_all" ON azera_knowledge;
CREATE POLICY "sr_azera_knowledge_all" ON azera_knowledge FOR ALL TO service_role USING (true) WITH CHECK (true);

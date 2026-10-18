-- Azera Calls — WebRTC (free internet) + SIP trunk (real phone numbers)
-- Additive only. CREATE TABLE IF NOT EXISTS.

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA CALLS
-- One row per call attempt. Supports two call types:
--   webrtc — browser-to-browser (free, both parties must be on the site)
--   sip    — via telecom provider (calls real phone numbers, per-minute cost)
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  conversation_id UUID REFERENCES azera_conversations(id) ON DELETE SET NULL,

  call_type TEXT NOT NULL DEFAULT 'webrtc'
    CHECK (call_type IN ('webrtc', 'sip')),

  direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('inbound', 'outbound')),

  status TEXT NOT NULL DEFAULT 'ringing'
    CHECK (status IN ('ringing', 'active', 'ended', 'missed', 'failed', 'busy')),

  -- Who initiated / is answering the call
  agent_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  agent_name TEXT,

  -- Customer side
  customer_name TEXT,
  customer_phone TEXT,        -- E.164 for SIP calls, null for webrtc
  customer_external_id TEXT,  -- webrtc session id / wa_id

  -- SIP provider details (only for sip calls)
  sip_provider TEXT,          -- 'africas_talking' | 'twilio' | 'plivo' | 'generic'
  sip_call_sid TEXT,          -- provider call reference
  sip_from_number TEXT,       -- your business number
  sip_to_number TEXT,         -- customer number
  sip_cost_cents INTEGER,     -- provider-charged cost in minor currency unit

  -- WebRTC details (only for webrtc calls)
  webrtc_room TEXT,           -- signaling room name

  started_at TIMESTAMPTZ,
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_calls_business_idx ON azera_calls (business_id);
CREATE INDEX IF NOT EXISTS azera_calls_conversation_idx ON azera_calls (conversation_id) WHERE conversation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_calls_status_idx ON azera_calls (status) WHERE status IN ('ringing','active');
CREATE INDEX IF NOT EXISTS azera_calls_agent_idx ON azera_calls (agent_user_id) WHERE agent_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_calls_type_idx ON azera_calls (call_type);
CREATE INDEX IF NOT EXISTS azera_calls_created_idx ON azera_calls (created_at DESC);

ALTER TABLE azera_calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_calls_all" ON azera_calls;
CREATE POLICY "sr_azera_calls_all" ON azera_calls FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA CALL EVENTS
-- Audit trail for each call (ringing, answered, hung up, missed, failed).
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'call_initiated','ringing','answered','ended','missed','failed','busy',
      'webrtc_offer','webrtc_answer','webrtc_ice_candidate','sip_webhook'
    )),

  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent','customer','system','sip_provider')),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,

  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_call_events_call_idx ON azera_call_events (call_id, created_at ASC);

ALTER TABLE azera_call_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_call_events_all" ON azera_call_events;
CREATE POLICY "sr_azera_call_events_all" ON azera_call_events FOR ALL TO service_role USING (true) WITH CHECK (true);

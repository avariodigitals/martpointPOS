-- Contact-centre delivery is explicit: a saved row is not proof of delivery.
ALTER TABLE azera_messages
  ADD COLUMN IF NOT EXISTS client_message_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS delivery_error TEXT,
  ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_updated_at TIMESTAMPTZ;
ALTER TABLE azera_messages DROP CONSTRAINT IF EXISTS azera_messages_delivery_status_check;
ALTER TABLE azera_messages ADD CONSTRAINT azera_messages_delivery_status_check
  CHECK (delivery_status IN ('not_required','pending','accepted','sent','delivered','read','received','failed','unknown'));
CREATE UNIQUE INDEX IF NOT EXISTS azera_messages_client_dedupe_idx
  ON azera_messages(conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS azera_messages_provider_dedupe_idx
  ON azera_messages(conversation_id, provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_messages_provider_delivery_idx
  ON azera_messages(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS azera_delivery_receipts (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  provider_message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','delivered','read','failed')),
  occurred_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (business_id, provider_message_id, status)
);
ALTER TABLE azera_delivery_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_azera_delivery_receipts ON azera_delivery_receipts;
CREATE POLICY sr_azera_delivery_receipts ON azera_delivery_receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Existing global integration settings remain usable. Per-business overrides
-- prevent a social account from being silently mapped to an unrelated tenant.
ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS messenger_page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS instagram_access_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_phone_number TEXT;

-- New browser-phone sessions have at most one live connection per staff user.
-- This predicate does not attempt to deduplicate historical provider records.
CREATE UNIQUE INDEX IF NOT EXISTS azera_one_africa_browser_call_per_agent
  ON azera_calls(agent_user_id)
  WHERE sip_provider = 'africas_talking_browser' AND status IN ('ringing','active');

ALTER TABLE azera_calls ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ;
ALTER TABLE azera_call_recordings
  ADD COLUMN IF NOT EXISTS consent_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ;

-- Call recordings contain private conversations, not public website assets.
UPDATE storage.buckets SET public = false WHERE id = 'call-recordings';
UPDATE storage.buckets SET allowed_mime_types = ARRAY['audio/wav','audio/x-wav','audio/mp3','audio/mpeg','audio/ogg','audio/webm','audio/mp4'] WHERE id = 'call-recordings';
DROP POLICY IF EXISTS "sr_call_recordings_public_read" ON storage.objects;

-- Least-loaded assignment is atomic across concurrently arriving chats.
CREATE OR REPLACE FUNCTION azera_assign_waiting_conversation(p_conversation_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c azera_conversations%ROWTYPE; chosen UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-assignment'));
  SELECT * INTO c FROM azera_conversations WHERE id = p_conversation_id FOR UPDATE;
  IF NOT FOUND OR c.status = 'closed' OR c.assigned_admin_user_id IS NOT NULL THEN RETURN c.assigned_admin_user_id; END IF;
  SELECT p.user_id INTO chosen FROM azera_agent_presence p JOIN users u ON u.id = p.user_id
  WHERE p.is_online AND p.last_seen_at > now() - INTERVAL '90 seconds'
    AND c.queue = ANY(p.queues) AND u.status = 'ACTIVE'
    AND u.role IN ('Admin','Sales','Customer Care','Tech')
    AND NOT EXISTS (SELECT 1 FROM azera_calls a WHERE a.agent_user_id = p.user_id AND a.status IN ('ringing','active'))
  ORDER BY (SELECT count(*) FROM azera_conversations a WHERE a.assigned_admin_user_id = p.user_id AND a.status <> 'closed'), p.last_seen_at DESC, p.user_id
  LIMIT 1;
  IF chosen IS NOT NULL THEN
    UPDATE azera_conversations SET assigned_admin_user_id = chosen, status = 'assigned', waiting_for_agent = false, ai_enabled = false, updated_at = now() WHERE id = c.id;
  END IF;
  RETURN chosen;
END $$;
REVOKE ALL ON FUNCTION azera_assign_waiting_conversation(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION azera_assign_waiting_conversation(UUID) TO service_role;
CREATE OR REPLACE FUNCTION azera_claim_browser_call(p_call_id UUID, p_agent_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c azera_calls%ROWTYPE; chosen_agent_name TEXT; required_queue TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:' || p_agent_id::TEXT));
  SELECT * INTO c FROM azera_calls WHERE id = p_call_id FOR UPDATE;
  IF NOT FOUND OR c.call_type <> 'webrtc' OR c.status <> 'ringing' OR (c.agent_user_id IS NOT NULL AND c.agent_user_id <> p_agent_id) THEN RETURN false; END IF;
  SELECT COALESCE(queue,'customer_support') INTO required_queue FROM azera_conversations WHERE id = c.conversation_id;
  SELECT u.name INTO chosen_agent_name FROM users u JOIN azera_agent_presence p ON p.user_id = u.id
    WHERE u.id = p_agent_id AND u.status = 'ACTIVE' AND u.role IN ('Admin','Sales','Customer Care','Tech')
      AND p.is_online AND p.last_seen_at > now() - INTERVAL '90 seconds' AND COALESCE(required_queue,'customer_support') = ANY(p.queues);
  IF NOT FOUND OR EXISTS(SELECT 1 FROM azera_calls WHERE agent_user_id = p_agent_id AND id <> p_call_id AND status IN ('ringing','active')) THEN RETURN false; END IF;
  UPDATE azera_calls SET agent_user_id = p_agent_id, agent_name = chosen_agent_name, updated_at = now() WHERE id = p_call_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION azera_claim_browser_call(UUID,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION azera_claim_browser_call(UUID,UUID) TO service_role;
CREATE OR REPLACE FUNCTION azera_guard_agent_call() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.agent_user_id IS NOT NULL AND NEW.status IN ('ringing','active') THEN
  PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:' || NEW.agent_user_id::TEXT));
  IF EXISTS(SELECT 1 FROM azera_calls WHERE agent_user_id=NEW.agent_user_id AND id<>NEW.id AND status IN ('ringing','active')) THEN
   RAISE EXCEPTION 'Finish the current call first' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS azera_guard_agent_call ON azera_calls;
CREATE TRIGGER azera_guard_agent_call BEFORE INSERT OR UPDATE OF agent_user_id,status ON azera_calls
 FOR EACH ROW EXECUTE FUNCTION azera_guard_agent_call();
CREATE TABLE IF NOT EXISTS azera_conversation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES azera_conversations(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE azera_conversation_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_azera_conversation_events ON azera_conversation_events;
CREATE POLICY sr_azera_conversation_events ON azera_conversation_events FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION azera_call_report_summary(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ, p_type TEXT DEFAULT NULL, p_direction TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_search TEXT DEFAULT '')
RETURNS JSONB LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT jsonb_build_object(
  'total', count(*),
  'answered', count(*) FILTER (WHERE answered_at IS NOT NULL),
  'missed', count(*) FILTER (WHERE status = 'missed'),
  'failed', count(*) FILTER (WHERE status = 'failed'),
  'busy', count(*) FILTER (WHERE status = 'busy'),
  'ringing', count(*) FILTER (WHERE status = 'ringing'),
  'active', count(*) FILTER (WHERE status = 'active'),
  'talkSeconds', COALESCE(sum(duration_seconds) FILTER (WHERE answered_at IS NOT NULL), 0),
  'averageAnswerSeconds', round(avg(GREATEST(0, extract(epoch FROM answered_at - COALESCE(started_at, created_at)))) FILTER (WHERE answered_at IS NOT NULL AND direction = 'inbound'), 1),
  'inboundFinished', count(*) FILTER (WHERE direction = 'inbound' AND status <> 'ringing'),
  'answeredWithin30Seconds', count(*) FILTER (WHERE direction = 'inbound' AND answered_at IS NOT NULL AND answered_at - COALESCE(started_at, created_at) <= INTERVAL '30 seconds'),
  'followUpsDue', count(*) FILTER (WHERE follow_up_at <= now() AND follow_up_status <> 'resolved')
) FROM azera_calls
WHERE created_at >= p_from AND created_at < p_to
  AND (p_type IS NULL OR call_type = p_type) AND (p_direction IS NULL OR direction = p_direction)
  AND (p_status IS NULL OR status = p_status)
  AND (p_search = '' OR customer_name ILIKE '%' || p_search || '%' OR customer_phone ILIKE '%' || p_search || '%' OR agent_name ILIKE '%' || p_search || '%');
$$;
REVOKE ALL ON FUNCTION azera_call_report_summary(TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION azera_call_report_summary(TIMESTAMPTZ,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT) TO service_role;
CREATE TABLE IF NOT EXISTS azera_follow_up_alerts (
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  due_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(call_id, due_at)
);
ALTER TABLE azera_follow_up_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_azera_follow_up_alerts ON azera_follow_up_alerts;
CREATE POLICY sr_azera_follow_up_alerts ON azera_follow_up_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

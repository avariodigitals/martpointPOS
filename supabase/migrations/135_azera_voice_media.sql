-- Opt-in recording and self-hosted media controls. Nothing is enabled by this
-- migration and no hosted service is provisioned. Apply after migration 134.
ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS voice_record_calls BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voice_recording_notice TEXT NOT NULL DEFAULT 'We would like to record this conversation for service quality. Press 1 to agree, or press 2 to continue without recording.',
  ADD COLUMN IF NOT EXISTS voice_recording_retention_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS voice_realtime_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS recording_choice TEXT CHECK (recording_choice IN ('accepted','declined')),
  ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_notice TEXT,
  ADD COLUMN IF NOT EXISTS media_control_claim UUID,
  ADD COLUMN IF NOT EXISTS transfer_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_expires_at TIMESTAMPTZ;
ALTER TABLE azera_call_recordings ADD COLUMN IF NOT EXISTS provider_reference TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS azera_auto_recording_reference
  ON azera_call_recordings(call_id,provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_ai_call_budget_idx ON azera_calls(business_id,created_at) WHERE sip_provider='openai_realtime';
CREATE INDEX IF NOT EXISTS azera_transfer_invite_idx ON azera_calls(transfer_to_user_id,transfer_expires_at) WHERE transfer_to_user_id IS NOT NULL;

-- A receiving agent must actually join and accept; inviting does not remove
-- the current agent or claim that the transfer succeeded.
CREATE OR REPLACE FUNCTION azera_accept_media_transfer(p_call_id UUID, p_agent_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_calls%ROWTYPE; agent_label TEXT; required_queue TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:' || p_agent_id::TEXT));
  SELECT * INTO c FROM azera_calls WHERE id=p_call_id FOR UPDATE;
  IF NOT FOUND OR c.sip_provider <> 'livekit' OR c.status <> 'active' OR c.media_control_claim IS NOT NULL OR c.held_at IS NOT NULL
    OR c.transfer_to_user_id IS DISTINCT FROM p_agent_id OR c.transfer_expires_at <= now() OR c.transfer_expires_at IS NULL THEN RETURN false; END IF;
  SELECT COALESCE(queue,'customer_support') INTO required_queue FROM azera_conversations WHERE id=c.conversation_id;
  SELECT u.name INTO agent_label FROM users u JOIN azera_agent_presence p ON p.user_id=u.id
  WHERE u.id=p_agent_id AND u.status='ACTIVE' AND u.role IN ('Admin','Sales','Customer Care','Tech')
    AND p.is_online AND p.last_seen_at > now()-INTERVAL '90 seconds'
    AND COALESCE(required_queue,'customer_support')=ANY(p.queues);
  IF NOT FOUND OR EXISTS(SELECT 1 FROM azera_calls WHERE id<>c.id AND agent_user_id=p_agent_id AND status IN ('ringing','active')) THEN RETURN false; END IF;
  UPDATE azera_calls SET agent_user_id=p_agent_id,agent_name=agent_label,transfer_to_user_id=NULL,transfer_expires_at=NULL,updated_at=now() WHERE id=c.id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION azera_accept_media_transfer(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION azera_accept_media_transfer(UUID,UUID) TO service_role;

-- Durable cross-instance limits: at most 3 concurrent AI calls, 100/day for a
-- business and 6/day for one conversation. Browser limit is 10 minutes;
-- the existing five-minute cron forcibly ends overdue provider sessions.
CREATE OR REPLACE FUNCTION azera_prepare_ai_call(p_conversation_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_conversations%ROWTYPE; call_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-ai-call-budget'));
  SELECT * INTO c FROM azera_conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT FOUND OR c.channel<>'website' OR c.status='closed' THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM azera_settings WHERE business_id=c.business_id AND voice_realtime_enabled)
    OR EXISTS(SELECT 1 FROM azera_calls WHERE conversation_id=c.id AND status IN ('ringing','active'))
    OR (SELECT count(*) FROM azera_calls WHERE sip_provider='openai_realtime' AND status IN ('ringing','active'))>=3
    OR (SELECT count(*) FROM azera_calls WHERE business_id=c.business_id AND sip_provider='openai_realtime' AND created_at>=date_trunc('day',now()))>=100
    OR (SELECT count(*) FROM azera_calls WHERE conversation_id=c.id AND sip_provider='openai_realtime' AND created_at>=date_trunc('day',now()))>=6 THEN RETURN NULL; END IF;
  call_id=gen_random_uuid();
  INSERT INTO azera_calls(id,business_id,conversation_id,call_type,direction,status,sip_provider,webrtc_room,customer_name,customer_phone,customer_external_id,started_at)
    VALUES(call_id,c.business_id,c.id,'webrtc','inbound','ringing','openai_realtime','azera-ai-'||call_id::TEXT,c.customer_name,c.customer_phone,c.external_id,now());
  RETURN call_id;
END $$;
REVOKE ALL ON FUNCTION azera_prepare_ai_call(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION azera_prepare_ai_call(UUID) TO service_role;

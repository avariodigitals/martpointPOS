-- Cloudflare-managed website audio. No provider resources are provisioned.
-- Apply after 135. Session locators and operation claims are service-only.
ALTER TABLE azera_calls ADD COLUMN IF NOT EXISTS media_control_claimed_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS azera_cloudflare_participants (
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  participant TEXT NOT NULL CHECK (participant IN ('customer','agent')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ice_servers JSONB,
  publisher_session TEXT,
  subscriber_session TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  subscribed BOOLEAN NOT NULL DEFAULT false,
  connected BOOLEAN NOT NULL DEFAULT false,
  operation_claim UUID,
  operation_claimed_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  PRIMARY KEY(call_id,participant)
);
ALTER TABLE azera_cloudflare_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_azera_cloudflare_participants ON azera_cloudflare_participants;
CREATE POLICY sr_azera_cloudflare_participants ON azera_cloudflare_participants
  FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON azera_cloudflare_participants FROM anon,authenticated;
GRANT ALL ON azera_cloudflare_participants TO service_role;
CREATE INDEX IF NOT EXISTS azera_cloudflare_open_idx ON azera_cloudflare_participants(last_seen_at) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS azera_cloudflare_call_idx ON azera_calls(created_at) WHERE sip_provider='cloudflare_sfu';

-- Admission limits survive Vercel concurrency and cannot be bypassed by
-- supplying a different provider in the browser. This is not a billing cap.
CREATE OR REPLACE FUNCTION azera_prepare_cloudflare_call(p_conversation_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_conversations%ROWTYPE; result UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-cloudflare-budget'));
  SELECT * INTO c FROM azera_conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT FOUND OR c.channel<>'website' OR c.status='closed' THEN RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM azera_calls WHERE conversation_id=c.id AND status IN ('ringing','active'))
    OR (SELECT count(*) FROM azera_calls WHERE sip_provider='cloudflare_sfu' AND status IN ('ringing','active'))>=10
    OR (SELECT count(*) FROM azera_calls WHERE conversation_id=c.id AND sip_provider='cloudflare_sfu' AND created_at>=date_trunc('day',now()))>=12 THEN RETURN NULL; END IF;
  result=gen_random_uuid();
  INSERT INTO azera_calls(id,business_id,conversation_id,call_type,direction,status,sip_provider,webrtc_room,customer_name,customer_phone,customer_external_id,started_at)
  VALUES(result,c.business_id,c.id,'webrtc','inbound','ringing','cloudflare_sfu','azera-cf-'||result::TEXT,c.customer_name,c.customer_phone,c.external_id,now());
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION azera_prepare_cloudflare_call(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION azera_prepare_cloudflare_call(UUID) TO service_role;

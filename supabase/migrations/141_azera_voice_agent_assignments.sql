-- Explicit voice-agent eligibility. A portal role grants access to the phone
-- feature; this table grants permission to answer a specific queue.
CREATE TABLE IF NOT EXISTS azera_voice_agent_assignments (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queues TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, user_id),
  CHECK (queues <@ ARRAY['sales','support','onboarding','customer_support']::TEXT[])
);

CREATE INDEX IF NOT EXISTS azera_voice_agent_assignments_user_idx
  ON azera_voice_agent_assignments (user_id, business_id)
  WHERE enabled;

ALTER TABLE azera_voice_agent_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON azera_voice_agent_assignments FROM anon, authenticated;
GRANT ALL ON azera_voice_agent_assignments TO service_role;
DROP POLICY IF EXISTS sr_azera_voice_agent_assignments ON azera_voice_agent_assignments;
CREATE POLICY sr_azera_voice_agent_assignments
  ON azera_voice_agent_assignments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Replace the client-selected queue list with the administrator-approved list.
CREATE OR REPLACE FUNCTION azera_register_africa_browser(
 p_user UUID, p_business UUID, p_lease UUID, p_queues TEXT[]
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_phone azera_africa_browser_agents%ROWTYPE; identity TEXT; allowed_queues TEXT[];
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:'||p_user::TEXT));
 SELECT a.queues INTO allowed_queues
 FROM azera_voice_agent_assignments a
 JOIN users u ON u.id=a.user_id
 WHERE a.business_id=p_business AND a.user_id=p_user AND a.enabled
   AND cardinality(a.queues)>0 AND u.status='ACTIVE'
   AND u.role IN ('Admin','Sales','Customer Care','Tech');
 IF allowed_queues IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO current_phone FROM azera_africa_browser_agents WHERE user_id=p_user FOR UPDATE;
 IF FOUND AND current_phone.lease_id<>p_lease AND current_phone.last_seen_at>now()-INTERVAL '60 seconds' THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM azera_calls WHERE agent_user_id=p_user AND status IN ('ringing','active')) THEN RETURN NULL; END IF;
 identity='mp_agent_'||replace(p_user::TEXT,'-','');
 INSERT INTO azera_africa_browser_agents(user_id,business_id,client_name,lease_id,queues,ready,last_seen_at)
 VALUES(p_user,p_business,identity,p_lease,allowed_queues,false,now())
 ON CONFLICT(user_id) DO UPDATE SET business_id=excluded.business_id,lease_id=excluded.lease_id,queues=excluded.queues,ready=false,last_seen_at=now();
 RETURN identity;
END $$;
REVOKE ALL ON FUNCTION azera_register_africa_browser(UUID,UUID,UUID,TEXT[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION azera_register_africa_browser(UUID,UUID,UUID,TEXT[]) TO service_role;

CREATE OR REPLACE FUNCTION azera_route_africa_browser(p_call UUID,p_queue TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_calls%ROWTYPE; agent RECORD;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('azera-africa-incoming-route'));
 SELECT * INTO c FROM azera_calls WHERE id=p_call FOR UPDATE;
 IF NOT FOUND OR c.direction<>'inbound' OR c.sip_provider<>'africas_talking' OR c.status<>'ringing' THEN RETURN NULL; END IF;
 IF c.agent_user_id IS NOT NULL THEN
  RETURN (SELECT p.client_name FROM azera_africa_browser_agents p
    JOIN azera_voice_agent_assignments a ON a.user_id=p.user_id AND a.business_id=p.business_id
    WHERE p.user_id=c.agent_user_id AND p.business_id=c.business_id AND a.enabled
      AND p_queue=ANY(a.queues) AND p.ready AND p.last_seen_at>now()-INTERVAL '60 seconds');
 END IF;
 FOR agent IN SELECT p.user_id,p.client_name,u.name FROM azera_africa_browser_agents p
 JOIN azera_voice_agent_assignments a ON a.user_id=p.user_id AND a.business_id=p.business_id
 JOIN users u ON u.id=p.user_id
 WHERE p.business_id=c.business_id AND a.enabled AND p.ready AND p.last_seen_at>now()-INTERVAL '60 seconds'
 AND p_queue=ANY(a.queues) AND u.status='ACTIVE' AND u.role IN ('Admin','Sales','Customer Care','Tech')
 ORDER BY (SELECT max(created_at) FROM azera_calls WHERE agent_user_id=p.user_id) NULLS FIRST,p.user_id
 LOOP
  PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:'||agent.user_id::TEXT));
  IF NOT EXISTS(SELECT 1 FROM azera_calls WHERE agent_user_id=agent.user_id AND status IN ('ringing','active')) THEN
   UPDATE azera_calls SET agent_user_id=agent.user_id,agent_name=agent.name,updated_at=now() WHERE id=c.id;
   RETURN agent.client_name;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION azera_route_africa_browser(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION azera_route_africa_browser(UUID,TEXT) TO service_role;

NOTIFY pgrst,'reload schema';

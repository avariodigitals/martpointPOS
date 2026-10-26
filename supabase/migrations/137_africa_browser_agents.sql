-- Persistent, authenticated Africa's Talking browser phones. No SIP passwords.
-- A short lease prevents another tab from stealing a registered browser identity.
CREATE TABLE IF NOT EXISTS azera_africa_browser_agents (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL UNIQUE,
  lease_id UUID NOT NULL,
  queues TEXT[] NOT NULL,
  ready BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE azera_africa_browser_agents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON azera_africa_browser_agents FROM anon, authenticated;
GRANT ALL ON azera_africa_browser_agents TO service_role;
DROP POLICY IF EXISTS sr_africa_browser_agents ON azera_africa_browser_agents;
CREATE POLICY sr_africa_browser_agents ON azera_africa_browser_agents
  FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION azera_register_africa_browser(
 p_user UUID, p_business UUID, p_lease UUID, p_queues TEXT[]
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_phone azera_africa_browser_agents%ROWTYPE; identity TEXT;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('azera-call-agent:'||p_user::TEXT));
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=p_user AND status='ACTIVE' AND role IN ('Admin','Sales','Customer Care','Tech'))
   OR cardinality(p_queues)=0 OR NOT (p_queues <@ ARRAY['sales','support','onboarding','customer_support']::TEXT[]) THEN RETURN NULL; END IF;
 SELECT * INTO current_phone FROM azera_africa_browser_agents WHERE user_id=p_user FOR UPDATE;
 IF FOUND AND current_phone.lease_id<>p_lease AND current_phone.last_seen_at>now()-INTERVAL '60 seconds' THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM azera_calls WHERE agent_user_id=p_user AND status IN ('ringing','active')) THEN RETURN NULL; END IF;
 identity='mp_agent_'||replace(p_user::TEXT,'-','');
 INSERT INTO azera_africa_browser_agents(user_id,business_id,client_name,lease_id,queues,ready,last_seen_at)
 VALUES(p_user,p_business,identity,p_lease,p_queues,false,now())
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
  RETURN (SELECT client_name FROM azera_africa_browser_agents WHERE user_id=c.agent_user_id AND business_id=c.business_id AND ready AND last_seen_at>now()-INTERVAL '60 seconds');
 END IF;
 FOR agent IN SELECT p.user_id,p.client_name,u.name FROM azera_africa_browser_agents p JOIN users u ON u.id=p.user_id
 WHERE p.business_id=c.business_id AND p.ready AND p.last_seen_at>now()-INTERVAL '60 seconds'
 AND p_queue=ANY(p.queues) AND u.status='ACTIVE' AND u.role IN ('Admin','Sales','Customer Care','Tech')
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

-- The same provider session must not create two histories on callback retries.
-- Only add the index when historical data permits it; never delete old calls.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM azera_calls WHERE sip_call_sid IS NOT NULL GROUP BY business_id,sip_call_sid HAVING count(*)>1) THEN
  CREATE UNIQUE INDEX IF NOT EXISTS azera_africa_session_unique ON azera_calls(business_id,sip_call_sid) WHERE sip_call_sid IS NOT NULL;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';

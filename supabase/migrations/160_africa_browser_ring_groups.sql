-- Ring every available browser agent in the selected inbound queue together.
CREATE TABLE IF NOT EXISTS public.azera_africa_browser_call_rings (
  call_id uuid NOT NULL REFERENCES public.azera_calls(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'ringing' CHECK (state IN ('ringing','answered','declined','missed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (call_id, user_id)
);

ALTER TABLE public.azera_africa_browser_call_rings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.azera_africa_browser_call_rings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.azera_africa_browser_call_rings TO service_role;
DROP POLICY IF EXISTS sr_azera_africa_browser_call_rings ON public.azera_africa_browser_call_rings;
CREATE POLICY sr_azera_africa_browser_call_rings ON public.azera_africa_browser_call_rings
  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS azera_africa_browser_call_rings_user_idx
  ON public.azera_africa_browser_call_rings(user_id, state, created_at DESC);

CREATE OR REPLACE FUNCTION public.azera_route_africa_browser_group(p_call uuid, p_queue text)
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_calls%ROWTYPE; agent RECORD; destinations text[] := ARRAY[]::text[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-africa-incoming-route'));
  SELECT * INTO c FROM azera_calls WHERE id=p_call FOR UPDATE;
  IF NOT FOUND OR c.direction<>'inbound' OR c.sip_provider<>'africas_talking' OR c.status<>'ringing' THEN
    RETURN destinations;
  END IF;
  FOR agent IN
    SELECT p.user_id,p.client_name
    FROM azera_africa_browser_agents p
    JOIN azera_voice_agent_assignments a ON a.user_id=p.user_id AND a.business_id=p.business_id
    JOIN users u ON u.id=p.user_id
    WHERE p.business_id=c.business_id AND a.enabled AND p.ready
      AND p.last_seen_at>now()-INTERVAL '60 seconds'
      AND p_queue=ANY(a.queues) AND u.status='ACTIVE'
      AND u.role IN ('Admin','Sales','Customer Care','Tech')
      AND NOT EXISTS (SELECT 1 FROM azera_calls busy WHERE busy.agent_user_id=p.user_id AND busy.status IN ('ringing','active'))
      AND NOT EXISTS (
        SELECT 1 FROM azera_africa_browser_call_rings active_ring
        JOIN azera_calls active_call ON active_call.id=active_ring.call_id
        WHERE active_ring.user_id=p.user_id AND active_ring.state='ringing'
          AND active_call.status IN ('ringing','active')
      )
    ORDER BY (SELECT max(created_at) FROM azera_calls WHERE agent_user_id=p.user_id) NULLS FIRST,p.user_id
  LOOP
    destinations := array_append(destinations, agent.client_name);
    INSERT INTO azera_africa_browser_call_rings(call_id,user_id,state)
      VALUES(p_call,agent.user_id,'ringing') ON CONFLICT(call_id,user_id) DO UPDATE
      SET state='ringing',updated_at=now();
  END LOOP;
  RETURN destinations;
END $$;
REVOKE ALL ON FUNCTION public.azera_route_africa_browser_group(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azera_route_africa_browser_group(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.azera_claim_africa_browser_answer(p_call uuid,p_user uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c azera_calls%ROWTYPE; v_agent_name text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('azera-africa-answer:'||p_call::text));
  SELECT * INTO c FROM azera_calls WHERE id=p_call FOR UPDATE;
  IF NOT FOUND OR c.status NOT IN ('ringing','active') THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM azera_africa_browser_call_rings
    WHERE call_id=p_call AND user_id=p_user AND state='ringing') THEN RETURN false; END IF;
  IF c.agent_user_id IS NOT NULL AND c.agent_user_id<>p_user THEN RETURN false; END IF;
  SELECT COALESCE(name,username) INTO v_agent_name FROM users WHERE id=p_user AND status='ACTIVE';
  IF v_agent_name IS NULL THEN RETURN false; END IF;
  UPDATE azera_calls SET agent_user_id=p_user,agent_name=v_agent_name,
    status='active',answered_at=COALESCE(answered_at,now()),updated_at=now()
    WHERE id=p_call AND status IN ('ringing','active');
  UPDATE azera_africa_browser_call_rings SET state=CASE WHEN user_id=p_user THEN 'answered' ELSE 'cancelled' END,updated_at=now()
    WHERE call_id=p_call AND state='ringing';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.azera_claim_africa_browser_answer(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.azera_claim_africa_browser_answer(uuid,uuid) TO service_role;

NOTIFY pgrst,'reload schema';

-- Retention clocks are genuine observed events; never backfill login from usage/health.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
CREATE INDEX IF NOT EXISTS businesses_last_login_idx ON public.businesses(last_login_at);

-- Serialize enrolment and rotation by business; rerunning enrolment returns the active token.
CREATE OR REPLACE FUNCTION public.issue_install_checkin_token(p_business_id uuid,p_rotate boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token text;
BEGIN
  PERFORM id FROM public.businesses WHERE id=p_business_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT p_rotate THEN
    SELECT token INTO v_token FROM public.install_tokens WHERE business_id=p_business_id AND status='active';
    IF v_token IS NOT NULL THEN RETURN v_token; END IF;
  END IF;
  UPDATE public.install_tokens SET status='retired',retired_at=now() WHERE business_id=p_business_id AND status='active';
  v_token=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.install_tokens(business_id,token,status) VALUES(p_business_id,v_token,'active');
  RETURN v_token;
END $$;

CREATE OR REPLACE FUNCTION public.record_install_retention(p_token text,p_login_at timestamptz DEFAULT NULL,p_activity_at timestamptz DEFAULT NULL,p_system_at timestamptz DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_business uuid;
BEGIN
  IF (p_login_at IS NULL AND p_activity_at IS NULL AND p_system_at IS NULL)
     OR greatest(p_login_at,p_activity_at,p_system_at)>now()+interval '5 minutes'
     OR least(p_login_at,p_activity_at,p_system_at)<'2000-01-01'::timestamptz THEN RETURN false; END IF;
  SELECT business_id INTO v_business FROM public.install_tokens WHERE token=p_token AND status='active';
  IF v_business IS NULL THEN RETURN false; END IF;
  PERFORM id FROM public.businesses WHERE id=v_business FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM public.install_tokens WHERE token=p_token AND status='active') THEN RETURN false; END IF;
  UPDATE public.businesses SET
    last_login_at=greatest(last_login_at,p_login_at),
    last_usage_at=greatest(last_usage_at,p_activity_at,p_login_at),
    last_seen_at=greatest(last_seen_at,p_activity_at,p_login_at),
    last_system_ping_at=greatest(last_system_ping_at,p_system_at)
  WHERE id=v_business;
  IF NOT FOUND THEN RETURN false; END IF;
  UPDATE public.install_tokens SET last_used_at=now() WHERE token=p_token AND status='active';
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.issue_install_checkin_token(uuid,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.record_install_retention(text,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.issue_install_checkin_token(uuid,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_install_retention(text,timestamptz,timestamptz,timestamptz) TO service_role;

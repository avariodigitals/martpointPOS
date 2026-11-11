CREATE TABLE IF NOT EXISTS public.paystack_gateway_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active_mode TEXT NOT NULL DEFAULT 'live' CHECK (active_mode IN ('test','live')),
  live_secret_encrypted TEXT,
  test_secret_encrypted TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.paystack_gateway_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.paystack_gateway_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.paystack_gateway_settings TO service_role;
DROP POLICY IF EXISTS sr_paystack_gateway_settings_all ON public.paystack_gateway_settings;
CREATE POLICY sr_paystack_gateway_settings_all
  ON public.paystack_gateway_settings
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- Central-managed Meta credentials. The application encrypts app_secret_ciphertext
-- before writing; this table is available only to the server-side service role.
CREATE TABLE IF NOT EXISTS public.meta_ads_platform_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_id TEXT NOT NULL DEFAULT '1492393586161488',
  login_config_id TEXT NOT NULL DEFAULT '1411401517644638',
  redirect_uri TEXT NOT NULL DEFAULT 'https://central.martpoint.com.ng/marketing/ai_ads/broker_callback',
  graph_version TEXT NOT NULL DEFAULT 'v27.0',
  app_secret_ciphertext TEXT,
  token_master_key_ciphertext TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_ads_platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_ads_platform_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.meta_ads_platform_settings TO service_role;
DROP POLICY IF EXISTS sr_meta_ads_platform_settings_all ON public.meta_ads_platform_settings;
CREATE POLICY sr_meta_ads_platform_settings_all ON public.meta_ads_platform_settings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

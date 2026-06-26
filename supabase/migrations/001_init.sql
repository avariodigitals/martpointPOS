-- Settings table for site configuration (replaces data/settings.json)
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure only one row exists
CREATE OR REPLACE FUNCTION enforce_single_settings_row()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.settings WHERE id = 1) THEN
    RAISE EXCEPTION 'Only one settings row is allowed. Use UPDATE instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS single_settings_trigger ON public.settings;
CREATE TRIGGER single_settings_trigger
  BEFORE INSERT ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION enforce_single_settings_row();

-- Insert default settings
INSERT INTO public.settings (id, data)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS but allow anon reads (settings are public)
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read" ON public.settings;
CREATE POLICY "Allow anon read"
  ON public.settings
  FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Allow service role write" ON public.settings;
CREATE POLICY "Allow service role write"
  ON public.settings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

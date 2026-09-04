-- Partner application reference + partner ID sequence counters
-- Uses a single-row counter table and atomic increment functions.
-- Idempotent.

CREATE TABLE IF NOT EXISTS partner_sequences (
  id INTEGER PRIMARY KEY DEFAULT 1,
  application_seq INTEGER NOT NULL DEFAULT 0,
  partner_seq_global INTEGER NOT NULL DEFAULT 0,
  partner_seq_by_country JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_sequences_all" ON partner_sequences;
CREATE POLICY "sr_partner_sequences_all" ON partner_sequences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ensure the single row exists
INSERT INTO partner_sequences (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Atomic increment for application reference (MPA-YYYY-XXXXX)
CREATE OR REPLACE FUNCTION increment_partner_application_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET application_seq = application_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING application_seq INTO next_val;
  RETURN next_val;
END;
$$;

-- Atomic increment for partner ID per country (MP-{CC}-XXXXX)
CREATE OR REPLACE FUNCTION increment_partner_id_seq(p_country TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cc TEXT;
  current_val INTEGER;
  next_val INTEGER;
BEGIN
  cc := UPPER(regexp_replace(substring(COALESCE(p_country, 'NG') FROM '[A-Z]{1,3}'), '[^A-Z]', '', 'g'));
  IF cc = '' THEN cc := 'NG'; END IF;

  SELECT COALESCE((partner_seq_by_country ->> cc)::INTEGER, 0) INTO current_val
    FROM partner_sequences WHERE id = 1;

  next_val := current_val + 1;

  UPDATE partner_sequences
    SET partner_seq_by_country = jsonb_set(partner_seq_by_country, cc, to_jsonb(next_val)),
        updated_at = now()
    WHERE id = 1;

  RETURN next_val;
END;
$$;

-- Revoke public execute; only service role should call these.
REVOKE EXECUTE ON FUNCTION increment_partner_application_seq() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_partner_id_seq(TEXT) FROM PUBLIC, anon, authenticated;

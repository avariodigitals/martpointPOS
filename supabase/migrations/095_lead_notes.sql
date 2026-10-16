-- 095: Lead notes history
-- The admin lead Notes tab previously overwrote the single `leads.notes` text
-- column on every save, so earlier notes were lost. Notes become one row each,
-- following the career_application_notes / creator_admin_notes convention.
-- `leads.notes` is left in place (the partner portal still reads it) and its
-- existing text is carried over as each lead's first entry.

CREATE TABLE IF NOT EXISTS lead_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_notes_lead_idx ON lead_notes (lead_id, created_at DESC);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_lead_notes_all" ON lead_notes;
CREATE POLICY "sr_lead_notes_all" ON lead_notes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Carry over text already saved in leads.notes, newest surface first.
INSERT INTO lead_notes (lead_id, author_name, note, created_at)
SELECT l.id, 'Imported note', TRIM(l.notes), l.updated_at
FROM leads l
WHERE NULLIF(TRIM(l.notes), '') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM lead_notes n WHERE n.lead_id = l.id);

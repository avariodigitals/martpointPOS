-- Explicitly consented recordings and reusable notes for outgoing calls.
ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS azera_calls_lead_history_idx
  ON azera_calls(lead_id, created_at DESC) WHERE lead_id IS NOT NULL;
ALTER TABLE azera_call_recordings ADD COLUMN IF NOT EXISTS summary_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (summary_status IN ('pending','complete','needs_staff_review','failed'));

UPDATE azera_calls c
SET lead_id = r.lead_id
FROM azera_call_campaign_recipients r
WHERE r.call_id = c.id AND c.lead_id IS NULL AND r.lead_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS azera_call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL UNIQUE REFERENCES azera_calls(id) ON DELETE CASCADE,
  transcript TEXT,
  summary TEXT CHECK (summary IS NULL OR length(trim(summary)) BETWEEN 5 AND 5000),
  action_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL DEFAULT 'other',
  summary_status TEXT NOT NULL DEFAULT 'pending' CHECK (summary_status IN ('pending','complete','needs_staff_review','failed')),
  summary_source TEXT NOT NULL DEFAULT 'staff' CHECK (summary_source IN ('ai','staff','campaign')),
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Azera',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS azera_call_summaries_created_idx ON azera_call_summaries(created_at DESC);
ALTER TABLE azera_call_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON azera_call_summaries FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON azera_call_summaries TO service_role;
DROP POLICY IF EXISTS sr_azera_call_summaries_all ON azera_call_summaries;
CREATE POLICY sr_azera_call_summaries_all ON azera_call_summaries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS azera_call_summary_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES azera_call_summaries(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('lead','business','creator','creator_application','team','user','conversation')),
  entity_id TEXT NOT NULL,
  entity_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(summary_id, entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS azera_call_summary_links_entity_idx ON azera_call_summary_links(entity_type, entity_id, created_at DESC);
ALTER TABLE azera_call_summary_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON azera_call_summary_links FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON azera_call_summary_links TO service_role;
DROP POLICY IF EXISTS sr_azera_call_summary_links_all ON azera_call_summary_links;
CREATE POLICY sr_azera_call_summary_links_all ON azera_call_summary_links FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

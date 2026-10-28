-- Profile-linked calls and append-only staff summaries. No phone-number guesses.
ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES creators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_application_id UUID REFERENCES creator_applications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS azera_calls_creator_history_idx ON azera_calls(creator_id,created_at DESC) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_calls_creator_application_history_idx ON azera_calls(creator_application_id,created_at DESC) WHERE creator_application_id IS NOT NULL;

-- Recover exact links already recorded by the outbound dialler. Conflicting
-- historical events are deliberately not guessed or assigned to either party.
WITH links AS (
  SELECT call_id,min(metadata->>'source_id') AS source_id,min(metadata->>'source_type') AS source_type
  FROM azera_call_events
  WHERE event_type='call_initiated' AND metadata->>'source_type' IN ('creator','creator_application')
  GROUP BY call_id
  HAVING count(DISTINCT (metadata->>'source_type',metadata->>'source_id'))=1
)
UPDATE azera_calls c SET creator_id=cr.id,creator_application_id=cr.application_id
FROM links l JOIN creators cr ON l.source_type='creator' AND cr.id::TEXT=l.source_id
WHERE c.id=l.call_id AND c.creator_id IS NULL AND c.creator_application_id IS NULL;
WITH links AS (
  SELECT call_id,min(metadata->>'source_id') AS source_id
  FROM azera_call_events WHERE event_type='call_initiated' AND metadata->>'source_type' IN ('creator','creator_application')
  GROUP BY call_id HAVING count(DISTINCT (metadata->>'source_type',metadata->>'source_id'))=1
    AND min(metadata->>'source_type')='creator_application'
)
UPDATE azera_calls c SET creator_application_id=a.id
FROM links l JOIN creator_applications a ON a.id::TEXT=l.source_id
WHERE c.id=l.call_id AND c.creator_id IS NULL AND c.creator_application_id IS NULL;

CREATE TABLE IF NOT EXISTS creator_call_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES azera_calls(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  summary TEXT NOT NULL CHECK(length(trim(summary)) BETWEEN 5 AND 5000),
  outcome TEXT NOT NULL CHECK(outcome IN ('discussed','follow_up_required','no_answer','not_interested','other')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_call_summaries_history_idx ON creator_call_summaries(call_id,created_at DESC);
ALTER TABLE creator_call_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON creator_call_summaries FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON creator_call_summaries TO service_role;
DROP POLICY IF EXISTS sr_creator_call_summaries_read ON creator_call_summaries;
DROP POLICY IF EXISTS sr_creator_call_summaries_insert ON creator_call_summaries;
CREATE POLICY sr_creator_call_summaries_read ON creator_call_summaries FOR SELECT TO service_role USING(true);
CREATE POLICY sr_creator_call_summaries_insert ON creator_call_summaries FOR INSERT TO service_role WITH CHECK(true);

-- Retain existing interview history while allowing post-approval meetings
-- without moving an approved creator back to Interview Scheduled.
ALTER TABLE creator_interviews
  ADD COLUMN IF NOT EXISTS meeting_kind TEXT NOT NULL DEFAULT 'interview' CHECK(meeting_kind IN ('interview','meeting')),
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS invite_status TEXT NOT NULL DEFAULT 'unknown' CHECK(invite_status IN ('unknown','pending','accepted','failed'));
NOTIFY pgrst,'reload schema';

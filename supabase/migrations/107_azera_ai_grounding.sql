-- Grounding and handoff audit fields. Additive only.
ALTER TABLE azera_conversations ADD COLUMN IF NOT EXISTS handoff_summary TEXT;
ALTER TABLE azera_conversations ADD COLUMN IF NOT EXISTS escalation_reason TEXT;
ALTER TABLE azera_conversations ADD COLUMN IF NOT EXISTS knowledge_refs JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS azera_conversations_escalation_idx
  ON azera_conversations (waiting_for_agent, escalation_reason)
  WHERE waiting_for_agent = true;

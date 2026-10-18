-- Curated AI knowledge management fields.
-- Blog and public marketing content are intentionally not treated as support truth.
ALTER TABLE azera_knowledge ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE azera_knowledge ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';
ALTER TABLE azera_knowledge ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE azera_knowledge ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';
ALTER TABLE azera_knowledge ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS azera_knowledge_status_idx
  ON azera_knowledge (business_id, status, sort_order);

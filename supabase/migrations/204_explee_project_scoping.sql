-- Keep Explee sync state isolated by AutoGTM project. Existing rows are left
-- unscoped until a project-specific sync claims them; they are not refreshed.
ALTER TABLE explee_leads
  ADD COLUMN IF NOT EXISTS project_id BIGINT;

CREATE INDEX IF NOT EXISTS explee_leads_project_hot_idx
  ON explee_leads (project_id, became_hot_at DESC);

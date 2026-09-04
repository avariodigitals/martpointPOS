-- Sprint 5 Final Completion Pass
-- Additive fixes: admin task persistence, partner complaint identity,
-- support attachment metadata, incident audit columns.

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADMIN TASKS PERSISTENCE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE admin_tasks
ADD COLUMN IF NOT EXISTS source_type TEXT,
ADD COLUMN IF NOT EXISTS source_id TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill from entity_type / entity_id where present
UPDATE admin_tasks
SET source_type = entity_type, source_id = entity_id
WHERE source_type IS NULL AND entity_type IS NOT NULL;

ALTER TABLE admin_tasks
DROP CONSTRAINT IF EXISTS admin_tasks_source_unique;

CREATE UNIQUE INDEX IF NOT EXISTS admin_tasks_source_unique
ON admin_tasks (source_type, source_id, task_type)
WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTNER COMPLAINT SEPARATE IDENTITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS complained_about_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_tickets_complained_about_idx ON support_tickets (complained_about_partner_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUPPORT ATTACHMENTS METADATA
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  message_id UUID REFERENCES support_ticket_messages(id) ON DELETE SET NULL,

  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT,
  mime_type TEXT,
  file_size INTEGER,

  uploaded_by_type TEXT NOT NULL CHECK (uploaded_by_type IN ('ADMIN','PARTNER','CUSTOMER','SYSTEM')),
  uploaded_by_id UUID,

  is_internal BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_attachments_ticket_id_idx ON support_attachments (ticket_id);

ALTER TABLE support_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_support_attachments_all" ON support_attachments;
CREATE POLICY "sr_support_attachments_all" ON support_attachments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Ensure bucket exists and is private
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

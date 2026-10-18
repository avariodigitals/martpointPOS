-- Azera chat media and support requests. Additive and safe to rerun.
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS attachment_path TEXT;
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS attachment_size INTEGER;
ALTER TABLE azera_messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS azera_messages_type_idx ON azera_messages (message_type);

INSERT INTO storage.buckets (id, name, public)
VALUES ('azera-chat-attachments', 'azera-chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

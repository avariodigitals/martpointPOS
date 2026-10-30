-- Configurable shared inboxes for admin staff, independent of lead/partner email pipes.
CREATE TABLE IF NOT EXISTS admin_mailboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  imap_host TEXT NOT NULL,
  imap_port INTEGER NOT NULL DEFAULT 993,
  imap_secure BOOLEAN NOT NULL DEFAULT TRUE,
  imap_user TEXT NOT NULL,
  imap_password TEXT NOT NULL,
  imap_folder TEXT NOT NULL DEFAULT 'INBOX',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_uid BIGINT NOT NULL DEFAULT 0,
  last_synced_uid_validity TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_mailbox_members (
  mailbox_id UUID NOT NULL REFERENCES admin_mailboxes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  can_manage BOOLEAN NOT NULL DEFAULT FALSE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (mailbox_id, user_id)
);

CREATE TABLE IF NOT EXISTS admin_mailbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES admin_mailboxes(id) ON DELETE CASCADE,
  thread_key TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '(no subject)',
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','deleted')),
  is_starred BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_message_preview TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mailbox_id, thread_key)
);
CREATE INDEX IF NOT EXISTS admin_mailbox_threads_list_idx
  ON admin_mailbox_threads(mailbox_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS admin_mailbox_threads_assignee_idx
  ON admin_mailbox_threads(mailbox_id, assigned_to, last_message_at DESC);

CREATE TABLE IF NOT EXISTS admin_mailbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mailbox_id UUID NOT NULL REFERENCES admin_mailboxes(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES admin_mailbox_threads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL DEFAULT '',
  to_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  cc_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL DEFAULT '(no subject)',
  body_text TEXT NOT NULL DEFAULT '',
  body_html TEXT NOT NULL DEFAULT '',
  message_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  provider TEXT NOT NULL DEFAULT 'imap',
  send_status TEXT NOT NULL DEFAULT 'received' CHECK (send_status IN ('received','pending','sent','failed')),
  provider_message_id TEXT,
  sent_by UUID REFERENCES users(id) ON DELETE SET NULL,
  sent_by_name TEXT,
  client_request_id UUID,
  attachment_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS admin_mailbox_messages_message_id_idx
  ON admin_mailbox_messages(mailbox_id, message_id) WHERE message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_mailbox_messages_client_request_idx
  ON admin_mailbox_messages(mailbox_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS admin_mailbox_messages_thread_idx
  ON admin_mailbox_messages(thread_id, created_at ASC);

CREATE TABLE IF NOT EXISTS admin_mailbox_thread_state (
  thread_id UUID NOT NULL REFERENCES admin_mailbox_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (thread_id, user_id)
);

ALTER TABLE admin_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mailbox_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mailbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mailbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_mailbox_thread_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_mailboxes, admin_mailbox_members, admin_mailbox_threads, admin_mailbox_messages, admin_mailbox_thread_state FROM PUBLIC, anon, authenticated;
GRANT ALL ON admin_mailboxes, admin_mailbox_members, admin_mailbox_threads, admin_mailbox_messages, admin_mailbox_thread_state TO service_role;
DROP POLICY IF EXISTS sr_admin_mailboxes ON admin_mailboxes;
CREATE POLICY sr_admin_mailboxes ON admin_mailboxes FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_admin_mailbox_members ON admin_mailbox_members;
CREATE POLICY sr_admin_mailbox_members ON admin_mailbox_members FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_admin_mailbox_threads ON admin_mailbox_threads;
CREATE POLICY sr_admin_mailbox_threads ON admin_mailbox_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_admin_mailbox_messages ON admin_mailbox_messages;
CREATE POLICY sr_admin_mailbox_messages ON admin_mailbox_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_admin_mailbox_thread_state ON admin_mailbox_thread_state;
CREATE POLICY sr_admin_mailbox_thread_state ON admin_mailbox_thread_state FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE admin_mailboxes IS 'Configurable shared IMAP inboxes displayed in the MartPoint admin Mailbox reader.';
COMMENT ON COLUMN admin_mailboxes.imap_password IS 'Mailbox app password; only server-side service-role code may read this value.';
NOTIFY pgrst, 'reload schema';

INSERT INTO storage.buckets (id, name, public)
VALUES ('admin-mailbox-attachments', 'admin-mailbox-attachments', FALSE)
ON CONFLICT (id) DO NOTHING;

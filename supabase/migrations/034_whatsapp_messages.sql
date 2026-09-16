-- WhatsApp message store for the custom 360dialog admin inbox
-- Keeps inbound and outbound messages grouped by customer phone number.

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id TEXT,
  wa_id TEXT NOT NULL,
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_messages_wa_id_idx ON whatsapp_messages (wa_id);
CREATE INDEX IF NOT EXISTS whatsapp_messages_direction_idx ON whatsapp_messages (direction);
CREATE INDEX IF NOT EXISTS whatsapp_messages_created_at_idx ON whatsapp_messages (created_at DESC);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_whatsapp_messages_all" ON whatsapp_messages;
CREATE POLICY "sr_whatsapp_messages_all" ON whatsapp_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

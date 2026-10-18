-- Azera Omnichannel + Google Reviews
-- Additive only. CREATE TABLE IF NOT EXISTS.

-- ════════════════════════════════════════════════════════════════════════════════
-- EXTEND AZERA CONVERSATIONS CHANNELS
-- Add messenger, instagram, sms, email as valid channels.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('azera_conversations') IS NOT NULL THEN
    ALTER TABLE azera_conversations DROP CONSTRAINT IF EXISTS azera_conversations_channel_check;
    ALTER TABLE azera_conversations
      ADD CONSTRAINT azera_conversations_channel_check
      CHECK (channel IN ('website', 'whatsapp', 'messenger', 'instagram', 'sms', 'email'));
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- EXTEND AZERA SETTINGS
-- Add omnichannel + Google Review config columns.
-- ════════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF to_regclass('azera_settings') IS NOT NULL THEN
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS messenger_page_id TEXT;
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS instagram_account_id TEXT;
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS google_place_id TEXT;
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS google_review_link TEXT;
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS google_review_enabled BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE azera_settings ADD COLUMN IF NOT EXISTS google_review_message TEXT;
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA GOOGLE REVIEW REQUESTS
-- Track review requests sent to customers (WhatsApp, SMS, Email).
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_google_review_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  conversation_id UUID REFERENCES azera_conversations(id) ON DELETE SET NULL,

  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,

  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'sms', 'email')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'delivered', 'reviewed', 'failed')),

  review_rating INTEGER, -- 1-5 stars when customer leaves review
  review_text TEXT,

  google_place_id TEXT, -- your Google Business Place ID
  review_link TEXT, -- generated short link

  sent_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_google_review_requests_business_idx ON azera_google_review_requests (business_id);
CREATE INDEX IF NOT EXISTS azera_google_review_requests_status_idx ON azera_google_review_requests (status);
CREATE INDEX IF NOT EXISTS azera_google_review_requests_channel_idx ON azera_google_review_requests (channel);
CREATE INDEX IF NOT EXISTS azera_google_review_requests_created_idx ON azera_google_review_requests (created_at DESC);

ALTER TABLE azera_google_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_google_review_requests_all" ON azera_google_review_requests;
CREATE POLICY "sr_azera_google_review_requests_all" ON azera_google_review_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════════
-- AZERA OUTBOUND MESSAGES
-- Log all outbound messages sent via any channel (for history/reporting).
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS azera_outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  conversation_id UUID REFERENCES azera_conversations(id) ON DELETE SET NULL,

  channel TEXT NOT NULL
    CHECK (channel IN ('whatsapp', 'messenger', 'instagram', 'sms', 'email')),

  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_name TEXT,

  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media')),

  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'delivered', 'read', 'failed')),

  provider_message_id TEXT, -- external provider message reference

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS azera_outbound_messages_business_idx ON azera_outbound_messages (business_id);
CREATE INDEX IF NOT EXISTS azera_outbound_messages_channel_idx ON azera_outbound_messages (channel);
CREATE INDEX IF NOT EXISTS azera_outbound_messages_created_idx ON azera_outbound_messages (created_at DESC);

ALTER TABLE azera_outbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_outbound_messages_all" ON azera_outbound_messages;
CREATE POLICY "sr_azera_outbound_messages_all" ON azera_outbound_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Africa's Talking webhook durability and per-business Voice routing.
-- Keep the complete provider request so callbacks can be replayed/debugged.

CREATE TABLE IF NOT EXISTS africastalking_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  product TEXT NOT NULL
    CHECK (product IN ('voice', 'ussd', 'sms', 'airtime')),
  endpoint TEXT NOT NULL,
  event_type TEXT,
  provider_reference TEXT,
  content_type TEXT,
  request_headers JSONB NOT NULL DEFAULT '{}',
  raw_body TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'received'
    CHECK (processing_status IN ('received', 'processed', 'failed')),
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS africastalking_webhook_events_product_idx
  ON africastalking_webhook_events (product, created_at DESC);
CREATE INDEX IF NOT EXISTS africastalking_webhook_events_reference_idx
  ON africastalking_webhook_events (provider_reference, created_at DESC)
  WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS africastalking_webhook_events_business_idx
  ON africastalking_webhook_events (business_id, created_at DESC)
  WHERE business_id IS NOT NULL;

ALTER TABLE africastalking_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_africastalking_webhook_events_all" ON africastalking_webhook_events;
CREATE POLICY "sr_africastalking_webhook_events_all"
  ON africastalking_webhook_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE azera_settings
  ADD COLUMN IF NOT EXISTS africas_talking_phone_number TEXT,
  ADD COLUMN IF NOT EXISTS africas_talking_forward_numbers TEXT[] NOT NULL DEFAULT '{}';


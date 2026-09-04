-- Sprint 6 Final Closure Pass
-- Schema additions for notifications, printable receipts, commission attribution, audit metadata.

-- Admin notification centre
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  deep_link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  source_type TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_notifications_user_read_idx ON admin_notifications (admin_user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_notifications_type_idx ON admin_notifications (type, created_at DESC);

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_admin_notifications_all" ON admin_notifications;
CREATE POLICY "sr_admin_notifications_all" ON admin_notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Printable receipt reference on payment
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS receipt_number TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS receipt_issued_at TIMESTAMPTZ;

-- Commission attribution
ALTER TABLE partner_commissions
ADD COLUMN IF NOT EXISTS attribution_type TEXT,
ADD COLUMN IF NOT EXISTS attribution_reason TEXT,
ADD COLUMN IF NOT EXISTS originating_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sales_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS implementation_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS partner_commissions_attribution_idx ON partner_commissions (attribution_type);

-- Payment webhook events for idempotency and reconciliation
CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway TEXT NOT NULL,
  reference TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (gateway, reference)
);

CREATE INDEX IF NOT EXISTS payment_webhook_events_reference_idx ON payment_webhook_events (gateway, reference);

ALTER TABLE payment_webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_payment_webhook_events_all" ON payment_webhook_events;
CREATE POLICY "sr_payment_webhook_events_all" ON payment_webhook_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit metadata sanitisation note: application layer must never log secrets.
-- This table already exists; no schema change required.

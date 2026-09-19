-- Public status page (statuspage.io-style): components, incidents,
-- incident updates, and email subscribers. Idempotent and additive.

CREATE TABLE IF NOT EXISTS status_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'operational' CHECK (status IN ('operational','degraded_performance','partial_outage','major_outage','under_maintenance')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  showcase BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE status_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_status_components_all" ON status_components;
CREATE POLICY "sr_status_components_all" ON status_components FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS status_components_sort_idx ON status_components (sort_order);

CREATE TABLE IF NOT EXISTS status_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'incident' CHECK (kind IN ('incident','maintenance')),
  status TEXT NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved','scheduled','in_progress','verifying','completed')),
  impact TEXT NOT NULL DEFAULT 'minor' CHECK (impact IN ('none','minor','major','critical','maintenance')),
  component_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  scheduled_for TIMESTAMPTZ,
  scheduled_until TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE status_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_status_incidents_all" ON status_incidents;
CREATE POLICY "sr_status_incidents_all" ON status_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS status_incidents_created_at_idx ON status_incidents (created_at DESC);
CREATE INDEX IF NOT EXISTS status_incidents_status_idx ON status_incidents (status);

CREATE TABLE IF NOT EXISTS status_incident_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES status_incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'investigating',
  body TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE status_incident_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_status_incident_updates_all" ON status_incident_updates;
CREATE POLICY "sr_status_incident_updates_all" ON status_incident_updates FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS status_incident_updates_incident_idx ON status_incident_updates (incident_id, created_at DESC);

CREATE TABLE IF NOT EXISTS status_subscribers (
  email TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE status_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_status_subscribers_all" ON status_subscribers;
CREATE POLICY "sr_status_subscribers_all" ON status_subscribers FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS status_subscribers_token_idx ON status_subscribers (token);

-- Seed sensible defaults only when the table is empty
INSERT INTO status_components (name, description, group_name, sort_order)
SELECT * FROM (VALUES
  ('MartPoint Retail POS', 'In-store point-of-sale app', 'Applications', 0),
  ('Merchant Dashboard', 'Web dashboard for merchants', 'Applications', 1),
  ('Payments & Checkout', 'Card, transfer and PayPlan payments', 'Payments', 2),
  ('APIs & Webhooks', 'Public API and webhook delivery', 'Platform', 3),
  ('Sync & Offline Mode', 'Offline queue and cloud sync', 'Platform', 4),
  ('Website & Documentation', 'martpoint.com.ng and help centre', 'Platform', 5)
) AS seed(name, description, group_name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM status_components);

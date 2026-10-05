-- City Requests & Adoption
-- Public users pick a city tied to a state. When their city is not listed they
-- can choose "Other", type a free-text city, and submit. That submission is
-- recorded here as a PENDING request and a notification is routed to admins for
-- authorisation. Approving "adopts" the city (makes it available in the public
-- dropdowns, served from /api/locations/cities). Admins can correct the spelling
-- before approving, or reject.

CREATE TABLE IF NOT EXISTS city_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS city_requests_status_idx ON city_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS city_requests_country_state_idx ON city_requests (country, state);

ALTER TABLE city_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_city_requests_all" ON city_requests;
CREATE POLICY "sr_city_requests_all" ON city_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

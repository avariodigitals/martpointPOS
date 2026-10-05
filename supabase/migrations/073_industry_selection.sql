-- Industry selection on leads & quotations
-- Businesses already carry a free-text `industry` column (006_businesses.sql).
-- This migration adds the same canonical industry value to leads and
-- lead_quotations so the admin can:
--   • segment and count leads by industry, and
--   • auto-apply the right public notes / payment-terms template per industry.
--
-- Values are the canonical `name` from lib/industries.ts (e.g. "Supermarkets"),
-- resolved from the business-type form label. There is no `industries` table —
-- the registry lives in code — so this is a plain TEXT column with an index.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS industry TEXT;

ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS industry TEXT;

CREATE INDEX IF NOT EXISTS leads_industry_idx ON leads (industry);
CREATE INDEX IF NOT EXISTS lead_quotations_industry_idx ON lead_quotations (industry);

-- NOTE: existing rows are intentionally left NULL. The canonical industry value
-- is resolved from each lead's business_type by the application (see
-- resolveIndustryName in lib/industries.ts); the dashboard and lead/quotation
-- APIs fall back to that mapping when the column is empty, so no lossy SQL
-- backfill is performed here.

-- Businesses: index the existing industry column for the dashboard footprint card.
CREATE INDEX IF NOT EXISTS businesses_industry_idx ON businesses (industry);

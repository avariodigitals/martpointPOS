-- Dedicated estimate column for leads captured via the website estimate calculator.
-- Previously the recommendation string was stuffed into `challenge`; keep it structured
-- so the sales team can review the retail/ERP recommendation in the lead record.
--
-- Shape:
-- {
--   "retail": { "planName": "...", "range": "...", "tier": "...", "inclusions": [...], "rationale": "..." },
--   "erp":    { "planName": "...", "range": "...", "tier": "...", "inclusions": [...], "rationale": "..." }
-- }

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS estimate JSONB;

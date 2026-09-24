-- Persist the latest installation-handover payload sent by an implementation
-- partner so the email can be re-sent and audited.
ALTER TABLE business_deployments
  ADD COLUMN IF NOT EXISTS handover_details JSONB;

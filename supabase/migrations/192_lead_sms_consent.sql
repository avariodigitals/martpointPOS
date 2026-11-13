-- Explicit SMS opt-in for lead-based communications. Consent is tied to the
-- exact phone number and the evidence source captured by an authorised user.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_consent_phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_source TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_note TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_recorded_by UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE leads
  DROP CONSTRAINT IF EXISTS leads_sms_consent_source_check;
ALTER TABLE leads
  ADD CONSTRAINT leads_sms_consent_source_check
  CHECK (sms_consent_source IS NULL OR sms_consent_source IN ('web_form','verbal','written','inbound_sms','other'));

NOTIFY pgrst,'reload schema';

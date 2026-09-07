-- Partner lead invites: allow admin-added leads to be unattributed prospects
-- and let them be invited to complete the public partner application form.

-- Admin-added leads may not belong to an existing partner / partner user.
ALTER TABLE partner_leads ALTER COLUMN partner_id DROP NOT NULL;
ALTER TABLE partner_leads ALTER COLUMN submitted_by_partner_user_id DROP NOT NULL;

-- Invite tracking
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS invite_token TEXT;
ALTER TABLE partner_leads ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS partner_leads_invite_token_idx
  ON partner_leads (invite_token) WHERE invite_token IS NOT NULL;

-- Link submitted applications back to the originating lead
ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS partner_lead_id UUID
  REFERENCES partner_leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS partner_applications_lead_idx ON partner_applications (partner_lead_id);

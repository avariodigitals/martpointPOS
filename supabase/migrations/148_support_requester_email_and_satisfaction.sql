-- Keep the customer who needs help distinct from the tenant account used to
-- operate the support desk (e.g. internal MartPoint Support business).
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS requester_name TEXT,
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS requester_on_behalf_of TEXT,
  ADD COLUMN IF NOT EXISTS satisfaction_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS satisfaction_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS satisfaction_reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS satisfaction_response TEXT CHECK (satisfaction_response IN ('satisfied','not_satisfied')),
  ADD COLUMN IF NOT EXISTS satisfaction_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS support_tickets_auto_close_idx
  ON support_tickets(status, auto_close_at)
  WHERE status = 'RESOLVED' AND auto_close_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_satisfaction_followup_idx
  ON support_tickets(status, resolved_at, satisfaction_sent_at, satisfaction_reminder_sent_at)
  WHERE status = 'RESOLVED';

COMMENT ON COLUMN support_tickets.requester_email IS
  'Email of the person receiving support updates; may differ from the operational business account.';
COMMENT ON COLUMN support_tickets.requester_on_behalf_of IS
  'Optional person/team the requester is filing this issue on behalf of.';

NOTIFY pgrst, 'reload schema';

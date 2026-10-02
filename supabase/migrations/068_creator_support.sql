-- ============================================================
-- Creator Network: creator support tickets.
-- Creators file tickets into the SAME support_tickets system as
-- businesses — routed to the Creator/Digital team via creator_id
-- and the CREATOR_NETWORK category instead of business_id.
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS throughout.
-- ============================================================

ALTER TABLE support_tickets
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES creators(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS support_tickets_creator_idx ON support_tickets (creator_id);

-- created_by_type: add CREATOR
ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_created_by_type_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_created_by_type_check
  CHECK (created_by_type IN ('ADMIN','PARTNER','CUSTOMER','CREATOR','SYSTEM'));

-- category: add CREATOR_NETWORK
ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_category_check
  CHECK (category IN (
    'SOFTWARE','LOGIN_ACCOUNT','POS','INVENTORY','PRODUCTS','REPORTS','ONLINE_STORE',
    'CONFIGURATION','TRAINING','BILLING','LICENSING','SECURITY','PRIVACY_DATA',
    'HARDWARE_GUIDANCE','FEATURE_REQUEST','PARTNER_COMPLAINT','CREATOR_NETWORK','OTHER'
  ));

-- messages/events: CREATOR can author messages + appear in the audit trail
ALTER TABLE support_ticket_messages
  DROP CONSTRAINT IF EXISTS support_ticket_messages_author_type_check;
ALTER TABLE support_ticket_messages
  ADD CONSTRAINT support_ticket_messages_author_type_check
  CHECK (author_type IN ('ADMIN','PARTNER','CUSTOMER','CREATOR','SYSTEM'));

ALTER TABLE support_ticket_events
  DROP CONSTRAINT IF EXISTS support_ticket_events_actor_type_check;
ALTER TABLE support_ticket_events
  ADD CONSTRAINT support_ticket_events_actor_type_check
  CHECK (actor_type IN ('ADMIN','PARTNER','CUSTOMER','CREATOR','SYSTEM'));

-- audit tables: creator actions + support audit rows for customer/creator
-- tickets were being silently rejected by the original CHECK lists.
ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_actor_type_check;
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_type_check
  CHECK (actor_type IN ('ADMIN','SYSTEM','PARTNER','CUSTOMER','CREATOR'));

ALTER TABLE finance_audit_events
  DROP CONSTRAINT IF EXISTS finance_audit_events_actor_type_check;
ALTER TABLE finance_audit_events
  ADD CONSTRAINT finance_audit_events_actor_type_check
  CHECK (actor_type IN ('ADMIN','SYSTEM','PARTNER','CUSTOMER','CREATOR'));

-- Sprint 5: Support, Customer Success & Compliance Operations
-- Additive only. Does not rebuild existing Sprints 1-4 objects.

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUPPORT TICKETS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,

  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  partner_assignment_id UUID REFERENCES partner_customer_assignments(id) ON DELETE SET NULL,

  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('ADMIN','PARTNER','CUSTOMER','SYSTEM')),
  created_by_id UUID,

  source TEXT NOT NULL DEFAULT 'PORTAL'
    CHECK (source IN ('PORTAL','PARTNER','ADMIN','EMAIL','WHATSAPP','PHONE','SYSTEM','OTHER')),

  category TEXT NOT NULL
    CHECK (category IN (
      'SOFTWARE','LOGIN_ACCOUNT','POS','INVENTORY','PRODUCTS','REPORTS','ONLINE_STORE',
      'CONFIGURATION','TRAINING','BILLING','LICENSING','SECURITY','PRIVACY_DATA',
      'HARDWARE_GUIDANCE','FEATURE_REQUEST','PARTNER_COMPLAINT','OTHER'
    )),

  priority TEXT NOT NULL DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),

  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (status IN (
      'NEW','ASSIGNED','IN_PROGRESS','WAITING_CUSTOMER','WAITING_PARTNER',
      'ESCALATED','RESOLVED','CLOSED','CANCELLED'
    )),

  subject TEXT NOT NULL,
  description TEXT,

  assigned_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  assigned_partner_user_id UUID REFERENCES partner_users(id) ON DELETE SET NULL,

  first_response_due_at TIMESTAMPTZ,
  resolution_due_at TIMESTAMPTZ,
  first_responded_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_number_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_support_ticket_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO support_ticket_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = support_ticket_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPS-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

  author_type TEXT NOT NULL CHECK (author_type IN ('ADMIN','PARTNER','CUSTOMER','SYSTEM')),
  author_id UUID,

  message TEXT NOT NULL,

  visibility TEXT NOT NULL DEFAULT 'PUBLIC'
    CHECK (visibility IN ('PUBLIC','INTERNAL')),

  attachment_path TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,

  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'CREATED','ASSIGNED','REASSIGNED','STATUS_CHANGED','PRIORITY_CHANGED','ESCALATED',
      'RESOLVED','REOPENED','CLOSED','ATTACHMENT_ADDED','PARTNER_ASSIGNED','PARTNER_REMOVED'
    )),

  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMIN','PARTNER','CUSTOMER','SYSTEM')),
  actor_id UUID,

  previous_value TEXT,
  new_value TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUPPORT SLA & BUSINESS HOURS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS support_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  first_response_minutes INTEGER NOT NULL DEFAULT 240,
  resolution_minutes INTEGER NOT NULL DEFAULT 2880,
  business_hours_only BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (priority)
);

CREATE TABLE IF NOT EXISTS support_business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
  working_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  opening_time TIME NOT NULL DEFAULT '09:00:00',
  closing_time TIME NOT NULL DEFAULT '17:00:00',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO support_sla_policies (name, priority, first_response_minutes, resolution_minutes, business_hours_only, active)
VALUES
  ('Urgent SLA', 'URGENT', 60, 240, true, true),
  ('High SLA', 'HIGH', 240, 960, true, true),
  ('Normal SLA', 'NORMAL', 480, 2880, true, true),
  ('Low SLA', 'LOW', 1440, 4320, true, true)
ON CONFLICT (priority) DO NOTHING;

INSERT INTO support_business_hours (timezone, working_days, opening_time, closing_time)
SELECT 'Africa/Lagos', ARRAY[1,2,3,4,5], '09:00:00', '17:00:00'
WHERE NOT EXISTS (SELECT 1 FROM support_business_hours);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER SUCCESS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_success_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  owner_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  stage TEXT NOT NULL DEFAULT 'ONBOARDING'
    CHECK (stage IN ('ONBOARDING','LIVE','ADOPTION','AT_RISK','RENEWAL','CHURNED')),
  health TEXT NOT NULL DEFAULT 'HEALTHY'
    CHECK (health IN ('HEALTHY','WATCH','AT_RISK','CRITICAL')),

  last_contact_at TIMESTAMPTZ,
  next_follow_up_at TIMESTAMPTZ,
  last_training_at TIMESTAMPTZ,
  notes_summary TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_success_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL
    CHECK (activity_type IN (
      'CALL','WHATSAPP','EMAIL','TRAINING','CHECK_IN','ISSUE_REVIEW',
      'RENEWAL_DISCUSSION','ONSITE_VISIT','OTHER'
    )),

  summary TEXT NOT NULL,
  outcome TEXT,
  next_action TEXT,
  next_action_at TIMESTAMPTZ,
  admin_user_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default customer success profiles for existing businesses
INSERT INTO customer_success_profiles (business_id, stage, health)
SELECT id, 'ONBOARDING', 'HEALTHY'
FROM businesses
ON CONFLICT (business_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLIANCE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_type TEXT NOT NULL CHECK (subject_type IN ('BUSINESS','PARTNER')),
  partner_type TEXT,

  requirement_type TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT false,
  expires BOOLEAN NOT NULL DEFAULT false,
  validity_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  subject_type TEXT NOT NULL CHECK (subject_type IN ('BUSINESS','PARTNER')),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,

  requirement_type TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'NOT_REQUIRED'
    CHECK (status IN ('NOT_REQUIRED','REQUESTED','SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED')),

  requested_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  expires_at TIMESTAMPTZ,

  internal_notes TEXT,
  public_note TEXT,
  document_path TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed some common requirements
INSERT INTO compliance_requirements (subject_type, requirement_type, required, expires, validity_days, active)
VALUES
  ('BUSINESS', 'Business Registration', true, true, 365, true),
  ('BUSINESS', 'CAC Certificate', true, true, 365, true),
  ('BUSINESS', 'Government ID', true, false, NULL, true),
  ('BUSINESS', 'Address Verification', false, false, NULL, true),
  ('PARTNER', 'Partner Agreement', true, true, 730, true),
  ('PARTNER', 'Bank Details', false, false, NULL, true)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CUSTOMER INCIDENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customer_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  support_ticket_id UUID REFERENCES support_tickets(id) ON DELETE SET NULL,

  type TEXT NOT NULL
    CHECK (type IN ('SERVICE','SECURITY','DATA','BILLING','PARTNER','OTHER')),
  severity TEXT NOT NULL
    CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),

  summary TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','CLOSED')),

  owner_admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADMIN OPERATIONAL TASKS / ACTION CENTRE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS admin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  task_type TEXT NOT NULL
    CHECK (task_type IN (
      'PARTNER_APPLICATION_REVIEW','PARTNER_COMPLIANCE_REQUIRED','CUSTOMER_ONBOARDING_REVIEW',
      'BUSINESS_DEPLOYMENT_PENDING','PAYMENT_CONFIRMATION_PENDING','RENEWAL_APPROACHING',
      'SUPPORT_UNASSIGNED','SLA_BREACH','CUSTOMER_FOLLOW_UP_DUE','COMPLIANCE_EXPIRING','OTHER'
    )),

  title TEXT NOT NULL,
  description TEXT,

  entity_type TEXT,
  entity_id UUID,

  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','DONE','DISMISSED')),

  assigned_to UUID,
  due_at TIMESTAMPTZ,

  deep_link TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- STORAGE BUCKET FOR SUPPORT ATTACHMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS support_tickets_business_id_idx ON support_tickets (business_id);
CREATE INDEX IF NOT EXISTS support_tickets_partner_id_idx ON support_tickets (partner_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets (status);
CREATE INDEX IF NOT EXISTS support_tickets_priority_idx ON support_tickets (priority);
CREATE INDEX IF NOT EXISTS support_tickets_category_idx ON support_tickets (category);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON support_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_admin_idx ON support_tickets (assigned_admin_user_id);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_partner_idx ON support_tickets (assigned_partner_id);

CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx ON support_ticket_messages (ticket_id);
CREATE INDEX IF NOT EXISTS support_ticket_messages_visibility_idx ON support_ticket_messages (ticket_id, visibility);
CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_id_idx ON support_ticket_events (ticket_id);

CREATE INDEX IF NOT EXISTS csp_business_id_idx ON customer_success_profiles (business_id);
CREATE INDEX IF NOT EXISTS csa_business_id_idx ON customer_success_activities (business_id);

CREATE INDEX IF NOT EXISTS compliance_records_business_id_idx ON compliance_records (business_id);
CREATE INDEX IF NOT EXISTS compliance_records_partner_id_idx ON compliance_records (partner_id);
CREATE INDEX IF NOT EXISTS compliance_records_status_idx ON compliance_records (status);
CREATE INDEX IF NOT EXISTS compliance_requirements_subject_idx ON compliance_requirements (subject_type, active);

CREATE INDEX IF NOT EXISTS customer_incidents_business_id_idx ON customer_incidents (business_id);
CREATE INDEX IF NOT EXISTS customer_incidents_status_idx ON customer_incidents (status);

CREATE INDEX IF NOT EXISTS admin_tasks_status_idx ON admin_tasks (status);
CREATE INDEX IF NOT EXISTS admin_tasks_assigned_to_idx ON admin_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS admin_tasks_due_at_idx ON admin_tasks (due_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_sla_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_success_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_success_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_support_tickets_all" ON support_tickets;
CREATE POLICY "sr_support_tickets_all" ON support_tickets FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_support_ticket_messages_all" ON support_ticket_messages;
CREATE POLICY "sr_support_ticket_messages_all" ON support_ticket_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_support_ticket_events_all" ON support_ticket_events;
CREATE POLICY "sr_support_ticket_events_all" ON support_ticket_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_support_sla_policies_all" ON support_sla_policies;
CREATE POLICY "sr_support_sla_policies_all" ON support_sla_policies FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_support_business_hours_all" ON support_business_hours;
CREATE POLICY "sr_support_business_hours_all" ON support_business_hours FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_customer_success_profiles_all" ON customer_success_profiles;
CREATE POLICY "sr_customer_success_profiles_all" ON customer_success_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_customer_success_activities_all" ON customer_success_activities;
CREATE POLICY "sr_customer_success_activities_all" ON customer_success_activities FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_compliance_records_all" ON compliance_records;
CREATE POLICY "sr_compliance_records_all" ON compliance_records FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_compliance_requirements_all" ON compliance_requirements;
CREATE POLICY "sr_compliance_requirements_all" ON compliance_requirements FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_customer_incidents_all" ON customer_incidents;
CREATE POLICY "sr_customer_incidents_all" ON customer_incidents FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_admin_tasks_all" ON admin_tasks;
CREATE POLICY "sr_admin_tasks_all" ON admin_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

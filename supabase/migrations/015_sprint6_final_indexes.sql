-- Sprint 6 — final index/performance review
-- Additive: recommended indexes for common Control Centre query patterns.

-- Leads / partners
CREATE INDEX IF NOT EXISTS leads_status_submitted_at_idx ON leads (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS partner_applications_status_submitted_at_idx ON partner_applications (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status);
CREATE INDEX IF NOT EXISTS partners_country_state_idx ON partners (country, state) WHERE country IS NOT NULL;

-- Businesses / customers
CREATE INDEX IF NOT EXISTS businesses_status_idx ON businesses (status);
CREATE INDEX IF NOT EXISTS businesses_status_created_at_idx ON businesses (status, created_at DESC);

-- Finance
CREATE INDEX IF NOT EXISTS invoices_business_id_status_idx ON invoices (business_id, status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices (due_date) WHERE status NOT IN ('PAID','CANCELLED');
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_business_id_idx ON payments (business_id);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_due_date_idx ON subscriptions (renewal_date) WHERE status IN ('ACTIVE','SUSPENDED');
CREATE INDEX IF NOT EXISTS partner_commissions_status_idx ON partner_commissions (status);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_id_idx ON partner_commissions (partner_id);

-- Support
CREATE INDEX IF NOT EXISTS support_tickets_business_id_idx ON support_tickets (business_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_priority_idx ON support_tickets (status, priority);
CREATE INDEX IF NOT EXISTS support_tickets_assigned_admin_idx ON support_tickets (assigned_admin_user_id) WHERE assigned_admin_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_assigned_partner_idx ON support_tickets (assigned_partner_id) WHERE assigned_partner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_first_responded_at_idx ON support_tickets (first_responded_at) WHERE first_responded_at IS NULL;
CREATE INDEX IF NOT EXISTS support_ticket_messages_ticket_id_idx ON support_ticket_messages (ticket_id, created_at DESC);

-- Customer success
CREATE INDEX IF NOT EXISTS customer_success_profiles_health_idx ON customer_success_profiles (health);
CREATE INDEX IF NOT EXISTS customer_success_profiles_stage_idx ON customer_success_profiles (stage);

-- Compliance
CREATE INDEX IF NOT EXISTS compliance_records_status_expires_idx ON compliance_records (status, expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS compliance_records_partner_id_idx ON compliance_records (partner_id) WHERE partner_id IS NOT NULL;

-- Customer incidents
CREATE INDEX IF NOT EXISTS customer_incidents_status_idx ON customer_incidents (status);
CREATE INDEX IF NOT EXISTS customer_incidents_type_idx ON customer_incidents (type);
CREATE INDEX IF NOT EXISTS customer_incidents_business_id_idx ON customer_incidents (business_id);

-- Action centre
CREATE INDEX IF NOT EXISTS admin_tasks_status_due_at_idx ON admin_tasks (status, due_at) WHERE status IN ('OPEN','IN_PROGRESS');
CREATE INDEX IF NOT EXISTS admin_tasks_assigned_to_idx ON admin_tasks (assigned_to) WHERE status IN ('OPEN','IN_PROGRESS');

-- Audit
CREATE INDEX IF NOT EXISTS finance_audit_events_action_idx ON finance_audit_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_audit_events_entity_idx ON finance_audit_events (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS finance_audit_events_actor_idx ON finance_audit_events (actor_type, actor_id, created_at DESC);

-- Storage bucket must remain private
UPDATE storage.buckets SET public = false WHERE id = 'support-attachments';
UPDATE storage.buckets SET public = false WHERE id = 'partner-documents';

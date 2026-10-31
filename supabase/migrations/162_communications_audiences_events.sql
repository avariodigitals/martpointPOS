-- Channel consent, broader communication actions and event sources.
ALTER TABLE status_subscribers
  ADD COLUMN IF NOT EXISTS newsletter_opt_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS newsletter_unsubscribed_at TIMESTAMPTZ;

ALTER TABLE marketing_contacts
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_consent_at TIMESTAMPTZ;
ALTER TABLE marketing_contacts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE marketing_contacts DROP CONSTRAINT IF EXISTS marketing_contacts_email_or_phone_check;
ALTER TABLE marketing_contacts ADD CONSTRAINT marketing_contacts_email_or_phone_check CHECK(email IS NOT NULL OR phone IS NOT NULL);
CREATE INDEX IF NOT EXISTS marketing_contacts_phone_idx ON marketing_contacts(phone) WHERE phone IS NOT NULL;

ALTER TABLE communication_templates DROP CONSTRAINT IF EXISTS communication_templates_channel_check;
ALTER TABLE communication_templates ADD CONSTRAINT communication_templates_channel_check CHECK(channel IN ('email','sms','whatsapp','call'));
ALTER TABLE communication_workflows DROP CONSTRAINT IF EXISTS communication_workflows_channel_check;
ALTER TABLE communication_workflows ADD CONSTRAINT communication_workflows_channel_check CHECK(channel IN ('email','sms','whatsapp','call'));
ALTER TABLE communication_workflows DROP CONSTRAINT IF EXISTS communication_workflows_trigger_check;
ALTER TABLE communication_workflows ADD CONSTRAINT communication_workflows_trigger_check CHECK(trigger IN (
  'new_lead','no_reply','manual','lead_replied','invoice_unpaid','meeting_booked','meeting_booked_from_email',
  'questionnaire_sent','quote_sent','estimate_requested',
  'status_incident_created','status_incident_updated','status_incident_resolved'
));
ALTER TABLE communication_messages ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS contact_name TEXT NOT NULL DEFAULT '';
ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES marketing_contacts(id) ON DELETE SET NULL;
ALTER TABLE communication_messages ADD COLUMN IF NOT EXISTS contact_source TEXT NOT NULL DEFAULT 'lead'
  CHECK(contact_source IN ('lead','saved_audience','newsletter','status_subscriber'));
ALTER TABLE communication_messages DROP CONSTRAINT IF EXISTS communication_messages_channel_check;
ALTER TABLE communication_messages ADD CONSTRAINT communication_messages_channel_check CHECK(channel IN ('email','sms','whatsapp','call'));
ALTER TABLE communication_suppressions DROP CONSTRAINT IF EXISTS communication_suppressions_channel_check;
ALTER TABLE communication_suppressions ADD CONSTRAINT communication_suppressions_channel_check CHECK(channel IN ('email','sms','whatsapp','call'));

CREATE TABLE IF NOT EXISTS communication_call_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL UNIQUE REFERENCES communication_messages(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL,
  call_brief TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL
);
ALTER TABLE communication_call_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON communication_call_tasks FROM PUBLIC,anon,authenticated;
GRANT ALL ON communication_call_tasks TO service_role;
DROP POLICY IF EXISTS sr_communications ON communication_call_tasks;
CREATE POLICY sr_communications ON communication_call_tasks FOR ALL TO service_role USING(true) WITH CHECK(true);

-- Event based system-status rules target a reviewed list of active status
-- subscribers. A generic newsletter opt-in is never treated as status consent.
CREATE TABLE IF NOT EXISTS communication_status_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL UNIQUE REFERENCES communication_workflows(id) ON DELETE CASCADE,
  incident_event TEXT NOT NULL CHECK(incident_event IN ('status_incident_created','status_incident_updated','status_incident_resolved')),
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE communication_status_rules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON communication_status_rules FROM PUBLIC,anon,authenticated;
GRANT ALL ON communication_status_rules TO service_role;
DROP POLICY IF EXISTS sr_communications ON communication_status_rules;
CREATE POLICY sr_communications ON communication_status_rules FOR ALL TO service_role USING(true) WITH CHECK(true);

INSERT INTO communication_templates(name,channel,subject,body)
SELECT seed.name,'email',seed.subject,seed.body FROM (VALUES
 ('System status: incident created','MartPoint service update: {{incidentTitle}}','An incident has been posted: {{incidentTitle}} ({{incidentStatus}}). {{incidentUpdate}}'||chr(10)||chr(10)||'View the current status at https://martpoint.com.ng/status.'),
 ('System status: incident updated','MartPoint incident update: {{incidentTitle}}','There is an update to {{incidentTitle}} ({{incidentStatus}}). {{incidentUpdate}}'||chr(10)||chr(10)||'View the current status at https://martpoint.com.ng/status.'),
 ('System status: incident resolved','Resolved: {{incidentTitle}}','{{incidentTitle}} is now {{incidentStatus}}. {{incidentUpdate}}'||chr(10)||chr(10)||'View the current status at https://martpoint.com.ng/status.')
) AS seed(name,subject,body)
WHERE NOT EXISTS(SELECT 1 FROM communication_templates t WHERE t.name=seed.name AND t.channel='email');

-- Recheck current workflow state and permissions at the dispatch boundary.
CREATE OR REPLACE FUNCTION communication_claim(p_claim UUID,p_limit INT DEFAULT 3) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages SET status='preparing',claim_token=p_claim,claim_expires_at=now()+interval '5 minutes'
  WHERE id IN (SELECT m.id FROM communication_messages m WHERE m.status='queued' AND m.scheduled_for<=now()
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w
      WHERE w.id=m.workflow_id AND w.enabled AND (
        (m.run_id IS NULL AND w.trigger IN ('status_incident_created','status_incident_updated','status_incident_resolved')) OR
        (m.run_id IS NOT NULL AND EXISTS(SELECT 1 FROM communication_runs r WHERE r.id=m.run_id AND r.workflow_id=w.id AND r.status='active' AND r.step=m.step))
      )))
    ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),10)) RETURNING *;
$$;
CREATE OR REPLACE FUNCTION communication_begin_dispatch(p_id UUID,p_claim UUID) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages m SET status='dispatching',claim_expires_at=now()+interval '5 minutes'
  WHERE m.id=p_id AND m.claim_token=p_claim AND m.status='preparing'
    AND EXISTS(SELECT 1 FROM users u WHERE u.id=m.created_by AND u.status='ACTIVE' AND u.role IN ('Admin','Digital Marketer','Sales'))
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w WHERE w.id=m.workflow_id AND w.enabled AND (
      (m.run_id IS NULL AND w.trigger IN ('status_incident_created','status_incident_updated','status_incident_resolved')) OR
      (m.run_id IS NOT NULL AND EXISTS(SELECT 1 FROM communication_runs r WHERE r.id=m.run_id AND r.workflow_id=w.id AND r.status='active' AND r.step=m.step))
    )))
  RETURNING m.*;
$$;
REVOKE ALL ON FUNCTION communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) TO service_role;

NOTIFY pgrst,'reload schema';

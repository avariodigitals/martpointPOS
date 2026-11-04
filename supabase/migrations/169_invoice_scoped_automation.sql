-- Link invoice reminder workflow runs to the invoice/customer instead of the
-- original sales lead. This prevents reminders going to stale lead contacts.
ALTER TABLE communication_runs ALTER COLUMN lead_id DROP NOT NULL;
ALTER TABLE communication_runs
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE communication_runs DROP CONSTRAINT IF EXISTS communication_runs_contact_check;
ALTER TABLE communication_runs ADD CONSTRAINT communication_runs_contact_check
  CHECK ((lead_id IS NOT NULL)::INT + (invoice_id IS NOT NULL)::INT = 1);
CREATE UNIQUE INDEX IF NOT EXISTS communication_runs_workflow_invoice_uq
  ON communication_runs(workflow_id, invoice_id);
CREATE INDEX IF NOT EXISTS communication_runs_invoice_idx
  ON communication_runs(invoice_id) WHERE invoice_id IS NOT NULL;

ALTER TABLE communication_messages
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE;
ALTER TABLE communication_messages DROP CONSTRAINT IF EXISTS communication_messages_contact_source_check;
ALTER TABLE communication_messages ADD CONSTRAINT communication_messages_contact_source_check
  CHECK(contact_source IN ('lead','invoice','saved_audience','newsletter','status_subscriber'));
CREATE INDEX IF NOT EXISTS communication_messages_invoice_idx
  ON communication_messages(invoice_id,created_at) WHERE invoice_id IS NOT NULL;

CREATE OR REPLACE FUNCTION communication_schedule_due() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO communication_messages(lead_id,invoice_id,run_id,workflow_id,step,channel,mode,created_by,contact_source)
  SELECT r.lead_id,r.invoice_id,r.id,w.id,r.step,w.channel,w.mode,w.created_by,
    CASE WHEN r.invoice_id IS NOT NULL THEN 'invoice' ELSE 'lead' END
  FROM communication_runs r JOIN communication_workflows w ON w.id=r.workflow_id
  WHERE r.status='active' AND w.enabled AND r.next_run_at<=now() AND r.step<=w.max_steps
  ORDER BY r.next_run_at LIMIT 100 ON CONFLICT(run_id,step) DO NOTHING;
  UPDATE communication_messages SET status=CASE WHEN status='dispatching' THEN 'unknown' ELSE 'failed' END,
    error='Worker interrupted. Review provider history before sending again.',claim_token=NULL,claim_expires_at=NULL
  WHERE status IN ('preparing','dispatching') AND claim_expires_at<now();
  UPDATE communication_runs r SET status='paused',reason='Message outcome needs staff review'
    WHERE r.status='active' AND EXISTS(SELECT 1 FROM communication_messages m
      WHERE m.run_id=r.id AND m.step=r.step AND m.status IN ('failed','unknown','skipped','cancelled'));
END $$;

CREATE OR REPLACE FUNCTION communication_claim(p_claim UUID,p_limit INT DEFAULT 3) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages SET status='preparing',claim_token=p_claim,claim_expires_at=now()+interval '5 minutes'
  WHERE id IN (SELECT m.id FROM communication_messages m WHERE m.status='queued' AND m.scheduled_for<=now()
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w WHERE w.id=m.workflow_id AND w.enabled AND (
      (m.run_id IS NULL AND w.trigger IN ('status_incident_created','status_incident_updated','status_incident_resolved')) OR
      (m.run_id IS NOT NULL AND EXISTS(SELECT 1 FROM communication_runs r WHERE r.id=m.run_id AND r.workflow_id=w.id AND r.status='active' AND r.step=m.step
        AND r.invoice_id IS NOT DISTINCT FROM m.invoice_id AND r.lead_id IS NOT DISTINCT FROM m.lead_id))
    ))) ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),10)) RETURNING *;
$$;

CREATE OR REPLACE FUNCTION communication_begin_dispatch(p_id UUID,p_claim UUID) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages m SET status='dispatching',claim_expires_at=now()+interval '5 minutes'
  WHERE m.id=p_id AND m.claim_token=p_claim AND m.status='preparing'
    AND EXISTS(SELECT 1 FROM users u WHERE u.id=m.created_by AND u.status='ACTIVE' AND u.role IN ('Admin','Digital Marketer','Sales'))
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w WHERE w.id=m.workflow_id AND w.enabled AND (
      (m.run_id IS NULL AND w.trigger IN ('status_incident_created','status_incident_updated','status_incident_resolved')) OR
      (m.run_id IS NOT NULL AND EXISTS(SELECT 1 FROM communication_runs r WHERE r.id=m.run_id AND r.workflow_id=w.id AND r.status='active' AND r.step=m.step
        AND r.invoice_id IS NOT DISTINCT FROM m.invoice_id AND r.lead_id IS NOT DISTINCT FROM m.lead_id))
    ))) RETURNING m.*;
$$;
REVOKE ALL ON FUNCTION communication_schedule_due(),communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION communication_schedule_due(),communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) TO service_role;
NOTIFY pgrst,'reload schema';

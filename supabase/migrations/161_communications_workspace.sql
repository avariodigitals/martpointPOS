-- Direct provider communications. No application wallet, credits or subscription.
CREATE TABLE IF NOT EXISTS communication_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS communication_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), mode TEXT NOT NULL CHECK(mode IN ('template','ai')),
  template_id UUID REFERENCES communication_templates(id) ON DELETE RESTRICT, instructions TEXT NOT NULL DEFAULT '',
  trigger TEXT NOT NULL CHECK(trigger IN ('new_lead','no_reply','manual')),
  delay_minutes INT NOT NULL DEFAULT 1440 CHECK(delay_minutes BETWEEN 1 AND 525600),
  interval_minutes INT NOT NULL DEFAULT 2880 CHECK(interval_minutes BETWEEN 60 AND 525600),
  max_steps INT NOT NULL DEFAULT 3 CHECK(max_steps BETWEEN 1 AND 10),
  stop_on_reply BOOLEAN NOT NULL DEFAULT true, require_approval BOOLEAN NOT NULL DEFAULT false, enabled BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK(mode <> 'template' OR template_id IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS communication_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), workflow_id UUID NOT NULL REFERENCES communication_workflows(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled','paused')),
  step INT NOT NULL DEFAULT 1, next_run_at TIMESTAMPTZ NOT NULL, reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(workflow_id,lead_id)
);
CREATE TABLE IF NOT EXISTS communication_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  run_id UUID REFERENCES communication_runs(id) ON DELETE SET NULL,
  workflow_id UUID REFERENCES communication_workflows(id) ON DELETE SET NULL, step INT,
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), recipient TEXT,
  subject TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'manual' CHECK(mode IN ('manual','template','ai')),
  template_id UUID REFERENCES communication_templates(id) ON DELETE RESTRICT, instructions TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','awaiting_approval','dispatching','accepted','delivered','failed','unknown','skipped','cancelled')),
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider TEXT, provider_message_id TEXT, ai_provider TEXT, ai_model TEXT, error TEXT,
  prepared_at TIMESTAMPTZ, context_last_inbound TIMESTAMPTZ, approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  claim_token UUID, claim_expires_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(), sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id,step)
);
CREATE INDEX IF NOT EXISTS communication_messages_lead_idx ON communication_messages(lead_id,created_at);
CREATE INDEX IF NOT EXISTS communication_messages_due_idx ON communication_messages(scheduled_for) WHERE status='queued';
CREATE INDEX IF NOT EXISTS communication_runs_due_idx ON communication_runs(next_run_at) WHERE status='active';
CREATE TABLE IF NOT EXISTS communication_suppressions (
  channel TEXT NOT NULL CHECK(channel IN ('email','sms')), address TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT 'Opted out', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(channel,address)
);
ALTER TABLE azera_conversations ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS azera_conversations_lead_idx ON azera_conversations(lead_id);

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['communication_templates','communication_workflows','communication_runs','communication_messages','communication_suppressions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT ALL ON %I TO service_role',t);
    EXECUTE format('DROP POLICY IF EXISTS sr_communications ON %I',t);
    EXECUTE format('CREATE POLICY sr_communications ON %I FOR ALL TO service_role USING(true) WITH CHECK(true)',t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION communication_enroll_new_lead() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO communication_runs(workflow_id,lead_id,next_run_at)
  SELECT id,NEW.id,now()+make_interval(mins=>delay_minutes) FROM communication_workflows
  WHERE enabled AND trigger IN ('new_lead','no_reply') AND NEW.status NOT IN ('Won','Lost')
  ON CONFLICT(workflow_id,lead_id) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS communication_new_lead ON leads;
CREATE TRIGGER communication_new_lead AFTER INSERT ON leads FOR EACH ROW EXECUTE FUNCTION communication_enroll_new_lead();

CREATE OR REPLACE FUNCTION communication_schedule_due() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO communication_messages(lead_id,run_id,workflow_id,step,channel,mode,created_by)
  SELECT r.lead_id,r.id,w.id,r.step,w.channel,w.mode,w.created_by FROM communication_runs r
  JOIN communication_workflows w ON w.id=r.workflow_id
  WHERE r.status='active' AND w.enabled AND r.next_run_at<=now() AND r.step<=w.max_steps
  ORDER BY r.next_run_at LIMIT 100 ON CONFLICT(run_id,step) DO NOTHING;
  -- Interrupted dispatches are uncertain: never resend them automatically.
  UPDATE communication_messages SET status=CASE WHEN status='dispatching' THEN 'unknown' ELSE 'failed' END,
    error='Worker interrupted. Review provider history before sending again.',claim_token=NULL
    WHERE status IN ('preparing','dispatching') AND claim_expires_at<now();
  UPDATE communication_runs r SET status='paused',reason='Message outcome needs staff review'
    WHERE r.status='active' AND EXISTS(SELECT 1 FROM communication_messages m
      WHERE m.run_id=r.id AND m.step=r.step AND m.status IN ('failed','unknown','skipped','cancelled'));
END $$;
CREATE OR REPLACE FUNCTION communication_claim(p_claim UUID,p_limit INT DEFAULT 3) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages SET status='preparing',claim_token=p_claim,claim_expires_at=now()+interval '5 minutes'
  WHERE id IN (SELECT m.id FROM communication_messages m WHERE m.status='queued' AND m.scheduled_for<=now()
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w JOIN communication_runs r ON r.workflow_id=w.id
      WHERE w.id=m.workflow_id AND w.enabled AND r.id=m.run_id AND r.status='active' AND r.step=m.step))
    ORDER BY scheduled_for FOR UPDATE SKIP LOCKED LIMIT LEAST(GREATEST(p_limit,1),3)) RETURNING *;
$$;
CREATE OR REPLACE FUNCTION communication_begin_dispatch(p_id UUID,p_claim UUID) RETURNS SETOF communication_messages
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  UPDATE communication_messages m SET status='dispatching',claim_expires_at=now()+interval '5 minutes'
  WHERE m.id=p_id AND m.claim_token=p_claim AND m.status='preparing'
    AND EXISTS(SELECT 1 FROM users u WHERE u.id=m.created_by AND u.status='ACTIVE' AND u.role IN ('Admin','Digital Marketer','Sales'))
    AND (m.workflow_id IS NULL OR EXISTS(SELECT 1 FROM communication_workflows w JOIN communication_runs r ON r.workflow_id=w.id
      WHERE w.id=m.workflow_id AND w.enabled AND r.id=m.run_id AND r.status='active' AND r.step=m.step))
  RETURNING m.*;
$$;
REVOKE ALL ON FUNCTION communication_enroll_new_lead(),communication_schedule_due(),communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION communication_schedule_due(),communication_claim(UUID,INT),communication_begin_dispatch(UUID,UUID) TO service_role;

INSERT INTO communication_templates(name,channel,subject,body)
SELECT x.name,x.channel,x.subject,x.body FROM (VALUES
 ('Lead introduction','email','MartPoint for {{business}}','Hi {{name}}, thanks for your interest in MartPoint. What would you most like to improve at {{business}}? We can arrange a demo that covers your needs.'),
 ('Lead follow-up','email','Following up with {{business}}','Hi {{name}}, I am following up on our conversation about MartPoint for {{business}}. Is there anything you would like us to clarify before the next step?'),
 ('SMS introduction','sms','','Hi {{name}}, thanks for your interest in MartPoint. When is a good time to discuss what {{business}} needs? Reply STOP to opt out.'),
 ('SMS follow-up','sms','','Hi {{name}}, following up on MartPoint for {{business}}. Would you like help with the next step? Reply STOP to opt out.')
) AS x(name,channel,subject,body) WHERE NOT EXISTS(SELECT 1 FROM communication_templates t WHERE t.name=x.name AND t.channel=x.channel);
NOTIFY pgrst,'reload schema';

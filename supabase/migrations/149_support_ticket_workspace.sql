-- Apply after 148. A ticket belongs to a real profile and retains the exact
-- formatted reply, sender signature and email outcome in its conversation.
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resolution_actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_closure_notice_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS followup_claim UUID,
  ADD COLUMN IF NOT EXISTS followup_claim_expires_at TIMESTAMPTZ;

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_owner_check;
ALTER TABLE support_tickets ADD CONSTRAINT support_tickets_owner_check
  CHECK (num_nonnulls(business_id,creator_id,requester_partner_id,lead_id) = 1);
-- Ownership and issue category are independent: a creator can have a billing
-- problem, for example, without losing their profile association.
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_creator_category_check;
ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_partner_category_check;
CREATE INDEX IF NOT EXISTS support_tickets_lead_idx ON support_tickets(lead_id,created_at DESC);

ALTER TABLE support_ticket_messages
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS attachment_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS message_html TEXT,
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_html TEXT,
  ADD COLUMN IF NOT EXISTS email_kind TEXT NOT NULL DEFAULT 'reply'
    CHECK (email_kind IN ('reply','update','resolution','reminder','closure')),
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (email_status IN ('not_required','pending','accepted','failed','no_recipient')),
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS email_recipient TEXT,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS support_ticket_inbound_dedupe ON support_ticket_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE support_ticket_events DROP CONSTRAINT IF EXISTS support_ticket_events_event_type_check;
ALTER TABLE support_ticket_events ADD CONSTRAINT support_ticket_events_event_type_check CHECK(event_type IN (
  'CREATED','ASSIGNED','REASSIGNED','STATUS_CHANGED','PRIORITY_CHANGED','ESCALATED','RESOLVED',
  'REOPENED','CLOSED','ATTACHMENT_ADDED','PARTNER_ASSIGNED','PARTNER_REMOVED','DETAILS_UPDATED','REQUESTER_CHANGED','EMAIL_RETRIED'
));

CREATE TABLE IF NOT EXISTS support_ticket_feedback_tokens (
  token_hash TEXT PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_ticket_feedback_ticket_idx ON support_ticket_feedback_tokens(ticket_id);
ALTER TABLE support_ticket_feedback_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON support_ticket_feedback_tokens FROM anon,authenticated;
GRANT ALL ON support_ticket_feedback_tokens TO service_role;
DROP POLICY IF EXISTS sr_support_feedback_tokens ON support_ticket_feedback_tokens;
CREATE POLICY sr_support_feedback_tokens ON support_ticket_feedback_tokens FOR ALL TO service_role USING(true) WITH CHECK(true);

CREATE OR REPLACE FUNCTION support_submit_feedback(p_ticket_id UUID,p_token_hash TEXT,p_response TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t support_tickets%ROWTYPE; previous_status TEXT; next_status TEXT;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash='' OR p_response IS NULL OR p_response NOT IN ('satisfied','not_satisfied') THEN RETURN NULL; END IF;
  SELECT * INTO t FROM support_tickets WHERE id=p_ticket_id FOR UPDATE;
  IF NOT FOUND OR t.status<>'RESOLVED' THEN RETURN NULL; END IF;
  IF NOT EXISTS(SELECT 1 FROM support_ticket_feedback_tokens WHERE ticket_id=t.id AND token_hash=p_token_hash AND used_at IS NULL AND expires_at>now()) THEN
    -- Preserve links issued before 149, but never bypass a new token's expiry.
    IF t.satisfaction_token_hash IS DISTINCT FROM p_token_hash
      OR EXISTS(SELECT 1 FROM support_ticket_feedback_tokens WHERE token_hash=p_token_hash)
    THEN RETURN NULL; END IF;
  END IF;
  previous_status=t.status;
  next_status=CASE WHEN p_response='satisfied' THEN 'CLOSED' ELSE 'IN_PROGRESS' END;
  UPDATE support_tickets SET status=next_status,satisfaction_response=p_response,satisfaction_responded_at=now(),
    satisfaction_token_hash=NULL,auto_close_at=NULL,followup_claim=NULL,followup_claim_expires_at=NULL,
    resolved_at=CASE WHEN p_response='not_satisfied' THEN NULL ELSE resolved_at END,
    closed_at=CASE WHEN p_response='satisfied' THEN now() ELSE NULL END,updated_at=now()
  WHERE id=t.id RETURNING * INTO t;
  UPDATE support_ticket_feedback_tokens SET used_at=now() WHERE ticket_id=t.id AND used_at IS NULL;
  INSERT INTO support_ticket_events(ticket_id,event_type,actor_type,previous_value,new_value,metadata)
  VALUES(t.id,'STATUS_CHANGED',CASE WHEN t.creator_id IS NOT NULL THEN 'CREATOR' ELSE 'CUSTOMER' END,previous_status,next_status,jsonb_build_object('satisfaction_response',p_response));
  RETURN to_jsonb(t);
END $$;
REVOKE ALL ON FUNCTION support_submit_feedback(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION support_submit_feedback(UUID,TEXT,TEXT) TO service_role;

-- Existing profile tickets gain a recipient without redirecting internal
-- support-account tickets to the support account's own address.
UPDATE support_tickets t SET requester_name=COALESCE(NULLIF(t.requester_name,''),c.full_name),
  requester_email=COALESCE(NULLIF(t.requester_email,''),c.email)
FROM creators c WHERE t.creator_id=c.id AND (t.requester_email IS NULL OR t.requester_email='');
UPDATE support_tickets t SET requester_name=COALESCE(NULLIF(t.requester_name,''),b.primary_contact_name),
  requester_email=COALESCE(NULLIF(t.requester_email,''),b.primary_email)
FROM businesses b WHERE t.business_id=b.id AND lower(trim(b.business_name))<>'martpoint support'
  AND (t.requester_email IS NULL OR t.requester_email='');

-- Repair existing website tickets attached to the internal support account
-- when the conversation contains an email. Ambiguous matches become an
-- explicitly linked lead instead of guessing which customer account owns it.
DO $$
DECLARE item RECORD; contact_email TEXT; contact_name TEXT; chosen UUID; owner_kind TEXT;
BEGIN
  FOR item IN SELECT t.id,t.requester_name,t.requester_email,c.id AS conversation_id,c.customer_name,c.customer_phone
    FROM support_tickets t JOIN businesses b ON b.id=t.business_id
    JOIN azera_conversations c ON c.ticket_id=t.id
    WHERE lower(trim(b.business_name))='martpoint support'
  LOOP
    contact_email=NULLIF(lower(trim(item.requester_email)),'');
    IF contact_email IS NULL THEN
      SELECT lower(trim(m.metadata->>'customer_email')) INTO contact_email FROM azera_messages m
      WHERE m.conversation_id=item.conversation_id AND m.author_type='customer'
        AND COALESCE(m.metadata->>'customer_email','') ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      ORDER BY m.created_at DESC LIMIT 1;
    END IF;
    IF contact_email IS NULL OR contact_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN CONTINUE; END IF;
    contact_name=COALESCE(NULLIF(trim(item.requester_name),''),NULLIF(trim(item.customer_name),''),contact_email);
    chosen=NULL;owner_kind=NULL;
    IF (SELECT count(*) FROM creators WHERE lower(email)=contact_email)=1 THEN
      SELECT id INTO chosen FROM creators WHERE lower(email)=contact_email;owner_kind='creator';
    ELSIF (SELECT count(*) FROM businesses WHERE lower(primary_email)=contact_email AND lower(trim(business_name))<>'martpoint support')=1 THEN
      SELECT id INTO chosen FROM businesses WHERE lower(primary_email)=contact_email AND lower(trim(business_name))<>'martpoint support';owner_kind='business';
    ELSIF (SELECT count(*) FROM partner_users WHERE lower(email)=contact_email)=1 THEN
      SELECT partner_id INTO chosen FROM partner_users WHERE lower(email)=contact_email;owner_kind='partner';
    ELSE
      SELECT id INTO chosen FROM leads WHERE lower(email)=contact_email ORDER BY submitted_at DESC LIMIT 1;
      IF chosen IS NULL THEN
        INSERT INTO leads(full_name,business_name,email,phone,business_type,product_interest,branches,staff_size,source,status)
        VALUES(contact_name,'',contact_email,COALESCE(item.customer_phone,''),'','','','','Support enquiry','New') RETURNING id INTO chosen;
      END IF;
      owner_kind='lead';
    END IF;
    UPDATE support_tickets SET business_id=CASE WHEN owner_kind='business' THEN chosen ELSE NULL END,
      creator_id=CASE WHEN owner_kind='creator' THEN chosen ELSE NULL END,
      requester_partner_id=CASE WHEN owner_kind='partner' THEN chosen ELSE NULL END,
      lead_id=CASE WHEN owner_kind='lead' THEN chosen ELSE NULL END,
      requester_name=contact_name,requester_email=contact_email WHERE id=item.id;
    INSERT INTO support_ticket_events(ticket_id,event_type,actor_type,new_value)
    VALUES(item.id,'REQUESTER_CHANGED','SYSTEM','Linked to the requester profile from the original chat');
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

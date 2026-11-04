ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE lead_quotations ADD CONSTRAINT lead_quotations_approval_status_check
    CHECK (approval_status IN ('NOT_REQUIRED','PENDING','APPROVED','REJECTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS lead_quotations_creator_drafts_idx
  ON lead_quotations (creator_id, status, approval_status, created_at DESC);

INSERT INTO approval_policies(action_key, label, enabled, approver_roles)
VALUES ('quotation.send', 'Approve a quotation before client email', true, ARRAY['Admin']::TEXT[])
ON CONFLICT (action_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';

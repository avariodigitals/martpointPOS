-- Phase 2A: canonical Business ↔ Fleet ↔ Installation identity.
-- Additive only. Existing deployment URLs, tokens, licences and behaviour remain valid.

ALTER TABLE public.business_deployments
  ADD COLUMN IF NOT EXISTS fleet_id UUID,
  ADD COLUMN IF NOT EXISTS installation_id UUID,
  ADD COLUMN IF NOT EXISTS identity_status TEXT NOT NULL DEFAULT 'UNMATCHED',
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_last_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_issue TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'business_deployments_identity_status_check'
  ) THEN
    ALTER TABLE public.business_deployments
      ADD CONSTRAINT business_deployments_identity_status_check
      CHECK (identity_status IN ('VERIFIED','REVIEW_REQUIRED','UNMATCHED','CONFLICT'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS business_deployments_fleet_id_unique
  ON public.business_deployments (fleet_id)
  WHERE fleet_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS business_deployments_installation_id_unique
  ON public.business_deployments (installation_id)
  WHERE installation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_deployments_identity_status_idx
  ON public.business_deployments (identity_status);

CREATE TABLE IF NOT EXISTS public.business_identity_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.business_deployments(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  identity_status TEXT NOT NULL CHECK (identity_status IN ('VERIFIED','REVIEW_REQUIRED','UNMATCHED','CONFLICT')),
  fleet_id UUID,
  installation_id UUID,
  issue TEXT,
  actor_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_identity_audit_business_idx
  ON public.business_identity_audit (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS business_identity_audit_deployment_idx
  ON public.business_identity_audit (deployment_id, created_at DESC);

ALTER TABLE public.business_identity_audit ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    DROP POLICY IF EXISTS "sr_business_identity_audit_all" ON public.business_identity_audit;
    CREATE POLICY "sr_business_identity_audit_all"
      ON public.business_identity_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

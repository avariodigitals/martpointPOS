-- Sprint 7: Customer support portal and DIRECT ticket source
-- Additive only.

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUPPORT TICKET SOURCES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Allow 'DIRECT' as a support ticket source for customer portal submissions.
-- New list is a strict superset of the previous one, so existing rows always
-- re-validate. DROP + ADD is atomic inside this transaction.
DO $$
BEGIN
  IF to_regclass('support_tickets') IS NULL THEN
    RAISE NOTICE 'support_tickets table not found; skipping source constraint update';
  ELSE
    ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_source_check;
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_source_check
      CHECK (source IN ('PORTAL','PARTNER','ADMIN','EMAIL','WHATSAPP','PHONE','SYSTEM','OTHER','DIRECT'));
  END IF;
END $$;

-- Unified Omnichannel support bridge.
-- Allow tickets created from a customer conversation to retain their source.
DO $$
BEGIN
  IF to_regclass('azera_conversations') IS NOT NULL THEN
    ALTER TABLE azera_conversations ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'public_site';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('support_tickets') IS NOT NULL THEN
    ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_source_check;
    ALTER TABLE support_tickets
      ADD CONSTRAINT support_tickets_source_check
      CHECK (source IN ('PORTAL','PARTNER','ADMIN','EMAIL','WHATSAPP','PHONE','SYSTEM','OTHER','DIRECT','OMNICHANNEL'));
  END IF;
END $$;

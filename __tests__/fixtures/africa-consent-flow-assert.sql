-- Isolated fixture DB only, after 139; never run on an application database.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='azera_calls' AND column_name='recording_consent_requested_at') THEN
  RAISE EXCEPTION 'Pending recording step is not persisted';
 END IF;
 IF EXISTS(SELECT 1 FROM azera_calls WHERE recording_consent_requested_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Migration fabricated pending consent for historical calls';
 END IF;
END $$;

-- Reproduce why the old PostgREST upsert could not use migration 126's index.
CREATE TEMP TABLE consent_webhook_dedupe_test(id UUID DEFAULT gen_random_uuid(),dedupe_key TEXT);
CREATE UNIQUE INDEX consent_webhook_dedupe_partial ON consent_webhook_dedupe_test(dedupe_key) WHERE dedupe_key IS NOT NULL;
INSERT INTO consent_webhook_dedupe_test(dedupe_key) VALUES('delivery-one');
DO $$ BEGIN
 BEGIN
  INSERT INTO consent_webhook_dedupe_test(dedupe_key) VALUES('delivery-one')
  ON CONFLICT(dedupe_key) DO UPDATE SET dedupe_key=excluded.dedupe_key;
  RAISE EXCEPTION 'Expected partial-index inference error';
 EXCEPTION WHEN SQLSTATE '42P10' THEN NULL;
 END;
 BEGIN
  INSERT INTO consent_webhook_dedupe_test(dedupe_key) VALUES('delivery-one');
  RAISE EXCEPTION 'Expected duplicate insert rejection';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
 IF (SELECT count(*) FROM consent_webhook_dedupe_test)<>1 THEN RAISE EXCEPTION 'Duplicate diagnostic delivery'; END IF;
END $$;

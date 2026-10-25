-- Isolated test database only. Apply fixture base and migrations 134-136 first.
BEGIN;
INSERT INTO businesses(id) VALUES ('50000000-0000-0000-0000-000000000001');
INSERT INTO azera_conversations(id,business_id,channel,status,customer_name,external_id)
 VALUES ('50000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000001','website','open','Website visitor','visitor_1');
DO $$ DECLARE result UUID; second UUID; BEGIN
 result=azera_prepare_cloudflare_call('50000000-0000-0000-0000-000000000002');
 IF result IS NULL OR NOT EXISTS(SELECT 1 FROM azera_calls WHERE id=result AND sip_provider='cloudflare_sfu' AND call_type='webrtc') THEN RAISE EXCEPTION 'Cloudflare reservation failed'; END IF;
 second=azera_prepare_cloudflare_call('50000000-0000-0000-0000-000000000002');
 IF second IS NOT NULL THEN RAISE EXCEPTION 'Duplicate call allowed'; END IF;
 INSERT INTO azera_cloudflare_participants(call_id,participant) VALUES(result,'customer');
 BEGIN
   INSERT INTO azera_cloudflare_participants(call_id,participant) VALUES(result,'customer');
   RAISE EXCEPTION 'Duplicate participant allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 IF has_function_privilege('anon','azera_prepare_cloudflare_call(uuid)','EXECUTE') OR has_function_privilege('authenticated','azera_prepare_cloudflare_call(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Reservation exposed'; END IF;
 IF has_table_privilege('authenticated','azera_cloudflare_participants','SELECT') OR has_table_privilege('anon','azera_cloudflare_participants','SELECT') THEN RAISE EXCEPTION 'Media sessions exposed'; END IF;
 UPDATE azera_calls SET status='ended' WHERE id=result;
 UPDATE azera_conversations SET status='closed' WHERE id='50000000-0000-0000-0000-000000000002';
 IF azera_prepare_cloudflare_call('50000000-0000-0000-0000-000000000002') IS NOT NULL THEN RAISE EXCEPTION 'Closed conversation accepted'; END IF;
END $$;
ROLLBACK;

-- Isolated database only, after base fixture + migrations 134,135.
INSERT INTO businesses VALUES ('40000000-0000-0000-0000-000000000001');
INSERT INTO azera_settings(business_id) VALUES ('40000000-0000-0000-0000-000000000001');
INSERT INTO azera_conversations(id,business_id,customer_name,external_id) VALUES
 ('50000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Caller','visitor-a'),
 ('50000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Caller B','visitor-b'),
 ('50000000-0000-0000-0000-000000000003','40000000-0000-0000-0000-000000000001','Caller C','visitor-c'),
 ('50000000-0000-0000-0000-000000000004','40000000-0000-0000-0000-000000000001','Caller D','visitor-d');
DO $$ DECLARE first_call UUID; BEGIN
 IF azera_prepare_ai_call('50000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'AI voice was enabled without opt-in'; END IF;
 UPDATE azera_settings SET voice_realtime_enabled=true WHERE business_id='40000000-0000-0000-0000-000000000001';
 first_call=azera_prepare_ai_call('50000000-0000-0000-0000-000000000001');
 IF first_call IS NULL THEN RAISE EXCEPTION 'Could not reserve allowed AI call'; END IF;
 IF (SELECT sip_provider FROM azera_calls WHERE id=first_call)<>'openai_realtime' THEN RAISE EXCEPTION 'AI call accidentally uses LiveKit'; END IF;
 IF azera_prepare_ai_call('50000000-0000-0000-0000-000000000001') IS NOT NULL THEN RAISE EXCEPTION 'Duplicate conversation call allowed'; END IF;
 PERFORM azera_prepare_ai_call('50000000-0000-0000-0000-000000000002');
 PERFORM azera_prepare_ai_call('50000000-0000-0000-0000-000000000003');
 IF azera_prepare_ai_call('50000000-0000-0000-0000-000000000004') IS NOT NULL THEN RAISE EXCEPTION 'Global concurrency budget exceeded'; END IF;
 IF has_function_privilege('authenticated','azera_prepare_ai_call(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Public AI budget RPC'; END IF;
 IF has_function_privilege('anon','azera_accept_media_transfer(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Public transfer RPC'; END IF;
END $$;
INSERT INTO users(id,name,role) VALUES
 ('60000000-0000-0000-0000-000000000001','Original','Customer Care'),
 ('60000000-0000-0000-0000-000000000002','Receiver','Customer Care'),
 ('60000000-0000-0000-0000-000000000003','Wrong queue','Sales');
INSERT INTO azera_agent_presence(user_id,queues) VALUES
 ('60000000-0000-0000-0000-000000000001',ARRAY['customer_support']),
 ('60000000-0000-0000-0000-000000000002',ARRAY['customer_support']),
 ('60000000-0000-0000-0000-000000000003',ARRAY['sales']);
INSERT INTO azera_calls(id,conversation_id,sip_provider,status,agent_user_id,transfer_to_user_id,transfer_expires_at) VALUES
 ('70000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','livekit','active','60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002',now()+INTERVAL '60 seconds');
DO $$ BEGIN
 IF azera_accept_media_transfer('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'Uninvited transfer accepted'; END IF;
 IF (SELECT agent_user_id FROM azera_calls WHERE id='70000000-0000-0000-0000-000000000001')<>'60000000-0000-0000-0000-000000000001'::UUID THEN RAISE EXCEPTION 'Failed transfer removed original agent'; END IF;
 UPDATE azera_calls SET media_control_claim=gen_random_uuid() WHERE id='70000000-0000-0000-0000-000000000001';
 IF azera_accept_media_transfer('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Transfer raced an in-progress provider control'; END IF;
 UPDATE azera_calls SET media_control_claim=NULL WHERE id='70000000-0000-0000-0000-000000000001';
 IF NOT azera_accept_media_transfer('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Valid handover failed'; END IF;
 IF (SELECT agent_user_id FROM azera_calls WHERE id='70000000-0000-0000-0000-000000000001')<>'60000000-0000-0000-0000-000000000002'::UUID THEN RAISE EXCEPTION 'Ownership not transferred'; END IF;
 IF azera_accept_media_transfer('70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Transfer accepted twice'; END IF;
END $$;
SELECT 'Voice opt-in, budgets, permissions and atomic transfer assertions passed' AS result;

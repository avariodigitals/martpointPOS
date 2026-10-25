INSERT INTO users(id,name,role,status) VALUES
 ('10000000-0000-0000-0000-000000000001','Support A','Customer Care','ACTIVE'),
 ('10000000-0000-0000-0000-000000000002','Support B','Customer Care','ACTIVE'),
 ('10000000-0000-0000-0000-000000000003','Sales only','Sales','ACTIVE'),
 ('10000000-0000-0000-0000-000000000004','Disabled','Customer Care','DISABLED'),
 ('10000000-0000-0000-0000-000000000005','Changed role','Finance','ACTIVE');
INSERT INTO azera_agent_presence(user_id,queues) VALUES
 ('10000000-0000-0000-0000-000000000001',ARRAY['customer_support']),
 ('10000000-0000-0000-0000-000000000002',ARRAY['customer_support']),
 ('10000000-0000-0000-0000-000000000003',ARRAY['sales']),
 ('10000000-0000-0000-0000-000000000004',ARRAY['customer_support']),
 ('10000000-0000-0000-0000-000000000005',ARRAY['customer_support']);
INSERT INTO azera_conversations(id,assigned_admin_user_id,status) VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','assigned');
INSERT INTO azera_conversations(id) VALUES('20000000-0000-0000-0000-000000000002');
DO $$ DECLARE chosen UUID; BEGIN
 chosen := azera_assign_waiting_conversation('20000000-0000-0000-0000-000000000002');
 IF chosen <> '10000000-0000-0000-0000-000000000002'::UUID THEN RAISE EXCEPTION 'Least-loaded matching active agent was not selected'; END IF;
 IF (SELECT ai_enabled FROM azera_conversations WHERE id='20000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'AI not paused on assignment'; END IF;
 IF azera_assign_waiting_conversation('20000000-0000-0000-0000-000000000002') <> chosen THEN RAISE EXCEPTION 'Existing owner changed'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='call-recordings') THEN RAISE EXCEPTION 'Recordings still public'; END IF;
 IF has_function_privilege('anon','azera_assign_waiting_conversation(uuid)','EXECUTE') THEN RAISE EXCEPTION 'Public assignment RPC access'; END IF;
END $$;
INSERT INTO azera_calls(id,agent_user_id,sip_provider,status,call_type,direction,started_at,answered_at,duration_seconds,created_at) VALUES
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','africas_talking_browser','active','sip','inbound',now()-interval '20 seconds',now()-interval '10 seconds',10,now()),
 ('30000000-0000-0000-0000-000000000002',NULL,'africas_talking','ended','sip','inbound',now(),NULL,0,now());
DO $$ DECLARE report JSONB; BEGIN
 report := azera_call_report_summary(now()-interval '1 day',now()+interval '1 day');
 IF (report->>'total')::INTEGER <> 2 OR (report->>'answered')::INTEGER <> 1 THEN RAISE EXCEPTION 'Answered and ended attempts incorrectly conflated'; END IF;
 IF (report->>'answeredWithin30Seconds')::INTEGER <> 1 THEN RAISE EXCEPTION 'Incorrect answer SLA count'; END IF;
 BEGIN
  INSERT INTO azera_calls(agent_user_id,sip_provider,status) VALUES('10000000-0000-0000-0000-000000000001','africas_talking_browser','ringing');
  RAISE EXCEPTION 'Concurrent live phone call was allowed';
 EXCEPTION WHEN unique_violation THEN NULL;
 END;
END $$;
SELECT 'Azera migration, routing, permissions and reporting assertions passed' AS result;
INSERT INTO azera_calls(id,conversation_id,call_type,direction,status) VALUES
 ('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','webrtc','inbound','ringing'),
 ('30000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','webrtc','inbound','ringing');
DO $$ BEGIN
 IF azera_claim_browser_call('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003') THEN RAISE EXCEPTION 'Wrong-queue agent claimed call'; END IF;
 IF azera_claim_browser_call('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001') THEN RAISE EXCEPTION 'Busy agent claimed call'; END IF;
 IF NOT azera_claim_browser_call('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Eligible agent could not claim call'; END IF;
 IF azera_claim_browser_call('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002') THEN RAISE EXCEPTION 'Agent claimed two calls'; END IF;
END $$;
SELECT 'Atomic website call ownership assertions passed' AS result;

-- Isolated fixture DB only; apply after fixture base, 134 and 137.
INSERT INTO businesses(id) VALUES('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
INSERT INTO users(id,name,role) VALUES
 ('00000000-0000-4000-8000-000000000011','Sales agent','Sales'),
 ('00000000-0000-4000-8000-000000000012','Support agent','Customer Care');
DO $$ DECLARE identity TEXT; BEGIN
 identity=azera_register_africa_browser('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000021',ARRAY['sales']);
 IF identity IS NULL THEN RAISE EXCEPTION 'Registration failed'; END IF;
 IF azera_register_africa_browser('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000022',ARRAY['sales']) IS NOT NULL THEN RAISE EXCEPTION 'Second tab stole phone'; END IF;
END $$;
INSERT INTO azera_calls(id,business_id,sip_provider,direction,status) VALUES
 ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','africas_talking','inbound','ringing'),
 ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','africas_talking','inbound','ringing'),
 ('00000000-0000-4000-8000-000000000033','00000000-0000-4000-8000-000000000002','africas_talking','inbound','ringing');
DO $$ BEGIN
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000031','sales') IS NOT NULL THEN RAISE EXCEPTION 'Unready phone received call'; END IF;
 UPDATE azera_africa_browser_agents SET ready=true;
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000031','support') IS NOT NULL THEN RAISE EXCEPTION 'Wrong queue received call'; END IF;
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000033','sales') IS NOT NULL THEN RAISE EXCEPTION 'Cross-business route'; END IF;
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000031','sales') IS NULL THEN RAISE EXCEPTION 'Ready phone did not receive call'; END IF;
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000032','sales') IS NOT NULL THEN RAISE EXCEPTION 'Agent assigned two calls'; END IF;
 UPDATE azera_calls SET status='ended' WHERE id='00000000-0000-4000-8000-000000000031';
 UPDATE azera_africa_browser_agents SET last_seen_at=now()-INTERVAL '90 seconds';
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000032','sales') IS NOT NULL THEN RAISE EXCEPTION 'Expired phone received call'; END IF;
 UPDATE azera_africa_browser_agents SET last_seen_at=now(); UPDATE users SET status='DISABLED' WHERE role='Sales';
 IF azera_route_africa_browser('00000000-0000-4000-8000-000000000032','sales') IS NOT NULL THEN RAISE EXCEPTION 'Disabled user received call'; END IF;
 IF has_table_privilege('authenticated','azera_africa_browser_agents','SELECT') THEN RAISE EXCEPTION 'Phone leases exposed'; END IF;
END $$;

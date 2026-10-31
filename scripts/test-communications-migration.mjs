import { readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
const schema = `comm_verify_${Date.now()}`
const migration = readFileSync(new URL("../supabase/migrations/161_communications_workspace.sql", import.meta.url), "utf8").replaceAll("SET search_path=public", `SET search_path=${schema},public`)
const sql = `BEGIN;
CREATE SCHEMA ${schema}; SET search_path=${schema},public;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE users(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'ACTIVE',role text NOT NULL DEFAULT 'Admin');
CREATE TABLE leads(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'New');
CREATE TABLE azera_conversations(id uuid PRIMARY KEY);
${migration}
INSERT INTO users(id) VALUES('00000000-0000-4000-8000-000000000001');
INSERT INTO communication_workflows(name,channel,mode,template_id,trigger,delay_minutes,created_by)
  SELECT 'test','email','template',id,'new_lead',1,'00000000-0000-4000-8000-000000000001' FROM communication_templates WHERE channel='email' LIMIT 1;
INSERT INTO leads VALUES('00000000-0000-4000-8000-000000000010','New');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM communication_runs) THEN RAISE EXCEPTION 'Disabled workflow enrolled a lead'; END IF; END $$;
UPDATE communication_workflows SET enabled=true;
INSERT INTO leads VALUES('00000000-0000-4000-8000-000000000011','New'),('00000000-0000-4000-8000-000000000012','New'),('00000000-0000-4000-8000-000000000013','Won');
UPDATE communication_runs SET next_run_at=now()-interval '1 minute';
SELECT communication_schedule_due(); SELECT communication_schedule_due();
DO $$ DECLARE n int; BEGIN
  SELECT count(*) INTO n FROM communication_messages; IF n<>2 THEN RAISE EXCEPTION 'Schedule duplicated jobs or enrolled closed lead: %',n; END IF;
  SELECT count(*) INTO n FROM communication_claim('00000000-0000-4000-8000-000000000021',1); IF n<>1 THEN RAISE EXCEPTION 'First claim failed'; END IF;
  SELECT count(*) INTO n FROM communication_claim('00000000-0000-4000-8000-000000000022',3); IF n<>1 THEN RAISE EXCEPTION 'Second claim duplicated messages'; END IF;
  SELECT count(*) INTO n FROM communication_claim('00000000-0000-4000-8000-000000000023',3); IF n<>0 THEN RAISE EXCEPTION 'Claimed an already claimed message'; END IF;
END $$;
UPDATE communication_messages SET status='dispatching',claim_expires_at=now()-interval '1 minute';
SELECT communication_schedule_due();
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM communication_messages WHERE status<>'unknown') THEN RAISE EXCEPTION 'Interrupted dispatch was not held'; END IF;
  IF EXISTS(SELECT 1 FROM communication_runs WHERE status<>'paused') THEN RAISE EXCEPTION 'Uncertain workflow was not paused'; END IF;
  RAISE NOTICE 'Communications migration and queue assertions passed';
END $$;
ROLLBACK;`
const result = spawnSync("psql", ["-X", "-q", "-d", process.env.COMMUNICATIONS_TEST_DB || "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8" })
process.stdout.write(result.stdout || "")
process.stderr.write(result.stderr || "")
process.exit(result.status ?? 1)

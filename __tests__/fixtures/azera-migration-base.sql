-- Isolated PostgreSQL fixtures only. Never run this file on a real app DB.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $$;
CREATE TABLE users(id UUID PRIMARY KEY, name TEXT, role TEXT, status TEXT DEFAULT 'ACTIVE');
CREATE TABLE businesses(id UUID PRIMARY KEY);
CREATE TABLE azera_conversations(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), business_id UUID REFERENCES businesses(id), channel TEXT DEFAULT 'website', customer_name TEXT, customer_phone TEXT, external_id TEXT, status TEXT DEFAULT 'open', queue TEXT DEFAULT 'customer_support', assigned_admin_user_id UUID REFERENCES users(id), waiting_for_agent BOOLEAN DEFAULT true, ai_enabled BOOLEAN DEFAULT true, updated_at TIMESTAMPTZ DEFAULT now(), last_message_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE azera_agent_presence(user_id UUID PRIMARY KEY REFERENCES users(id), queues TEXT[], is_online BOOLEAN DEFAULT true, last_seen_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE azera_calls(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), business_id UUID REFERENCES businesses(id), conversation_id UUID REFERENCES azera_conversations(id), customer_external_id TEXT, webrtc_room TEXT, agent_user_id UUID REFERENCES users(id), sip_provider TEXT, status TEXT, call_type TEXT, direction TEXT, customer_name TEXT, customer_phone TEXT, agent_name TEXT, duration_seconds INTEGER DEFAULT 0, answered_at TIMESTAMPTZ, started_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), follow_up_at TIMESTAMPTZ, follow_up_status TEXT DEFAULT 'new');
CREATE TABLE azera_messages(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES azera_conversations(id));
CREATE TABLE azera_settings(business_id UUID REFERENCES businesses(id));
CREATE TABLE azera_call_recordings(id UUID PRIMARY KEY DEFAULT gen_random_uuid(), call_id UUID REFERENCES azera_calls(id));
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id TEXT PRIMARY KEY, public BOOLEAN, allowed_mime_types TEXT[]);
CREATE TABLE storage.objects(id UUID, bucket_id TEXT);
INSERT INTO storage.buckets VALUES('call-recordings',true,ARRAY['audio/wav']);

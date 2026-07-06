const fs = require('fs');

const unifiedSQL = `-- =========================================================================
-- UNIFIED DATABASE SCHEMA FOR CRM WIKS
-- Use this script in your Supabase SQL Editor to initialize your new database.
-- =========================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Create channels table
CREATE TABLE IF NOT EXISTS public.channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    provider TEXT NOT NULL, -- 'meta' or 'evolution' or 'instagram' or 'webchat'
    status TEXT NOT NULL DEFAULT 'active',
    credentials JSONB, -- store provider‑specific credentials
    webhook_url TEXT,
    phone_id TEXT,
    access_token TEXT,
    url TEXT,
    instance TEXT,
    api_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create agent_profiles table
CREATE TABLE IF NOT EXISTS public.agent_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'agent',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    pipeline_stage TEXT DEFAULT 'new' CHECK (pipeline_stage IN ('new', 'contacted', 'proposal', 'won', 'lost')),
    notes TEXT,
    email TEXT,
    value NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    content TEXT,
    content_type TEXT DEFAULT 'text',
    media_url TEXT,
    whatsapp_msg_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create webhook_logs table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Create failed_messages table
CREATE TABLE IF NOT EXISTS public.failed_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Create ai_settings table
CREATE TABLE IF NOT EXISTS public.ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
    system_prompt TEXT,
    temperature NUMERIC DEFAULT 0.7,
    pause_trigger_phrases TEXT[] DEFAULT ARRAY['falar com atendente', 'humano', 'pessoa']::text[],
    updated_at TIMESTAMPTZ DEFAULT now(),
    channel_id UUID REFERENCES public.channels(id) ON DELETE CASCADE,
    CONSTRAINT unique_channel_tenant UNIQUE (tenant_id, channel_id)
);

-- 8. Create crm_settings table
CREATE TABLE IF NOT EXISTS public.crm_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- 9. Create followup_rules table
CREATE TABLE IF NOT EXISTS public.followup_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  trigger_event   TEXT NOT NULL,
  delay_hours     NUMERIC(6,2) NOT NULL DEFAULT 24.00,
  message         TEXT NOT NULL,
  channel_ids     UUID[] NOT NULL DEFAULT '{}',
  pipeline_stages TEXT[] NOT NULL DEFAULT '{}',
  stop_on_reply   BOOLEAN NOT NULL DEFAULT true,
  max_attempts    INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Create followup_queue table
CREATE TABLE IF NOT EXISTS public.followup_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES public.followup_rules(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel_id      UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  sent_at         TIMESTAMPTZ,
  cancel_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Create activity_log table
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    meta TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show')) DEFAULT 'scheduled',
    created_by TEXT NOT NULL CHECK (created_by IN ('ai', 'human')),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT prevent_double_booking EXCLUDE USING gist (
        tstzrange(start_time, end_time) WITH &&
    ) WHERE (status <> 'cancelled')
);

-- 13. Enable Realtime Publications on necessary tables
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.followup_queue REPLICA IDENTITY FULL;
ALTER TABLE public.activity_log REPLICA IDENTITY FULL;
ALTER TABLE public.appointments REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
    
    -- Add tables to publication
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contacts') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'followup_queue') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.followup_queue;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'activity_log') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'appointments') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
    END IF;
END $$;

-- 14. Enable Row Level Security (RLS) and Create Policies
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followup_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Creation helper to avoid errors
CREATE OR REPLACE FUNCTION public.create_policy_safe(polname TEXT, tblname TEXT, op TEXT, roles TEXT[], using_expr TEXT, check_expr TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', polname, tblname);
    IF op = 'INSERT' THEN
        EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO %s WITH CHECK (%s)', polname, tblname, array_to_string(roles, ','), check_expr);
    ELSIF check_expr IS NOT NULL THEN
        EXECUTE format('CREATE POLICY %I ON %I FOR %s TO %s USING (%s) WITH CHECK (%s)', polname, tblname, op, array_to_string(roles, ','), using_expr, check_expr);
    ELSE
        EXECUTE format('CREATE POLICY %I ON %I FOR %s TO %s USING (%s)', polname, tblname, op, array_to_string(roles, ','), using_expr);
    END IF;
END;
$$ LANGUAGE plpgsql;

SELECT public.create_policy_safe('channel_select', 'channels', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('channel_insert', 'channels', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('channel_update', 'channels', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('channel_delete', 'channels', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('contact_select', 'contacts', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('contact_insert', 'contacts', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('contact_update', 'contacts', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('contact_delete', 'contacts', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('message_select', 'messages', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('message_insert', 'messages', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('message_update', 'messages', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('message_delete', 'messages', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('ai_settings_select', 'ai_settings', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('ai_settings_insert', 'ai_settings', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('ai_settings_update', 'ai_settings', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('ai_settings_delete', 'ai_settings', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('crm_settings_select', 'crm_settings', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('crm_settings_insert', 'crm_settings', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('crm_settings_update', 'crm_settings', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('crm_settings_delete', 'crm_settings', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('followup_rules_select', 'followup_rules', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('followup_rules_insert', 'followup_rules', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('followup_rules_update', 'followup_rules', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('followup_rules_delete', 'followup_rules', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('followup_queue_select', 'followup_queue', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('followup_queue_insert', 'followup_queue', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('followup_queue_update', 'followup_queue', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('followup_queue_delete', 'followup_queue', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

SELECT public.create_policy_safe('activity_log_select', 'activity_log', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('activity_log_insert', 'activity_log', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');

SELECT public.create_policy_safe('appointments_select', 'appointments', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('appointments_insert', 'appointments', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('appointments_update', 'appointments', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');

SELECT public.create_policy_safe('agent_profiles_select', 'agent_profiles', 'SELECT', ARRAY['anon', 'authenticated'], 'true', NULL);
SELECT public.create_policy_safe('agent_profiles_insert', 'agent_profiles', 'INSERT', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('agent_profiles_update', 'agent_profiles', 'UPDATE', ARRAY['anon', 'authenticated'], 'true', 'true');
SELECT public.create_policy_safe('agent_profiles_delete', 'agent_profiles', 'DELETE', ARRAY['anon', 'authenticated'], 'true', NULL);

DROP FUNCTION public.create_policy_safe;

-- 15. Helper Trigger Functions for Automated Workflows

-- set_updated_at helper
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_followup_rules_updated ON public.followup_rules;
CREATE TRIGGER trg_followup_rules_updated
  BEFORE UPDATE ON public.followup_rules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 16. Follow-Up triggers and rules
CREATE OR REPLACE FUNCTION public.followup_trigger_contact_created()
RETURNS TRIGGER AS $$
DECLARE
    rule_rec RECORD;
    target_channel_id UUID;
    is_global_enabled TEXT;
BEGIN
    SELECT value INTO is_global_enabled FROM public.crm_settings WHERE key = 'followup_global_enabled';
    IF is_global_enabled IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    SELECT id INTO target_channel_id FROM public.channels LIMIT 1;
    IF target_channel_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    FOR rule_rec IN 
        SELECT * FROM public.followup_rules 
        WHERE is_active = true 
          AND trigger_event = 'contact_created'
    LOOP
        IF array_length(rule_rec.channel_ids, 1) IS NOT NULL AND NOT (target_channel_id = ANY(rule_rec.channel_ids)) THEN
            CONTINUE;
        END IF;

        IF array_length(rule_rec.pipeline_stages, 1) IS NOT NULL AND NOT (COALESCE(NEW.pipeline_stage, 'new') = ANY(rule_rec.pipeline_stages)) THEN
            CONTINUE;
        END IF;

        INSERT INTO public.followup_queue (rule_id, contact_id, channel_id, scheduled_at, status)
        VALUES (rule_rec.id, NEW.id, target_channel_id, now() + (rule_rec.delay_hours * interval '1 hour'), 'pending');
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_followup_contact_created ON public.contacts;
CREATE TRIGGER trg_followup_contact_created
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.followup_trigger_contact_created();

CREATE OR REPLACE FUNCTION public.followup_trigger_stage_entered()
RETURNS TRIGGER AS $$
DECLARE
    rule_rec RECORD;
    target_channel_id UUID;
    is_global_enabled TEXT;
BEGIN
    SELECT value INTO is_global_enabled FROM public.crm_settings WHERE key = 'followup_global_enabled';
    IF is_global_enabled IS DISTINCT FROM 'true' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' AND (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage) THEN
        SELECT channel_id INTO target_channel_id 
        FROM public.messages 
        WHERE contact_id = NEW.id 
        ORDER BY timestamp DESC 
        LIMIT 1;

        IF target_channel_id IS NULL THEN
            SELECT id INTO target_channel_id FROM public.channels LIMIT 1;
        END IF;

        IF target_channel_id IS NULL THEN
            RETURN NEW;
        END IF;

        FOR rule_rec IN 
            SELECT * FROM public.followup_rules 
            WHERE is_active = true 
              AND trigger_event = 'stage_entered'
        LOOP
            IF array_length(rule_rec.pipeline_stages, 1) IS NOT NULL AND NOT (NEW.pipeline_stage = ANY(rule_rec.pipeline_stages)) THEN
                CONTINUE;
            END IF;

            IF array_length(rule_rec.channel_ids, 1) IS NOT NULL AND NOT (target_channel_id = ANY(rule_rec.channel_ids)) THEN
                CONTINUE;
            END IF;

            INSERT INTO public.followup_queue (rule_id, contact_id, channel_id, scheduled_at, status)
            VALUES (rule_rec.id, NEW.id, target_channel_id, now() + (rule_rec.delay_hours * interval '1 hour'), 'pending');
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_followup_stage_entered ON public.contacts;
CREATE TRIGGER trg_followup_stage_entered
  AFTER UPDATE OF pipeline_stage ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.followup_trigger_stage_entered();

CREATE OR REPLACE FUNCTION public.followup_trigger_message_inserted()
RETURNS TRIGGER AS $$
DECLARE
    rule_rec RECORD;
    contact_stage TEXT;
    is_global_enabled TEXT;
BEGIN
    IF NEW.direction = 'in' THEN
        UPDATE public.followup_queue q
        SET status = 'cancelled',
            cancel_reason = 'replied_before_send'
        FROM public.followup_rules r
        WHERE q.rule_id = r.id
          AND q.contact_id = NEW.contact_id
          AND q.status = 'pending'
          AND r.stop_on_reply = true;

        SELECT value INTO is_global_enabled FROM public.crm_settings WHERE key = 'followup_global_enabled';
        IF is_global_enabled IS DISTINCT FROM 'true' THEN
            RETURN NEW;
        END IF;

        SELECT COALESCE(pipeline_stage, 'new') INTO contact_stage FROM public.contacts WHERE id = NEW.contact_id;

        FOR rule_rec IN 
            SELECT * FROM public.followup_rules 
            WHERE is_active = true 
              AND trigger_event = 'last_message_in'
        LOOP
            IF array_length(rule_rec.channel_ids, 1) IS NOT NULL AND NOT (NEW.channel_id = ANY(rule_rec.channel_ids)) THEN
                CONTINUE;
            END IF;

            IF array_length(rule_rec.pipeline_stages, 1) IS NOT NULL AND NOT (contact_stage = ANY(rule_rec.pipeline_stages)) THEN
                CONTINUE;
            END IF;

            INSERT INTO public.followup_queue (rule_id, contact_id, channel_id, scheduled_at, status)
            VALUES (rule_rec.id, NEW.contact_id, NEW.channel_id, now() + (rule_rec.delay_hours * interval '1 hour'), 'pending');
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_followup_message_inserted ON public.messages;
CREATE TRIGGER trg_followup_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.followup_trigger_message_inserted();

-- 17. Activity log triggers
CREATE OR REPLACE FUNCTION public.fn_log_contact_activity()
RETURNS TRIGGER AS $$
DECLARE
    contact_name TEXT;
BEGIN
    contact_name := NEW.name;
    
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO public.activity_log (contact_id, type, title, meta)
        VALUES (NEW.id, 'lead', 'Novo Lead importado', 'Lead ' || contact_name || ' foi criado no sistema.');
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage THEN
            IF NEW.pipeline_stage = 'won' THEN
                INSERT INTO public.activity_log (contact_id, type, title, meta)
                VALUES (NEW.id, 'won', 'Lead ganho! Status atualizado', 'Lead ' || contact_name || ' foi movido para Vendas Fechadas (Ganhos) com o valor de R$ ' || COALESCE(NEW.value::text, '0'));
            ELSIF NEW.pipeline_stage = 'lost' THEN
                INSERT INTO public.activity_log (contact_id, type, title, meta)
                VALUES (NEW.id, 'lost', 'Lead perdido', 'Lead ' || contact_name || ' foi marcado como perdido.');
            ELSE
                INSERT INTO public.activity_log (contact_id, type, title, meta)
                VALUES (
                    NEW.id,
                    'status_changed',
                    'Estágio do Lead atualizado',
                    'Lead ' || contact_name || ' foi movido para a etapa: ' || 
                    CASE 
                        WHEN NEW.pipeline_stage = 'new' THEN 'Novos Leads'
                        WHEN NEW.pipeline_stage = 'contacted' THEN 'Em Atendimento'
                        WHEN NEW.pipeline_stage = 'proposal' THEN 'Tem Interesse'
                        ELSE NEW.pipeline_stage
                    END
                );
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_contact_activity ON public.contacts;
CREATE TRIGGER trg_contact_activity
AFTER INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.fn_log_contact_activity();

CREATE OR REPLACE FUNCTION public.fn_log_message_activity()
RETURNS TRIGGER AS $$
DECLARE
    contact_name TEXT;
    contact_tags JSONB;
BEGIN
    SELECT name, tags INTO contact_name, contact_tags 
    FROM public.contacts 
    WHERE id = NEW.contact_id;
    
    IF contact_name IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.direction = 'in' THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.messages 
            WHERE contact_id = NEW.contact_id 
              AND direction = 'in'
              AND id <> NEW.id
              AND public.messages.timestamp::timestamptz > NEW.timestamp::timestamptz - INTERVAL '60 minutes'
        ) THEN
            INSERT INTO public.activity_log (contact_id, type, title, meta)
            VALUES (NEW.contact_id, 'lead', 'Mensagem recebida', 'O cliente ' || contact_name || ' enviou uma mensagem.');
        END IF;
    ELSIF NEW.direction = 'out' THEN
        IF contact_tags IS NULL OR NOT (contact_tags ? 'IA Inativa') THEN
            INSERT INTO public.activity_log (contact_id, type, title, meta)
            VALUES (NEW.contact_id, 'bot', 'Bot Auto-resposta executado', 'Resposta automatizada enviada para ' || contact_name || '.');
        ELSE
            INSERT INTO public.activity_log (contact_id, type, title, meta)
            VALUES (NEW.contact_id, 'webhook', 'Mensagem manual enviada', 'Atendente respondeu ' || contact_name || '.');
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_message_activity ON public.messages;
CREATE TRIGGER trg_message_activity
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.fn_log_message_activity();

-- 18. Trigger to notify n8n AI Agent on Inbound Message
CREATE OR REPLACE FUNCTION public.notify_n8n_ai_agent()
RETURNS TRIGGER AS $$
DECLARE
  request_id BIGINT;
BEGIN
  IF NEW.direction = 'in' THEN
    SELECT
      net.http_post(
        -- ATTENTION: Replace the URL below with your actual Central AI Agent webhook URL on n8n
        url:='https://n8n-n8n.rh3fr2.easypanel.host/webhook/b705693e-ddc4-4aea-98a3-16c742e1738e',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=jsonb_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'channel_id', NEW.channel_id,
          'user_message', NEW.content,
          'direction', NEW.direction
        )
      ) INTO request_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notify_n8n_ai_agent ON public.messages;
CREATE TRIGGER trg_notify_n8n_ai_agent
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_n8n_ai_agent();

-- 19. RLS policies helper functions
CREATE OR REPLACE FUNCTION public.rename_tag_in_contacts(old_name TEXT, new_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.contacts
  SET tags = (
    SELECT COALESCE(
      jsonb_agg(DISTINCT replaced_val),
      '[]'::jsonb
    )
    FROM (
      SELECT CASE WHEN val = old_name THEN new_name ELSE val END AS replaced_val
      FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS val
    ) sub
  )::jsonb
  WHERE tags ? old_name;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.remove_tag_from_contacts(tag_name TEXT)
RETURNS INTEGER AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.contacts
  SET tags = (
    SELECT COALESCE(
      jsonb_agg(val),
      '[]'::jsonb
    )
    FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb)) AS val
    WHERE val <> tag_name
  )::jsonb
  WHERE tags ? tag_name;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.rename_tag_in_contacts(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_tag_from_contacts(TEXT) TO anon, authenticated;

-- 20. Seed Initial settings
INSERT INTO public.crm_settings (key, value) VALUES
  ('company_name', 'Minha Empresa'),
  ('followup_global_enabled', 'true'),
  ('agenda_settings', '{"working_hours": {"start": "09:00", "end": "18:00"}, "days": [1, 2, 3, 4, 5], "slot_duration_minutes": 60}')
ON CONFLICT (key) DO NOTHING;
`;

fs.writeFileSync('scratch/unified_production_schema.sql', unifiedSQL);
console.log("Unified production schema created successfully!");

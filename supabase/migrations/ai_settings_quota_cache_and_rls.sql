-- Migration: ai_settings RLS Hardening and Quota Cache Columns
-- File: supabase/migrations/ai_settings_quota_cache_and_rls.sql

-- 1. Add cache columns to ai_settings if they don't exist
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS quota_status text;
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS last_checked_at timestamptz;

-- 2. Restrict SELECT on ai_settings to authenticated users only (block anon)
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_settings_select ON public.ai_settings;
DROP POLICY IF EXISTS ai_settings_insert ON public.ai_settings;
DROP POLICY IF EXISTS ai_settings_update ON public.ai_settings;
DROP POLICY IF EXISTS ai_settings_delete ON public.ai_settings;

CREATE POLICY ai_settings_select ON public.ai_settings 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY ai_settings_insert ON public.ai_settings 
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY ai_settings_update ON public.ai_settings 
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY ai_settings_delete ON public.ai_settings 
    FOR DELETE TO authenticated USING (true);

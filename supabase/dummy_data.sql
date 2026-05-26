-- Script para popular o CRM Conversacional com dados fictícios de alta qualidade

-- 1. Definir um Tenant ID padrão para todos os dados fictícios
-- (Em um cenário real, cada empresa teria o seu)
DO $$
DECLARE
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- Limpar dados anteriores (opcional, remova se quiser apenas adicionar)
    -- DELETE FROM public.messages;
    -- DELETE FROM public.leads;
    -- DELETE FROM public.tags;

    -- 2. Criar Tags de exemplo
    INSERT INTO public.tags (id, tenant_id, name, color) VALUES
    ('11111111-1111-1111-1111-111111111111', default_tenant_id, 'VIP', '#FFD700'),
    ('22222222-2222-2222-2222-222222222222', default_tenant_id, 'Urgente', '#FF4C4C'),
    ('33333333-3333-3333-3333-333333333333', default_tenant_id, 'Follow-up', '#4C9EFF'),
    ('44444444-4444-4444-4444-444444444444', default_tenant_id, 'Interesse em PMMA', '#A259FF')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Criar Leads de exemplo
    INSERT INTO public.leads (id, tenant_id, name, phone, instagram_handle, stage, ai_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', default_tenant_id, 'Caio Martins', '+5511999998888', '@caio_dev', 'Novo', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', default_tenant_id, 'Beatriz Silva', '+5512988776655', '@beatriz_estetica', 'Em Atendimento', true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', default_tenant_id, 'Ricardo Oliveira', '+5511977665544', '@ricardo_fit', 'Proposta', false),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', default_tenant_id, 'Mariana Costa', '+5511966554433', '@mari_makeup', 'Ganho', true)
    ON CONFLICT (id) DO NOTHING;

    -- 4. Vincular Tags aos Leads
    INSERT INTO public.lead_tags (lead_id, tag_id, tenant_id) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', default_tenant_id),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', default_tenant_id),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', default_tenant_id)
    ON CONFLICT DO NOTHING;

    -- 5. Criar Mensagens de exemplo (Simulando uma conversa)
    INSERT INTO public.messages (tenant_id, lead_id, sender_type, channel, content) VALUES
    (default_tenant_id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'lead', 'whatsapp', 'Olá, gostaria de saber mais sobre os procedimentos de rejuvenescimento.'),
    (default_tenant_id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ai', 'whatsapp', 'Olá Caio! Com certeza. Temos diversos tratamentos modernos. Você tem interesse em algum específico, como bioestimuladores ou preenchimento?'),
    (default_tenant_id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'lead', 'instagram', 'Vi o post sobre PMMA e fiquei interessada.'),
    (default_tenant_id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'ai', 'instagram', 'Olá Beatriz! O preenchimento com cimento cirúrgico (PMMA) é excelente para volumização definitiva. Gostaria de agendar uma avaliação cortesia?');

    -- 6. Configuração da IA Inicial
    INSERT INTO public.ai_settings (tenant_id, system_prompt, temperature, pause_trigger_phrases) VALUES
    (default_tenant_id, 'Você é um assistente virtual especializado em estética avançada. Seja profissional, empático e focado em converter o lead para uma avaliação presencial.', 0.7, ARRAY['falar com atendente', 'humano', 'pessoa'])
    ON CONFLICT (tenant_id) DO NOTHING;

END $$;

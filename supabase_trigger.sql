-- Habilita a extensão pg_net para fazer requisições HTTP (se não estiver habilitada)
create extension if not exists pg_net;

-- Cria a função que será acionada pela trigger
create or replace function public.notify_n8n_ai_agent()
returns trigger
language plpgsql
security definer
as $$
declare
  request_id bigint;
begin
  -- Só chama o Agente se a mensagem for de um cliente (inbound)
  if NEW.direction = 'in' then
    select
      net.http_post(
        url:='https://n8n-n8n.rh3fr2.easypanel.host/webhook/b705693e-ddc4-4aea-98a3-16c742e1738e',
        headers:='{"Content-Type": "application/json"}'::jsonb,
        body:=jsonb_build_object(
          'id', NEW.id,
          'contact_id', NEW.contact_id,
          'channel_id', NEW.channel_id,
          'user_message', NEW.content,
          'direction', NEW.direction
        )
      ) into request_id;
  end if;
  return NEW;
end;
$$;

-- Remove a trigger se ela já existir para evitar duplicidade
drop trigger if exists trg_notify_n8n_ai_agent on public.messages;

-- Cria a trigger para rodar sempre após um insert na tabela messages
create trigger trg_notify_n8n_ai_agent
after insert on public.messages
for each row execute function public.notify_n8n_ai_agent();

-- Disparo do coletor pelo Supabase (no lugar do agendamento do GitHub, que demora a
-- começar e atrasa/pula execuções).
--   * a cada 5 min (pg_cron)
--   * na hora em que a página pede um histórico (trigger em loc_pedidos)
-- O Supabase chama a API do GitHub (pg_net) com uma chave guardada no Vault.
--
-- ANTES DE RODAR: troque COLE_A_CHAVE_AQUI (linha abaixo) pela chave do GitHub.
-- Pode rodar de novo (ex.: para trocar a chave quando ela vencer).

do $$
declare
  chave text := 'COLE_A_CHAVE_AQUI';
  existente uuid;
begin
  if chave = 'COLE_A_CHAVE_AQUI' then
    raise exception 'troque COLE_A_CHAVE_AQUI pela chave do GitHub antes de rodar';
  end if;
  select id into existente from vault.secrets where name = 'github_token_coletor';
  if existente is null then
    perform vault.create_secret(chave, 'github_token_coletor', 'GitHub: só dispara o workflow do coletor de localização');
  else
    perform vault.update_secret(existente, chave);
  end if;
end $$;

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- tudo que dispara fica fora do schema exposto pela API: a página não alcança
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.coletor_disparo (
  id smallint primary key default 1 check (id = 1),
  ultimo timestamptz
);
insert into private.coletor_disparo (id) values (1) on conflict do nothing;

create or replace function private.disparar_coletor()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok text;
  ult timestamptz;
begin
  -- vários pedidos seguidos = um disparo só (o workflow ainda enfileira no máximo 1)
  select ultimo into ult from private.coletor_disparo where id = 1 for update;
  if ult is not null and now() - ult < interval '20 seconds' then
    return;
  end if;
  select decrypted_secret into tok from vault.decrypted_secrets where name = 'github_token_coletor';
  if tok is null then
    raise warning 'github_token_coletor não está no Vault';
    return;
  end if;
  perform net.http_post(
    url := 'https://api.github.com/repos/GrupoGps-Mecanizada/Monitoramento-De-Produtividade/actions/workflows/coletor.yml/dispatches',
    body := jsonb_build_object('ref', 'main'),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || tok,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'supabase-coletor-localizacao',
      'Content-Type', 'application/json'
    )
  );
  update private.coletor_disparo set ultimo = now() where id = 1;
end $$;
revoke execute on function private.disparar_coletor() from public, anon, authenticated;

-- pedido de histórico novo: dispara na hora (resposta em ~1 min em vez de até 5)
create or replace function private.ao_pedir_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.disparar_coletor();
  return new;
end $$;
revoke execute on function private.ao_pedir_historico() from public, anon, authenticated;

drop trigger if exists loc_pedidos_dispara_coletor on public.loc_pedidos;
create trigger loc_pedidos_dispara_coletor
  after insert on public.loc_pedidos
  for each row execute function private.ao_pedir_historico();

-- a cada 5 min
select cron.unschedule(jobid) from cron.job where jobname = 'coletor-localizacao';
select cron.schedule('coletor-localizacao', '*/5 * * * *', 'select private.disparar_coletor()');

-- conferência
select jobname, schedule, active from cron.job where jobname = 'coletor-localizacao';

-- Mapa de análise: uma linha por parada dos últimos 30 dias (só fatos; as regras ficam no site, src/lib/dominio/).
-- Grava: o PC (automation/historico/enviar.js) e, depois, o coletor - sempre com a chave secreta. A página só lê.
-- Rodar no SQL Editor do PRODUTIVIDADE. Pode rodar de novo.

create table if not exists public.analise_paradas (
  id bigint generated always as identity primary key,
  dia date not null,                      -- dia local (America/Sao_Paulo)
  veiculo_id text not null,               -- id do veículo no GAUSS
  placa text not null,
  ini integer not null check (ini between 0 and 86400),  -- segundos do dia
  fim integer not null check (fim between 0 and 86400),
  lat double precision not null,
  lng double precision not null,
  area text,                              -- cerca do GAUSS (a menor); null = fora das cercas
  motor jsonb not null default '{}'::jsonb,  -- minutos de cada status do motor do GAUSS na parada
  apont text[] not null default '{}',     -- categorias do tablet que cobrem a parada
  gravado_em timestamptz not null default now(),
  unique (dia, veiculo_id, ini)
);
create index if not exists analise_paradas_dia on public.analise_paradas (dia);

alter table public.analise_paradas enable row level security;
revoke all on public.analise_paradas from anon, authenticated;
grant select on public.analise_paradas to anon, authenticated;
drop policy if exists "analise_paradas: leitura pública" on public.analise_paradas;
create policy "analise_paradas: leitura pública" on public.analise_paradas
  for select to anon, authenticated using (true);

-- guarda no máximo 30 dias (decisão do dono, 08/10/2026): limpa todo dia às 00:15 de Brasília.
-- Só cria o agendamento se ele ainda não existe: o supabase/tempo-real.sql o troca por um que limpa também as
-- tabelas novas, e rodar este arquivo de novo não pode desfazer isso.
create extension if not exists pg_cron;
select cron.schedule('analise-limpeza', '15 3 * * *',
  $$delete from public.analise_paradas where dia < (now() at time zone 'America/Sao_Paulo')::date - 30$$)
where not exists (select 1 from cron.job where jobname = 'analise-limpeza');

-- conferência
select jobname, schedule, active from cron.job where jobname = 'analise-limpeza';

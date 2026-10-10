-- Puxador em tempo real (08/10/2026): posições de cada ciclo, origem das paradas e excessos de velocidade.
-- Rodar no SQL Editor do PRODUTIVIDADE DEPOIS do supabase/analise.sql. Pode rodar de novo.

-- paradas: "ao_vivo" (posições de 5 em 5 min, hoje) ou "rota" (rota completa, de madrugada)
alter table public.analise_paradas add column if not exists fonte text not null default 'rota';
alter table public.analise_paradas drop constraint if exists analise_paradas_fonte;
alter table public.analise_paradas add constraint analise_paradas_fonte check (fonte in ('ao_vivo', 'rota'));

-- posição de cada equipamento da frota a cada ciclo do coletor (só hoje e ontem; só o coletor lê)
create table if not exists public.loc_posicoes (
  veiculo_id text not null,
  t timestamptz not null,
  dia date not null,
  lat double precision not null,
  lng double precision not null,
  primary key (veiculo_id, t)
);
create index if not exists loc_posicoes_dia on public.loc_posicoes (dia);
alter table public.loc_posicoes enable row level security;
revoke all on public.loc_posicoes from anon, authenticated;

-- excessos de velocidade dentro da usina (rota completa, de madrugada)
create table if not exists public.analise_excessos (
  id bigint generated always as identity primary key,
  dia date not null,
  veiculo_id text not null,
  ini integer not null,
  fim integer not null,
  vel_max real not null,
  lat double precision not null,
  lng double precision not null,
  unique (dia, veiculo_id, ini)
);
create index if not exists analise_excessos_dia on public.analise_excessos (dia);
alter table public.analise_excessos enable row level security;
revoke all on public.analise_excessos from anon, authenticated;
grant select on public.analise_excessos to anon, authenticated;
drop policy if exists "analise_excessos: leitura pública" on public.analise_excessos;
create policy "analise_excessos: leitura pública" on public.analise_excessos for select to anon, authenticated using (true);

-- limpeza diária: 30 dias de paradas e excessos, 2 dias de posições
select cron.unschedule(jobid) from cron.job where jobname = 'analise-limpeza';
select cron.schedule('analise-limpeza', '15 3 * * *', $$
  delete from public.analise_paradas where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  delete from public.analise_excessos where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  delete from public.loc_posicoes where dia < (now() at time zone 'America/Sao_Paulo')::date - 2;
$$);
select jobname, schedule, active from cron.job where jobname = 'analise-limpeza';

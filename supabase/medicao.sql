-- Medição do GAUSS (Fase 1): boletins FECHADOS, só GPS. Grava só o coletor (chave secreta); o site só lê.
-- Sem valores em R$ e sem nomes de pessoas (o site é aberto). Pode rodar de novo.
-- Desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md (ajustes no plano 2026-10-13-medicao-oficial.md)
create table if not exists public.medicao_boletim (
  cod text primary key,
  identificacao text not null,
  inicio date not null,
  fim date not null,
  -- o boletim entra primeiro (as outras tabelas apontam para ele) e só vira completo depois de gravado por inteiro
  completo boolean not null default false,
  baixado_em timestamptz not null default now()
);
alter table public.medicao_boletim add column if not exists completo boolean not null default false;

-- horas_regime, horas_indisp e df: campos oficiais do boletim. Motivos: soma dos eventos da vaga
-- (o campo de área de manutenção do GAUSS às vezes passa do total). Tipo desconhecido vai para "outros".
create table if not exists public.medicao_boletim_vaga (
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  vaga text not null,
  regime text,
  horas_regime numeric not null,
  horas_indisp numeric not null,
  df numeric not null,
  ausencia_operador numeric not null default 0,
  area_manutencao numeric not null default 0,
  fora_planta numeric not null default 0,
  trajeto numeric not null default 0,
  cartao_rfid numeric not null default 0,
  lancada numeric not null default 0,
  motor_desligado numeric not null default 0,
  parado_ligado numeric not null default 0,
  outros numeric not null default 0,
  primary key (boletim_cod, vaga_id)
);
alter table public.medicao_boletim_vaga add column if not exists outros numeric not null default 0;

create table if not exists public.medicao_indisp_evento (
  id bigint generated always as identity primary key,
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  placa text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  tipo text not null,
  horas numeric not null,
  unique (boletim_cod, vaga_id, placa, inicio, tipo)
);
create index if not exists medicao_indisp_evento_vaga on public.medicao_indisp_evento (boletim_cod, vaga_id);

create table if not exists public.medicao_vaga_dia (
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  dia date not null,
  placas text,
  horas_regime numeric not null,
  horas_indisp numeric not null,
  primary key (boletim_cod, vaga_id, dia)
);

-- leitura pública (decisão do dono, 10/10/2026); fechar com o login da Central na Fase 3 do portal
do $$
declare t text;
begin
  foreach t in array array['medicao_boletim', 'medicao_boletim_vaga', 'medicao_indisp_evento', 'medicao_vaga_dia'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('drop policy if exists "%s: leitura pública" on public.%I', t, t);
    execute format('create policy "%s: leitura pública" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- conferência
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'medicao_%' order by 1;

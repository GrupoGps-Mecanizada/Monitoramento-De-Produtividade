-- Alertas da frota (15/10/2026, P-026) - Supabase PRODUTIVIDADE
--
-- Cada exceção do dia vira UM alerta (chave única), com nota 0-100 que decide se vai ao WhatsApp, ao resumo
-- diário ou só à tela. Desenho: docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md
-- O coletor grava com a chave secreta (ignora o RLS). A página só lê. Telefones não são públicos.
-- Pode rodar de novo.

-- Configuração de cada regra das Exceções do dia (src/lib/dominio/excecoes.ts, REGRAS)
create table if not exists public.alerta_regra (
  regra text primary key,
  ativa boolean not null default true,
  peso int not null check (peso between 0 and 100),
  faixas jsonb not null default '[]'::jsonb,          -- [{ "acima_min": 15, "pontos": 30 }, ...]
  justificativas jsonb not null default '{}'::jsonb,  -- { "manutencao": 40, ... } (família -> pontos a tirar)
  espera_min int not null default 10 check (espera_min between 0 and 240),
  lembrete_min int not null default 120 check (lembrete_min between 15 and 1440),
  escalar_min int check (escalar_min between 5 and 1440),
  atualizado_em timestamptz not null default now()
);

-- Cortes do filtro (uma linha só)
create table if not exists public.alerta_politica (
  id int primary key default 1 check (id = 1),
  corte_whatsapp int not null default 60 check (corte_whatsapp between 0 and 100),
  corte_resumo int not null default 30 check (corte_resumo between 0 and 100),
  corte_coordenador int not null default 85 check (corte_coordenador between 0 and 100),
  max_por_hora int not null default 6 check (max_por_hora between 1 and 60),
  modo_teste boolean not null default true,
  resumo_hora time not null default '07:00',
  atualizado_em timestamptz not null default now()
);

-- Quem recebe (telefone = dado pessoal: sem leitura pública)
create table if not exists public.alerta_destino (
  id bigint generated always as identity primary key,
  nome text not null check (length(trim(nome)) between 2 and 60),
  telefone text check (telefone ~ '^[0-9]{12,13}$'),  -- 55 + DDD + número, só dígitos
  grupo_id text,
  tipo text not null check (tipo in ('grupo', 'supervisor', 'coordenador', 'teste')),
  supervisor text,                                     -- nome como em supervisor-vaga.ts ("Junior Pereira")
  regras text[] not null default '{}',                 -- vazio = todas
  nao_perturbe_ini time,
  nao_perturbe_fim time,
  resumo_diario boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  check (telefone is not null or grupo_id is not null)
);

-- Silenciar um equipamento, uma regra ou os dois juntos até uma data
create table if not exists public.alerta_silencio (
  id bigint generated always as identity primary key,
  veiculo_id text,
  regra text,
  motivo text not null check (length(trim(motivo)) between 2 and 200),
  ate timestamptz not null,
  criado_em timestamptz not null default now(),
  check (veiculo_id is not null or regra is not null)
);

-- Um registro por ocorrência: chave = regra|veiculo|dia|ref (ref = horário estável da exceção, em segundos do dia)
create table if not exists public.alertas (
  id bigint generated always as identity primary key,
  chave text not null unique,
  regra text not null,
  veiculo_id text not null,
  placa text not null,
  vaga text not null default '',
  supervisor text,
  dia date not null,
  ini int not null,                 -- segundos do dia
  fim int,
  ref int not null,
  local text,
  detalhe text not null,
  situacao text not null default 'aberto' check (situacao in ('aberto', 'visto', 'resolvido', 'silenciado')),
  nota int not null check (nota between 0 and 100),
  motivos jsonb not null default '[]'::jsonb,
  destino text not null check (destino in ('whatsapp', 'resumo', 'tela')),
  avaliacao text check (avaliacao in ('problema', 'nao_era_problema')),
  contagem int not null default 1,
  visto_por text,
  visto_em timestamptz,
  resolvido_em timestamptz,
  ultimo_aviso_em timestamptz,
  detectado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists alertas_dia_idx on public.alertas (dia desc, situacao);
create index if not exists alertas_regra_vaga_idx on public.alertas (regra, vaga, dia);

-- Fila do WhatsApp (usada na etapa 3)
create table if not exists public.alerta_envios (
  id bigint generated always as identity primary key,
  destino_id bigint not null references public.alerta_destino (id),
  tipo text not null check (tipo in ('alerta', 'lembrete', 'escala', 'resumo')),
  chave text unique,                -- resumo|dia|destino: o resumo não duplica
  alertas bigint[] not null default '{}',
  texto text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'descartado', 'erro')),
  tentativas int not null default 0,
  erro text,
  enviar_apos timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists alerta_envios_status_idx on public.alerta_envios (status, enviar_apos);

-- RLS: a página lê alertas e configuração; destino e fila só o coletor/enviador (chave secreta)
alter table public.alerta_regra enable row level security;
alter table public.alerta_politica enable row level security;
alter table public.alerta_destino enable row level security;
alter table public.alerta_silencio enable row level security;
alter table public.alertas enable row level security;
alter table public.alerta_envios enable row level security;

drop policy if exists alerta_regra_ler on public.alerta_regra;
create policy alerta_regra_ler on public.alerta_regra for select to anon, authenticated using (true);
drop policy if exists alerta_politica_ler on public.alerta_politica;
create policy alerta_politica_ler on public.alerta_politica for select to anon, authenticated using (true);
drop policy if exists alerta_silencio_ler on public.alerta_silencio;
create policy alerta_silencio_ler on public.alerta_silencio for select to anon, authenticated using (true);
drop policy if exists alertas_ler on public.alertas;
create policy alertas_ler on public.alertas for select to anon, authenticated using (true);

grant select on public.alerta_regra, public.alerta_politica, public.alerta_silencio, public.alertas to anon, authenticated;
revoke all on public.alerta_destino, public.alerta_envios from anon, authenticated;

-- Padrões (spec 7A). "on conflict do nothing": rodar de novo não desfaz o que o gestor mudou na tela.
insert into public.alerta_politica (id) values (1) on conflict (id) do nothing;
insert into public.alerta_regra (regra, peso, faixas, justificativas) values
  ('saida_tarde', 35, '[{"acima_min":15,"pontos":30},{"acima_min":30,"pontos":55}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('chegada_cedo', 35, '[{"acima_min":15,"pontos":30},{"acima_min":30,"pontos":55}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('desligado', 40, '[{"acima_min":60,"pontos":25},{"acima_min":120,"pontos":45},{"acima_min":180,"pontos":60}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('patio', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('restaurante', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('ocioso', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('bica_vacuo', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('velocidade', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('servitec', 0, '[]', '{}'),
  ('oficina_fora', 0, '[]', '{}')
on conflict (regra) do nothing;

-- Conferência: 10 regras, 1 política e os alertas de hoje
select (select count(*) from public.alerta_regra) as regras,
       (select count(*) from public.alerta_politica) as politica,
       (select count(*) from public.alertas where dia = current_date) as alertas_hoje;

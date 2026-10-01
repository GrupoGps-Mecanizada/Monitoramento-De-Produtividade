-- Monitoramento de Localização - estrutura no Supabase PRODUTIVIDADE
--
-- Fluxo: coletor (GitHub Actions, a cada ~5 min, chave secreta) consulta o GAUSS e
-- grava aqui; a página (GitHub Pages, chave publishable) só LÊ, e pode PEDIR o
-- histórico de um veículo (loc_pedidos), que o coletor atende no ciclo seguinte.
--
-- Pode rodar de novo sem problema (idempotente). Cole no SQL Editor do projeto.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

-- Valores únicos por chave:
--   snapshot  retrato atual da frota que a página mostra (público)
--   cercas    polígonos das cercas do GAUSS (público)
--   estado    estado interno do coletor, para detectar eventos (privado)
--   veiculos  cadastro do filtro do GAUSS (privado)
--   sessao    sessão do GAUSS reaproveitada entre execuções (privado - nunca expor)
--   carga     contador diário de requisições ao GAUSS (privado; vai no snapshot)
create table if not exists public.loc_kv (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Entrada/saída de área, mudança de status, perda/retorno de sinal.
create table if not exists public.loc_eventos (
  id bigint generated always as identity primary key,
  dia date not null,              -- dia local (America/Sao_Paulo)
  t timestamptz not null,
  tipo text not null check (tipo in ('entrada', 'saida', 'status', 'sinal_perdido', 'sinal_retomado')),
  veiculo_id text not null,
  dados jsonb not null,
  criado_em timestamptz not null default now()
);
create index if not exists loc_eventos_dia_t_idx on public.loc_eventos (dia, t desc);

-- Rota do GAUSS de um veículo num dia (cache) + apontamento já calculado.
-- Dia "fechado" nunca é baixado de novo.
create table if not exists public.loc_historico (
  veiculo_id text not null,
  dia date not null,
  pontos jsonb not null default '[]'::jsonb,   -- pontos crus do GAUSS (só o coletor lê)
  fechado boolean not null default false,
  baixado_em timestamptz not null default now(),
  resultado jsonb,                              -- apontamento pronto para a página
  primary key (veiculo_id, dia)
);

-- Pedidos de histórico feitos pela página.
create table if not exists public.loc_pedidos (
  id bigint generated always as identity primary key,
  veiculo_id text not null check (veiculo_id ~ '^[0-9]{1,12}$'),
  dia date not null,
  status text not null default 'pendente' check (status in ('pendente', 'processando', 'pronto', 'erro')),
  erro text,
  criado_em timestamptz not null default now(),
  atendido_em timestamptz
);
create index if not exists loc_pedidos_fila_idx on public.loc_pedidos (status, criado_em);
create index if not exists loc_pedidos_veiculo_dia_idx on public.loc_pedidos (veiculo_id, dia, criado_em desc);
-- um pedido em aberto por veículo/dia: clicar várias vezes não enche a fila
create unique index if not exists loc_pedidos_em_aberto_uq
  on public.loc_pedidos (veiculo_id, dia) where status in ('pendente', 'processando');

-- Dias com eventos (seletor de dia da página).
create or replace view public.loc_dias with (security_invoker = true) as
  select distinct dia from public.loc_eventos;

-- ---------------------------------------------------------------------------
-- Acesso: a página é pública (decisão do usuário em 01/10/2026). Mínimo necessário:
-- ler retrato/cercas/eventos/apontamentos e criar pedido de histórico.
-- O coletor usa a chave secreta (service_role), que ignora RLS.
-- ---------------------------------------------------------------------------
alter table public.loc_kv enable row level security;
alter table public.loc_eventos enable row level security;
alter table public.loc_historico enable row level security;
alter table public.loc_pedidos enable row level security;

revoke all on public.loc_kv, public.loc_eventos, public.loc_historico, public.loc_pedidos, public.loc_dias
  from anon, authenticated;

grant select on public.loc_kv, public.loc_eventos, public.loc_pedidos, public.loc_dias to anon, authenticated;
-- os pontos crus (pesados) ficam de fora: a página só precisa do resultado
grant select (veiculo_id, dia, fechado, baixado_em, resultado) on public.loc_historico to anon, authenticated;
grant insert (veiculo_id, dia) on public.loc_pedidos to anon, authenticated;

drop policy if exists "loc_kv: leitura pública do retrato e cercas" on public.loc_kv;
create policy "loc_kv: leitura pública do retrato e cercas" on public.loc_kv
  for select to anon, authenticated using (chave in ('snapshot', 'cercas'));

drop policy if exists "loc_eventos: leitura pública" on public.loc_eventos;
create policy "loc_eventos: leitura pública" on public.loc_eventos
  for select to anon, authenticated using (true);

drop policy if exists "loc_historico: leitura pública" on public.loc_historico;
create policy "loc_historico: leitura pública" on public.loc_historico
  for select to anon, authenticated using (true);

drop policy if exists "loc_pedidos: leitura pública" on public.loc_pedidos;
create policy "loc_pedidos: leitura pública" on public.loc_pedidos
  for select to anon, authenticated using (true);

drop policy if exists "loc_pedidos: página pede histórico" on public.loc_pedidos;
create policy "loc_pedidos: página pede histórico" on public.loc_pedidos
  for insert to anon, authenticated
  with check (status = 'pendente' and dia between current_date - 90 and current_date);

-- ---------------------------------------------------------------------------
-- Realtime: a página atualiza sozinha quando o coletor grava
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['loc_kv', 'loc_eventos', 'loc_pedidos'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- conferência: deve listar as 4 tabelas com RLS ligado
select c.relname as tabela, c.relrowsecurity as rls_ligado
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname like 'loc\_%' and c.relkind = 'r'
order by 1;

-- Matriz de equipamentos (05/10/2026) - Supabase PRODUTIVIDADE
--
-- A lista da frota da Mecanizada deixa de ficar escrita no código: o coletor e o site leem daqui.
-- Cada equipamento tem status (ATIVO, EM_MANUTENCAO, DESMOBILIZADO), supervisor e regime.
--   ATIVO e EM_MANUTENCAO aparecem no Monitoramento; DESMOBILIZADO sai do mapa, da Timeline e dos alertas.
-- Ler é público (a página é pública); gravar só quem fez login E está em frota_editor.
-- Cada mudança fica em frota_equipamento_historico (quem, quando, de -> para).
--
-- Pode rodar de novo sem problema (idempotente). A carga inicial só entra se a tabela estiver vazia.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table if not exists public.frota_supervisor (
  id bigint generated always as identity primary key,
  nome text not null unique check (length(trim(nome)) between 2 and 60),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.frota_regime (
  id bigint generated always as identity primary key,
  nome text not null unique check (length(trim(nome)) between 2 and 40),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.frota_equipamento (
  id bigint generated always as identity primary key,
  -- ap Alta Pressão · av Alto Vácuo · hv Hiper Vácuo · uv Ultravac · pg Poliguindaste (Brook) · as Aspirador
  tipo text not null check (tipo in ('ap', 'av', 'hv', 'uv', 'pg', 'as')),
  -- caminhão: a placa como a planilha escreve ("EGC-2985"); aspirador: o número da vaga no GAUSS
  placa text check (placa is null or placa ~ '^[A-Za-z0-9-]{4,10}$'),
  placa_norm text generated always as (upper(regexp_replace(placa, '[^A-Za-z0-9]', '', 'g'))) stored,
  numero integer check (numero between 1 and 99),
  -- código usado pela equipe ("AP 01", "AV 08"); opcional
  codigo text check (codigo is null or length(codigo) <= 30),
  status text not null default 'ATIVO' check (status in ('ATIVO', 'EM_MANUTENCAO', 'DESMOBILIZADO')),
  supervisor_id bigint references public.frota_supervisor (id),
  regime_id bigint references public.frota_regime (id),
  observacao text check (observacao is null or length(observacao) <= 500),
  -- posição na planilha dentro do tipo
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  -- quem mudou fica só no histórico (só editor lê): a matriz é pública e não mostra e-mail
  atualizado_em timestamptz not null default now(),
  constraint frota_equipamento_identificacao check ((tipo = 'as' and numero is not null) or (tipo <> 'as' and placa is not null))
);
create unique index if not exists frota_equipamento_placa_uq on public.frota_equipamento (placa_norm) where placa is not null;
create unique index if not exists frota_equipamento_aspirador_uq on public.frota_equipamento (numero) where tipo = 'as';
create index if not exists frota_equipamento_supervisor_idx on public.frota_equipamento (supervisor_id);
create index if not exists frota_equipamento_regime_idx on public.frota_equipamento (regime_id);

create table if not exists public.frota_equipamento_historico (
  id bigint generated always as identity primary key,
  equipamento_id bigint not null references public.frota_equipamento (id) on delete cascade,
  em timestamptz not null default now(),
  por text,
  -- {"campo": {"de": ..., "para": ...}}; no cadastro: {"novo": true}
  mudancas jsonb not null
);
create index if not exists frota_equipamento_historico_equip_idx on public.frota_equipamento_historico (equipamento_id, em desc);

-- quem pode editar (login do Supabase Auth). Para liberar alguém:
--   insert into public.frota_editor (usuario_id, email) select id, email from auth.users where email = 'pessoa@exemplo.com';
create table if not exists public.frota_editor (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gatilhos: quando mudou e histórico com quem mudou (esquema privado, fora da API)
-- ---------------------------------------------------------------------------
create schema if not exists frota_priv;
revoke all on schema frota_priv from public, anon, authenticated;

create or replace function frota_priv.carimbar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- security definer: o histórico não tem permissão de gravação para ninguém, só este gatilho grava
create or replace function frota_priv.registrar_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  mud jsonb := '{}'::jsonb;
  campo text;
begin
  if tg_op = 'INSERT' then
    mud := jsonb_build_object('novo', true);
  else
    foreach campo in array array['tipo', 'placa', 'numero', 'codigo', 'status', 'supervisor_id', 'regime_id', 'observacao', 'ordem'] loop
      if (to_jsonb(old) -> campo) is distinct from (to_jsonb(new) -> campo) then
        mud := mud || jsonb_build_object(campo, jsonb_build_object('de', to_jsonb(old) -> campo, 'para', to_jsonb(new) -> campo));
      end if;
    end loop;
    if mud = '{}'::jsonb then return new; end if;
  end if;
  insert into public.frota_equipamento_historico (equipamento_id, por, mudancas) values (new.id, coalesce(auth.jwt() ->> 'email', 'sistema'), mud);
  return new;
end;
$$;
revoke all on function frota_priv.carimbar(), frota_priv.registrar_historico() from public, anon, authenticated;

drop trigger if exists frota_equipamento_carimbo on public.frota_equipamento;
create trigger frota_equipamento_carimbo before insert or update on public.frota_equipamento
  for each row execute function frota_priv.carimbar();
drop trigger if exists frota_equipamento_historico on public.frota_equipamento;
create trigger frota_equipamento_historico after insert or update on public.frota_equipamento
  for each row execute function frota_priv.registrar_historico();

-- ---------------------------------------------------------------------------
-- Acesso
-- ---------------------------------------------------------------------------
alter table public.frota_supervisor enable row level security;
alter table public.frota_regime enable row level security;
alter table public.frota_equipamento enable row level security;
alter table public.frota_equipamento_historico enable row level security;
alter table public.frota_editor enable row level security;

revoke all on public.frota_supervisor, public.frota_regime, public.frota_equipamento,
  public.frota_equipamento_historico, public.frota_editor from anon, authenticated;

grant select on public.frota_supervisor, public.frota_regime, public.frota_equipamento to anon, authenticated;
grant insert (tipo, placa, numero, codigo, status, supervisor_id, regime_id, observacao, ordem),
      update (tipo, placa, numero, codigo, status, supervisor_id, regime_id, observacao, ordem)
  on public.frota_equipamento to authenticated;
grant insert (nome, ativo), update (nome, ativo) on public.frota_supervisor, public.frota_regime to authenticated;
grant select on public.frota_equipamento_historico, public.frota_editor to authenticated;

-- leitura pública
drop policy if exists "frota_equipamento: leitura pública" on public.frota_equipamento;
create policy "frota_equipamento: leitura pública" on public.frota_equipamento for select to anon, authenticated using (true);
drop policy if exists "frota_supervisor: leitura pública" on public.frota_supervisor;
create policy "frota_supervisor: leitura pública" on public.frota_supervisor for select to anon, authenticated using (true);
drop policy if exists "frota_regime: leitura pública" on public.frota_regime;
create policy "frota_regime: leitura pública" on public.frota_regime for select to anon, authenticated using (true);

-- cada um vê só a própria linha de editor (a página usa para saber se mostra os botões de editar)
drop policy if exists "frota_editor: a própria linha" on public.frota_editor;
create policy "frota_editor: a própria linha" on public.frota_editor for select to authenticated
  using (usuario_id = (select auth.uid()));

-- gravar e ver o histórico: só editor
drop policy if exists "frota_equipamento: editor cadastra" on public.frota_equipamento;
create policy "frota_equipamento: editor cadastra" on public.frota_equipamento for insert to authenticated
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_equipamento: editor altera" on public.frota_equipamento;
create policy "frota_equipamento: editor altera" on public.frota_equipamento for update to authenticated
  using (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())))
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_supervisor: editor cadastra" on public.frota_supervisor;
create policy "frota_supervisor: editor cadastra" on public.frota_supervisor for insert to authenticated
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_supervisor: editor altera" on public.frota_supervisor;
create policy "frota_supervisor: editor altera" on public.frota_supervisor for update to authenticated
  using (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())))
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_regime: editor cadastra" on public.frota_regime;
create policy "frota_regime: editor cadastra" on public.frota_regime for insert to authenticated
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_regime: editor altera" on public.frota_regime;
create policy "frota_regime: editor altera" on public.frota_regime for update to authenticated
  using (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())))
  with check (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));
drop policy if exists "frota_equipamento_historico: editor lê" on public.frota_equipamento_historico;
create policy "frota_equipamento_historico: editor lê" on public.frota_equipamento_historico for select to authenticated
  using (exists (select 1 from public.frota_editor e where e.usuario_id = (select auth.uid())));

-- Realtime: a matriz e o mapa atualizam sozinhos quando alguém edita
do $$
declare t text;
begin
  foreach t in array array['frota_equipamento', 'frota_supervisor', 'frota_regime'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Carga inicial: planilha "PLACAS VEICULOS.xlsx" (LOCAÇÃO - GPS) de 05/10/2026
-- ---------------------------------------------------------------------------
insert into public.frota_regime (nome)
values ('ADM'), ('4X4 - A'), ('4X4 - B'), ('4X4 - C'), ('4X4 - D'), ('16H - 5X2'), ('16H - 6X3')
on conflict (nome) do nothing;

-- supervisores ativos do SST - Mecanizada
insert into public.frota_supervisor (nome)
values ('DONIZETE'), ('FÁBIO'), ('GENESIO'), ('ISRAEL'), ('JUNIOR'), ('MATUSALEM'), ('OZIAS')
on conflict (nome) do nothing;

do $$
begin
  if exists (select 1 from public.frota_equipamento) then return; end if;
  insert into public.frota_equipamento (tipo, placa, ordem)
  select 'ap', p, o from unnest(array['CZC-0453', 'DSY-6472', 'DSY-6474', 'DSY-6475', 'EAM-3253', 'EAM-3255', 'EAM-3256',
    'EAM-3262', 'EGC-2978', 'EGC-2983', 'EGC-2985', 'EGC-2989', 'EZS-8764', 'PUB-2F80']) with ordinality as x(p, o);
  insert into public.frota_equipamento (tipo, placa, ordem)
  select 'av', p, o from unnest(array['ALY-5322', 'ANF-2676', 'CUB-0763', 'DSY-6473', 'DSY-6577', 'DYB-7210', 'EAM-3251',
    'EAM-3257', 'EGC-2993', 'FSA-3D71', 'HJS-1097']) with ordinality as x(p, o);
  insert into public.frota_equipamento (tipo, placa, ordem)
  select 'pg', p, o from unnest(array['DSY-6477', 'EGC-2984', 'EPN-2463']) with ordinality as x(p, o);
  insert into public.frota_equipamento (tipo, placa, ordem)
  select 'hv', p, o from unnest(array['DSY-6471', 'EGC-1875', 'FMD-2200', 'FHD-9264']) with ordinality as x(p, o);
  insert into public.frota_equipamento (tipo, numero, ordem) select 'as', n, n from generate_series(1, 10) n;
  -- estava no código antigo (Ultravac) e não está na planilha de 05/10: fica guardado, fora do monitoramento
  insert into public.frota_equipamento (tipo, placa, ordem, status, observacao)
  values ('uv', 'OWU-1596', 1, 'DESMOBILIZADO', 'Não está na planilha de 05/10/2026');
end $$;

-- conferência: 43 equipamentos (42 da planilha + o Ultravac desmobilizado)
select tipo, status, count(*) from public.frota_equipamento group by 1, 2 order by 1, 2;

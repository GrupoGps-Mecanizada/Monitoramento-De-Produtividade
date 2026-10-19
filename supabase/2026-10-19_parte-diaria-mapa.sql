-- Parte Diária × mapa (P-056): o banco aprende sozinho onde fica cada local da Parte Diária e confere cada
-- programação (cumprida, parcial, local diferente, não foi...). Tudo no banco, sem chamada nova ao GAUSS.
-- Projeto PRODUTIVIDADE. Pode rodar de novo. Roda sozinho a cada hora (pg_cron "parte-diaria-mapa").
--
-- De onde vem cada coisa:
--   parte_diaria         a programação (coletor, de 3 em 3 h)
--   timeline_motor_vaga  qual caminhão estava na vaga e o motor ligado/desligado
--   loc_posicoes         GPS a cada ~6 min (o banco só guarda 3 dias: por isso as amostras ficam em parte_amostra)
--   loc_kv "cercas"      as áreas desenhadas no GAUSS (viram mapa_area)
-- Sem nomes e sem telefones. Sem acesso público por enquanto.
create extension if not exists postgis with schema extensions;

-- nome sem acento, só letras/números, "02" = "2": casa "ACIARIA 2 (REFINO)" com a área "ACIARIA 02"
create or replace function public.norm_local(s text) returns text language sql immutable as $$
  select regexp_replace(trim(regexp_replace(regexp_replace(upper(translate(coalesce(s, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇºª°', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC   ')),
    '[^A-Z0-9 ]', ' ', 'g'), '\s+', ' ', 'g')), '\m0+(\d)', '\1', 'g')
$$;

create table if not exists public.mapa_area (
  code bigint primary key,
  nome text not null,
  nome_norm text not null,
  tipo text,
  classe text not null,               -- trabalho | via | apoio (base, baia, restaurante) | destino | usina
  geom extensions.geometry not null,
  atualizado_em timestamptz not null default now()
);
create index if not exists mapa_area_geom on public.mapa_area using gist (geom);

create table if not exists public.parte_amostra (
  chave text not null references public.parte_diaria(chave) on delete cascade,
  placa text not null,
  t timestamp not null,               -- hora local
  lat double precision not null,
  lng double precision not null,
  parado boolean not null,            -- andou menos de 40 m desde a posição anterior
  area text,
  classe text,
  primary key (chave, placa, t)
);
create index if not exists parte_amostra_chave on public.parte_amostra (chave);

create table if not exists public.parte_local (
  local text primary key,             -- norm_local(parte_diaria.area)
  nome text not null,
  lat double precision,
  lng double precision,
  raio_m integer,
  area_gauss text,
  ponto_fonte text,
  certeza text not null,              -- alta | média | baixa | várias áreas
  motivo text,
  amostras integer not null default 0,
  programacoes integer not null default 0,
  atualizado_em timestamptz not null default now()
);

create table if not exists public.parte_conferencia (
  chave text primary key references public.parte_diaria(chave) on delete cascade,
  dia date not null,
  vaga_id integer,
  vaga text,
  local text,
  placas text,
  status text not null,
  motivo text,
  chegada timestamp,
  saida timestamp,
  min_programado integer,
  min_no_local integer,
  min_motor_ligado integer,
  local_real text,
  atualizado_em timestamptz not null default now()
);
create index if not exists parte_conferencia_dia on public.parte_conferencia (dia);

do $$
declare t text;
begin
  foreach t in array array['mapa_area', 'parte_amostra', 'parte_local', 'parte_conferencia'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 1) áreas do GAUSS -> polígonos
create or replace function public.mapa_sincronizar_areas() returns integer language plpgsql
set search_path = public, extensions as $$
#variable_conflict use_column
declare n integer;
begin
  insert into public.mapa_area (code, nome, nome_norm, tipo, classe, geom, atualizado_em)
  select code, nome, nn, tipo,
    case when nn = 'PLANTA USIMINAS' then 'usina'
         when nn ~ 'PATIO DO TRANSPORTE RODOVIARIO|BAIA DE RESIDUOS|ESTACIONAMENTO|RESTAURANTE|OFICINA GPS|GARAGEM|ABAST|ALMOXARIFADO|OFICINAS DE VEICULOS|ROTA BROOK|PATIO DAS TRANSPOR|CENTRO DE CONVIVENCIA' then 'apoio'
         when nn ~ 'POCO REDONDO|ATERRO|^CRAL|^CRAME|ETOL|CRARP' then 'destino'
         when tipo = 'via' then 'via'
         else 'trabalho' end,
    geom, now()
  from (
    select (c->>'code')::bigint code, trim(c->>'name') nome, norm_local(c->>'name') nn, c->>'tipo' tipo,
      (select ST_MakeValid(ST_MakePolygon(ST_AddPoint(l, ST_StartPoint(l))))
         from (select ST_MakeLine(array_agg(ST_SetSRID(ST_MakePoint((p->>1)::float, (p->>0)::float), 4326) order by o)) l
                 from jsonb_array_elements(c->'polygon') with ordinality x(p, o)) y) geom
    from public.loc_kv, jsonb_array_elements(valor->'cercas') c
    where chave = 'cercas' and jsonb_array_length(c->'polygon') >= 3
  ) z
  where geom is not null
  on conflict (code) do update set nome = excluded.nome, nome_norm = excluded.nome_norm, tipo = excluded.tipo,
    classe = excluded.classe, geom = excluded.geom, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- 2) amostras do GPS de cada programação (antes que o banco apague as posições)
create or replace function public.parte_coletar_amostras(p_desde date) returns integer language plpgsql
set search_path = public, extensions as $$
#variable_conflict use_column
declare n integer;
begin
  with p as (
    select chave, dia, vaga_id, (dia + inicio::time) ini,
           (dia + case when fim ~ '^\d\d:\d\d$' and fim <> '23:59' then fim::time else time '23:59:59' end) fim
    from public.parte_diaria where dia >= p_desde and inicio ~ '^\d\d:\d\d$'),
  pl as (
    select p.chave, p.dia, replace(t.placa, '-', '') placa, min(greatest(p.ini, t.inicio)) ini, max(least(p.fim, t.fim)) fim
    from p join public.timeline_motor_vaga t on t.vaga_id = p.vaga_id and t.inicio < p.fim and t.fim > p.ini and t.placa is not null
    group by 1, 2, 3),
  v as (
    select distinct on (placa) placa, veiculo_id from (
      select replace(dados->>'placa', '-', '') placa, veiculo_id, t from public.loc_eventos
      where dia >= p_desde - 30 and dados ? 'placa') z
    order by placa, t desc),
  pos as (
    select pl.chave, pl.placa, (lp.t at time zone 'America/Sao_Paulo') tl, lp.lat, lp.lng,
           lag(lp.lat) over w la0, lag(lp.lng) over w lo0
    from pl join v using (placa)
    join public.loc_posicoes lp on lp.veiculo_id = v.veiculo_id and lp.dia between pl.dia - 1 and pl.dia + 1
     and (lp.t at time zone 'America/Sao_Paulo') between pl.ini and pl.fim
    window w as (partition by pl.chave, pl.placa order by lp.t))
  insert into public.parte_amostra (chave, placa, t, lat, lng, parado, area, classe)
  select chave, placa, tl, lat, lng,
    coalesce(111000 * sqrt((lat - la0)^2 + ((lng - lo0) * cos(radians(lat)))^2) < 40, false),
    a.nome, a.classe
  from pos
  left join lateral (
    select nome, classe from public.mapa_area a
    where a.classe <> 'usina' and ST_Contains(a.geom, ST_SetSRID(ST_MakePoint(pos.lng, pos.lat), 4326))
    order by ST_Area(a.geom) limit 1) a on true
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- 3) aprender o ponto de cada local: onde os caminhões param repetidas vezes (sem base, baia, restaurante, destino)
create or replace function public.parte_aprender_locais() returns integer language plpgsql
set search_path = public, extensions as $$
#variable_conflict use_column
declare n integer;
begin
  with loc as (
    select norm_local(area) local, max(area) nome, count(*) progs from public.parte_diaria where area is not null group by 1),
  -- área do GAUSS com o mesmo nome (exato > começa igual > portão N > nome contido)
  nome as (
    select distinct on (loc.local) loc.local, a.code, a.nome area, a.geom,
      case when a.nome_norm = loc.local then 'igual' else 'contido' end como
    from loc join public.mapa_area a on a.classe not in ('usina', 'via') and (
      a.nome_norm = loc.local
      or loc.local like a.nome_norm || ' %' or a.nome_norm like loc.local || ' %'
      or (loc.local ~ '^PORTAO \d+' and a.nome_norm ~ ('^' || substring(loc.local from '^PORTAO \d+') || '( |$)'))
      or (' ' || loc.local || ' ') like ('% ' || a.nome_norm || ' %'))
    where length(a.nome_norm) >= 4
    order by loc.local, (a.nome_norm = loc.local) desc, (loc.local like a.nome_norm || ' %' or a.nome_norm like loc.local || ' %') desc, length(a.nome_norm) desc),
  s as (
    select norm_local(pd.area) local, am.chave, am.lat, am.lng,
      ST_Transform(ST_SetSRID(ST_MakePoint(am.lng, am.lat), 4326), 31983) g
    from public.parte_amostra am join public.parte_diaria pd using (chave)
    where am.parado and (coalesce(am.classe, 'fora') in ('trabalho', 'via', 'fora')
      or norm_local(am.area) = norm_local(pd.area))),
  cl as (select *, ST_ClusterDBSCAN(g, 60, 3) over (partition by local) k from s),
  -- o grupo perto da área de mesmo nome vence; senão, o que mais programações confirmam
  grupo as (
    select distinct on (cl.local) cl.local, count(*) amostras, count(distinct chave) progs,
      ST_Centroid(ST_Collect(cl.g)) c
    from cl left join nome on nome.local = cl.local where k is not null group by cl.local, k, nome.code
    order by cl.local, bool_or(nome.geom is not null and ST_DWithin(cl.g, ST_Transform(nome.geom, 31983), 200)) desc,
      count(distinct chave) desc, count(*) desc),
  gps as (
    select g.local, g.amostras, g.progs, ST_Transform(g.c, 4326) p,
      greatest(30, (select percentile_cont(0.9) within group (order by ST_Distance(cl.g, g.c)) from cl
                     where cl.local = g.local and ST_DWithin(cl.g, g.c, 150)))::int raio
    from grupo g),
  fim as (
    select loc.local, loc.nome, loc.progs total, nome.area, nome.geom, nome.como, gps.p, gps.raio, gps.amostras, gps.progs,
      (select a.nome from public.mapa_area a where gps.p is not null and a.classe <> 'usina' and ST_Contains(a.geom, gps.p)
        order by ST_Area(a.geom) limit 1) area_gps,
      case when gps.p is not null and nome.geom is not null
           then ST_Distance(ST_Transform(gps.p, 31983), ST_Transform(nome.geom, 31983)) end dist
    from loc left join nome using (local) left join gps using (local))
  insert into public.parte_local (local, nome, lat, lng, raio_m, area_gauss, ponto_fonte, certeza, motivo, amostras, programacoes, atualizado_em)
  select local, nome,
    coalesce(ST_Y(p), ST_Y(ST_PointOnSurface(geom))), coalesce(ST_X(p), ST_X(ST_PointOnSurface(geom))),
    coalesce(raio, case when geom is not null then 80 end),
    coalesce(area, area_gps),
    case when p is not null then 'GPS: onde os caminhões param' when geom is not null then 'área do GAUSS' end,
    case when local ~ 'AREAS DIVERSAS|RECOLHIMENTO' then 'várias áreas'
         when p is not null and progs >= 2 and (geom is null or dist <= 150) then 'alta'
         when geom is not null and como = 'igual' and (p is null or dist <= 150) then 'alta'
         when p is not null or geom is not null then 'média'
         else 'baixa' end,
    case when local ~ 'AREAS DIVERSAS|RECOLHIMENTO' then 'o serviço anda pela usina'
         when p is not null and progs >= 2 and geom is not null and dist <= 150 then 'nome igual a uma área do GAUSS e o GPS confirma'
         when p is not null and progs >= 2 and geom is null then format('caminhões parados no mesmo ponto em %s programações', progs)
         when geom is not null and como = 'igual' and p is null then 'nome igual a uma área do GAUSS (o GPS ainda vai confirmar)'
         when p is not null and geom is not null and dist > 150 then format('o GPS mostra os caminhões a %s m da área %s', round(dist), area)
         when geom is not null then format('o nome cita a área %s do GAUSS', area)
         when p is not null then 'só uma programação com GPS até agora'
         else 'ainda sem GPS nem área com esse nome: aprende quando um caminhão for lá' end,
    coalesce(amostras, 0), total, now()
  from fim
  on conflict (local) do update set nome = excluded.nome, lat = excluded.lat, lng = excluded.lng, raio_m = excluded.raio_m,
    area_gauss = excluded.area_gauss, ponto_fonte = excluded.ponto_fonte, certeza = excluded.certeza, motivo = excluded.motivo,
    amostras = excluded.amostras, programacoes = excluded.programacoes, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- 4) conferir cada programação contra o local aprendido
create or replace function public.parte_conferir(p_desde date) returns integer language plpgsql
set search_path = public, extensions as $$
#variable_conflict use_column
declare n integer;
begin
  with p as (
    select pd.chave, pd.dia, pd.vaga_id, pd.vaga, norm_local(pd.area) local, (pd.dia + pd.inicio::time) ini,
           (pd.dia + case when pd.fim ~ '^\d\d:\d\d$' and pd.fim <> '23:59' then pd.fim::time else time '23:59:59' end) fim
    from public.parte_diaria pd where pd.dia >= p_desde and pd.inicio ~ '^\d\d:\d\d$'),
  pl as (
    select p.chave, string_agg(distinct t.placa, ', ') placas,
      round(sum(case when t.status = 'on' then extract(epoch from least(p.fim, t.fim) - greatest(p.ini, t.inicio)) / 60 else 0 end)) motor
    from p join public.timeline_motor_vaga t on t.vaga_id = p.vaga_id and t.inicio < p.fim and t.fim > p.ini
    group by 1),
  am as (
    select p.chave, a.t, a.parado, a.area, a.classe,
      (l.lat is not null and ST_DWithin(ST_SetSRID(ST_MakePoint(a.lng, a.lat), 4326)::geography,
         ST_SetSRID(ST_MakePoint(l.lng, l.lat), 4326)::geography, greatest(coalesce(l.raio_m, 80), 80) + 40)) no_local
    from p join public.parte_amostra a using (chave) left join public.parte_local l on l.local = p.local),
  r as (
    select chave, count(*) n, count(*) filter (where no_local) n_local,
      min(t) filter (where no_local) chegada, max(t) filter (where no_local) saida,
      extract(epoch from max(t) - min(t)) / 60 cobertos,
      mode() within group (order by area) filter (where parado and classe in ('trabalho', 'via')) local_real,
      count(*) filter (where parado and classe in ('trabalho', 'via') and not no_local) n_fora
    from am group by 1),
  x as (
    select p.*, l.lat, l.certeza, pl.placas, pl.motor, r.n, r.n_local, r.chegada, r.saida, r.local_real, r.n_fora,
      round(extract(epoch from p.fim - p.ini) / 60) prog,
      case when r.n > 0 then round(r.n_local::numeric / r.n * greatest(r.cobertos, 5)) else 0 end min_local,
      (now() at time zone 'America/Sao_Paulo') agora
    from p left join public.parte_local l using (local) left join pl using (chave) left join r using (chave))
  insert into public.parte_conferencia (chave, dia, vaga_id, vaga, local, placas, status, motivo, chegada, saida,
    min_programado, min_no_local, min_motor_ligado, local_real, atualizado_em)
  select chave, dia, vaga_id, vaga, local, placas,
    case when agora < ini then 'aguardando'
         when placas is null then 'sem caminhão'
         when coalesce(n, 0) = 0 and dia < date '2026-10-17' then 'sem GPS'
         when coalesce(n, 0) = 0 then 'sem GPS'
         when certeza = 'várias áreas' then 'em rota'
         when lat is null then 'local sem ponto'
         when n_local > 0 and coalesce(motor, 0) = 0 then 'motor desligado'
         when n_local > 0 and chegada <= ini + interval '60 min' and min_local >= 0.4 * least(prog, extract(epoch from least(fim, agora) - ini) / 60) then 'cumprida'
         when n_local > 0 then 'parcial'
         when agora < fim then 'em andamento'
         when n_fora > 0 then 'local diferente'
         else 'não foi' end,
    case when agora < ini then 'ainda não começou'
         when placas is null then 'nenhum caminhão na vaga nesse horário'
         when coalesce(n, 0) = 0 then 'sem posições do GPS para esse horário'
         when certeza = 'várias áreas' then 'serviço em vários lugares: conferido pela rota'
         when lat is null then 'o local ainda não tem ponto no mapa'
         when n_local > 0 then format('no local %s min de %s programados; chegou %s', min_local, prog, to_char(chegada, 'HH24:MI'))
         when n_fora > 0 then format('parado em outro lugar: %s', coalesce(local_real, 'fora das áreas do GAUSS'))
         else 'não passou pelo local' end,
    chegada, saida, prog, min_local, motor, local_real, now()
  from x
  on conflict (chave) do update set status = excluded.status, motivo = excluded.motivo, placas = excluded.placas,
    chegada = excluded.chegada, saida = excluded.saida, min_programado = excluded.min_programado,
    min_no_local = excluded.min_no_local, min_motor_ligado = excluded.min_motor_ligado, local_real = excluded.local_real,
    local = excluded.local, vaga = excluded.vaga, atualizado_em = now();
  get diagnostics n = row_count;
  return n;
end $$;

-- tudo de uma vez (o agendador chama a cada hora)
create or replace function public.parte_atualizar(p_dias integer default 3) returns text language plpgsql
set search_path = public, extensions as $$
declare a integer; b integer; c integer; d integer; desde date := (now() at time zone 'America/Sao_Paulo')::date - p_dias;
begin
  a := public.mapa_sincronizar_areas();
  b := public.parte_coletar_amostras(desde);
  c := public.parte_aprender_locais();
  d := public.parte_conferir(desde);
  return format('%s áreas, %s amostras novas, %s locais, %s programações conferidas', a, b, c, d);
end $$;
revoke all on function public.parte_atualizar(integer), public.parte_conferir(date), public.parte_aprender_locais(),
  public.parte_coletar_amostras(date), public.mapa_sincronizar_areas() from public, anon, authenticated;

select cron.unschedule('parte-diaria-mapa') where exists (select 1 from cron.job where jobname = 'parte-diaria-mapa');
select cron.schedule('parte-diaria-mapa', '25 * * * *', $$select public.parte_atualizar(3)$$);

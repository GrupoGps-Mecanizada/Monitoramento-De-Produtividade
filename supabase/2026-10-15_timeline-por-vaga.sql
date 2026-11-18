-- Timeline de motor por vaga fiel ao GAUSS (15/10/2026) - Supabase PRODUTIVIDADE
--
-- 1. Cada trecho guarda o caminhão DAQUELE trecho (antes ia o caminhão que estava na vaga na hora da busca).
-- 2. Cada busca troca o dia inteiro da vaga numa transação só: nunca sobra trecho velho nem fica o dia pela metade.
-- 3. timeline_conferencia: o que o GAUSS mandou em cada vaga-dia (para a tela avisar se o banco não bater).
-- 4. Liga o reprocessamento de 01/10 a 14/10 (o coletor faz aos poucos, sem pesar no GAUSS).
--
-- Rodar ANTES de publicar o coletor novo. Pode rodar de novo sem problema.

alter table public.timeline_motor_vaga add column if not exists placa text;
alter table public.timeline_motor_vaga add column if not exists cor text;

create table if not exists public.timeline_conferencia (
  vaga_id text not null,
  dia date not null,
  vaga_nome text,
  trechos integer not null,
  minutos jsonb not null default '{}'::jsonb,  -- minutos de cada status que o GAUSS mandou
  buscado_em timestamptz not null default now(),
  primary key (vaga_id, dia)
);
alter table public.timeline_conferencia enable row level security;
revoke all on public.timeline_conferencia from anon, authenticated;
grant select on public.timeline_conferencia to anon, authenticated;
drop policy if exists "timeline_conferencia: leitura pública" on public.timeline_conferencia;
create policy "timeline_conferencia: leitura pública" on public.timeline_conferencia
  for select to anon, authenticated using (true);

-- Troca o dia p_dia da vaga p_vaga pelas linhas p_linhas (o que o GAUSS mandou). Os valores passam pelo tipo das
-- próprias colunas (jsonb_populate_record): serve qualquer que seja o tipo de vaga_id/inicio/fim na tabela.
create or replace function public.substituir_timeline_vaga(p_vaga text, p_dia date, p_vaga_nome text, p_linhas jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  ref public.timeline_motor_vaga;
  n integer;
begin
  ref := jsonb_populate_record(null::public.timeline_motor_vaga, jsonb_build_object(
    'vaga_id', p_vaga,
    'inicio', to_char(p_dia, 'YYYY-MM-DD') || ' 00:00:00',
    'fim', to_char(p_dia + 1, 'YYYY-MM-DD') || ' 00:00:00'));
  -- tudo o que cruza o dia (ref.inicio = 00:00 do dia, ref.fim = 00:00 do dia seguinte)
  delete from public.timeline_motor_vaga t
   where t.vaga_id = ref.vaga_id and t.inicio < ref.fim and t.fim > ref.inicio;
  insert into public.timeline_motor_vaga (vaga_id, vaga_nome, inicio, fim, status, status_label, tempo_total_horas, placa_ou_codigo, placa, cor)
  select r.vaga_id, r.vaga_nome, r.inicio, r.fim, r.status, r.status_label, r.tempo_total_horas, r.placa_ou_codigo, r.placa, r.cor
    from jsonb_populate_recordset(null::public.timeline_motor_vaga, p_linhas) r;
  get diagnostics n = row_count;
  insert into public.timeline_conferencia (vaga_id, dia, vaga_nome, trechos, minutos, buscado_em)
  select p_vaga, p_dia, p_vaga_nome, n, coalesce(jsonb_object_agg(status, minutos), '{}'::jsonb), now()
    from (
      select r.status, round(sum(extract(epoch from (r.fim::timestamp - r.inicio::timestamp))) / 60.0, 1) as minutos
        from jsonb_populate_recordset(null::public.timeline_motor_vaga, p_linhas) r
       group by r.status
    ) m
  on conflict (vaga_id, dia) do update
    set vaga_nome = excluded.vaga_nome, trechos = excluded.trechos, minutos = excluded.minutos, buscado_em = excluded.buscado_em;
  return n;
end;
$$;
-- só o coletor (chave secreta) troca dados
revoke execute on function public.substituir_timeline_vaga(text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.substituir_timeline_vaga(text, date, text, jsonb) to service_role;

-- Reprocessar 01/10 a 14/10 (hoje o coletor novo já refaz sozinho). Para reiniciar, rode de novo esta linha.
insert into public.loc_kv (chave, valor, atualizado_em)
values ('reprocesso', '{"de": "2026-10-01", "ate": "2026-10-14"}'::jsonb, now())
on conflict (chave) do update set valor = excluded.valor, atualizado_em = now();

-- Conferência: deve listar placa e cor como colunas novas e a função criada
select column_name, data_type from information_schema.columns
 where table_schema = 'public' and table_name = 'timeline_motor_vaga' order by ordinal_position;

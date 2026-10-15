-- Supervisor de cada equipamento na matriz (15/10/2026) - Supabase PRODUTIVIDADE
--
-- Regra oficial do dono (segundo cérebro: "Regimes, turnos e supervisores", 14/10/2026):
--   Junior Pereira (ADM): Alta pressão AP-02, 03, 04, 05, 06, 09, 10
--   Donizete (ADM):       Vácuo AV-02, 03, 04, 05, 06 e Hipervácuo 01 e 02
--   Genésio (ADM):        todos os aspiradores, Hipervácuo 03 e 04 e os Brooks
--   Ficam sem supervisor fixo: AP/AV 01 e 08 (24 h: supervisor pela letra do 4x4) e AP/AV 07 (16 horas).
--
-- O número do equipamento vem do código ("AP 02") ou, sem código, da vaga atual do caminhão no GAUSS (loc_kv "estado").
-- Só preenche quem está sem supervisor: o que alguém já escolheu na tela Equipamentos não muda.
-- Cada mudança fica no histórico da matriz. Pode rodar de novo sem problema.

-- 1) Os 3 supervisores existem na lista (não duplica se já houver, com ou sem acento)
insert into public.frota_supervisor (nome)
select n from (values ('Junior Pereira'), ('Donizete'), ('Genésio')) v(n)
where not exists (
  select 1 from public.frota_supervisor s
  where lower(translate(s.nome, 'ÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç', 'AEIOUaeiouAEOaeoAOaoCc')) = lower(translate(v.n, 'ÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç', 'AEIOUaeiouAEOaeoAOaoCc'))
);

-- 2) Preenche o supervisor pela regra
with sup as (
  select id, lower(translate(nome, 'ÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç', 'AEIOUaeiouAEOaeoAOaoCc')) as chave from public.frota_supervisor
),
vaga_atual as (
  select upper(regexp_replace(v.value ->> 'placa', '[^A-Za-z0-9]', '', 'g')) as placa_norm,
         (regexp_match(v.value ->> 'vaga', 'GPS\s*-\s*(\d{1,2})'))[1]::int as num
  from public.loc_kv k, jsonb_each(k.valor) v
  where k.chave = 'estado' and jsonb_typeof(v.value) = 'object'
),
equip as (
  select e.id, e.tipo,
         coalesce((regexp_match(e.codigo, '(\d{1,2})'))[1]::int, va.num) as num
  from public.frota_equipamento e
  left join vaga_atual va on va.placa_norm = e.placa_norm
  where e.supervisor_id is null and e.status <> 'DESMOBILIZADO'
),
regra as (
  select id,
    case
      when tipo in ('as', 'pg') then 'genesio'
      when tipo = 'ap' and num in (2, 3, 4, 5, 6, 9, 10) then 'junior pereira'
      when tipo = 'av' and num in (2, 3, 4, 5, 6) then 'donizete'
      when tipo = 'hv' and num in (1, 2) then 'donizete'
      when tipo = 'hv' and num in (3, 4) then 'genesio'
    end as quem
  from equip
)
update public.frota_equipamento e
set supervisor_id = s.id, atualizado_em = now()
from regra r join sup s on s.chave = r.quem
where e.id = r.id;

-- 3) Conferência: como ficou a matriz (quem segue "sem supervisor" aparece com o motivo provável)
select e.tipo, coalesce(e.codigo, e.placa, 'Aspirador ' || e.numero) as equipamento, e.status,
       coalesce(s.nome, '— sem supervisor (24 h, 16 h ou sem código/vaga)') as supervisor
from public.frota_equipamento e
left join public.frota_supervisor s on s.id = e.supervisor_id
where e.status <> 'DESMOBILIZADO'
order by e.tipo, e.ordem;

-- Em que vaga cada caminhão esteve em cada dia (15/10/2026) - Supabase PRODUTIVIDADE
--
-- O supervisor é da VAGA (AP-02, AV-05...), não da placa: os caminhões rodam entre as vagas (regra do dono).
-- A tela Análise lê esta view para achar a vaga de cada parada e, com ela, o supervisor.
-- Vem da timeline de motor por vaga (timeline_motor_vaga), que o site já lê. Só leitura. Pode rodar de novo.

create or replace view public.vaga_do_dia
with (security_invoker = true) as
select (inicio)::date as dia,
       placa_ou_codigo as veiculo_id,
       vaga_nome,
       round(sum(extract(epoch from (fim::timestamp - inicio::timestamp))) / 60) as minutos
from public.timeline_motor_vaga
where coalesce(placa_ou_codigo, '') <> '' and status <> 'no_data'
group by 1, 2, 3;

grant select on public.vaga_do_dia to anon, authenticated;

-- Conferência: as vagas de ontem
select * from public.vaga_do_dia where dia = current_date - 1 order by vaga_nome;

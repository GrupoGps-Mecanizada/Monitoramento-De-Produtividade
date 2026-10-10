# Medição do GAUSS na Análise — Fase 1 (boletim oficial) — desenho

Data: 10/10/2026 · Aprovado pelo dono no chat (fases, aba, ranking por vaga, só GPS, tela, SQL e coletor).
Rota dos dados: `automation/medicao/README.md` (fora deste repositório). Fase 2 (nossa conta para o período em aberto e o "agora", com selo Parcial) terá desenho próprio.

## Por quê
O dono quer ver **qual vaga/equipamento teve indisponibilidade** e a **DF (disponibilidade física)**, que é a base do pagamento da GPS pela Usiminas. A Fase 1 mostra os números **oficiais** dos boletins já fechados (iguais ao pagamento), com risco baixo.

## Regras que não podem ser quebradas
- **NUNCA** chamar a Medição Mensal (`/data/measurement/contract-position-fixed-variable/usiminas/`, `action=list`): grava registro no GAUSS (incidente SAVED192881, 08/10/2026). **NUNCA** `reprocess`, `consolidate`, `delete-*`, `close_*`, `send_*`, `save*`.
- Só duas chamadas: a **lista do Dashboard** e o **`get_data`** de um boletim. Fila serial do coletor, sessão reaproveitada.
- Boletim fechado se baixa **uma vez** e fica guardado.
- **Não guardar** valores em R$ (preço, multa, total…) nem nomes de pessoas (solicitante, turno do operador): o site é aberto.
- Nunca ler `.env`. O SQL só roda no Supabase depois de mostrado e aprovado pelo dono.

## Tela: aba "Disponibilidade" na Análise
- No topo da Análise, duas abas: **Paradas** (o painel de `2026-10-10-painel-analise-design.md`) e **Disponibilidade**. A aba escolhida fica guardada no navegador.
- **Ciclo:** lista dos boletins GPS guardados, do mais novo ao mais antigo ("GPS 2026-10 · 16/09 a 08/10"). Selo **Oficial** ao lado. (Agora/Hoje/Ontem/Semana/Customizado entram na Fase 2.)
- **Placar:** DF da frota no ciclo = (Σ horas do regime − Σ horas indisponíveis) ÷ Σ horas do regime; horas indisponíveis no total; pior vaga (nome e DF).
- **Vagas** (coluna da esquerda), da pior DF para a melhor: nome da vaga, **DF %**, **horas indisponíveis** (hh:mm), **motivo que mais pesou**. Clicar abre o detalhe.
- **Detalhe da vaga** (coluna da direita):
  - **DF por dia** (uma barra por dia do ciclo, valor ao passar o mouse);
  - **Por motivo**: as horas de cada um dos 8 motivos (só os que têm valor);
  - **Eventos**: placa, início, fim, motivo e horas, em ordem de início;
  - **Motor secundário ligado**: total do ciclo e por dia, de `timeline_motor_vaga` (`status = 'secondary_motor_on'`, cortado nos dias do ciclo). O campo do boletim vem zerado e não é usado. Sem dado nos dias → "sem dado do motor nestes dias".
  - **Placas** que passaram pela vaga no ciclo;
  - **Conferência**: soma das horas dos eventos × total oficial; se a diferença passar de 1 min, mostra a diferença ("eventos somam 23h50, boletim diz 23h55: diferença 0h05").
- Computador/TV primeiro; no celular, uma coluna (vagas, depois o detalhe).
- Avisos em português: tabela não criada ("rode supabase/medicao.sql"), nenhum boletim baixado ainda ("o coletor baixa o boletim quando ele fecha no GAUSS").

## Banco (`supabase/medicao.sql`, roda no PRODUTIVIDADE depois do OK)
```sql
-- Medição do GAUSS (Fase 1): boletins FECHADOS, só GPS. Grava só o coletor (chave secreta); o site só lê.
-- Sem valores em R$ e sem nomes de pessoas (o site é aberto). Pode rodar de novo.
create table if not exists public.medicao_boletim (
  cod text primary key,
  identificacao text not null,
  inicio date not null,
  fim date not null,
  baixado_em timestamptz not null default now()
);
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
  primary key (boletim_cod, vaga_id)
);
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
```
Leitura pública agora (decisão do dono, 10/10/2026); fechar com o login da Central quando vier a Fase 3 do portal.

## Do boletim para as tabelas
| Tabela.coluna | Campo do GAUSS |
|---|---|
| `medicao_boletim.cod / identificacao / inicio / fim` | linha da lista: `cod`, `identification` (sem espaços), `initial_date`, `final_date` |
| `medicao_boletim_vaga.vaga_id / vaga / regime` | `vacancy_code`, `vaga`, `regime_name` |
| `horas_regime` | `CHM` ("551:37" → 551,6167 h) |
| `horas_indisp` | `total_indisponibilidade` ("23:55:00") |
| `df` | `DF` ("95,66" → 95.66) |
| `ausencia_operador`, `area_manutencao`, `fora_planta`, `trajeto`, `cartao_rfid`, `lancada`, `motor_desligado`, `parado_ligado` | `indisponibility_time_driverless`, `_geofence`, `_out_plant`, `indisponibility_route_time`, `indisponibility_time_rfid`, `indisponibility_released`, `indisponibility_time_engine_off`, `indisponibility_time_stopped_on` |
| `medicao_indisp_evento` | cada item de `json_data_indisponibility` com `type_indisp` e `start_sql`: `vehicle_name`, `start_sql`/`end_sql` (hora local de Ipatinga, −03:00), `type_indisp` antes do `#`, `approved_time_` (horas) |
| `medicao_vaga_dia` | `availability_json_data` somado por `day`: `regime_util_`, `indip_total_`, placas de `vehicle_name` (sem "S/…" e "BDVE") |
Conversão de horas: aceita "h:mm", "h:mm:ss" e número com vírgula ou ponto; vazio = 0.

## Coletor (`coletor/medicao.ts`)
- **Uma vez por dia**, no 1º ciclo a partir das 07:00 (fora da janela da madrugada): lê a lista do Dashboard dos últimos 90 dias (`filtered=0`, `logistic_providers[]=13`, `start_day`/`end_day`, sem `view-all-measurements`), fica só com `identification` começando com "GPS".
- Para cada boletim que **não está** em `medicao_boletim`: um `get_data` (com `rowData[...]` = a linha da lista), grava vagas, eventos e dias, e por último a linha do boletim (se algo falhar no meio, o boletim não fica marcado como baixado e é tentado de novo). No máximo 1 boletim por ciclo; até 3 tentativas por boletim por dia.
- Controle em `loc_kv` (`"medicao"`: dia da última lista e tentativas). Falha aqui não derruba o ciclo (mesmo padrão de `motor`/`madrugada` no `run.ts`).
- **Trava:** toda chamada da medição passa por `conferirChamada(path, campos)`, que só aceita a lista do Dashboard (sem campo `action`) e `get_data` no endereço do Dashboard; recusa qualquer endereço com `/data/measurement/` e qualquer campo/valor com `reprocess`, `consolidate`, `delete`, `close_`, `send_` ou `save`. Testado.
- O `get_data` devolve todas as vagas de uma vez (~1,5 MB por vaga): é uma requisição só, uma vez por ciclo de medição.

## Por dentro
- `src/lib/dominio/medicao.ts` (puro, testado): `horasDe(texto)`, `lerBoletim(linhaLista, vagasGetData)` → linhas das 4 tabelas, `dfDaFrota`, `motivoPrincipal`, `conferencia(eventos, total)`, `motor2PorDia(trechos, inicio, fim)`, `MOTIVOS` (nome falado de cada coluna).
- `src/lib/dados/medicao.ts`: leituras do Supabase (boletins, vagas do boletim, eventos/dias da vaga, trechos de motor 2º da vaga no ciclo), com o mesmo tratamento de erro da Análise.
- `src/app/analise/_componentes/disponibilidade/`: aba, placar, lista de vagas, detalhe. Gráficos em HTML/CSS feitos à mão (sem biblioteca).
- `coletor/medicao.ts` + chamada no `run.ts`.

## Testes
- Vitest: conversão de horas; leitura de um boletim de exemplo **montado no teste** (sem dados reais), incluindo evento sem tipo (ignorado), placa "S/…" e "BDVE" fora das placas do dia, e campos de R$ ausentes da saída; DF da frota; motivo principal; conferência com e sem diferença; motor 2º cortado no início/fim do ciclo; trava de chamadas (aceita as 2, recusa Medição Mensal, `reprocess`, `save…` etc.).
- **Gabarito (conferência manual, uma vez):** com o arquivo local `automation/data/medicao/202609161320261008-vaga530.json` (fora do repositório), `lerBoletim` deve dar AP 01 24h (vaga 530): `horas_regime` 551h37, `horas_indisp` 23h55, `df` 95,66, ausência de operador 12h41. Teste que **pula sozinho** se o arquivo não existir.
- e2e: aba Disponibilidade com dados falsos — ranking pela pior DF, selo Oficial, clicar na vaga mostra eventos, DF por dia, motor 2º e conferência; avisos de tabela não criada e de nenhum boletim.

## Fora desta fase
Nossa conta (período em aberto, Agora/Hoje/Ontem/Semana/Customizado, selo Parcial, conferência automática com o oficial), SERVITEC, login.

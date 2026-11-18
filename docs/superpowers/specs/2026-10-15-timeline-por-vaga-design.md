# Timeline por vaga fiel ao GAUSS + reprocessamento (15/10/2026)

Pedido do dono (P-034): o Dia da frota igual à "Timeline Tempo de Motor (Vaga)" do GAUSS, organizado por vaga, com
dados intrínsecos (iguais ao GAUSS, sem confundir caminhão) e reprocessar timeline, apontamentos e rotas.

## O que a captura da tela do GAUSS provou (REA, 15/10/2026, 10 vagas de Alta Pressão)

A tela chama `POST /data/hard-vehicle/analytics/timeline-engine-by-vacancy/` uma vaga por vez
(`action=timeline-engine-by-vacancy`, `vacancy`, `initial_date_time`, `final_date_time`). Cada trecho traz:

| campo | o que é |
|---|---|
| `start`, `end`, `status`, `status_`, `bgColor`, `total_time` | o trecho |
| `vehicle_data.vehicle_cs_code`, `vehicle_name` | **o caminhão daquele trecho** (vazio em `not_appropriated`) |
| `vacancy_info.vehicle_cs_code` | o caminhão que está na vaga **agora** (igual em todos os trechos) |
| `callback` | `getModalInfosTimelineEngine('<veículo do trecho>', status, início, fim, ...)` |

**Defeito 1 (causa do "apropriado no GAUSS e não no meu"):** `linhasDaVaga` grava `placa_ou_codigo` com
`vacancy_info.vehicle_cs_code`. Todo o dia da vaga vai para o caminhão de agora. Ex.: AP-01 teve EAM-3253 e PUB2F80
hoje; AP-05 também; tudo foi parar num caminhão só. Afeta Dia da frota, Timeline do veículo, Cronoanálise, Medição
(motor) e as paradas da Análise (`analise_paradas`, via `motorDe(id)`).

**Defeito 2:** o coletor só busca a vaga cujo caminhão a planilha diz estar nela. Vaga apropriada no GAUSS a outro
caminhão (ou sem caminhão na planilha) não é buscada.

**Defeito 3:** upsert por (vaga, início, fim) nunca apaga. Trecho que o GAUSS corrigiu/dividiu depois fica no banco.

**Achado no próprio GAUSS:** DSY6475 aparece ao mesmo tempo em AP-09 e AP-10 desde 07:50 (apropriação dupla).

Cores oficiais: on #008000 Motor Ligado · stopped #FFFF00 Parado Ligado · secondary_motor_on #76e576 Motor Secundário
Ligado · off #ff0000 Motor Desligado · categorized_stop #1a1a7a Parada Apontada · maintenance #ffa500 Em manutenção ·
not_appropriated #c5c7cc Indisponível / Sem Apropriação · no_data #000 Sem dados de bordo.

## Decisões

1. **Espelho por vaga.** A tabela guarda exatamente o que o GAUSS mostra por vaga. Colunas novas:
   `veiculo_id` (do trecho, `vehicle_data.vehicle_cs_code`, null sem apropriação), `placa` (`vehicle_name`),
   `cor` (`bgColor`). `placa_ou_codigo` passa a ser o veículo do trecho (compatível com quem já lê).
2. **Substituir, não somar.** Cada busca de vaga+dia troca todas as linhas daquela vaga naquele dia numa função do
   Postgres (`substituir_timeline_vaga`), numa transação só: nunca fica o dia pela metade nem trecho velho.
3. **Todas as vagas da lista do GAUSS** (a lista do filtro, 1x por dia), não só as da planilha. Pular vaga quieta
   continua (carga mínima no GAUSS), mas a 1ª busca do dia e o fechamento do dia anterior valem para todas.
4. **Reprocessamento em fila suave:** `loc_kv "reprocesso"` com o período e o cursor; cada ciclo do coletor faz no
   máximo 12 vaga-dias (fila serial do gauss.ts, 2–3 s entre requisições). Ordem: timeline (todas as vagas, dia a
   dia, do mais novo para o mais velho) → apontamentos do tablet do dia → paradas da Análise do dia (pela rota já
   guardada; só baixa a rota de novo se não houver cópia). Botão/ação manual no workflow para iniciar.
5. **Conferência automática:** para cada vaga-dia gravado, o total por status do GAUSS (`total_time`) é guardado; a
   tela mostra ⚠ quando a soma do que está no banco difere em mais de 1 min.
6. **Tela Dia da frota por vaga:** uma linha por vaga na ordem do GAUSS (Alta Pressão, Auto Vácuo, Hiper Vácuo,
   depois as demais), régua 00–23 h, mesmas cores e rótulos "15/10 08:15 ~ 15/10 10:20"; nome do caminhão no trecho
   e na dica; troca de caminhão na vaga marcada com um traço. Totais e "produtivo" continuam (por vaga e por caminhão).

## Como provar que está certo

- Amostra real da captura (vaga 530, 15/10) em `coletor/__amostras__/` e teste: cada trecho fica com o caminhão do
  trecho; AP-01 tem 2 caminhões; sem apropriação fica sem caminhão.
- Teste da troca do dia (linhas velhas somem; falha no meio não apaga nada).
- Depois de publicado: comparar 3 vagas, trecho a trecho, com a tela do GAUSS (REA) no mesmo horário.

## O dono roda

- 1 SQL no Supabase **PRODUTIVIDADE** (colunas novas + função de troca).
- Disparar o reprocessamento (botão "Run workflow" com o período).

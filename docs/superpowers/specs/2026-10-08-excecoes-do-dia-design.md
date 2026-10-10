# Exceções do dia — desenho (08/10/2026)

## Objetivo

Primeira parte do "rastreamento inteligente": uma lista com **só o que fugiu das regras** da frota em cada dia
(gestão por exceção, como na Geotab), para o dono não precisar olhar o mapa o dia inteiro. Fonte das regras: o
questionário respondido pelo dono (artifact "Rastreamento Inteligente da Frota", 08/10/2026).

**Fora deste trabalho (fase 2):** regras por média (tempo de bica, horário de almoço, Poço Redondo, Aterro), ciclos
do Auto Vácuo, velocidade acima de 30 km/h, desvio de rota, cartão de ponto, ranking, utilização, apontamento x GPS e
relatório semanal. Velocidade e rota dependem das rotas completas do dia (download noturno, ainda não feito).

## Onde fica

Na tela **Alertas**, que ganha duas abas: **Exceções do dia** (padrão) e **Eventos** (a lista de hoje, sem mudança).
O dono escolheu "tela de alertas do site + resumo diário": o resumo é a mesma tela com o dia de **ontem**. Nenhum
envio por WhatsApp ou e-mail nesta fase.

## Dados (nada novo no banco, nenhuma consulta nova ao GAUSS)

- `loc_eventos` do dia (e do dia seguinte, para o turno da noite): `abertura`, `entrada`, `saida` de área — a cada
  ciclo do coletor (~5 min). Viram **intervalos por área** de cada veículo.
- `timeline_motor_vaga` do dia (já lida pelo Dia da frota): ligado, parado ligado, motor 2º, desligado...
- `demoras_categorizadas` do dia, da frota inteira (leitura nova, só Supabase): apontamentos do tablet.
- Matriz de equipamentos (retrato): tipo, status (Em manutenção), regime, vaga.

Tudo é calculado no navegador, com funções puras e testadas (`src/lib/dominio/excecoes.ts`), como o Dia da frota.

## Regimes e expedientes

| Regime | Dias | Expedientes (sai do Pátio até → volta ao Pátio a partir de) |
|---|---|---|
| ADM | seg–sex | 07:45 → 16:30 |
| 16 horas | seg–sex | 07:15 → 14:23 e 15:15 → 22:23 |
| 24 horas / turno (4X4 A–D) | todos | 07:15 → 18:23 e 19:15 → 06:23 do dia seguinte |

- **Qual regime:** o da matriz (`ADM` → ADM; `16H...` → 16 horas; `4X4...` → 24 horas). Matriz em branco: pelo nome
  da vaga do GAUSS (`24 HS` → 24 horas; `16 HS` → 16 horas). Sem pista: ADM, marcado **"regime presumido"** na tela
  para o dono corrigir na matriz.
- **Feriado:** dia normal do regime.
- **Fora dos expedientes** nada vira exceção (o parado não conta).
- **Tolerância de 5 min** nos horários: o coletor só vê a posição a cada ~5 min.
- Equipamento **Em manutenção** na matriz não gera exceção de horário nem de motor.

## Regras desta fase

| # | Exceção | Quando | Quem |
|---|---|---|---|
| 1 | **Saída tarde do Pátio** | 1ª saída do Pátio do Transporte depois do horário (+5 min), ou não saiu | todos |
| 2 | **Chegada cedo ao Pátio** | volta definitiva ao Pátio antes do horário (−5 min) | todos |
| 3 | **Ida ao Pátio no expediente** | entrou e saiu do Pátio no meio do expediente (troca de equipamento pedida pelo cliente: o dono justifica olhando) | todos |
| 4 | **Oficina da Servitec** | passagem pela cerca OFICINA GPS/SERVITEC no expediente (conta como manutenção) | todos |
| 5 | **Oficina de fora** | passagem pela OFICINA CENTRO | todos |
| 6 | **Vácuo na bica** | Auto Vácuo ou Hiper Vácuo dentro de ABAST ÁGUA ou ABASTECIMENTO ÁGUA RUA 29 | AV, HV |
| 7 | **Restaurante acima de 1 h** | mais de 60 min seguidos dentro de uma das 8 cercas de restaurante, no expediente | todos |
| 8 | **Ociosidade** | parado ligado (GAUSS `stopped`) por 30 min ou mais seguidos, no expediente, quando parado ligado não é o produtivo do equipamento | todos menos Alto Vácuo e DSY6472 |
| 9 | **Motor desligado 1 h** | desligado (`off`/`main_switch_off`) por 60 min ou mais seguidos no expediente, fora do Pátio, sem apontamento de refeição no tablet e fora das oficinas | todos |

Cercas de restaurante: RESTAURANTE DA SINTER, DA LUA, DA SOL, MECANIZADA, DA LAGOA, ESTACIONAMENTO RESTAURANTE
CENTRAL, DA LAGOA, DA MATA. Todos os nomes, horários e limites ficam num só arquivo de regras
(`src/lib/dominio/regras-frota.ts`), fáceis de mudar.

Cada exceção tem: equipamento, regra, início, fim/duração, local, gravidade (**atenção** ou **alerta**) e o link para
a Timeline do equipamento naquele dia.

## A tela

```
Alertas   [Exceções do dia] [Eventos]          Dia: Hoje ▾
┌ resumo ──────────────────────────────────────────────────────────┐
│ 12 exceções em 7 equipamentos                                    │
│ [Saída tarde 3] [Chegada cedo 2] [Ida ao Pátio 1] [Vácuo na bica 1]│
│ [Restaurante 1] [Ociosidade 3] [Motor desligado 1] [Servitec 0] … │
└──────────────────────────────────────────────────────────────────┘
Agrupar: (Por equipamento) (Por regra)
┌ EGC-2985 · Alta Pressão · 24 horas ──────────────────────────────┐
│ ● Saída tarde do Pátio   07:52 (limite 07:15)      ver Timeline › │
│ ● Ociosidade             10:05–10:48 · 43 min · ACIARIA 02        │
└──────────────────────────────────────────────────────────────────┘
```

- Os chips filtram pela regra; o número aparece mesmo quando é zero (mostra que a regra foi checada).
- Gravidade com rótulo e cor (nunca só cor).
- Hoje: atualiza sozinho (eventos ao vivo, motor a cada 5 min). Ontem/dias anteriores: o resumo do dia.
- Celular: mesma lista, uma coluna.

## Testes

- Unidade (`excecoes.test.ts`, `regras-frota.test.ts`): regime pela matriz/vaga/presumido; expedientes de cada
  regime, incluindo o da noite que vira o dia; intervalos por área a partir dos eventos; cada uma das 9 regras
  (dispara e não dispara, tolerância, exceções de manutenção/refeição/oficina/Pátio).
- e2e: a aba Exceções mostra o resumo e a lista com dados sintéticos; filtro por regra; link para a Timeline; aba
  Eventos continua igual.
- Antes de publicar: lint, typecheck, test, build e e2e.

## Limites conhecidos

- Resolução de ~5 min (ciclo do coletor): passagens muito curtas por uma cerca podem não aparecer.
- Dias antes do coletor gravar eventos não têm exceções.
- Regras 1–3 dependem do Pátio ter a cerca "PÁTIO DO TRANSPORTE RODOVIÁRIO" no GAUSS.

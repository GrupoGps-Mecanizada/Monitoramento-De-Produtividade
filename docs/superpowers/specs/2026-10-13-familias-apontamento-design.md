# Subabas por família de apontamento na Análise — desenho

Data: 13/10/2026 · Aprovado pelo dono no chat (organização por família, frases automáticas, quem mais para, tendência por dia).
Ramo: `analise-visual` (sobre `medicao-oficial`). Etapa 2 de 3 (1 = placar fora e período no topo, já feita; 3 = cruzamento com a cronoanálise, desenho próprio).

## Por quê
O dono quer ver melhor as paradas por apontamento do tablet, inclusive **Aguardando Área**, com "dados inteligentes". Hoje há 18 apontamentos (30 dias até 06/10: Refeição 527 h, Documentação 474 h, Água 258 h, DDS 223 h, Preparação 195 h, Aguardando Área 134 h…) e **79% do tempo parado não tem apontamento** (8.653 h). Um gráfico só ("Por serviço") não mostra quem, quando nem se está piorando.

## O que muda na tela (aba Paradas)
```
┌ [Paradas | Disponibilidade] [7 | 15 | 30 dias]   Tipo ▾ Supervisor ▾ Regime ▾ ┐
│ Filtrando: [Aguardando Área ×] [ABC1D23 ×]   Limpar tudo                        │
├──────────────────────────────────────┬──────────────────────────────────────────┤
│                                      │ Visão geral | Aguardando | Pausas e      │
│   MAPA (bolhas só da família         │ pessoas | Logística | Preparação e       │
│   escolhida)                         │ bloqueio | Manutenção e clima | Sem apont.│
│                                      ├──────────────────────────────────────────┤
│                                      │ • frases automáticas (2 a 4)             │
│                                      │ Por apontamento (barras, clicável)       │
│                                      │ Quem mais para: placas | supervisores    │
│                                      │ Tendência por dia (barras)               │
└──────────────────────────────────────┴──────────────────────────────────────────┘
```
- **Visão geral** = o painel de hoje, sem mudança (Lugares, Por serviço, Hora do dia).
- **Família escolhida** filtra também o mapa (bolhas) e vale junto com tipo, supervisor, regime e as etiquetas.
- A subaba escolhida fica guardada neste navegador (`useOpcao`, chave `mon-analise-familia`), como as outras escolhas.
- Celular (< 1024 px): as subabas rolam na horizontal acima dos gráficos; o resto já empilha.

## Famílias (tabela fixa no código)
| Família | Apontamentos |
|---|---|
| Aguardando | Aguardando Área, Aguardando semáforo/cancela, Aguardando Auto Vácuo descarregar, Aguardando carreta bascular |
| Pausas e pessoas | Refeição Motorista, Pausas Diversas (água, banheiro), Inicio de turno, DDS/Check-List - LM, Abordagem de Segurança |
| Logística | Abastecimento (Água) - LM, Abastecimento (Combustível), Descarregando equipamento, Troca de Equipamento |
| Preparação e bloqueio | Documentação, Preparação - LM, Bloqueio - LM |
| Manutenção e clima | Pequenas manutenções, Condições Climáticas (chuva, etc) e **qualquer apontamento novo** que não esteja na tabela |
| Sem apontamento | paradas sem nenhum apontamento |

- A comparação de nomes ignora maiúsculas, acentos, espaços extras e o final " - LM" (o tablet varia).
- Apontamento novo fora da tabela: entra em Manutenção e clima e a subaba mostra o aviso "Apontamento novo sem família: X" (para incluir na tabela).
- Uma parada com 2 apontamentos de famílias diferentes conta nas duas; dentro da mesma família conta **uma vez** no total da família (cada apontamento ainda soma no seu próprio item).

## Dentro de uma família (de cima para baixo)
1. **Frases automáticas** (2 a 4, só as que tiverem dado; nenhuma inventada):
   - **Total e comparação:** "Aguardando somou 134h00 em 113 paradas, 25% a mais que nos 15 dias anteriores." A comparação usa o período anterior de mesmo tamanho; como a tabela guarda só 30 dias, **só existe em 7 e 15 dias**. Em 30 dias a frase sai sem comparação.
   - **Concentração:** a placa com maior fatia ("A placa ABC1D23 sozinha soma 31% do tempo."), só se passar de 20%.
   - **Pico:** a faixa de 2 horas com mais minutos ("O pico é das 14h às 16h.").
   - **Lugar:** o lugar (área/cerca) com mais horas ("Onde mais acontece: OFICINA, 40h00.").
2. **Por apontamento:** barras com horas de cada item da família (número escrito). Clicar vira etiqueta (dimensão `servico`, a que já existe) e filtra o resto. Some em "Sem apontamento".
3. **Quem mais para:** dois rankings lado a lado (empilham no celular): **placas** e **supervisores**, top 10, com horas, nº de paradas e média por parada. Clicar numa placa vira etiqueta (dimensão nova `placa`); clicar num supervisor preenche o filtro Supervisor do topo.
4. **Tendência por dia:** barras com as horas de cada dia do período (dia sem parada = 0, para não esconder buracos). Clicar num dia não filtra (fica para depois, se o dono pedir).

## Como fica por dentro
- **`src/lib/dominio/familias.ts`** (novo, sem tela): `FAMILIAS`, `familiaDe(apont)`, `paradasDaFamilia(paradas, familia)`, `porApontamento`, `rankingPlacas`, `rankingSupervisores`, `porDia(paradas, hoje, periodo)`, `frases(atual, anterior, locais)`. Funções puras, testadas em `familias.test.ts`.
- **`src/lib/dominio/analise.ts`:** a seleção cruzada ganha a dimensão `placa` (`SelecaoCruzada`, `filtrarSelecao`, etiqueta). Nada mais muda.
- **Tela:** `src/app/analise/_componentes/familia/` (novo): `subabas-familia.tsx`, `painel-familia.tsx`, `frases.tsx`, `ranking.tsx`, `grafico-dias.tsx`. `analise.tsx` passa o recorte para a Visão geral ou para o painel da família e filtra as bolhas pela família.
- **Dados:** os mesmos de hoje (`analise_paradas`, já carregados). **Sem SQL novo, sem chamada ao GAUSS, sem custo.** Para a comparação, o recorte do período anterior sai da mesma lista em memória.

## Avisos e erros
- Família sem paradas no filtro: "Nada neste filtro." (o mesmo texto de hoje), sem quebrar.
- Os avisos de "sem histórico" e "tabela não criada" continuam no mapa.
- **Dado parado:** o histórico está em 06/10 (depende do "Enviar Historico ao Site.bat"). Com 7 dias a partir de hoje a tela fica vazia; isso não é deste trabalho, mas o painel mostra "Último dia com dados: 06/10" no topo da coluna quando o último dia for anterior a ontem.

## Testes
- `familias.test.ts`: família de cada um dos 18 nomes (com e sem " - LM", acento), apontamento novo, parada com 2 famílias, total sem contar 2x, rankings, dias com zero, cada frase (com e sem dado, 30 dias sem comparação, concentração abaixo de 20% não sai).
- `analise.test.ts`: dimensão `placa` na seleção cruzada.
- `e2e/analise.spec.ts`: abrir "Aguardando", ver frase, barras e rankings; clicar no apontamento e numa placa vira etiqueta; mapa e lugares filtram; Visão geral continua igual.
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

## Fora deste trabalho
- Etapa 3 (telemetria × cronoanálise).
- Automatizar o envio do histórico (hoje é o .bat no PC).
- Clicar no dia da tendência para filtrar.

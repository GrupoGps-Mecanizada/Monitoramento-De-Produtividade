# Análise em satélite com mapa de calor e subabas por assunto — desenho

Data: 13/10/2026 · Aprovado pelo dono no chat ("PROSSIGA"): layout "mapa + coluna", subabas Status do motor, Motor secundário, Apontamentos e Disponibilidade; tirar Mata CDP e USIPA e deixar o restante.
Ramo: `analise-visual`. Substitui a parte de tela de `2026-10-13-familias-apontamento-design.md` (as regras de `familias.ts` continuam e viram a subaba Apontamentos).

## Por quê
O dono achou a tela pouco clara: focava só em apontamentos. Ele quer ver **status do motor, motor secundário, apontamentos e disponibilidade**, numa tela sofisticada de apresentação, com **mapa de satélite real** e **mapa de calor** mostrando onde cada coisa acontece.

## Tela (computador/TV primeiro)
```
[Paradas|Disponibilidade] [7|15|30 dias] [Tipo ▾][Supervisor ▾][Regime ▾]      ← uma linha só
Filtrando: [ALTO FORNO 3 ×] [EGC2985 ×]  Limpar tudo                            ← só quando há escolhas
+------------------------------------+------------------------------------------+
|  fundo preto                       | Status do motor | Motor 2º | Apontamentos|
|   +--------------------------+     | | Disponibilidade                         |
|   | SATÉLITE só dentro das   |     +------------------------------------------+
|   | plantas (sem Mata CDP e  |     | 3 números-chave                          |
|   | USIPA)                   |     | frases automáticas                       |
|   |    ▓▓  mapa de calor     |     | gráfico principal (clicável)             |
|   |   ▓▓▓▓ (muda c/ subaba)  |     | quem mais (placas, clicável)             |
|   +--------------------------+     | lugares (clicável) · hora do dia         |
+------------------------------------+------------------------------------------+
```
- Celular (< 1024 px): tudo em uma coluna, a linha de filtros quebra em duas, as subabas rolam na horizontal.

## Construção em 4 partes (cada uma testada e entregue antes da próxima)

### Parte A — base visual
1. **Uma linha de filtros:** abas Paradas | Disponibilidade, período (só em Paradas) e Tipo, Supervisor, Regime (só em Paradas) na mesma linha. As etiquetas "Filtrando" ficam na linha de baixo, só quando existem. Na aba **Disponibilidade**, os filtros dela (ciclo e o que mais houver) também numa linha só, ao lado das abas.
2. **Mapa de satélite recortado:** imagem de satélite Esri (grátis, a mesma da Localização) só **dentro das plantas** da região; fora delas, uma máscara **preta** (um polígono do mundo com furos nas plantas). Contornos finos das plantas e das áreas, nomes das plantas como hoje.
3. **Sem Mata CDP e USIPA:** saem do mapa (PLANTA MATA CDP, MATA CDP, PLANTA USIPA, USIPA) **e das contas**, como o Pátio da base: sai a parada cuja cerca é uma dessas ou cujo ponto cai dentro de PLANTA MATA CDP / PLANTA USIPA. "ESTACIONAMENTO RESTAURANTE DA MATA" é outro lugar e fica. Todo o resto continua como hoje (Aterro, Poço Redondo, oficinas de fora, "Longe da região").
4. **Mapa de calor no lugar das bolhas:** `leaflet.heat` (grátis, ~5 KB). Cada parada vira um ponto com peso = minutos (na Parte A: minutos parados do recorte atual; nas próximas partes, o peso da subaba). Cores do calor: azul → amarelo → vermelho, legíveis sobre o satélite. As **áreas (cercas) continuam clicáveis**: clicar escolhe o lugar (etiqueta), como a bolha fazia; passar o mouse mostra nome e horas.
5. A coluna da direita fica como está (Visão geral + famílias) até a Parte B.

### Parte B — subabas Status do motor (padrão) e Motor secundário
Molde comum a todas as subabas: **3 números-chave → frases automáticas → gráfico principal (clicável) → quem mais (placas) → lugares → hora do dia**.
- **Status do motor:** horas em cada status do GAUSS durante as paradas (`analise_paradas.motor`: desligado, ligado parado, motor 2º...). Números: horas paradas, % com motor ligado, status que mais pesa. Gráfico principal: horas por status; clicar num status deixa o calor só com aquele status (etiqueta).
- **Motor secundário:** minutos de `secondary_motor_on` (só tipos com regra, ex.: Alta Pressão). Números: horas de bomba ligada, % do tempo parado com bomba ligada, placa campeã. Calor = minutos de bomba ligada.
- A Visão geral atual (Lugares, Por serviço, Hora do dia) se dissolve no molde: lugares e hora aparecem em toda subaba.

### Parte C — subaba Apontamentos
- As famílias já prontas (`familias.ts`: Aguardando, Pausas e pessoas, Logística, Preparação e bloqueio, Manutenção e clima, Sem apontamento) viram um seletor dentro da subaba; o conteúdo segue o molde. Calor = minutos da família.
- Pendências da revisão final: sem comparação quando o histórico parou; filtro de serviço comparando o nome normalizado; ranking de supervisores mostrando todos com o escolhido marcado.

### Parte D — subaba Disponibilidade
- Números do boletim oficial (tabelas `medicao_*`): DF da frota, pior vaga, horas indisponíveis por motivo.
- Calor = onde os equipamentos estavam **parados durante a indisponibilidade**: paradas (`analise_paradas`) da placa da vaga que cruzam no horário com os eventos de indisponibilidade do boletim.
- Limite: o boletim só existe para ciclo fechado (hoje 16/09 a 08/10) e as paradas só guardam 30 dias; a subaba usa o período do boletim (não os 7/15/30) e avisa quantos dias do ciclo têm paradas para cruzar. O período em aberto fica para a Fase 2 da medição.

## Regras que não mudam
- Sem SQL novo nas partes A–C (a Parte D só lê tabelas que já existem). Sem chamada ao GAUSS. Só ferramentas grátis.
- A trava da medição (`coletor/medicao.ts`) não é tocada.
- Avisos de "sem histórico", "tabela não criada" e "Último dia com dados" continuam.

## Testes (por parte)
- Regras puras com vitest (recorte de Mata CDP/USIPA, pesos do calor, contas de status e motor 2º, cruzamento da disponibilidade).
- e2e por parte: linha única de filtros nas duas abas; satélite e máscara presentes; Mata CDP/USIPA fora dos lugares; clicar numa cerca vira etiqueta; cada subaba com números, frases e gráficos; subaba sem dado diz "Nada neste filtro.".
- Antes de cada entrega: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

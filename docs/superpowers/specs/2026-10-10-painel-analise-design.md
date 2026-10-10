# Painel da Análise (mapa + gráficos que se filtram) — desenho

Data: 10/10/2026 · Aprovado pelo dono no chat (layout, gráficos, interação e aparelho).

## Por quê
A tela Análise (`/analise`) virou o uso principal, mas o mapa pintado por medida confunde: 6 medidas, funil, lista, "Ir para" e troca de fundo. O dono quer **dados precisos** e **poucos botões**, num formato de **apresentação** (computador/TV): mapa de um lado, gráficos do outro, e **um filtra o outro**.

## O que muda na tela
```
┌ Período: 7 | 15 | 30 dias   Tipo ▾  Supervisor ▾  Regime ▾ ───────────────┐
│ Filtrando: [Servitec ×] [Vácuo ×] [14h ×]   Limpar tudo                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Produtivo 312h │ 68% produtivo │ Parado 140h │ Serviços 1.240  ← placar     │
├────────────────────────────────────────────┬────────────────────────────────┤
│                                            │ Lugares (mais tempo parado)    │
│   MAPA                                     ├────────────────────────────────┤
│   bolha por lugar: tamanho = horas paradas │ Por serviço                    │
│   cor = serviço principal (3 cores+cinza)  ├────────────────────────────────┤
│                                            │ Hora do dia (0h–23h)           │
└────────────────────────────────────────────┴────────────────────────────────┘
```
- **Sai:** funil (gaveta de opções), botão de lista, as 6 medidas, "Ir para", troca de fundo preto/branco, filtros de faixa do dia e dia da semana (a "Hora do dia" substitui a faixa).
- **Fica:** os dados (`analise_paradas`), o mapa Leaflet com as cercas da região, o fundo escuro atual, os avisos de "sem histórico" e "tabela não criada", e a leitura que relê a cada 10 min.
- **Computador/TV primeiro:** mapa ~60% à esquerda, coluna de gráficos ~40% à direita, rolando sozinha se não couber. No celular (< 1024px), tudo em uma coluna: filtros, placar, mapa (altura fixa), gráficos.

## Filtros do topo (uma linha só)
- **Período:** 7 | 15 | 30 dias (guardado no navegador, como hoje).
- **Tipo, Supervisor, Regime:** listas, como hoje.
- **Etiquetas de seleção:** cada clique no mapa ou num gráfico vira uma etiqueta ("Servitec ×", "Vácuo ×", "14h ×"). O **×** tira só aquela; **Limpar tudo** tira as etiquetas (não mexe no período nem nas listas).

## Placar (4 números)
| Número | Conta |
|---|---|
| Produtivo | soma de `produtivo` (regra de `produtividade.ts`, sem contar a base) |
| % produtivo | `produtivo ÷ paradoComRegra` (mesma base de hoje); "—" se não houver base |
| Parado | soma do tempo parado |
| Serviços | nº de paradas com pelo menos um apontamento do tablet |
Valores exatos (ex.: "312h 40"), sem gráfico.

## Gráficos (barras com o número escrito ao lado; detalhe ao passar o mouse)
1. **Lugares:** barras horizontais, os 10 lugares com mais tempo parado + a linha "Longe da região" se houver. Rótulo: nome e horas.
2. **Por serviço:** barras horizontais, nº de paradas por apontamento (todos, do maior ao menor; se passar de 10, os demais somam em "Outros"). Ao passar o mouse: nº e horas.
3. **Hora do dia:** 24 colunas (0h–23h), horas paradas pela hora de início. Ao passar o mouse: hora e horas paradas.
Uma cor só por gráfico (barras na cor de destaque); a cor não carrega significado, o rótulo sim.

## Mapa
- Uma **bolha por lugar** da região (centro da cerca ou ponto), **área da bolha proporcional às horas paradas** (raiz quadrada; mínimo legível).
- **Cor = serviço principal do lugar**, só para os **3 serviços com mais paradas** no recorte atual; o resto e "sem apontamento" em cinza ("Outros"). Legenda com as 4 entradas. Contorno fino da cor da superfície entre bolhas sobrepostas.
- As cercas continuam desenhadas apagadas, só como referência. Ao passar o mouse na bolha: nome, horas paradas, serviço principal.
- A cor de cada serviço é fixa pelo nome (não muda quando o filtro muda). Paleta validada com `validate_palette.js` (claro e escuro) antes de entrar.

## Como um filtra o outro
Estado da seleção: `{ local: string | null, servico: string | null, hora: number | null }`.
- **Clicou numa bolha** ou **num lugar do ranking** → `local`. O mapa aproxima e destaca o lugar (as outras bolhas ficam apagadas).
- **Clicou numa barra de serviço** → `servico` (só paradas com aquele apontamento).
- **Clicou numa hora** → `hora` (só paradas que começaram naquela hora).
- Clicar de novo no que já está selecionado tira a seleção.
- **Regra:** o placar aplica as três seleções. Cada gráfico aplica as seleções **dos outros** e mostra a sua em destaque (a barra escolhida forte, as outras apagadas), para dar para trocar de escolha sem limpar. O mapa aplica `servico` e `hora` e destaca `local`.
- Os filtros do topo valem para tudo.

## Por dentro
- **Regras puras** em `src/lib/dominio/analise.ts`, com testes (Vitest):
  - `filtrarSelecao(paradas, sel, ignorar?)` — aplica `local`/`servico`/`hora`, pulando a dimensão `ignorar`.
  - `porServico(paradas)` → `{ nome, n, min }[]`, com "Outros" após 10.
  - `porHora(paradas)` → 24 números (minutos parados por hora de início).
  - `placar(paradas, locais)` → os 4 números.
  - `coresDosServicos(paradas)` → os 3 serviços principais com a cor fixa de cada um.
  - Saem as que só a tela antiga usava (`valorDe` por medida, `faixaDeCor`, `MEDIDAS`) quando nada mais as usar.
- **Tela** em `src/app/analise/_componentes/`: `analise.tsx` (estado e layout), `barra-filtros.tsx`, `placar.tsx`, `grafico-barras.tsx` (horizontal, usado por Lugares e Serviços), `grafico-horas.tsx`, `camada-analise.ts` (bolhas). Saem `ranking.tsx`, `resumo-periodo.tsx`, `detalhe-local.tsx` e o `filtros.tsx` antigo. Gráficos em SVG feito à mão, como já é hoje (sem biblioteca nova, sem custo).
- **Banco:** nada muda.
- **Acessibilidade:** cada barra e cada bolha é botão com nome falado ("Servitec, 42 horas paradas"); teclado seleciona; a seleção nunca depende só da cor (etiqueta no topo).

## Testes
- Vitest para as regras novas (seleção cruzada, por serviço com "Outros", por hora, placar, cores fixas).
- `e2e/analise.spec.ts`: o 1º teste é reescrito (placar visível; clicar em "Vácuo" muda o placar e cria a etiqueta; clicar num lugar do ranking cria a etiqueta; "Limpar tudo" volta). Os testes de "sem histórico" e "tabela não criada" ficam.

## Fora deste trabalho
Tabela por equipamento/supervisor, comparação entre períodos, exportar PDF/imagem, velocidade (`analise_excessos`).

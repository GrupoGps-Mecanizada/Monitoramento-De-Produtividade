# Mapa de análise — desenho (08/10/2026)

## Objetivo

Uma tela nova no site, **Mapa de análise**, para usar no dia a dia: o mapa da Usiminas com cada área pintada pela medida
escolhida (onde a frota mais produz, onde fica parada ligada sem produzir, quem atende cada área...), com filtros e
um painel de detalhe ao clicar na área. Inspiração: mapas interativos de apuração (áreas coloridas, passar o mouse,
clicar e ver o detalhe, ranking ao lado).

**O que o dono decidiu**
- Nova tela no site publicado (público, só leitura, como as outras).
- Medidas: produtivo por área, parado ligado sem produzir, quem atende cada área, e mais classificações: tipo de
  local, apontamentos do tablet, horário e dia da semana, supervisor e regime.
- Guardar **no máximo 30 dias** de dados.
- Agora: só o mapa, alimentado pelos 15 dias que o PC já baixou (22/09 a 06/10), enviados **uma vez**.
- **Depois (fora deste trabalho):** o puxador (coletor no GitHub Actions) baixa toda madrugada as rotas de ontem, guarda
  as rotas cruas no R2 da Cloudflare (bucket novo, 30 dias) e grava o resumo na mesma tabela deste desenho.

**Fora deste trabalho:** R2, coletor noturno, Timeline lendo do R2, sugestão de cercas novas.

## Dados

### Tabela nova `analise_paradas` (Supabase PRODUTIVIDADE)

Uma linha por parada (GPS abaixo de 5 km/h por 3 min ou mais, a mesma regra do `classificar.js`):

| coluna | o que é |
|---|---|
| `dia` date | dia local |
| `veiculo_id` text | id do veículo no GAUSS |
| `placa` text | placa como o GAUSS grava |
| `ini`, `fim` integer | segundos do dia (início e fim da parada) |
| `lat`, `lng` double | posição média da parada |
| `area` text, nulo | cerca do GAUSS onde parou (a menor, como no site); nulo = fora das cercas |
| `motor` jsonb | minutos de cada status do motor do GAUSS durante a parada, ex.: `{"stopped": 42.5, "off": 10}` |
| `apont` text[] | categorias do tablet que cobrem a parada |

- Chave única `(dia, veiculo_id, ini)`: reenviar o mesmo dia substitui, não duplica.
- **Só fatos, nenhuma regra gravada.** Produtivo, base, categoria do local e "sem produzir" são calculados na tela com as
  regras de `src/lib/dominio/`. Mudou a regra → o mapa já mostra o novo cálculo, sem reenviar nada.
- RLS: qualquer um lê (a página é pública); só a chave secreta grava (o PC agora, o puxador depois).
- **Limpeza automática:** pg_cron apaga todo dia as linhas com `dia` de mais de 30 dias.
- Tamanho: ~370 paradas por dia → 30 dias ≈ 11 mil linhas (~2 MB). A tela lê tudo de uma vez (em páginas de 1000) e
  filtra no navegador.

### Envio único do PC

`automation/historico/enviar.js` (+ atalho `Enviar Historico ao Site.bat`): lê `data/historico/` com a mesma detecção de
parada do `classificar.js` e grava em `analise_paradas` pelo `supabase-client.js` que já existe (a chave fica no `.env`
do PC, nunca no código). **Nenhuma consulta ao GAUSS.** Só manda dias dos últimos 30.

## Regras (puras, com testes, em `src/lib/dominio/analise.ts`)

- **Produtivo:** `statusProdutivo` (Alta Pressão = motor 2º; Alto Vácuo e DSY6472 = parado ligado; Hiper Vácuo, Brook e
  Aspiradores sem regra).
- **Base:** cerca da base (`ehBase`: Pátio do Transporte, Garagem; a Baia de Resíduos conta) **ou** ponto sem cerca
  classificado como Base/pernoite. O produtivo ali vira "motor ligado na base".
- **Parado ligado sem produzir:** minutos ligados (on, stopped, motor 2º) da parada menos o produtivo que conta. Na base,
  todo o ligado entra aqui. Só para tipos com regra; os sem regra ficam fora e o painel avisa.
- **Pontos sem cerca:** paradas fora das cercas a menos de 120 m umas das outras, vistas 3 ou mais vezes, viram um
  ponto ("Ponto perto de ALTO FORNO 3"); as que sobram ficam em "Fora de área (avulso)", que não aparece no mapa.
  Os pontos são calculados sobre os 30 dias inteiros (sem os filtros), para não mudarem de nome ao filtrar.
- **Tipo de local** (sobre o período inteiro, sem os filtros, para não mudar de cor ao filtrar): pelo nome (Base,
  Abastecimento, Descarte, Oficina/apoio); senão, produz em 15% ou mais do tempo parado com motor = Serviço; parada média
  de 2 h ou mais = Base/pernoite; senão Espera/passagem.
- **Horário:** pela hora de início da parada — madrugada (0–6 h), manhã (6–12 h), tarde (12–18 h), noite (18–24 h).
- **Supervisor e regime:** da matriz de equipamentos atual (`equip.supervisor`, `equip.regime` do retrato). Placa fora da
  matriz ou desmobilizada não entra.

## A tela (`src/app/analise/`, menu "Análise")

```
┌ funil (filtros) ──────────────┐                     ┌ ranking (10) ──┐
│ Período: 7 · 15 · 30 dias     │    MAPA (satélite)  │ 1 Alto Forno 3 │
│ Medida ▾                      │  cercas pintadas    │   42 h ▓▓▓▓▓▓  │
│ Tipo · Supervisor · Regime    │  do claro ao escuro │ 2 ...          │
│ Hora: madrug manhã tarde noite│  ● pontos sem cerca │                │
│ Dia: S T Q Q S S D            │                     │                │
└───────────────────────────────┘  legenda 0 ░▒▓█ 42 h └────────────────┘
```

- **Medidas** (uma por vez): Produtivo · Parado ligado sem produzir · Tempo parado · Visitas · Tipo de local (cores por
  categoria, com legenda e rótulo) · Apontamentos (cor pelo apontamento mais comum).
- **Mapa:** cercas do tipo área (`lerCercas`, já em cache) pintadas em 5 faixas de cor; pontos sem cerca como círculos.
  Área sem dado no filtro fica só com o contorno.
- **Passar o mouse:** balão com nome e valor. **Clicar:** painel com totais (produtivo, sem produzir, motor ligado na
  base, tempo parado, visitas, % produtivo), **quem atende** (equipamento, visitas, horas; cada um abre a Timeline do
  último dia em que esteve lá), horário (barras por hora do dia) e apontamentos mais comuns.
- **Ranking:** as 10 áreas com mais da medida; clicar centraliza o mapa e abre o painel.
- **Celular:** mapa na tela inteira, filtros no funil, painel da área na gaveta (a mesma do resto do site, que no celular
  ocupa a largura toda).
- **Visual:** padrão SST/Campo; cor sempre com rótulo; a medida e o período ficam lembrados no navegador (`useOpcao`,
  como as outras telas).
- Sem dados ainda: aviso "o histórico ainda não foi enviado".

## Arquivos

- `supabase/analise.sql`: tabela, índice por dia, RLS e o pg_cron de limpeza.
- `src/lib/dominio/analise.ts` (+ teste): agregação por área, pontos sem cerca, categorias, filtros.
- `src/lib/dados/analise.ts` (+ teste): leitura validada com zod, em cache por aba.
- `src/app/analise/page.tsx` e `_componentes/` (mapa, funil, painel, ranking).
- Menu: `src/components/barra-superior.tsx`.
- `automation/historico/enviar.js` e o `.bat`.
- README (item novo nos Pontos de atenção) e LEIA-ME.

## Testes

- Unidade: regras de `analise.ts` (produtivo/base/sem produzir por parada, agrupar pontos, categoria, filtros de hora,
  dia e supervisor) e a leitura (formato inválido avisa).
- e2e (dados sintéticos, nada gravado): abre a tela, troca a medida, filtra por tipo, clica numa área e vê "quem atende";
  computador e celular.
- Antes de publicar: lint, typecheck, test, build e e2e.

## Cautelas

- Zero consulta nova ao GAUSS neste trabalho.
- O SQL é rodado pelo dono no SQL Editor (como os outros arquivos de `supabase/`).
- O envio do PC só roda quando o dono abrir o `.bat`.

# Repaginação "Campo" do Monitoramento — desenho

> 02/10/2026 · branch `repaginacao-campo` · modelo: `Desktop/SST - Mecanizada/sistema`

## Objetivo

Levar o Monitoramento de Localização (este repositório) para a mesma estrutura, organização, layout, modularização e tipagem do sistema SST - Mecanizada: Next.js 16 com exportação estática, TypeScript estrito, Tailwind v4 com a identidade visual "Campo", componentes reutilizáveis, regras de domínio puras e testadas, CI de qualidade.

**Sucesso =** as três telas (Localização, Timeline, Alertas) e o coletor fazem tudo o que fazem hoje, no mesmo link, com a cara do SST, e `npm run lint && npm run typecheck && npm test && npm run build` passam.

## Decisões (combinadas em 02/10/2026)

| Tema | Decisão |
|---|---|
| Escopo | Site **e** coletor em TypeScript, com tipos e regras compartilhados |
| Acesso | Continua **público** (sem login). RLS do Supabase não muda |
| Hospedagem | **GitHub Pages, mesmo link** (`grupogps-mecanizada.github.io/Monitoramento-De-Produtividade`) |
| Visual | Identidade **"Campo" do SST inteira** (tokens, fonte Inter, barra escura, logo SGE, claro/escuro) |
| Abordagem | **Projeto único** no molde do SST (raiz = app Next; `coletor/` com `package.json` enxuto) |

## Fora do escopo

- Login, perfis ou limites por usuário.
- Mudanças no banco (`supabase/schema.sql`, `supabase/disparo.sql`) ou no Vault.
- Novas funções nas telas. O que existe é portado; nada é acrescentado além do que a estrutura do SST traz (paleta Ctrl K, gaveta, tema).
- Mudanças na forma de consultar o GAUSS (frequência, quantidade, cache).

## O que precisa sobreviver (inventário do sistema atual)

**Localização** (`index.html` + `app.js` + `mobile.js`): mapa Leaflet com satélite (Esri, `maxNativeZoom` 18) e ruas (OSM); marcadores agrupados (markercluster, sem agrupar a partir do zoom 18) com cor por status e tracejado sem sinal; cercas (planta tracejada, via, área); legenda; abas Veículos / Áreas / Eventos com contadores; busca (placa, vaga, área, motorista); filtro ativo (KPI, área); eventos por dia e por tipo (entrada, saída, status, sinal); detalhe do veículo com histórico do dia (pedido ao coletor com andamento), trechos clicáveis no mapa, exportar CSV; zoom inicial na frota; faixa de erro e de "acesso ao GAUSS pausado"; indicador de leitura atrasada (> 3 × intervalo); contador de requisições ao GAUSS; links diretos `#v=<id>&hist=<dia>` e `#cerca=<nome>`.

> A "pausa por inatividade" do `app.js` está **desligada** no site publicado (`MODO_TV = true`: a página só lê do Supabase e não gera consulta ao GAUSS). Não é portada.

**Celular** (`mobile.js`/`mobile.css`): foco no mapa; gaveta que, fechada, vira barra de resumo/cartão do veículo; busca geral (veículos, cercas com ocupação, eventos) com buscas recentes (`localStorage`); player flutuante com painel retrátil de opções; play aproxima no caminhão.

**Timeline** (`timeline.html`): seletor de veículo (com filtro) e dia; rota no mapa por estado; player (▶/pausa, arrastar, pular deslocamento, velocidade, rumo do ícone); lista de trechos com foco no mapa; apontamento, resumo e tempo por área (computador).

**Alertas** (`alertas.html`): dia; indicadores; chips por tipo; lista; detalhe do alerta; status da conexão.

**Coletor** (`coletor/*.js`): ver Parte 3.

## Parte 1 — Layout e navegação

### Computador

- **Barra superior "Campo"** (componente `barra-superior.tsx` portado do SST): altura 62 px, fundo `--nav`; logo SGE + "Monitoramento · Grupo GPS" / "Mecanizada"; trilho de navegação com ícones: **Localização** (`/`), **Timeline** (`/timeline`), **Alertas** (`/alertas`), tela atual destacada (`bg-nav-ativo`, ícone `#8fb1f5`); à direita: botão de busca **Ctrl K**, botão de tema e, no lugar do menu de usuário, o **indicador ao vivo** ("atualizado 12:05:39 · a cada 5 min"; verde em dia, amarelo depois de 3 ciclos sem leitura (15 min) ou reconectando, vermelho com erro do coletor — mesma regra do site atual) com o contador de requisições ao GAUSS no título.
- **Localização:** tela cheia (como a Matriz do SST, sem margens do `<main>`). Painel lateral = cartão (`--superficie`, `--sombra-2`, raio 14 px) com abas segmentadas e filtros no cabeçalho; mapa ocupa o resto. Detalhe do veículo dentro do painel (troca de vista, com voltar).
- **Timeline:** barra de seleção (veículo + dia) no topo; mapa com o player; cartão lateral com apontamento, resumo e tempo por área.
- **Alertas:** fileira de indicadores (estilo do Dashboard do SST), lista com chips de tipo; detalhe numa **gaveta** lateral (`gaveta.tsx` do SST).

### Celular

- Cabeçalho compacto do SST (logo, nome da tela, horário da última leitura, tema); a busca fica na barra inferior.
- Barra inferior: **Mapa · Timeline · Alertas · Buscar**.
- Mantidos, redesenhados com os componentes Campo: gaveta de resumo/cartão do veículo, player flutuante com opções retráteis, busca geral com recentes — que passa a ser a **paleta Ctrl K** (`paleta.tsx`), com resultados de veículos, cercas e eventos.

### Status e cores

Sempre cor + ícone + rótulo, com os tokens de status do SST:

| Categoria | `status_cod` | Token |
|---|---|---|
| Ligado | 1 | `ok` |
| Parado ligado | 3 | `warn` |
| Desligado | 2, 4, 71, 98 | `bad` |
| Manutenção | 5, 9 | `na` (laranja) |
| Sem comunicação | 7 | `neu` |
| Outros | demais | `reg` |

Estados do histórico (movimento, parado ligado, desligado, parado, sem sinal) usam as mesmas famílias; movimento usa `--serie-1`. No mapa (Leaflet), os marcadores usam os valores `-dot` dos tokens lidos do CSS.

### Tema

Igual ao SST: `data-tema="claro|escuro"` no `<html>`, aplicado por script inline antes da primeira pintura, chave `mon-tema` no `localStorage`; sem escolha, segue o sistema. Os tiles do mapa não mudam com o tema; só painéis e controles.

### Regras de interface herdadas do SST

Poucos botões; textos didáticos; sem títulos grandes; cantos arredondados e camadas com sombra; filtros no cabeçalho; não usar CSS `zoom`.

## Parte 2 — Tipos e camada de dados

### `src/lib/tipos.ts` (site + coletor)

Derivados do código e dos dados reais atuais (sem inventar campos):

- `StatusCod`, `CategoriaVeiculo`, `EstadoTrecho` (`movimento | parado_ligado | desligado | parado | sem_sinal`).
- `Veiculo` (formato do `estado` do coletor + `motor2?` / `motor2_de?`), `Motor2Resumo`.
- `Retrato` (= `loc_kv.snapshot`: `lido_em`, `erro`, `intervalo_s`, `sem_sinal_min`, carga, `veiculos`).
- `Cerca` (`name`, `color`, `polygon`, `tipo: planta | via | area`).
- `Evento` (`tipo: entrada | saida | status | sinal_perdido | sinal_retomado`, `t`, `veiculo_id`, …).
- `Apontamento` (= retorno de `montarApontamento`: `temRpm`, `rpm_travado`, `motor2_rpm_travado`, `trechos`, `resumo`, `pontos` como tupla `[lat, lng, hora, vel, estado, motor2]`, `motor2`), `Trecho` (união discriminada por `estado`), `ResumoDia`.
- `Historico` (= `loc_historico.resultado` + `fonte`/`aviso`), `Pedido` (`status: pendente | processando | pronto | erro`).

### Validação (zod)

`src/lib/dados/esquemas.ts`: esquemas zod para o que vem em `jsonb` (retrato, cercas, resultado do histórico, `dados` do evento). Ao ler, `safeParse`; em falha, a tela mostra "dados em formato inesperado — avise o responsável" (via `estado-tela.tsx`) e registra no console. Os tipos de `tipos.ts` e os esquemas são mantidos juntos (`z.infer` onde couber).

### `src/lib/dados/` (substitui `api-supabase.js`)

| Arquivo | Responsabilidade |
|---|---|
| `../supabase/cliente.ts` | cliente único (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `use-retrato.ts` | hook do retrato: leitura inicial, Realtime em `loc_kv` (`chave=eq.snapshot`, relê o retrato inteiro), releitura a cada 2 min, estado de conexão; uma assinatura só, compartilhada pela barra e pela tela |
| `leituras.ts` | retrato, cercas (cache na aba), eventos do dia (limite 5000, por veículo opcional) e dias disponíveis (`loc_dias`, 120) |
| `use-eventos.ts` | eventos do dia com os novos chegando ao vivo (INSERT, só no dia de hoje) |
| `historico.ts` | `pedirHistorico(id, dia, { aoAndar, sinal })`: cache fresco (fechado ou < 10 min) devolve na hora; senão insere pedido (ignora `23505`), devolve versão antiga se houver, ou acompanha a cada 6 s por até 25 min, reportando `fila`/`processando` e tempo decorrido por callback; cancelável |

### `src/lib/dominio/` (puro, com testes)

`veiculo.ts` (categoria, frescor), `formato.ts` (`fmtMin`, `idadeCurta`, horas, dia local), `eventos.ts` (texto e grupo do evento), `frota.ts` (`normPlaca`, `parearMotores`), `geo.ts` (ponto no polígono, área, distância, `geofencesAt`), `cercas.ts` (`tipoCerca`), `apontamento.ts` (`rpmTravado`, `intervalosLigado`, `montarApontamento`), `leitura.ts` (`processarLeitura`, `montarSnapshot`), `csv.ts` (exportação do histórico).

Restrição: arquivos de `dominio/` e `tipos.ts` não importam nada com `@/`, nem React, nem Supabase — o coletor os importa por caminho relativo.

## Parte 3 — Coletor em TypeScript

```
coletor/
  package.json        @supabase/supabase-js + tsx; "type": "module"
  run.ts              orquestração (mesma ordem de hoje)
  gauss.ts            fila serial, login, sessão (.sessao-gauss.json), backoff, pausa após falhas, estatísticas
  location-online.ts  lista de veículos, posições, cercas
  historico.ts        baixarRota, mesclarPontos, diaFechado (usa dominio/apontamento)
  supabase.ts         cliente com chave secreta, ok(), kvGet/kvSet, acesso às tabelas loc_*
  config.ts           BASE_URL e checagem de variáveis/TZ
```

- **Comportamento idêntico:** constantes e regras de cautela preservadas (TTL de cadastro 24 h, cercas 7 dias, `MAX_PEDIDOS = 4`, `INTERVALO_S = 300`, `HOJE_TTL_MS`, sessão reaproveitada se usada há < 20 min, limpeza diária, registro de carga).
- **Paridade:** antes de portar, gravar amostras do coletor atual em `coletor/__amostras__/` (entradas: estado anterior, posições derivadas do retrato real com variações, cercas, pontos de rota; saídas: estado, eventos, retrato, apontamento). Testes do coletor novo exigem saída igual. As amostras são geradas lendo o que já está no Supabase e rodando as funções puras atuais — **sem consultar o GAUSS**. Como têm placas, posições e nomes de motoristas e o repositório é público, a pasta fica no `.gitignore` e o teste de paridade é pulado quando ela não existe (mesma solução da paridade com a planilha real no SST); testes com dados sintéticos cobrem as mesmas regras no CI.
- **Workflow `coletor.yml`:** mesmo nome, gatilhos, `concurrency` e segredos; passos: `npm ci --omit=dev` em `coletor/` e `npx tsx run.ts`. Acrescentar `if: github.ref == 'refs/heads/main'` no job para nunca rodar a partir da branch.
- `tsx` fica em `dependencies` do coletor (é usado em produção).

## Parte 4 — Build, publicação e troca

- **Raiz do repositório = app Next** (como `sistema/` do SST): `package.json`, `tsconfig.json` (estrito, alias `@/*`, inclui `coletor/**`), `eslint.config.mjs`, `vitest.config.mts`, `playwright.config.ts`, `postcss.config.mjs`, `next.config.ts`.
- **`next.config.ts`:** `output: "export"`, `images: { unoptimized: true }`, `basePath` vindo da variável `BASE_PATH` (o `pages.yml` passa `/Monitoramento-De-Produtividade`; local, CI e testes de navegador ficam na raiz), `trailingSlash: true` (Pages serve `timeline/index.html`).
- Leaflet e `leaflet.markercluster` via npm (+ `@types/leaflet`), carregados só no navegador (`next/dynamic` com `ssr: false`); CSS do Leaflet importado no componente do mapa. Sem CDN.
- Fonte Inter via `next/font/google` (servida pelo site). Logo SGE copiado para `public/`.
- **Workflows:**
  - `ci.yml` (push e PR): `npm ci`, `lint`, `typecheck`, `test`, `build`.
  - `pages.yml` (push na `main`): build e publicação de `out/` com `actions/upload-pages-artifact` + `actions/deploy-pages`; `concurrency: pages`.
  - `coletor.yml`: Parte 3.
- **Troca:** (1) tudo na branch `repaginacao-campo`; (2) teste local com `npm run dev` (dados reais, só leitura); (3) quando o dono disser "suba": merge na `main`, o dono muda **Settings → Pages → Source: GitHub Actions**, conferência do site no ar e da execução seguinte do coletor; (4) **volta atrás:** reverter o merge e voltar a fonte do Pages para "Deploy from a branch".
- `supabase/disparo.sql` e o token no Vault não mudam (o workflow do coletor mantém o nome do arquivo).

## Parte 5 — Testes e documentação

- **Vitest** (`src/**/*.test.ts`, `coletor/**/*.test.ts`): categoria, frescor, formato, texto de eventos, motor secundário, geo, RPM travado, apontamento, leitura/eventos, CSV, paridade com as amostras.
- **Playwright** (só leitura): as 3 telas no computador e no celular (viewport 390×844); abrir detalhe de veículo; player da Timeline. `page.route` intercepta `POST .../loc_pedidos` (devolve 201 vazio) para não criar pedidos reais. Rodar contra `npm run dev` ou `npx serve out`.
- **Docs no padrão do SST:** `README.md` (Pontos de atenção do dono, como rodar e publicar, arquitetura e pastas, banco, coletor, pendências), `AGENTS.md`/`CLAUDE.md`, esta spec. Atualizar o `LEIA-ME.md` da pasta `automatização GAUSS FLEET`.
- **Arquivos antigos removidos no merge:** `index.html`, `timeline.html`, `alertas.html`, `app.js`, `mobile.js`, `api-supabase.js`, `theme.css`, `style.css`, `mobile.css`, `coletor/*.js`.

## Correções pequenas incluídas

- **Alertas agrupados por hora:** hoje o agrupamento usa a hora UTC do registro (`ev.t.slice(11,13)`), então 14h aparece como 17h. Passa a usar a hora local.
- **CSV do apontamento:** Localização e Timeline usam a mesma função (com a coluna do motor secundário) e o mesmo nome de arquivo.
- **Ponto sem coordenada** (latitude/longitude vazia vinda do GAUSS) é ignorado no mapa e no player em vez de quebrar a tela.

## Riscos e cuidados

| Risco | Cuidado |
|---|---|
| Coletor novo calcular diferente | Testes de paridade com amostras reais antes da troca |
| Coletor rodar a partir da branch e consultar o GAUSS em dobro | `if: github.ref == 'refs/heads/main'` + `concurrency` mantido |
| Push com `coletor/**` na `main` disparar execução extra | Uma única subida na troca; uma execução a mais em 5 min é aceitável |
| Leaflet quebrar no build estático (usa `window`) | Componentes de mapa só no cliente (`ssr: false`) |
| Caminhos quebrados no Pages | `basePath` + `trailingSlash`; teste com `npx serve` simulando o subcaminho |
| Usuário com favorito em `timeline.html`/`alertas.html` | Páginas de redirecionamento `timeline.html` e `alertas.html` em `public/` apontando para as novas rotas |
| Chave publishable no código | É pública por natureza (já está hoje em `api-supabase.js`); a chave secreta continua só nos segredos do Actions |

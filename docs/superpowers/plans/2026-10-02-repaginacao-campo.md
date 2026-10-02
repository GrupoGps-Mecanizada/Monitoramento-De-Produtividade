# Repaginação "Campo" do Monitoramento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o Monitoramento de Localização (site + coletor) na estrutura do SST - Mecanizada: Next.js 16 estático, TypeScript estrito, Tailwind v4 com a identidade "Campo", regras puras testadas e coletor em TypeScript compartilhando tipos e regras com o site.

**Architecture:** A raiz do repositório vira o app Next (`src/app` telas, `src/components` UI, `src/lib/dominio` regras puras, `src/lib/dados` leituras do Supabase). O `coletor/` passa a ser TypeScript rodado com `tsx`, com `package.json` próprio e enxuto, e importa `src/lib/dominio` e `src/lib/tipos.ts` por caminho relativo. O banco (`loc_*`) e o RLS não mudam.

**Tech Stack:** Next.js 16.3.6 (output export), React 19.2.8, TypeScript 5 estrito, Tailwind v4, zod 4.6.5, @supabase/supabase-js 2.117.1, Leaflet 1.9.4 + leaflet.markercluster 1.5.3, Vitest 4.1.11, Playwright 1.63.0, tsx 4.23.15.

**Spec:** `docs/superpowers/specs/2026-10-02-repaginacao-campo-design.md` (ler antes de começar).

## Global Constraints

- Repositório: `C:\Users\Meu Computador\Desktop\automatização GAUSS FLEET\deploy\Monitoramento-De-Produtividade`, branch `repaginacao-campo`. Todos os caminhos deste plano são relativos a essa pasta. Shell: Git Bash.
- Projeto modelo (só leitura): `SST="/c/Users/Meu Computador/Desktop/SST - Mecanizada/sistema"`. Copie arquivos dele só onde o plano manda.
- Next 16 tem mudanças em relação ao que você conhece: em dúvida, leia `node_modules/next/dist/docs/` (já instalado após a Tarefa 1).
- Versões fixas iguais ao SST: `next 16.3.6`, `react`/`react-dom 19.2.8`, `zod 4.6.5`, `@supabase/supabase-js 2.117.1`, `vitest 4.1.11`, `@playwright/test 1.63.0`, `tsx 4.23.15`, `eslint-config-next 16.3.6`.
- Textos de tela, comentários, nomes de funções e mensagens de commit em **português**, no estilo do SST (linhas longas, sem Prettier no arquivo inteiro).
- ESLint ativo (do SST): `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity`, `react-hooks/immutability` como **erro**. Na prática: nada de `setState` síncrono no corpo de `useEffect` (só em callbacks, `.then`, depois de `await` ou em eventos); nada de ler/escrever `ref.current` durante a renderização; nada de `Date.now()`/`Math.random()` na renderização; para "zerar estado quando muda o item", use `key`.
- **Cautela com o GAUSS:** nenhuma tarefa consulta o GAUSS. O coletor só roda no GitHub Actions a partir da `main` (nunca da branch). Testar o histórico na tela cria um pedido real em `loc_pedidos` (o coletor atende no ciclo seguinte, como no site atual): faça no máximo **um** teste assim por tarefa, de preferência com um dia já baixado ("Ontem").
- **Dados reais:** a página só lê o Supabase e cria pedido de histórico. Nos testes de navegador, todas as leituras do Supabase são interceptadas com dados sintéticos e nenhuma gravação passa.
- O site atual continua no ar no GitHub Pages até o dono dizer "suba". Não fazer merge, push na `main` nem mudar configurações do GitHub.
- Acompanhamento ao vivo pelo dono: depois da Tarefa 1, mantenha `npm run dev` rodando em segundo plano (http://localhost:3000). O site antigo fica em http://localhost:5800 para comparação.
- Commits pequenos, um por tarefa (ou por passo, quando indicado), terminando com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`

## Review Focus

1. **Veículo ou ponto sem coordenada** (GAUSS manda latitude vazia → `null` no JSON): o mapa ignora o marcador, o histórico ignora o ponto e nada quebra. Testes: `esquemas.test.ts` (Tarefa 2) e `rota.test.ts` (Tarefa 12).
2. **Antes da 1ª leitura do coletor** (sem `snapshot` no banco): a barra mostra "aguardando 1ª leitura…" e as telas mostram lista vazia, sem erro. Testes: `esquemas.test.ts` (Tarefa 2) e `conexao.test.ts` (Tarefa 11).
3. **Link antigo com o motor secundário** (`?v=<id ou placa do motor 2º>` na Timeline): abre o caminhão principal. Teste: `resolverVeiculo` em `veiculo.test.ts` (Tarefa 14).
4. **Alertas agrupados por hora local**, não UTC (evento 14:30 em Ipatinga fica no grupo "14:00 – 14:59"). Teste: `eventos.test.ts` (Tarefa 3).
5. **Busca de placa com hífen, minúsculas ou sem acento** ("egc-2984", "manutencao") acha o veículo. Teste: `busca.test.ts` (Tarefa 11).

## Mapa de arquivos

```
package.json, tsconfig.json, next.config.ts, eslint.config.mjs, vitest.config.mts, postcss.config.mjs, playwright.config.ts
.env.example, .gitignore, README.md, AGENTS.md, CLAUDE.md
public/logo-sge.png, public/timeline.html, public/alertas.html (redirecionam os endereços antigos)
src/app/
  layout.tsx, globals.css, icon.png, apple-icon.png, favicon.ico
  page.tsx                      Localização
  _localizacao/                 localizacao.tsx, painel.tsx, detalhe.tsx, mapa-frota.ts, resumo-celular.tsx
  timeline/page.tsx             + _componentes/ timeline.tsx, seletor-veiculo.tsx, conteudo.tsx
  alertas/page.tsx              + _componentes/ alertas.tsx
src/components/
  ui.tsx, icones.tsx, estado-tela.tsx, avisos.tsx, gaveta.tsx, folha.tsx
  barra-superior.tsx, indicador-vivo.tsx, paleta.tsx, casca.tsx
  mapa/  leaflet.ts, use-mapa.ts, legenda.tsx, rota.ts
  historico/  resumo.tsx, trechos.tsx, tempo-area.tsx, andamento.tsx, use-player.ts, barra-tempo.tsx
src/lib/
  tipos.ts, cores.ts, marca.ts, menu.ts, navegacao.ts, hooks.ts, tema.ts, busca.ts, player.ts, arquivo.ts
  supabase/cliente.ts
  dados/  esquemas.ts, leituras.ts, historico.ts, use-retrato.ts, use-eventos.ts
  dominio/ formato.ts, veiculo.ts, eventos.ts, frota.ts, geo.ts, cercas.ts, apontamento.ts, leitura.ts, conexao.ts, csv.ts
  mapa/  marcador.ts, rota.ts
coletor/  package.json, config.ts, gauss.ts, location-online.ts, historico.ts, supabase.ts, run.ts, paridade.test.ts, historico.test.ts
e2e/      apoio.ts, localizacao.spec.ts, timeline.spec.ts, alertas.spec.ts
.github/workflows/  ci.yml, pages.yml, coletor.yml
```

Removidos na Tarefa 16: `index.html`, `timeline.html`, `alertas.html`, `app.js`, `mobile.js`, `api-supabase.js`, `theme.css`, `style.css`, `mobile.css`. O `coletor/*.js` sai na Tarefa 8.

---

### Task 1: Esqueleto Next + TypeScript + Tailwind com a identidade "Campo"

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `vitest.config.mts`, `postcss.config.mjs`, `.env.example`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `src/lib/marca.ts`, `public/logo-sge.png`, `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`
- Modify: `.gitignore` (substituir inteiro)

**Interfaces:**
- Produces: alias `@/*` → `src/*`; `BASE` e `MARCA` em `src/lib/marca.ts`; tokens de cor do SST + `--motor2`, classes `.st-*`, `.st-mov`, `.st-motor2`, `.altura-tela`, `.mk`, `.cl`, `.mk-play` em `globals.css`; utilitários Tailwind `bg-superficie`, `text-suave`, `text-motor2`, `bg-nav` etc.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "monitoramento-localizacao",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "serve out -l 3210 --no-clipboard",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.117.1",
    "leaflet": "1.9.4",
    "leaflet.markercluster": "1.5.3",
    "next": "16.3.6",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@playwright/test": "1.63.0",
    "@tailwindcss/postcss": "^4",
    "@types/leaflet": "^1.9.12",
    "@types/leaflet.markercluster": "^1.5.4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.6",
    "serve": "^14.2.4",
    "tailwindcss": "^4",
    "tsx": "4.23.15",
    "typescript": "^5",
    "vitest": "4.1.11"
  }
}
```

`"type": "module"` é necessário: o coletor (ESM) importa `src/lib/dominio/*.ts`, que fica sob este `package.json`.

- [ ] **Step 2: Configurações**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["**/node_modules", "out"]
}
```

`next.config.ts`:

```ts
import type { NextConfig } from "next";

/**
 * Site estático (GitHub Pages): `next build` gera a pasta out/. Não há servidor: a página só lê do Supabase
 * (chave publishable + RLS) e pode criar pedido de histórico, que o coletor atende.
 * BASE_PATH vem do workflow do Pages ("/Monitoramento-De-Produtividade"); local, CI e testes ficam na raiz.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // o Pages serve timeline/index.html em /timeline/
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
};

export default nextConfig;
```

`eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coletor/node_modules/**",
    "test-results/**",
    "playwright-report/**",
    // site antigo (HTML + JS puro): sai na Tarefa 16; coletor em JS: sai na Tarefa 8
    "*.js",
    "coletor/*.js",
    "coletor/scripts/**",
  ]),
]);

export default eslintConfig;
```

`vitest.config.mts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// horários do GAUSS são locais: as regras são testadas no fuso da usina
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "coletor/**/*.test.ts"],
    environment: "node",
    pool: "threads",
  },
});
```

`postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

`.env.example`:

```
# Copie para .env.local (npm run dev). Valores PÚBLICOS: a chave publishable só lê e cria pedido de histórico (RLS em supabase/schema.sql).
NEXT_PUBLIC_SUPABASE_URL=https://mfsyrsegkvjmefcdaegh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_rw878qLgcmUdixI8QsejBA_lSXYAsIv
```

`.gitignore` (substitui o atual):

```
node_modules/
/.next/
/out/
*.tsbuildinfo
next-env.d.ts
.env*
!.env.example
/test-results/
/playwright-report/
coletor/.sessao-gauss.json
# amostras do coletor antigo: têm placas, posições e motoristas (o repositório é público)
coletor/__amostras__/
```

- [ ] **Step 3: Identidade e arquivos copiados do SST**

```bash
SST="/c/Users/Meu Computador/Desktop/SST - Mecanizada/sistema"
mkdir -p public src/app src/lib
cp "$SST/public/logo-sge.png" public/
cp "$SST/src/app/icon.png" "$SST/src/app/apple-icon.png" "$SST/src/app/favicon.ico" src/app/
cp "$SST/src/app/globals.css" src/app/globals.css
cp .env.example .env.local
```

Em `src/app/globals.css`, troque o comentário do topo (o bloco `/* Identidade visual "Campo", refinada (28/09/2026)... */`) por:

```css
/*
 * Identidade visual "Campo" — a mesma do SST - Mecanizada (barra superior escura, azul #1d4fa3, camadas com sombra).
 * Tema: segue o sistema operacional; o botão de tema grava a escolha em <html data-tema>.
 * Os tokens abaixo são cópia do SST: mudança de cor deve ser feita nos dois sistemas.
 */
```

Apague o bloco `.planilha-barra-extra { ... }` (é da planilha do SST) e acrescente ao fim do arquivo:

```css
/* ---------- Monitoramento: motor secundário, trecho em movimento, altura das telas e mapa ---------- */
:root { --motor2: #0891b2; }
:root[data-tema="escuro"] { --motor2: #22d3ee; }
@media (prefers-color-scheme: dark) { :root:not([data-tema="claro"]) { --motor2: #22d3ee; } }
@theme inline { --color-motor2: var(--motor2); }

.st-mov { background: color-mix(in srgb, var(--serie-1) 15%, transparent); color: var(--serie-1); }
.st-motor2 { background: color-mix(in srgb, var(--motor2) 15%, transparent); color: var(--motor2); }

/* telas de mapa ocupam o espaço entre a barra superior e (no celular) a barra inferior */
.altura-tela { height: calc(100dvh - 56px - 64px); }
@media (min-width: 768px) { .altura-tela { height: calc(100dvh - 62px); } }

.leaflet-container { font-family: var(--font-sans); background: #1b1f27; }
.leaflet-tooltip.rotulo-cerca { font: 600 11px var(--font-sans); }
/* marcador do veículo: cor do status (--c), seta na direção, idade da posição */
.mk {
  position: absolute; transform: translate(-50%, -50%);
  display: inline-flex; align-items: center; gap: 5px;
  background: var(--c); color: #fff; white-space: nowrap;
  border: 2px solid #fff; border-radius: 999px; padding: 1px 8px 1px 4px;
  font: 700 11px/1.5 var(--font-sans);
  box-shadow: 0 1px 5px rgba(0, 0, 0, .45); cursor: pointer;
}
.mk .seta { width: 14px; height: 14px; display: grid; place-items: center; font-size: 10px; line-height: 1; }
.mk small { font-weight: 500; opacity: .9; }
.mk .m2 { margin-left: 3px; font-size: 11px; color: #a5f3fc; text-shadow: 0 0 3px #0e7490; }
.mk.semsinal { opacity: .6; border-style: dashed; }
.mk.sel { outline: 3px solid #8fb1f5; outline-offset: 1px; z-index: 1; }
/* agrupamento de marcadores */
.cl {
  width: 38px; height: 38px; display: grid; place-items: center;
  background: var(--primaria); color: #fff; border: 3px solid rgba(255, 255, 255, .85); border-radius: 50%;
  font: 800 13px var(--font-sans); box-shadow: 0 1px 6px rgba(0, 0, 0, .45);
}
.cerca-achada { animation: pulsoCerca 1.2s ease-in-out 3; }
@keyframes pulsoCerca { 50% { stroke-opacity: .25; } }
/* caminhão do player da Timeline */
.mk-play {
  position: absolute; transform: translate(-50%, -50%); display: grid; place-items: center;
  width: 34px; height: 34px; border-radius: 50%; background: var(--c, var(--serie-1));
  border: 3px solid #fff; box-shadow: 0 0 0 2px #0b1220, 0 2px 10px rgba(0, 0, 0, .6); color: #fff; font-size: 15px;
}
.mk-play .seta-play { display: block; line-height: 1; transition: transform .15s linear; }
.mk-play .m2 {
  position: absolute; right: -9px; top: -9px; width: 18px; height: 18px; border-radius: 50%;
  background: var(--motor2); border: 2px solid #fff; font-size: 10px; display: grid; place-items: center;
}
```

`src/lib/marca.ts`:

```ts
/** Identidade do sistema (título, barra superior): a mesma do SST, com o nome deste sistema. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const NOME_SISTEMA = "Monitoramento - Grupo GPS - Mecanizada";
export const MARCA = { sigla: "Monitoramento", empresa: "Grupo GPS", area: "Mecanizada", dona: "SGE", logo: `${BASE}/logo-sge.png` } as const;
```

- [ ] **Step 4: Layout raiz e página provisória**

`src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { NOME_SISTEMA } from "@/lib/marca";

// fontes baixadas no build e servidas pelo próprio site
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: NOME_SISTEMA,
  description: "Mapa ao vivo da frota, trajeto do dia com reprodução e alertas de área, status e sinal",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#12151b" };

/** Aplica o tema escolhido antes da primeira pintura (sem piscar). */
const TEMA = `try{var t=localStorage.getItem("mon-tema");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (provisória, trocada na Tarefa 13):

```tsx
export default function Pagina() {
  return <main className="p-8 text-suave">Monitoramento · em construção</main>;
}
```

- [ ] **Step 5: Instalar, compilar e conferir**

```bash
npm install
npm run build && ls out/index.html
npm run typecheck && npm run lint
```

Esperado: `out/index.html` existe; typecheck e lint sem erros.

- [ ] **Step 6: Servidor de acompanhamento**

Rodar em segundo plano (fica ligado até o fim do plano): `npm run dev` → http://localhost:3000 mostra "Monitoramento · em construção" com o fundo cinza-azulado do SST.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts eslint.config.mjs vitest.config.mts postcss.config.mjs .env.example .gitignore src public
git commit -m "Esqueleto Next + TypeScript + Tailwind com a identidade Campo do SST

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tipos compartilhados e validação dos dados do banco

**Files:**
- Create: `src/lib/tipos.ts`, `src/lib/dados/esquemas.ts`
- Test: `src/lib/dados/esquemas.test.ts`

**Interfaces:**
- Produces (`src/lib/tipos.ts`, sem imports): `LatLng`, `Tom`, `CategoriaVeiculo`, `Frescor`, `EstadoTrecho`, `TipoCerca`, `CercaGauss`, `Cerca`, `EstadoVeiculo`, `Motor2Resumo`, `Veiculo`, `CargaGauss`, `Retrato`, `TipoEvento`, `Evento`, `PontoRota`, `TrechoMovimento`, `TrechoParado`, `Trecho`, `ResumoDia`, `PontoMapa`, `Apontamento`, `FonteHistorico`, `Historico`, `StatusPedido`.
- Produces (`esquemas.ts`): `class FormatoInesperado extends Error`; `RETRATO_VAZIO: Retrato`; `validarRetrato(v: unknown): Retrato` (null/undefined → `RETRATO_VAZIO`); `validarCercas(v: unknown): Cerca[]` (null → `[]`); `validarEvento(v: unknown): Evento`; `validarHistorico(v: unknown): Historico` (tira pontos sem coordenada).

- [ ] **Step 1: Escrever `src/lib/tipos.ts`**

```ts
/**
 * Formatos dos dados do Monitoramento, usados pelo site e pelo coletor (coletor/ importa este arquivo por
 * caminho relativo: ele não importa nada). Tirados do código do coletor e do que está gravado no Supabase
 * PRODUTIVIDADE (tabelas loc_*).
 */

export type LatLng = [number, number];
/** Tom de cor da identidade "Campo" (tokens --ok-dot, --warn-dot... em globals.css); mov = --serie-1, motor2 = --motor2. */
export type Tom = "ok" | "warn" | "bad" | "na" | "neu" | "reg" | "mov" | "motor2";

export type CategoriaVeiculo = "ligado" | "parado" | "desligado" | "manut" | "semcom" | "outro";
export type Frescor = "vivo" | "atrasado" | "semsinal";
export type EstadoTrecho = "movimento" | "parado_ligado" | "desligado" | "parado" | "sem_sinal";
export type TipoCerca = "planta" | "via" | "area";

/** Cerca (geofence) como vem do GAUSS. */
export interface CercaGauss {
  code: number;
  name: string;
  layer: number;
  color: string;
  polygon: LatLng[];
}
/** Cerca com o tipo calculado pelo coletor (loc_kv.cercas). */
export interface Cerca extends CercaGauss {
  tipo: TipoCerca;
}

/** Estado de um veículo guardado pelo coletor (loc_kv.estado) a cada leitura. */
export interface EstadoVeiculo {
  id: string;
  placa: string;
  vaga: string;
  grupo: string;
  motorista: string;
  endereco: string;
  demora: string;
  direcao: number;
  status: string;
  status_cod: number;
  /** null = o monitoramento começou com o veículo já nesse status (não se sabe desde quando) */
  status_desde: string | null;
  /** coordenada vazia do GAUSS vira NaN, que o JSON grava como null */
  lat: number | null;
  lng: number | null;
  posicao_em: string | null;
  area: string;
  area_desde: string | null;
  via: string;
  sem_sinal: boolean;
}

export interface Motor2Resumo {
  id: string;
  placa: string;
  status: string;
  status_cod: number;
  status_desde: string | null;
  posicao_em: string | null;
  sem_sinal: boolean;
}

/** Veículo no retrato: o motor secundário vai dentro do caminhão (motor2) e também aparece sozinho, marcado com motor2_de. */
export interface Veiculo extends EstadoVeiculo {
  motor2?: Motor2Resumo;
  motor2_de?: string;
}

export interface CargaGauss {
  dia: string;
  requisicoes: number;
  logins: number;
  erros: number;
}

/** loc_kv.snapshot: o que a página mostra. */
export interface Retrato {
  lido_em: string | null;
  erro: { em: string; msg: string } | null;
  intervalo_s: number;
  sem_sinal_min: number;
  gauss?: CargaGauss & { desde: string; pausadoAte: string | null };
  veiculos: Veiculo[];
}

export type TipoEvento = "entrada" | "saida" | "status" | "sinal_perdido" | "sinal_retomado";
interface EventoBase {
  t: string;
  id: string;
  placa: string;
  vaga: string;
  /** evento do motor secundário: aparece no caminhão principal */
  motor2?: true;
  principal_id?: string;
  principal?: string;
}
/** loc_eventos.dados */
export type Evento = EventoBase &
  (
    | { tipo: "entrada"; area: string; lat: number | null; lng: number | null }
    | { tipo: "saida"; area: string; desde: string | null; permanencia_min: number | null }
    | { tipo: "status"; de: string; para: string; area: string; duracao_min: number | null }
    | { tipo: "sinal_perdido"; ultima_posicao: string | null; area: string }
    | { tipo: "sinal_retomado"; area: string; sem_sinal_min: number | null }
  );

/** Ponto da rota do GAUSS (loc_historico.pontos): t em horário local "AAAA-MM-DD HH:MM:SS". */
export interface PontoRota {
  t: string;
  lat: number;
  lng: number;
  vel: number;
  rpm: number;
}

interface TrechoBase {
  inicio: string;
  fim: string;
  duracao_min: number;
  motor2_min?: number;
}
export interface TrechoMovimento extends TrechoBase {
  estado: "movimento";
  de: string;
  para: string;
  percurso: string[];
  km: number;
  vel_max: number;
}
export interface TrechoParado extends TrechoBase {
  estado: Exclude<EstadoTrecho, "movimento">;
  local: string;
  lat?: number | null;
  lng?: number | null;
}
export type Trecho = TrechoMovimento | TrechoParado;

export interface ResumoDia {
  primeiro: string;
  ultimo: string;
  pontos: number;
  km: number;
  vel_max: number;
  movimento_min: number;
  parado_ligado_min: number;
  desligado_min: number;
  parado_min: number;
  sem_sinal_min: number;
  motor2_ligado_min: number | null;
  areas: { area: string; min: number }[];
}

/** Ponto leve para o mapa: [lat, lng, hora "HH:MM:SS", km/h, estado, motor 2º ligado (1/0; null = sem motor 2º)]. */
export type PontoMapa = [number, number, string, number, EstadoTrecho, 0 | 1 | null];

export interface Apontamento {
  temRpm: boolean;
  /** ausentes quando o dia não tem pontos */
  rpm_travado?: number | null;
  motor2_rpm_travado?: number | null;
  trechos: Trecho[];
  resumo: ResumoDia | null;
  pontos: PontoMapa[];
  motor2: { intervalos: [string, string][]; id?: string; placa?: string } | null;
}

export type FonteHistorico = "cache" | "incremental" | "gauss";
/** loc_historico.resultado (+ aviso que a página acrescenta). */
export interface Historico extends Apontamento {
  id: string;
  dia: string;
  fonte: FonteHistorico;
  baixado_em: string;
  motor2_erro: string | null;
  aviso?: string;
}

export type StatusPedido = "pendente" | "processando" | "pronto" | "erro";
```

- [ ] **Step 2: Escrever o teste `src/lib/dados/esquemas.test.ts`**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormatoInesperado, RETRATO_VAZIO, validarCercas, validarEvento, validarHistorico, validarRetrato } from "./esquemas";

const veiculo = {
  id: "10", placa: "EOF5208", vaga: "V1", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0,
  status: "Ligado", status_cod: 1, status_desde: null, lat: -19.4, lng: -42.5, posicao_em: "2026-10-01T12:00:00.000Z",
  area: "", area_desde: null, via: "", sem_sinal: false,
};
const retrato = { lido_em: "2026-10-01T12:00:00.000Z", erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [veiculo] };
const historico = {
  id: "10", dia: "2026-10-01", fonte: "gauss", baixado_em: "2026-10-01T12:00:00.000Z", motor2_erro: null,
  temRpm: true, rpm_travado: null, motor2_rpm_travado: null, motor2: null,
  trechos: [{ estado: "parado_ligado", inicio: "2026-10-01 08:00:00", fim: "2026-10-01 08:10:00", duracao_min: 10, local: "PATIO" }],
  resumo: { primeiro: "2026-10-01 08:00:00", ultimo: "2026-10-01 08:10:00", areas: [] },
  pontos: [[-19.4, -42.5, "08:00:00", 0, "parado_ligado", null], [null, null, "08:05:00", 0, "parado_ligado", null]],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validarRetrato", () => {
  it("aceita o retrato do coletor e mantém campos extras", () => {
    const r = validarRetrato({ ...retrato, gauss: { dia: "2026-10-01", requisicoes: 3, logins: 1, erros: 0, desde: "x", pausadoAte: null } });
    expect(r.veiculos[0].placa).toBe("EOF5208");
    expect(r.gauss?.requisicoes).toBe(3);
  });
  it("sem retrato gravado (antes da 1ª leitura) devolve o retrato vazio", () => {
    expect(validarRetrato(null)).toEqual(RETRATO_VAZIO);
    expect(validarRetrato(undefined).veiculos).toEqual([]);
  });
  it("aceita veículo sem coordenada (NaN do GAUSS vira null)", () => {
    expect(validarRetrato({ ...retrato, veiculos: [{ ...veiculo, lat: null, lng: null }] }).veiculos[0].lat).toBeNull();
  });
  it("formato diferente vira FormatoInesperado", () => {
    expect(() => validarRetrato({ ...retrato, veiculos: "x" })).toThrow(FormatoInesperado);
  });
});

describe("validarCercas, validarEvento", () => {
  it("cercas ausentes viram lista vazia", () => {
    expect(validarCercas(undefined)).toEqual([]);
  });
  it("cerca sem tipo é recusada", () => {
    expect(() => validarCercas([{ name: "A", color: "#000", polygon: [] }])).toThrow(FormatoInesperado);
  });
  it("evento com tipo desconhecido é recusado", () => {
    expect(() => validarEvento({ t: "x", tipo: "outro", id: "1", placa: "A" })).toThrow(FormatoInesperado);
    expect(validarEvento({ t: "x", tipo: "entrada", id: "1", placa: "A", vaga: "", area: "P", lat: 1, lng: 2 }).tipo).toBe("entrada");
  });
});

describe("validarHistorico", () => {
  it("tira do mapa e do player o ponto sem coordenada", () => {
    const h = validarHistorico(historico);
    expect(h.pontos).toHaveLength(1);
    expect(h.trechos[0].estado).toBe("parado_ligado");
  });
  it("dia sem pontos (resumo nulo) é válido", () => {
    expect(validarHistorico({ ...historico, trechos: [], pontos: [], resumo: null }).resumo).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/dados/esquemas.test.ts` → FAIL (`Cannot find module './esquemas'`).

- [ ] **Step 4: Escrever `src/lib/dados/esquemas.ts`**

```ts
import { z } from "zod";
import type { Cerca, Evento, Historico, Retrato } from "../tipos";

/** O formato dos dados mudou (ex.: coletor novo gravando outra coisa): a tela avisa em vez de quebrar em silêncio. */
export class FormatoInesperado extends Error {
  constructor(oque: string) {
    super(`${oque} em formato inesperado - avise o responsável pelo sistema`);
    this.name = "FormatoInesperado";
  }
}

function validar<T>(esquema: z.ZodType, valor: unknown, oque: string): T {
  const r = esquema.safeParse(valor);
  if (!r.success) {
    console.error(`[formato] ${oque}`, r.error.issues);
    throw new FormatoInesperado(oque);
  }
  return r.data as T;
}

// confere só o que as telas usam; o resto passa adiante como veio (looseObject)
const numOuNulo = z.number().nullable();
const veiculo = z.looseObject({
  id: z.string(), placa: z.string(), status: z.string(), status_cod: z.number(),
  lat: numOuNulo, lng: numOuNulo, posicao_em: z.string().nullable(), area: z.string(), via: z.string(), sem_sinal: z.boolean(),
});
const retrato = z.looseObject({
  lido_em: z.string().nullable(),
  erro: z.looseObject({ em: z.string(), msg: z.string() }).nullable(),
  intervalo_s: z.number(),
  sem_sinal_min: z.number(),
  veiculos: z.array(veiculo),
});
const cerca = z.looseObject({ name: z.string(), color: z.string(), polygon: z.array(z.tuple([z.number(), z.number()])), tipo: z.enum(["planta", "via", "area"]) });
const evento = z.looseObject({ t: z.string(), tipo: z.enum(["entrada", "saida", "status", "sinal_perdido", "sinal_retomado"]), id: z.string(), placa: z.string() });
const estado = z.enum(["movimento", "parado_ligado", "desligado", "parado", "sem_sinal"]);
const historico = z.looseObject({
  id: z.string(),
  dia: z.string(),
  temRpm: z.boolean(),
  trechos: z.array(z.looseObject({ estado, inicio: z.string(), fim: z.string(), duracao_min: z.number() })),
  resumo: z.looseObject({ primeiro: z.string(), ultimo: z.string(), areas: z.array(z.looseObject({ area: z.string(), min: z.number() })) }).nullable(),
  pontos: z.array(z.tuple([numOuNulo, numOuNulo, z.string(), z.number(), estado, z.union([z.literal(0), z.literal(1), z.null()])])),
});

/** Retrato antes da 1ª leitura do coletor. */
export const RETRATO_VAZIO: Retrato = { lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [] };

export const validarRetrato = (v: unknown): Retrato => (v == null ? RETRATO_VAZIO : validar<Retrato>(retrato, v, "Retrato da frota"));
export const validarCercas = (v: unknown): Cerca[] => validar<Cerca[]>(z.array(cerca), v ?? [], "Cercas");
export const validarEvento = (v: unknown): Evento => validar<Evento>(evento, v, "Evento");

export function validarHistorico(v: unknown): Historico {
  const h = validar<Historico>(historico, v, "Histórico");
  // ponto sem coordenada (o GAUSS mandou vazio) fica fora do mapa e do player
  return { ...h, pontos: h.pontos.filter((p) => p[0] != null && p[1] != null) };
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/dados/esquemas.test.ts` → PASS (9 testes). Depois `npm run typecheck`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/tipos.ts src/lib/dados
git commit -m "Tipos compartilhados (site e coletor) e validação dos dados do banco

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Regras puras de formato, veículo e eventos

**Files:**
- Create: `src/lib/dominio/formato.ts`, `src/lib/dominio/veiculo.ts`, `src/lib/dominio/eventos.ts`
- Test: `src/lib/dominio/formato.test.ts`, `src/lib/dominio/veiculo.test.ts`, `src/lib/dominio/eventos.test.ts`

**Interfaces:**
- Consumes: tipos da Tarefa 2.
- Produces (`formato.ts`): `pad(n)`, `diaLocal(d?)`, `diaBR(dia)`, `hora(iso)`, `horaSeg(iso)`, `dataHora(iso)`, `minutosDesde(iso, agora?)`, `fmtMin(min)`, `idadeCurta(iso, agora?)`, `segDe(hms)`, `fmtHora(seg)`, `hhmm(t)`, `ultimosDias(n, agora?)`, `rotuloDia(dia, hoje?)`.
- Produces (`veiculo.ts`): `SEM_SINAL_MIN_PADRAO`, `CATEGORIAS`, `categoria(v)`, `frescor(v, semSinalMin?, agora?)`, `FRESCOR`, `ESTADOS_TRECHO`, `motor2Ligado(v)`, `semMotor2(vs)`, `type Indicador`, `INDICADORES`, `noIndicador(id, v, semSinalMin, agora?)`, `FORA_DE_AREA`, `interface FiltroVeiculos { indicador: Indicador | null; busca: string; area: string | null }`, `filtrarVeiculos(vs, f, semSinalMin, agora?)`, `agruparPorArea(vs)`, `resumoAreas(vs)`, `areaInicial(vs, poligonos, semSinalMin, agora?)`, `nomeArea(a)`.
- Produces (`eventos.ts`): `type GrupoEvento`, `GRUPOS`, `TODOS_GRUPOS`, `grupoDoEvento(e)`, `ROTULO_TIPO`, `veiculoDoEvento(e)`, `interface TextoEvento { quem; motor2; acao; alvo; extra }`, `textoEvento(e)`, `textoPlano(t)`, `filtrarEventos(es, grupos, busca)`, `contarPorGrupo(es)`, `agruparPorHora(es)`, `chaveEvento(e)`.

- [ ] **Step 1: Testes de `formato`**

`src/lib/dominio/formato.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diaBR, fmtHora, fmtMin, hhmm, hora, idadeCurta, rotuloDia, segDe, ultimosDias } from "./formato";

describe("formato", () => {
  it("fmtMin: minutos, horas e dias", () => {
    expect(fmtMin(null)).toBe("—");
    expect(fmtMin(Number.NaN)).toBe("—");
    expect(fmtMin(45.4)).toBe("45 min");
    expect(fmtMin(61)).toBe("1h01");
    expect(fmtMin(1500)).toBe("1d 1h");
  });
  it("idadeCurta: segundos, minutos, horas e dias", () => {
    const agora = new Date("2026-10-01T12:00:00Z").getTime();
    expect(idadeCurta(null, agora)).toBe("?");
    expect(idadeCurta("2026-10-01T11:59:20Z", agora)).toBe("40s");
    expect(idadeCurta("2026-10-01T11:48:00Z", agora)).toBe("12m");
    expect(idadeCurta("2026-10-01T09:00:00Z", agora)).toBe("3h");
    expect(idadeCurta("2026-09-29T12:00:00Z", agora)).toBe("2d");
  });
  it("segundos do dia e de volta", () => {
    expect(segDe("01:02:03")).toBe(3723);
    expect(segDe("08:30")).toBe(30600);
    expect(fmtHora(3723)).toBe("01:02:03");
  });
  it("datas", () => {
    expect(diaBR("2026-10-01")).toBe("01/10/2026");
    expect(hhmm("2026-10-01 08:05:09")).toBe("08:05");
    expect(hora(null)).toBe("—");
    expect(hora("2026-10-01T17:30:00.000Z")).toBe("14:30");
    expect(rotuloDia("2026-10-02", "2026-10-02")).toBe("Hoje");
    expect(rotuloDia("2026-10-01", "2026-10-02")).toBe("Ontem");
    expect(rotuloDia("2026-09-30", "2026-10-02")).toBe("30/09/2026");
    expect(ultimosDias(3, new Date("2026-10-02T12:00:00-03:00"))).toEqual(["2026-10-02", "2026-10-01", "2026-09-30"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/formato.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: Escrever `src/lib/dominio/formato.ts`**

```ts
/** Formatação de datas, horas e durações (horário local da usina: America/Sao_Paulo). */

export const pad = (n: number) => String(n).padStart(2, "0");
export const diaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const diaBR = (dia: string) => dia.split("-").reverse().join("/");
export const hora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
export const horaSeg = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("pt-BR") : "—");
export const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const minutosDesde = (iso: string, agora = Date.now()) => (agora - new Date(iso).getTime()) / 60000;

/** 45 min · 1h05 · 2d 3h */
export function fmtMin(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)}h${pad(m % 60)}`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/** Idade curta de uma posição: 40s · 12m · 3h · 2d */
export function idadeCurta(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "?";
  const s = Math.max(0, (agora - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** "HH:MM[:SS]" → segundos do dia */
export function segDe(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}
/** segundos do dia → "HH:MM:SS" */
export const fmtHora = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
/** "AAAA-MM-DD HH:MM:SS" (horário do GAUSS) → "HH:MM" */
export const hhmm = (t: string) => t.slice(11, 16);

/** Últimos n dias, de hoje para trás (seletores de dia). */
export function ultimosDias(n: number, agora = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => diaLocal(new Date(agora.getTime() - i * 86400000)));
}
export function rotuloDia(dia: string, hoje = diaLocal()): string {
  if (dia === hoje) return "Hoje";
  const ontem = diaLocal(new Date(new Date(`${hoje}T12:00:00`).getTime() - 86400000));
  return dia === ontem ? "Ontem" : diaBR(dia);
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/dominio/formato.test.ts` → PASS.

- [ ] **Step 5: Testes de `veiculo`**

`src/lib/dominio/veiculo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { FORA_DE_AREA, agruparPorArea, areaInicial, categoria, filtrarVeiculos, frescor, noIndicador, resumoAreas, semMotor2 } from "./veiculo";

const AGORA = new Date("2026-10-01T12:00:00Z").getTime();
const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "1", placa: "AAA0001", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: "2026-10-01T11:59:00Z", area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});

describe("categoria e frescor", () => {
  it("mapeia os códigos de status do GAUSS", () => {
    expect([1, 3, 2, 4, 71, 98, 5, 9, 7, 99].map((c) => categoria({ status_cod: c }))).toEqual(
      ["ligado", "parado", "desligado", "desligado", "desligado", "desligado", "manut", "manut", "semcom", "outro"],
    );
  });
  it("posição de até 5 min é ao vivo; até o limite, atrasada; depois, sem sinal", () => {
    expect(frescor({ posicao_em: "2026-10-01T11:56:00Z" }, 30, AGORA)).toBe("vivo");
    expect(frescor({ posicao_em: "2026-10-01T11:40:00Z" }, 30, AGORA)).toBe("atrasado");
    expect(frescor({ posicao_em: "2026-10-01T11:00:00Z" }, 30, AGORA)).toBe("semsinal");
    expect(frescor({ posicao_em: null }, 30, AGORA)).toBe("semsinal");
  });
});

describe("filtros e agrupamentos", () => {
  const frota = [
    v({ id: "1", placa: "CCC0003", area: "PATIO", status_cod: 1 }),
    v({ id: "2", placa: "BBB0002", area: "PATIO", status_cod: 2 }),
    v({ id: "3", placa: "AAA0001", area: "OFICINA", status_cod: 5, motor2: { id: "9", placa: "AAA00012", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
    v({ id: "4", placa: "DDD0004", area: "", via: "RUA A", posicao_em: "2026-10-01T10:00:00Z" }),
    v({ id: "9", placa: "AAA00012", motor2_de: "3" }),
  ];
  it("motor secundário sai da lista", () => {
    expect(semMotor2(frota).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
  });
  it("indicadores: motor 2º ligado e sem sinal", () => {
    expect(noIndicador("motor2", frota[2], 30, AGORA)).toBe(true);
    expect(noIndicador("semsinal", frota[3], 30, AGORA)).toBe(true);
    expect(noIndicador("desligado", frota[1], 30, AGORA)).toBe(true);
  });
  it("busca pela placa do motor 2º, área e fora de área", () => {
    const lista = semMotor2(frota);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "aaa00012", area: null }, 30, AGORA).map((x) => x.id)).toEqual(["3"]);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "", area: "PATIO" }, 30, AGORA).map((x) => x.id)).toEqual(["1", "2"]);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "", area: FORA_DE_AREA }, 30, AGORA).map((x) => x.id)).toEqual(["4"]);
  });
  it("agrupa pela área: mais cheia primeiro, sem área por último, placas em ordem", () => {
    const g = agruparPorArea(semMotor2(frota));
    expect(g.map((x) => x.area)).toEqual(["PATIO", "OFICINA", ""]);
    expect(g[0].veiculos.map((x) => x.placa)).toEqual(["BBB0002", "CCC0003"]);
  });
  it("resumo das áreas conta por categoria", () => {
    const r = resumoAreas(semMotor2(frota));
    expect(r[0]).toEqual({ area: "PATIO", total: 2, porCategoria: [["ligado", 1], ["desligado", 1]] });
    expect(r.at(-1)?.area).toBe(FORA_DE_AREA);
  });
  it("zoom inicial vai para a área com mais veículos com sinal", () => {
    const poligonos = { PATIO: [[0, 0], [0, 1], [1, 1]] as [number, number][], OFICINA: [[2, 2], [2, 3], [3, 3]] as [number, number][] };
    expect(areaInicial(semMotor2(frota), poligonos, 30, AGORA)).toBe("PATIO");
    expect(areaInicial([], poligonos, 30, AGORA)).toBeNull();
  });
});
```

- [ ] **Step 6: Rodar e ver falhar** — `npx vitest run src/lib/dominio/veiculo.test.ts` → FAIL.

- [ ] **Step 7: Escrever `src/lib/dominio/veiculo.ts`**

```ts
import type { CategoriaVeiculo, EstadoTrecho, Frescor, LatLng, Tom, Veiculo } from "../tipos";
import { minutosDesde } from "./formato";

export const SEM_SINAL_MIN_PADRAO = 30;

export const CATEGORIAS: Record<CategoriaVeiculo, { rotulo: string; tom: Tom }> = {
  ligado: { rotulo: "Ligado", tom: "ok" },
  parado: { rotulo: "Parado ligado", tom: "warn" },
  desligado: { rotulo: "Desligado", tom: "bad" },
  manut: { rotulo: "Manutenção", tom: "na" },
  semcom: { rotulo: "Sem comunicação", tom: "neu" },
  outro: { rotulo: "Outros", tom: "reg" },
};

/** Categoria pelo código de status do GAUSS (legenda do mapa). */
export function categoria(v: Pick<Veiculo, "status_cod">): CategoriaVeiculo {
  const c = v.status_cod;
  if (c === 1) return "ligado";
  if (c === 3) return "parado";
  if ([2, 4, 71, 98].includes(c)) return "desligado";
  if ([5, 9].includes(c)) return "manut";
  if (c === 7) return "semcom";
  return "outro";
}

/** Quão recente é a posição: nunca mostrar posição velha como se fosse ao vivo. */
export function frescor(v: Pick<Veiculo, "posicao_em">, semSinalMin = SEM_SINAL_MIN_PADRAO, agora = Date.now()): Frescor {
  const min = v.posicao_em ? minutosDesde(v.posicao_em, agora) : Infinity;
  if (min <= 5) return "vivo";
  if (min <= semSinalMin) return "atrasado";
  return "semsinal";
}
export const FRESCOR: Record<Frescor, { rotulo: string; tom: Tom }> = {
  vivo: { rotulo: "posição ao vivo", tom: "ok" },
  atrasado: { rotulo: "posição atrasada", tom: "warn" },
  semsinal: { rotulo: "sem sinal", tom: "neu" },
};

/** Situação de cada trecho do histórico (rota no mapa, apontamento, player). */
export const ESTADOS_TRECHO: Record<EstadoTrecho, { rotulo: string; tom: Tom; icone: string }> = {
  movimento: { rotulo: "Em deslocamento", tom: "mov", icone: "➜" },
  parado_ligado: { rotulo: "Parado ligado", tom: "warn", icone: "◐" },
  desligado: { rotulo: "Desligado", tom: "bad", icone: "■" },
  parado: { rotulo: "Parado", tom: "neu", icone: "■" },
  sem_sinal: { rotulo: "Sem sinal", tom: "reg", icone: "!" },
};

export const motor2Ligado = (v: Veiculo) => v.motor2?.status_cod === 1;
/** O motor secundário não é outro caminhão: sai das listas e vai em v.motor2. */
export const semMotor2 = (vs: Veiculo[]) => vs.filter((v) => !v.motor2_de);

export type Indicador = "ligado" | "parado" | "motor2" | "desligado" | "manut" | "semsinal";
export const INDICADORES: { id: Indicador; rotulo: string; curto: string; tom: Tom }[] = [
  { id: "ligado", rotulo: "Ligados", curto: "ligados", tom: "ok" },
  { id: "parado", rotulo: "Parados ligados", curto: "parados lig.", tom: "warn" },
  { id: "motor2", rotulo: "Motor 2º ligado", curto: "⚙ 2º ligado", tom: "motor2" },
  { id: "desligado", rotulo: "Desligados", curto: "desligados", tom: "bad" },
  { id: "manut", rotulo: "Manutenção", curto: "manutenção", tom: "na" },
  { id: "semsinal", rotulo: "Sem sinal", curto: "sem sinal", tom: "neu" },
];
export function noIndicador(id: Indicador, v: Veiculo, semSinalMin: number, agora = Date.now()): boolean {
  if (id === "motor2") return motor2Ligado(v);
  if (id === "semsinal") return frescor(v, semSinalMin, agora) === "semsinal";
  return categoria(v) === id;
}

export const FORA_DE_AREA = "__fora";
export const nomeArea = (a: string) => (!a || a === FORA_DE_AREA ? "Fora de área / em vias" : a);

export interface FiltroVeiculos {
  indicador: Indicador | null;
  busca: string;
  area: string | null;
}
export function filtrarVeiculos(vs: Veiculo[], f: FiltroVeiculos, semSinalMin: number, agora = Date.now()): Veiculo[] {
  const q = f.busca.trim().toUpperCase();
  return vs.filter(
    (v) =>
      (!f.indicador || noIndicador(f.indicador, v, semSinalMin, agora)) &&
      (!f.area || (f.area === FORA_DE_AREA ? !v.area : v.area === f.area)) &&
      (!q || [v.placa, v.motor2?.placa, v.vaga, v.grupo, v.area, v.via, v.motorista].join(" ").toUpperCase().includes(q)),
  );
}

/** Agrupa pela área atual: mais cheias primeiro; quem está em rua/sem área vai para o fim. */
export function agruparPorArea(vs: Veiculo[]): { area: string; veiculos: Veiculo[] }[] {
  const g = new Map<string, Veiculo[]>();
  for (const v of vs) g.set(v.area, [...(g.get(v.area) ?? []), v]);
  return [...g.entries()]
    .sort(([a, va], [b, vb]) => Number(!a) - Number(!b) || vb.length - va.length || a.localeCompare(b))
    .map(([area, lista]) => ({ area, veiculos: [...lista].sort((x, y) => x.placa.localeCompare(y.placa)) }));
}

/** Aba "Áreas": total por área e quantos de cada categoria. */
export function resumoAreas(vs: Veiculo[]): { area: string; total: number; porCategoria: [CategoriaVeiculo, number][] }[] {
  const g = new Map<string, Veiculo[]>();
  for (const v of vs) {
    const k = v.area || FORA_DE_AREA;
    g.set(k, [...(g.get(k) ?? []), v]);
  }
  return [...g.entries()]
    .sort(([a, va], [b, vb]) => Number(a === FORA_DE_AREA) - Number(b === FORA_DE_AREA) || vb.length - va.length)
    .map(([area, lista]) => {
      const conta = new Map<CategoriaVeiculo, number>();
      for (const v of lista) conta.set(categoria(v), (conta.get(categoria(v)) ?? 0) + 1);
      return { area, total: lista.length, porCategoria: [...conta.entries()] };
    });
}

/** Zoom inicial do mapa: a área com mais veículos com sinal (normalmente o pátio). */
export function areaInicial(vs: Veiculo[], poligonos: Record<string, LatLng[]>, semSinalMin: number, agora = Date.now()): string | null {
  const conta = new Map<string, number>();
  for (const v of vs) if (frescor(v, semSinalMin, agora) !== "semsinal" && poligonos[v.area]) conta.set(v.area, (conta.get(v.area) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
```

- [ ] **Step 8: Rodar e ver passar** — `npx vitest run src/lib/dominio/veiculo.test.ts` → PASS.

- [ ] **Step 9: Testes de `eventos`**

`src/lib/dominio/eventos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Evento } from "../tipos";
import { agruparPorHora, contarPorGrupo, filtrarEventos, grupoDoEvento, textoEvento, textoPlano, TODOS_GRUPOS, veiculoDoEvento } from "./eventos";

const base = { id: "10", placa: "EOF5208", vaga: "V1" };
const ev: Evento[] = [
  { ...base, t: "2026-10-01T17:30:00.000Z", tipo: "entrada", area: "PATIO", lat: 1, lng: 1 },
  { ...base, t: "2026-10-01T17:45:00.000Z", tipo: "saida", area: "PATIO", desde: null, permanencia_min: 15 },
  { ...base, t: "2026-10-01T18:10:00.000Z", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
  { ...base, t: "2026-10-01T18:20:00.000Z", tipo: "sinal_perdido", ultima_posicao: "2026-10-01T17:50:00.000Z", area: "" },
  { id: "11", placa: "EOF52082", vaga: "V1", motor2: true, principal_id: "10", principal: "EOF5208", t: "2026-10-01T18:25:00.000Z", tipo: "sinal_retomado", area: "", sem_sinal_min: 5 },
];

describe("eventos", () => {
  it("textos de cada tipo", () => {
    expect(textoPlano(textoEvento(ev[0]))).toBe("EOF5208 entrou em PATIO");
    expect(textoPlano(textoEvento(ev[1]))).toBe("EOF5208 saiu de PATIO · ficou 15 min");
    expect(textoPlano(textoEvento(ev[2]))).toBe("EOF5208 Ligado → Desligado · 1h10 no anterior · OFICINA");
    expect(textoPlano(textoEvento(ev[3]))).toBe("EOF5208 sem sinal desde 14:50");
    expect(textoPlano(textoEvento(ev[4]))).toBe("EOF5208 ⚙ motor 2º voltou a comunicar após 5 min");
  });
  it("evento do motor 2º abre o caminhão principal", () => {
    expect(veiculoDoEvento(ev[4])).toBe("10");
    expect(grupoDoEvento(ev[4])).toBe("sinal");
  });
  it("filtra por grupo e busca, do mais novo para o mais antigo", () => {
    expect(filtrarEventos(ev, new Set(["entrada", "saida"]), "").map((e) => e.tipo)).toEqual(["saida", "entrada"]);
    expect(filtrarEventos(ev, new Set(TODOS_GRUPOS), "oficina").map((e) => e.tipo)).toEqual(["status"]);
  });
  it("conta por grupo", () => {
    expect(contarPorGrupo(ev)).toEqual({ entrada: 1, saida: 1, status: 1, sinal: 2 });
  });
  it("agrupa pela hora LOCAL (14h em Ipatinga, não 17h UTC)", () => {
    const g = agruparPorHora(filtrarEventos(ev, new Set(TODOS_GRUPOS), ""));
    expect(g.map((x) => [x.rotulo, x.eventos.length])).toEqual([["15:00 – 15:59", 3], ["14:00 – 14:59", 2]]);
  });
});
```

- [ ] **Step 10: Rodar e ver falhar** — `npx vitest run src/lib/dominio/eventos.test.ts` → FAIL.

- [ ] **Step 11: Escrever `src/lib/dominio/eventos.ts`**

```ts
import type { Evento, Tom } from "../tipos";
import { fmtMin, hora, pad } from "./formato";

export type GrupoEvento = "entrada" | "saida" | "status" | "sinal";
export const GRUPOS: Record<GrupoEvento, { rotulo: string; icone: string; tom: Tom }> = {
  entrada: { rotulo: "Entradas", icone: "↘", tom: "ok" },
  saida: { rotulo: "Saídas", icone: "↗", tom: "reg" },
  status: { rotulo: "Status", icone: "●", tom: "warn" },
  sinal: { rotulo: "Sinal", icone: "⚠", tom: "bad" },
};
export const TODOS_GRUPOS: GrupoEvento[] = ["entrada", "saida", "status", "sinal"];
export const ROTULO_TIPO: Record<Evento["tipo"], string> = { entrada: "Entrada", saida: "Saída", status: "Status", sinal_perdido: "Sem sinal", sinal_retomado: "Sinal voltou" };

export const grupoDoEvento = (e: Pick<Evento, "tipo">): GrupoEvento => (e.tipo === "sinal_perdido" || e.tipo === "sinal_retomado" ? "sinal" : e.tipo);
/** Veículo a abrir ao clicar no evento: o do motor secundário abre o caminhão principal. */
export const veiculoDoEvento = (e: Evento) => e.principal_id ?? e.id;
/** Chave estável do evento na lista (lido / selecionado). */
export const chaveEvento = (e: Evento) => `${e.t}|${e.id}|${e.tipo}`;

/** Partes do texto: a tela põe "quem" e "alvo" em negrito. */
export interface TextoEvento {
  quem: string;
  motor2: boolean;
  acao: string;
  alvo: string;
  extra: string;
}
export function textoEvento(e: Evento): TextoEvento {
  const base = { quem: e.motor2 ? (e.principal ?? e.placa) : e.placa, motor2: !!e.motor2 };
  switch (e.tipo) {
    case "entrada":
      return { ...base, acao: "entrou em", alvo: e.area, extra: "" };
    case "saida":
      return { ...base, acao: "saiu de", alvo: e.area, extra: e.permanencia_min != null ? ` · ficou ${fmtMin(e.permanencia_min)}` : "" };
    case "status":
      return { ...base, acao: `${e.de} →`, alvo: e.para, extra: (e.duracao_min != null ? ` · ${fmtMin(e.duracao_min)} no anterior` : "") + (e.area ? ` · ${e.area}` : "") };
    case "sinal_perdido":
      return { ...base, acao: "", alvo: "sem sinal", extra: ` desde ${hora(e.ultima_posicao)}${e.area ? ` · ${e.area}` : ""}` };
    case "sinal_retomado":
      return { ...base, acao: "", alvo: "voltou a comunicar", extra: e.sem_sinal_min != null ? ` após ${fmtMin(e.sem_sinal_min)}` : "" };
  }
}
/** Texto corrido (busca, título, leitores de tela). */
export const textoPlano = (t: TextoEvento) => [`${t.quem}${t.motor2 ? " ⚙ motor 2º" : ""}`, t.acao, t.alvo].filter(Boolean).join(" ") + t.extra;

/** Eventos dos grupos marcados que casam com a busca (placa ou área), do mais novo para o mais antigo. */
export function filtrarEventos(es: Evento[], grupos: ReadonlySet<GrupoEvento>, busca: string): Evento[] {
  const q = busca.trim().toUpperCase();
  return es
    .filter((e) => grupos.has(grupoDoEvento(e)) && (!q || `${e.placa} ${e.principal ?? ""} ${e.area}`.toUpperCase().includes(q)))
    .sort((a, b) => b.t.localeCompare(a.t));
}

export function contarPorGrupo(es: Evento[]): Record<GrupoEvento, number> {
  const c: Record<GrupoEvento, number> = { entrada: 0, saida: 0, status: 0, sinal: 0 };
  for (const e of es) c[grupoDoEvento(e)]++;
  return c;
}

/** Agrupa eventos já ordenados por hora LOCAL ("14:00 – 14:59"). O site antigo usava a hora UTC do registro. */
export function agruparPorHora(es: Evento[]): { rotulo: string; eventos: Evento[] }[] {
  const g = new Map<string, Evento[]>();
  for (const e of es) {
    const d = new Date(e.t);
    const k = `${d.toDateString()}|${pad(d.getHours())}`;
    g.set(k, [...(g.get(k) ?? []), e]);
  }
  return [...g.entries()].map(([k, eventos]) => {
    const h = k.split("|")[1];
    return { rotulo: `${h}:00 – ${h}:59`, eventos };
  });
}
```

- [ ] **Step 12: Rodar tudo** — `npm test` → PASS; `npm run typecheck && npm run lint`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/dominio
git commit -m "Regras puras: formato de datas, categoria e frescor do veículo, textos e agrupamento de eventos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Regras da frota e geometria (compartilhadas com o coletor)

**Files:**
- Create: `src/lib/dominio/frota.ts`, `src/lib/dominio/geo.ts`, `src/lib/dominio/cercas.ts`
- Test: `src/lib/dominio/frota.test.ts`, `src/lib/dominio/geo.test.ts`

**Interfaces:**
- Produces: `normPlaca(p: unknown): string`; `parearMotores(vs: { id: string | number; placa: string }[]): { principalDe: Map<string, string>; secundarioDe: Map<string, string> }`; `dentroDoPoligono(lat, lng, poligono: LatLng[]): boolean`; `areaPoligono(p: LatLng[]): number`; `cercasNoPonto<C extends { polygon: LatLng[] }>(lat, lng, cercas: C[]): C[]`; `distanciaM(a: {lat,lng}, b: {lat,lng}): number`; `tipoCerca(c: { layer: number; name: string }): TipoCerca`.
- Restrição: estes arquivos só importam `../tipos` e irmãos de `dominio/` (o coletor os usa).

- [ ] **Step 1: Testes**

`src/lib/dominio/frota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tipoCerca } from "./cercas";
import { normPlaca, parearMotores } from "./frota";

describe("motor secundário", () => {
  it("placa + 2 é o motor secundário do caminhão", () => {
    const { principalDe, secundarioDe } = parearMotores([
      { id: 10, placa: "EOF-5208" },
      { id: 11, placa: "EOF52082" },
      { id: 12, placa: "DTW5E38" },
      { id: 13, placa: "XYZ12342" }, // termina em 2, mas não existe XYZ1234
      { id: 14, placa: "DTW5E381" }, // 8 caracteres sem o 2 no fim
    ]);
    expect([...principalDe]).toEqual([["11", "10"]]);
    expect([...secundarioDe]).toEqual([["10", "11"]]);
  });
  it("normaliza placa", () => {
    expect(normPlaca(" eof-5208 ")).toBe("EOF5208");
    expect(normPlaca(null)).toBe("");
  });
});

describe("tipo da cerca", () => {
  it("planta, via e área", () => {
    expect(tipoCerca({ layer: 3, name: "USINA" })).toBe("planta");
    expect(["RUA 1", "R. 2", "AV 3", "AV. 4", "AVENIDA 5", "PN-6", "CANCELA 7"].map((name) => tipoCerca({ layer: 1, name }))).toEqual(Array(7).fill("via"));
    expect(tipoCerca({ layer: 1, name: "PATIO MECANIZADA" })).toBe("area");
    expect(tipoCerca({ layer: 1, name: "AVARIA" })).toBe("area");
  });
});
```

`src/lib/dominio/geo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { LatLng } from "../tipos";
import { areaPoligono, cercasNoPonto, dentroDoPoligono, distanciaM } from "./geo";

const quadrado = (lat: number, lng: number, lado: number): LatLng[] => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

describe("geo", () => {
  it("ponto dentro e fora do polígono", () => {
    expect(dentroDoPoligono(0.5, 0.5, quadrado(0, 0, 1))).toBe(true);
    expect(dentroDoPoligono(1.5, 0.5, quadrado(0, 0, 1))).toBe(false);
  });
  it("cercas que contêm o ponto, da menor para a maior; ignora cerca com menos de 3 pontos", () => {
    const cercas = [{ name: "GRANDE", polygon: quadrado(0, 0, 10) }, { name: "PEQUENA", polygon: quadrado(0, 0, 1) }, { name: "LINHA", polygon: [[0, 0], [1, 1]] as LatLng[] }];
    expect(cercasNoPonto(0.5, 0.5, cercas).map((c) => c.name)).toEqual(["PEQUENA", "GRANDE"]);
    expect(areaPoligono(quadrado(0, 0, 2))).toBe(4);
  });
  it("distância de 1 grau de latitude ≈ 111,2 km", () => {
    expect(Math.round(distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(111195);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/frota.test.ts src/lib/dominio/geo.test.ts` → FAIL.

- [ ] **Step 3: Escrever os três módulos**

`src/lib/dominio/frota.ts`:

```ts
// Regras da frota que não vêm prontas do GAUSS.
//
// Motor secundário: placas têm 7 caracteres (EOF5208, DTW5E38). O GAUSS cadastra o motor secundário do
// caminhão (bomba de alta pressão, vácuo...) como outro "veículo", com a mesma placa + "2" no fim:
// EOF5208 -> EOF52082. Ele tem rastreador e status próprios (RPM 0/1000 = desligado/ligado), mas NÃO é outro
// caminhão: não entra na contagem da frota nem aparece duplicado no mapa. Conferido em 01/10/2026: 12 pares.

export const normPlaca = (p: unknown) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * principalDe: id do secundário -> id do principal; secundarioDe: id do principal -> id do secundário.
 */
export function parearMotores(veiculos: { id: string | number; placa: string }[]): { principalDe: Map<string, string>; secundarioDe: Map<string, string> } {
  const porPlaca = new Map(veiculos.map((v) => [normPlaca(v.placa), v]));
  const principalDe = new Map<string, string>();
  const secundarioDe = new Map<string, string>();
  for (const v of veiculos) {
    const n = normPlaca(v.placa);
    if (n.length !== 8 || !n.endsWith("2")) continue;
    const principal = porPlaca.get(n.slice(0, 7));
    if (!principal) continue;
    principalDe.set(String(v.id), String(principal.id));
    secundarioDe.set(String(principal.id), String(v.id));
  }
  return { principalDe, secundarioDe };
}
```

`src/lib/dominio/geo.ts`:

```ts
import type { LatLng } from "../tipos";

/** Ponto dentro do polígono (raio cruzando as arestas). Polígono em [lat, lng]. */
export function dentroDoPoligono(lat: number, lng: number, poligono: LatLng[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Área aproximada (em graus²), só para ordenar da cerca mais específica para a mais ampla. */
export function areaPoligono(p: LatLng[]): number {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][1] * p[i][0] - p[i][1] * p[j][0];
  return Math.abs(s / 2);
}

/** Cercas que contêm o ponto, da menor (mais específica) para a maior. */
export function cercasNoPonto<C extends { polygon: LatLng[] }>(lat: number, lng: number, cercas: C[]): C[] {
  return cercas.filter((g) => g.polygon.length >= 3 && dentroDoPoligono(lat, lng, g.polygon)).sort((a, b) => areaPoligono(a.polygon) - areaPoligono(b.polygon));
}

/** Distância em metros (haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
```

`src/lib/dominio/cercas.ts`:

```ts
import type { TipoCerca } from "../tipos";

// Ruas/avenidas também são cercas no GAUSS. Para entrada/saída só contam as áreas de verdade (pátios,
// oficinas, baias...): rua é trânsito e geraria um evento a cada esquina. Plantas (layer 3) cobrem a usina inteira.
const VIA = /^(RUA|R\.|AV\b|AV\.|AVENIDA|PN-|CANCELA)/i;

export function tipoCerca(c: { layer: number; name: string }): TipoCerca {
  if (c.layer === 3) return "planta";
  if (VIA.test(c.name)) return "via";
  return "area";
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test` → PASS; `npm run typecheck && npm run lint`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio
git commit -m "Regras da frota (motor secundário), geometria das cercas e tipo de cerca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Amostras do coletor atual (para conferir a reescrita)

**Files:**
- Create: `coletor/scripts/gravar-amostras.mjs` (temporário: sai na Tarefa 8)
- Gera (fora do git): `coletor/__amostras__/leitura.json`, `snapshot.json`, `apontamento-N.json`

**Interfaces:**
- Produces: arquivos JSON com `{ entradas..., saida }` que as Tarefas 6 a 8 usam em `coletor/paridade.test.ts`:
  - `leitura.json`: `{ agora: string; estadoAnterior; posicoes; cercas; saida: { estado; eventos } }`
  - `snapshot.json`: `{ estado; meta; saida }`
  - `apontamento-N.json`: `{ pontos; cercas; pontosMotor2; saida }`

O script roda as funções puras do coletor **atual** (`coletor/*.js`) sobre dados lidos do Supabase. Só **lê** do banco (chave secreta do `automation/.env`, sem mostrar o valor) e **não** consulta o GAUSS. As posições da leitura são derivadas do estado real com variações (troca de status, de área, perda e volta de sinal) para exercitar todos os tipos de evento.

- [ ] **Step 1: Escrever `coletor/scripts/gravar-amostras.mjs`**

```js
// Grava amostras para conferir o coletor novo (TypeScript) contra o atual (JS): roda as funções puras do
// coletor ATUAL sobre dados lidos do Supabase. Só LÊ do banco e NÃO consulta o GAUSS.
// Uso (na raiz do repositório): node --env-file=../../automation/.env coletor/scripts/gravar-amostras.mjs
// Saída: coletor/__amostras__/ (no .gitignore: tem placas, posições e motoristas)
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { processarLeitura, montarSnapshot } from "../processamento.js";
import { montarApontamento } from "../historico.js";
import { parearMotores } from "../frota.js";

process.env.TZ = "America/Sao_Paulo"; // o GAUSS fala em horário local (como no workflow)

for (const v of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) if (!process.env[v]) throw new Error(`variável ${v} não configurada`);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
async function ok(p) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
const kv = async (chave) => (await ok(db.from("loc_kv").select("valor").eq("chave", chave).maybeSingle()))?.valor ?? null;
const SAIDA = new URL("../__amostras__/", import.meta.url);
const gravar = (nome, dados) => writeFileSync(new URL(nome, SAIDA), JSON.stringify(dados, null, 1));
const pad = (n) => String(n).padStart(2, "0");
const local = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

mkdirSync(SAIDA, { recursive: true });
const estado = (await kv("estado")) ?? {};
const cercas = (await kv("cercas"))?.cercas ?? [];
const snapshot = await kv("snapshot");
if (!Object.keys(estado).length || !cercas.length) throw new Error("estado ou cercas vazios no Supabase - rode depois de uma coleta");

// 1. leitura: posições "como o GAUSS manda", derivadas do estado real, com variações que geram eventos
const agora = new Date();
const areas = cercas.filter((c) => c.tipo === "area" && c.polygon.length >= 3);
const centro = (c) => [c.polygon.reduce((s, p) => s + p[0], 0) / c.polygon.length, c.polygon.reduce((s, p) => s + p[1], 0) / c.polygon.length];
const veiculos = Object.values(estado);
const posicoes = veiculos.map((v, i) => {
  let { lat, lng, status_cod: status } = v;
  let quando = new Date(agora.getTime() - 60_000).toISOString();
  if (i % 3 === 0) status = status === 1 ? 2 : 1; // muda de status
  if (i % 5 === 0 && areas.length) [lat, lng] = centro(areas[i % areas.length]); // muda de área
  if (i % 7 === 0) quando = new Date(agora.getTime() - 2 * 3600_000).toISOString(); // perde o sinal
  return {
    vehicle_code: Number(v.id), vehicle_name: v.placa, lat: String(lat), lng: String(lng), datetime: local(quando), status,
    contract_position_obj: { name: v.vaga }, vehicle_group: v.grupo, driver: v.motorista || "S/ MOTORISTA", address: v.endereco,
    delay_name: v.demora || "--", direction: v.direcao,
  };
});
// alguns "voltam a comunicar": no estado anterior estavam sem sinal
const anterior = Object.fromEntries(veiculos.map((v, i) => [v.id, i % 11 === 0 ? { ...v, sem_sinal: true } : v]));
const leitura = processarLeitura(anterior, posicoes, cercas, agora);
gravar("leitura.json", { agora: agora.toISOString(), estadoAnterior: anterior, posicoes, cercas, saida: leitura });
console.log(`leitura: ${posicoes.length} posições, ${leitura.eventos.length} eventos`);

// 2. retrato
const meta = { lido_em: agora.toISOString(), erro: null, intervalo_s: 300, gauss: snapshot?.gauss ?? null };
gravar("snapshot.json", { estado: leitura.estado, meta, saida: montarSnapshot(leitura.estado, meta) });

// 3. apontamentos: até 4 dias guardados, de preferência 2 de caminhão com motor secundário
const { secundarioDe } = parearMotores(veiculos);
const secundarios = new Set(secundarioDe.values());
const linhas = await ok(db.from("loc_historico").select("veiculo_id, dia, pontos").order("baixado_em", { ascending: false }).limit(40));
const comPontos = linhas.filter((l) => l.pontos?.length);
const escolhidos = [
  ...comPontos.filter((l) => secundarioDe.has(l.veiculo_id)).slice(0, 2),
  ...comPontos.filter((l) => !secundarioDe.has(l.veiculo_id) && !secundarios.has(l.veiculo_id)).slice(0, 2),
];
let n = 0;
for (const l of escolhidos) {
  const secId = secundarioDe.get(l.veiculo_id);
  const sec = secId ? (comPontos.find((x) => x.veiculo_id === secId && x.dia === l.dia) ?? null) : null;
  const pontosMotor2 = sec?.pontos ?? null;
  gravar(`apontamento-${++n}.json`, { pontos: l.pontos, cercas, pontosMotor2, saida: montarApontamento(l.pontos, cercas, pontosMotor2) });
}
console.log(`apontamentos: ${n} (${escolhidos.filter((l) => secundarioDe.has(l.veiculo_id)).length} de caminhão com motor secundário)`);
```

- [ ] **Step 2: Rodar (na raiz do repositório)**

```bash
node --env-file=../../automation/.env coletor/scripts/gravar-amostras.mjs
ls coletor/__amostras__
git status --short coletor   # __amostras__ NÃO pode aparecer (está no .gitignore)
```

Esperado: imprime `leitura: N posições, M eventos` (M > 0) e `apontamentos: K (...)` com K ≥ 1; a pasta tem `leitura.json`, `snapshot.json` e `apontamento-*.json`; `git status` mostra só `coletor/scripts/`. Se sair `apontamentos: 0`, ninguém pediu histórico recentemente: abra o site atual (http://localhost:5800), peça "Ver histórico" de **ontem** de um caminhão com motor secundário (um pedido só), espere aparecer e rode de novo.

- [ ] **Step 3: Commit (só o script)**

```bash
git add coletor/scripts/gravar-amostras.mjs
git commit -m "Script que grava amostras do coletor atual para conferir a reescrita

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Apontamento (rota do dia → trechos e resumo) em TypeScript

**Files:**
- Create: `src/lib/dominio/apontamento.ts`, `coletor/paridade.test.ts`
- Test: `src/lib/dominio/apontamento.test.ts`

**Interfaces:**
- Consumes: `cercasNoPonto`, `distanciaM` (Tarefa 4); tipos `Apontamento`, `Cerca`, `PontoRota`, `PontoMapa`, `Trecho`, `EstadoTrecho`.
- Produces: `VEL_MOVIMENTO = 5`, `GAP_SEM_SINAL_MIN = 10`, `paraData(t: string): Date`, `rpmTravado(pts: PontoRota[]): number | null`, `intervalosLigado(pts: PontoRota[]): [string, string][]`, `montarApontamento(pontos: PontoRota[], cercas: Cerca[], pontosMotor2?: PontoRota[] | null): Apontamento`.

Porte **literal** de `coletor/historico.js` (linhas 15-233): mesma ordem de operações, mesmas constantes, mesmo formato de saída (inclusive o retorno sem `rpm_travado` quando não há pontos).

- [ ] **Step 1: Testes sintéticos**

`src/lib/dominio/apontamento.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PontoRota } from "../tipos";
import { intervalosLigado, montarApontamento, rpmTravado } from "./apontamento";

// um ponto por minuto a partir de "HH:MM"
const serie = (inicio: string, n: number, f: (i: number) => Partial<PontoRota>): PontoRota[] => {
  const [h, m] = inicio.split(":").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const min = h * 60 + m + i;
    const t = `2026-10-01 ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;
    return { t, lat: -19.48 + i * 0.0005, lng: -42.53, vel: 0, rpm: 0, ...f(i) };
  });
};

describe("montarApontamento", () => {
  it("dia sem pontos", () => {
    expect(montarApontamento([], [])).toEqual({ trechos: [], resumo: null, temRpm: false, pontos: [], motor2: null });
  });

  it("deslocamento seguido de parada com motor ligado", () => {
    const pts = [...serie("08:00", 10, () => ({ vel: 30, rpm: 1500 })), ...serie("08:10", 11, () => ({ vel: 0, rpm: 800 }))];
    const a = montarApontamento(pts, []);
    expect(a.temRpm).toBe(true);
    expect(a.rpm_travado).toBeNull();
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["movimento", 10], ["parado_ligado", 10]]);
    expect(a.resumo).toMatchObject({ movimento_min: 10, parado_ligado_min: 10, desligado_min: 0, sem_sinal_min: 0, motor2_ligado_min: null, areas: [] });
    expect(a.pontos).toHaveLength(21);
    expect(a.pontos[0].slice(2)).toEqual(["08:00:00", 30, "movimento", null]);
    const parada = a.trechos[1];
    expect(parada.estado !== "movimento" && parada.local).toBe("Fora de cerca");
  });

  it("parada curta (menos de 2 min) é absorvida pelo deslocamento", () => {
    const pts = [...serie("08:00", 6, () => ({ vel: 30, rpm: 1500 })), ...serie("08:06", 1, () => ({ vel: 0, rpm: 800 })), ...serie("08:07", 6, () => ({ vel: 30, rpm: 1500 }))];
    expect(montarApontamento(pts, []).trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["movimento", 12]]);
  });

  it("RPM travado o dia todo: não afirma ligado/desligado", () => {
    const pts = serie("08:00", 40, () => ({ rpm: 1316 }));
    expect(rpmTravado(pts)).toBe(1316);
    const a = montarApontamento(pts, []);
    expect(a.temRpm).toBe(false);
    expect(a.rpm_travado).toBe(1316);
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["parado", 39]]);
  });

  it("RPM 1000 fixo por menos de 6h é liga/desliga legítimo", () => {
    expect(rpmTravado(serie("08:00", 40, () => ({ rpm: 1000 })))).toBeNull();
  });

  it("buraco de mais de 10 min vira trecho sem sinal", () => {
    const pts = [...serie("08:00", 6, () => ({})), ...serie("08:30", 6, () => ({}))];
    const a = montarApontamento(pts, []);
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["parado", 5], ["sem_sinal", 25], ["parado", 5]]);
    expect(a.resumo).toMatchObject({ sem_sinal_min: 25, parado_min: 10 });
  });

  it("motor secundário: intervalos ligado e minutos em cada trecho", () => {
    const motor2 = serie("08:00", 7, (i) => ({ rpm: i >= 2 && i <= 4 ? 1000 : 0 }));
    expect(intervalosLigado(motor2)).toEqual([["2026-10-01 08:02:00", "2026-10-01 08:05:00"]]);
    const a = montarApontamento(serie("08:00", 10, () => ({ rpm: 800 })), [], motor2);
    expect(a.motor2).toEqual({ intervalos: [["08:02:00", "08:05:00"]] });
    expect(a.resumo?.motor2_ligado_min).toBe(3);
    expect(a.trechos[0].motor2_min).toBe(3);
    expect(a.pontos.map((p) => p[5])).toEqual([0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/apontamento.test.ts` → FAIL.

- [ ] **Step 3: Escrever `src/lib/dominio/apontamento.ts`**

```ts
// Apontamento de um veículo num dia, a partir da "Rota" do GAUSS (um ponto a cada ~30 s com velocidade e
// RPM): deslocamentos (por quais ruas/áreas passou), paradas (onde, motor ligado ou desligado), sem sinal.
// Mesmo cálculo do coletor em JS (paridade conferida em coletor/paridade.test.ts).
import type { Apontamento, Cerca, EstadoTrecho, PontoMapa, PontoRota, Trecho } from "../tipos";
import { cercasNoPonto, distanciaM } from "./geo";

export const VEL_MOVIMENTO = 5; // km/h - abaixo disso é parado (GPS oscila 1-4 km/h parado)
export const GAP_SEM_SINAL_MIN = 10;
const SEGMENTO_MIN = 2; // trechos menores que isso são ruído e são absorvidos pelo anterior

/** "AAAA-MM-DD HH:MM:SS" (horário local do GAUSS) → Date */
export const paraData = (t: string) => new Date(t.replace(" ", "T"));
const minutos = (a: string, b: string) => (paraData(b).getTime() - paraData(a).getTime()) / 60000;

/**
 * RPM que não muda o dia inteiro é sensor travado, não motor ligado - ex.: EOF5208 em 01/10/2026 mandou 1316
 * em todas as 1538 leituras, andando e parado. O padrão 0/1000 (liga/desliga) é legítimo, mas 1000 fixo por
 * mais de 6h também é suspeito.
 * @returns o valor travado, ou null se o RPM parece confiável
 */
export function rpmTravado(pts: PontoRota[]): number | null {
  if (pts.length < 30) return null;
  const valores = new Set(pts.map((p) => p.rpm));
  if (valores.size !== 1) return null;
  const v = [...valores][0];
  if (v <= 0) return null;
  if (v === 1000 && minutos(pts[0].t, pts.at(-1)!.t) <= 6 * 60) return null;
  return v;
}

/**
 * Intervalos [início, fim] em que o motor secundário esteve ligado. O rastreador dele manda RPM 0/1000;
 * buraco grande sem leitura encerra o intervalo em vez de supor que ficou ligado o tempo todo.
 */
export function intervalosLigado(pts: PontoRota[]): [string, string][] {
  const out: [string, string][] = [];
  let ini: string | null = null;
  let ult: string | null = null;
  for (const p of pts) {
    if (ini && ult && minutos(ult, p.t) > GAP_SEM_SINAL_MIN) {
      out.push([ini, ult]);
      ini = null;
    }
    if (p.rpm > 0 && !ini) ini = p.t;
    if (p.rpm <= 0 && ini) {
      out.push([ini, p.t]);
      ini = null;
    }
    ult = p.t;
  }
  if (ini && ult) out.push([ini, ult]);
  return out;
}

function sobreposicaoMin(a: string, b: string, intervalos: [string, string][]): number {
  let min = 0;
  for (const [ini, fim] of intervalos) {
    const i = ini > a ? ini : a;
    const f = fim < b ? fim : b;
    if (f > i) min += minutos(i, f);
  }
  return min;
}

interface PontoEnriquecido extends PontoRota {
  area: string;
  via: string;
  estado: EstadoTrecho;
}
interface TrechoBruto {
  estado: EstadoTrecho;
  inicio: string;
  fim?: string;
  pts: PontoEnriquecido[];
}

/**
 * Transforma os pontos em apontamento (trechos contínuos) + resumo do dia. Motor: RPM > 0 = ligado. Se o
 * veículo não manda RPM nenhum no dia, não dá pra afirmar ligado/desligado e a parada fica só "Parado".
 * pontosMotor2: pontos do motor secundário do caminhão (ver frota.ts), se houver.
 */
export function montarApontamento(pontos: PontoRota[], cercas: Cerca[], pontosMotor2: PontoRota[] | null = null): Apontamento {
  if (!pontos.length) return { trechos: [], resumo: null, temRpm: false, pontos: [], motor2: null };
  const travadoMotor2 = pontosMotor2 ? rpmTravado(pontosMotor2) : null;
  const motor2 = pontosMotor2 && travadoMotor2 == null ? intervalosLigado(pontosMotor2) : null;
  const travado = rpmTravado(pontos);
  const temRpm = travado == null && pontos.some((p) => p.rpm > 0);

  const enriquecidos: PontoEnriquecido[] = pontos.map((p) => {
    const dentro = cercasNoPonto(p.lat, p.lng, cercas);
    const area = dentro.find((c) => c.tipo === "area")?.name ?? "";
    const via = dentro.find((c) => c.tipo === "via")?.name ?? "";
    let estado: EstadoTrecho = "parado";
    if (p.vel >= VEL_MOVIMENTO) estado = "movimento";
    else if (temRpm) estado = p.rpm > 0 ? "parado_ligado" : "desligado";
    return { ...p, area, via, estado };
  });

  // trechos brutos: muda de estado = novo trecho; buraco grande = trecho "sem sinal"
  let trechos: TrechoBruto[] = [];
  for (let i = 0; i < enriquecidos.length; i++) {
    const p = enriquecidos[i];
    const ant = enriquecidos[i - 1];
    if (ant && minutos(ant.t, p.t) > GAP_SEM_SINAL_MIN) trechos.push({ estado: "sem_sinal", inicio: ant.t, fim: p.t, pts: [] });
    const atual = trechos.at(-1);
    if (atual && atual.estado === p.estado) atual.pts.push(p);
    else trechos.push({ estado: p.estado, inicio: p.t, pts: [p] });
  }
  // cada trecho vai até o começo do próximo (linha do tempo contínua)
  trechos.forEach((t, i) => {
    t.fim = trechos[i + 1]?.inicio ?? t.fim ?? t.pts.at(-1)!.t;
  });

  // suaviza: trecho curto (ex.: parou 40 s no cruzamento) é absorvido pelo anterior
  const suavizados: TrechoBruto[] = [];
  for (const t of trechos) {
    const anterior = suavizados.at(-1);
    const curto = t.estado !== "sem_sinal" && minutos(t.inicio, t.fim!) < SEGMENTO_MIN;
    if (anterior && (curto || anterior.estado === t.estado) && anterior.estado !== "sem_sinal") {
      anterior.fim = t.fim;
      anterior.pts.push(...t.pts);
    } else {
      suavizados.push({ ...t, pts: [...t.pts] });
    }
  }
  trechos = suavizados;

  const resultado: Trecho[] = trechos.map((t): Trecho => {
    const fim = t.fim!;
    const duracao_min = Math.round(minutos(t.inicio, fim));
    const extra = motor2 ? { motor2_min: Math.round(sobreposicaoMin(t.inicio, fim, motor2)) } : {};
    if (t.estado === "movimento") {
      // sequência de lugares por onde passou, sem repetir o mesmo seguido
      const percurso: string[] = [];
      for (const p of t.pts) {
        const lugar = p.area || p.via;
        if (lugar && percurso.at(-1) !== lugar) percurso.push(lugar);
      }
      let km = 0;
      for (let i = 1; i < t.pts.length; i++) km += distanciaM(t.pts[i - 1], t.pts[i]) / 1000;
      return {
        estado: t.estado, inicio: t.inicio, fim, duracao_min,
        de: t.pts[0]?.area || t.pts[0]?.via || "", para: t.pts.at(-1)?.area || t.pts.at(-1)?.via || "",
        percurso, km: Math.round(km * 10) / 10, vel_max: Math.max(0, ...t.pts.map((p) => p.vel)), ...extra,
      };
    }
    // parado: o lugar onde passou mais tempo nesse trecho
    const conta: Record<string, number> = {};
    for (const p of t.pts) {
      const lugar = p.area || p.via || "Fora de cerca";
      conta[lugar] = (conta[lugar] ?? 0) + 1;
    }
    const local = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] ?? "";
    const ref = t.pts[Math.floor(t.pts.length / 2)];
    return { estado: t.estado, inicio: t.inicio, fim, duracao_min, local, lat: ref?.lat, lng: ref?.lng, ...extra };
  });

  const total = (estado: EstadoTrecho) => resultado.filter((t) => t.estado === estado).reduce((s, t) => s + t.duracao_min, 0);
  // tempo por área: soma do intervalo até o próximo ponto (limitado, pra buraco não inflar)
  const tempoArea: Record<string, number> = {};
  for (let i = 0; i < enriquecidos.length - 1; i++) {
    const p = enriquecidos[i];
    if (!p.area) continue;
    tempoArea[p.area] = (tempoArea[p.area] ?? 0) + Math.min(minutos(p.t, enriquecidos[i + 1].t), GAP_SEM_SINAL_MIN);
  }

  return {
    temRpm,
    rpm_travado: travado,
    motor2_rpm_travado: travadoMotor2,
    trechos: resultado,
    resumo: {
      primeiro: pontos[0].t,
      ultimo: pontos.at(-1)!.t,
      pontos: pontos.length,
      // só os trechos em movimento têm km (no JS: t.km ?? 0, mesmo resultado)
      km: Math.round(resultado.reduce((s, t) => s + (t.estado === "movimento" ? t.km : 0), 0) * 10) / 10,
      vel_max: Math.max(0, ...pontos.map((p) => p.vel)),
      movimento_min: total("movimento"),
      parado_ligado_min: total("parado_ligado"),
      desligado_min: total("desligado"),
      parado_min: total("parado"),
      sem_sinal_min: total("sem_sinal"),
      motor2_ligado_min: motor2 ? Math.round(motor2.reduce((s, [a, b]) => s + minutos(a, b), 0)) : null,
      areas: Object.entries(tempoArea)
        .map(([area, min]) => ({ area, min: Math.round(min) }))
        .filter((a) => a.min >= 1)
        .sort((a, b) => b.min - a.min),
    },
    // pontos leves pro mapa: [lat, lng, hora, km/h, estado, motor 2º ligado (1/0, ou null sem motor 2º)]
    pontos: enriquecidos.map((p): PontoMapa => [p.lat, p.lng, p.t.slice(11, 19), p.vel, p.estado, motor2 ? (motor2.some(([a, b]) => p.t >= a && p.t <= b) ? 1 : 0) : null]),
    motor2: motor2 ? { intervalos: motor2.map(([a, b]): [string, string] => [a.slice(11, 19), b.slice(11, 19)]) } : null,
  };
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/dominio/apontamento.test.ts` → PASS.

- [ ] **Step 5: Teste de paridade com as amostras**

`coletor/paridade.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { montarApontamento } from "../src/lib/dominio/apontamento";

// Amostras do coletor antigo em JS, gravadas por coletor/scripts/gravar-amostras.mjs (Tarefa 5; o script sai do
// repositório junto com o JS, mas fica no histórico do git). Têm dados reais e ficam fora do git: sem elas
// (CI), este bloco é pulado e valem os testes sintéticos de src/lib/dominio.
const PASTA = new URL("./__amostras__/", import.meta.url);
const arquivos = existsSync(PASTA) ? readdirSync(PASTA) : [];
const ler = (nome: string) => JSON.parse(readFileSync(new URL(nome, PASTA), "utf-8"));
// o banco guarda JSON: compara como JSON (campos undefined somem, NaN vira null)
const json = (v: unknown) => JSON.parse(JSON.stringify(v));

describe.skipIf(!arquivos.length)("paridade com o coletor em JS", () => {
  for (const nome of arquivos.filter((n) => n.startsWith("apontamento-"))) {
    it(`apontamento igual: ${nome}`, () => {
      const a = ler(nome);
      expect(json(montarApontamento(a.pontos, a.cercas, a.pontosMotor2))).toStrictEqual(a.saida);
    });
  }
});
```

Run: `npx vitest run coletor/paridade.test.ts` → PASS (um teste por `apontamento-N.json`). Se falhar, a diferença está no porte: compare linha a linha com `coletor/historico.js` — **não** mexa na amostra.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dominio/apontamento.ts src/lib/dominio/apontamento.test.ts coletor/paridade.test.ts
git commit -m "Apontamento do dia em TypeScript, igual ao coletor em JS (paridade com amostras reais)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Leitura da frota (estado, eventos e retrato) em TypeScript

**Files:**
- Create: `src/lib/dominio/leitura.ts`
- Modify: `coletor/paridade.test.ts` (acrescentar leitura e retrato)
- Test: `src/lib/dominio/leitura.test.ts`

**Interfaces:**
- Consumes: `parearMotores`, `cercasNoPonto` (Tarefa 4); tipos `Cerca`, `EstadoVeiculo`, `Evento`, `Retrato`.
- Produces: `SEM_SINAL_MIN = 30`; `STATUS: Record<number, string>`; `interface PosicaoGauss`; `processarLeitura(estadoAnterior: Record<string, EstadoVeiculo>, posicoes: PosicaoGauss[], cercas: Cerca[], agora?: Date): { estado: Record<string, EstadoVeiculo>; eventos: Evento[] }`; `montarSnapshot(estado: Record<string, EstadoVeiculo>, meta: Omit<Retrato, "veiculos" | "sem_sinal_min">): Retrato`.

Porte de `coletor/processamento.js` e da tabela `STATUS` de `coletor/location-online.js`. Uma correção: evento de entrada/saída usa `posicaoEm ?? agoraISO` como horário (no JS, posição sem data gerava evento com `t` nulo, que o banco recusa — e a execução inteira caía).

- [ ] **Step 1: Testes**

`src/lib/dominio/leitura.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Cerca, EstadoVeiculo } from "../tipos";
import { montarSnapshot, processarLeitura, type PosicaoGauss } from "./leitura";

const quadrado = (name: string, lat: number, lng: number): Cerca => ({ code: 1, name, layer: 1, color: "#000", tipo: "area", polygon: [[lat, lng], [lat, lng + 1], [lat + 1, lng + 1], [lat + 1, lng]] });
const CERCAS = [quadrado("PATIO", 0, 0), quadrado("OFICINA", 5, 5)];
const AGORA = new Date("2026-10-01T12:05:00-03:00");
const pos = (o: Partial<PosicaoGauss> = {}): PosicaoGauss => ({
  vehicle_code: 10, vehicle_name: "EOF5208", lat: "0.5", lng: "0.5", datetime: "2026-10-01 12:04:00", status: 1,
  contract_position_obj: { name: "VAGA 1" }, vehicle_group: "AP", driver: "S/ MOTORISTA", address: "Rua A", delay_name: "--", direction: 90, ...o,
});
const anterior = (o: Partial<EstadoVeiculo> = {}): EstadoVeiculo => ({
  id: "10", placa: "EOF5208", vaga: "VAGA 1", grupo: "AP", motorista: "", endereco: "Rua A", demora: "", direcao: 90, status: "Ligado", status_cod: 1,
  status_desde: "2026-10-01T14:30:00.000Z", lat: 0.5, lng: 0.5, posicao_em: "2026-10-01T14:59:00.000Z", area: "PATIO", area_desde: "2026-10-01T14:00:00.000Z",
  via: "", sem_sinal: false, ...o,
});

describe("processarLeitura", () => {
  it("primeira leitura: estado sem 'desde' e nenhum evento", () => {
    const r = processarLeitura({}, [pos()], CERCAS, AGORA);
    expect(r.eventos).toEqual([]);
    expect(r.estado["10"]).toMatchObject({ area: "PATIO", status: "Ligado", status_desde: null, area_desde: null, motorista: "", demora: "", sem_sinal: false, posicao_em: "2026-10-01T15:04:00.000Z" });
  });
  it("mudou de área e de status", () => {
    const r = processarLeitura({ "10": anterior() }, [pos({ lat: "5.5", lng: "5.5", status: 2 })], CERCAS, AGORA);
    expect(r.eventos.map((e) => e.tipo)).toEqual(["saida", "entrada", "status"]);
    expect(r.eventos[0]).toMatchObject({ area: "PATIO", permanencia_min: 64, t: "2026-10-01T15:04:00.000Z" });
    expect(r.eventos[2]).toMatchObject({ de: "Ligado", para: "Desligado", duracao_min: 35, area: "OFICINA" });
    expect(r.estado["10"]).toMatchObject({ area: "OFICINA", area_desde: "2026-10-01T15:04:00.000Z", status_desde: "2026-10-01T15:05:00.000Z" });
  });
  it("perdeu o sinal (posição de mais de 30 min)", () => {
    const r = processarLeitura({ "10": anterior() }, [pos({ datetime: "2026-10-01 11:00:00" })], CERCAS, AGORA);
    expect(r.eventos).toEqual([expect.objectContaining({ tipo: "sinal_perdido", ultima_posicao: "2026-10-01T14:00:00.000Z", area: "PATIO" })]);
  });
  it("voltou a comunicar", () => {
    const r = processarLeitura({ "10": anterior({ sem_sinal: true, posicao_em: "2026-10-01T13:00:00.000Z" }) }, [pos()], CERCAS, AGORA);
    expect(r.eventos).toEqual([expect.objectContaining({ tipo: "sinal_retomado", sem_sinal_min: 124 })]);
  });
  it("motor secundário: sem entrada/saída, status marcado com o caminhão principal", () => {
    const ant = { "10": anterior(), "11": anterior({ id: "11", placa: "EOF52082" }) };
    const r = processarLeitura(ant, [pos(), pos({ vehicle_code: 11, vehicle_name: "EOF52082", lat: "5.5", lng: "5.5", status: 2 })], CERCAS, AGORA);
    expect(r.eventos.map((e) => e.tipo)).toEqual(["status"]);
    expect(r.eventos[0]).toMatchObject({ id: "11", motor2: true, principal_id: "10", principal: "EOF5208" });
  });
});

describe("montarSnapshot", () => {
  it("põe o motor secundário dentro do caminhão", () => {
    const estado = { "10": anterior(), "11": anterior({ id: "11", placa: "EOF52082", status: "Desligado", status_cod: 2 }) };
    const s = montarSnapshot(estado, { lido_em: "x", erro: null, intervalo_s: 300 });
    expect(s.sem_sinal_min).toBe(30);
    expect(s.veiculos.find((v) => v.id === "10")?.motor2).toMatchObject({ id: "11", placa: "EOF52082", status_cod: 2 });
    expect(s.veiculos.find((v) => v.id === "11")?.motor2_de).toBe("10");
  });
});
```

Contas dos valores esperados: posição 12:04 local = 15:04Z; agora 12:05 local = 15:05Z. Permanência = 14:00Z → 15:04Z = 64 min. Status anterior desde 14:30Z até agora (15:05Z) = 35 min. Sem sinal desde 13:00Z até 15:04Z = 124 min.

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/leitura.test.ts` → FAIL.

- [ ] **Step 3: Escrever `src/lib/dominio/leitura.ts`**

```ts
// Transforma uma leitura da tela Localização do GAUSS em estado + eventos (entrada/saída de área, mudança de
// status, perda/retorno de sinal), em forma de função pura: o GitHub Actions roda uma vez e termina, então o
// estado anterior vem do Supabase. Mesmo cálculo do coletor em JS (paridade em coletor/paridade.test.ts).
import type { Cerca, EstadoVeiculo, Evento, Retrato } from "../tipos";
import { parearMotores } from "./frota";
import { cercasNoPonto } from "./geo";

// sem leitura nova do GPS há mais que isso = "sem sinal" (gera evento)
export const SEM_SINAL_MIN = 30;

/** Legenda de status do GAUSS (códigos do marcador da tela Localização). */
export const STATUS: Record<number, string> = {
  1: "Ligado",
  2: "Desligado",
  3: "Parado ligado",
  4: "Chave geral desligada",
  5: "Aguardando manutenção",
  6: "Em programação",
  7: "Sem comunicação +6h",
  9: "Em manutenção",
  11: "Disponível",
  37: "Geo área indisponível",
  71: "Desligado",
  88: "Checklist não conforme",
  89: "Checklist impeditivo",
  98: "Desligado",
  99: "Excesso de velocidade",
};

/** Posição de um veículo como o GAUSS devolve na tela Localização (location-online). */
export interface PosicaoGauss {
  vehicle_code: number | string;
  vehicle_name: string;
  lat: string | number;
  lng: string | number;
  /** "AAAA-MM-DD HH:MM:SS" em horário local */
  datetime: string | null;
  status: number | string;
  contract_position_obj?: { name?: string } | null;
  vehicle_group?: string | null;
  driver?: string | null;
  address?: string | null;
  delay_name?: string | null;
  direction?: number | string | null;
}

// o GAUSS manda "2026-09-30 22:52:02" em horário local (TZ=America/Sao_Paulo no workflow)
const gaussParaISO = (s: string | null) => (s ? new Date(s.replace(" ", "T")).toISOString() : null);
const minutosEntre = (a: string | null, b: string | null) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : null);

export function processarLeitura(
  estadoAnterior: Record<string, EstadoVeiculo>,
  posicoes: PosicaoGauss[],
  cercas: Cerca[],
  agora = new Date(),
): { estado: Record<string, EstadoVeiculo>; eventos: Evento[] } {
  const agoraISO = agora.toISOString();
  const estado = { ...estadoAnterior };
  const eventos: Evento[] = [];
  const { principalDe } = parearMotores(posicoes.map((p) => ({ id: String(p.vehicle_code), placa: p.vehicle_name })));
  const placaPorId = new Map(posicoes.map((p) => [String(p.vehicle_code), p.vehicle_name]));

  for (const p of posicoes) {
    const id = String(p.vehicle_code);
    const ant = estadoAnterior[id];
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    const posicaoEm = gaussParaISO(p.datetime);
    const dentro = cercasNoPonto(lat, lng, cercas);
    const area = dentro.find((c) => c.tipo === "area")?.name ?? "";
    const via = dentro.find((c) => c.tipo === "via")?.name ?? "";
    const status = STATUS[Number(p.status)] ?? `Status ${p.status}`;
    const semSinal = posicaoEm ? (agora.getTime() - new Date(posicaoEm).getTime()) / 60000 > SEM_SINAL_MIN : true;

    const atual: EstadoVeiculo = {
      id,
      placa: p.vehicle_name,
      vaga: p.contract_position_obj?.name ?? "",
      grupo: p.vehicle_group ?? "",
      motorista: p.driver && !/^S\/ MOTORISTA/i.test(p.driver) ? p.driver : "",
      endereco: p.address ?? "",
      demora: p.delay_name && p.delay_name !== "--" ? p.delay_name : "",
      direcao: Number(p.direction) || 0,
      status,
      status_cod: Number(p.status),
      // sem estado anterior não dá pra saber desde quando - fica null em vez de inventar
      status_desde: ant ? (ant.status === status ? ant.status_desde : agoraISO) : null,
      lat,
      lng,
      posicao_em: posicaoEm,
      area,
      area_desde: ant ? (ant.area === area ? ant.area_desde : posicaoEm) : null,
      via,
      sem_sinal: semSinal,
    };

    const principalId = principalDe.get(id);
    const base = {
      t: agoraISO, id, placa: atual.placa, vaga: atual.vaga,
      ...(principalId ? { motor2: true as const, principal_id: principalId, principal: placaPorId.get(principalId) } : {}),
    };
    if (ant) {
      // posição sem data: o evento fica com o horário da leitura (t nulo o banco recusa)
      const quando = posicaoEm ?? agoraISO;
      // entrada/saída de área do motor secundário seria cópia da do caminhão
      if (ant.area !== area && !principalId) {
        if (ant.area) eventos.push({ ...base, t: quando, tipo: "saida", area: ant.area, desde: ant.area_desde, permanencia_min: minutosEntre(ant.area_desde, posicaoEm) });
        if (area) eventos.push({ ...base, t: quando, tipo: "entrada", area, lat, lng });
      }
      if (ant.status !== status) {
        eventos.push({ ...base, tipo: "status", de: ant.status, para: status, area, duracao_min: minutosEntre(ant.status_desde, agoraISO) });
      }
      if (semSinal && !ant.sem_sinal) {
        eventos.push({ ...base, tipo: "sinal_perdido", ultima_posicao: posicaoEm, area });
      } else if (!semSinal && ant.sem_sinal) {
        eventos.push({ ...base, tipo: "sinal_retomado", area, sem_sinal_min: minutosEntre(ant.posicao_em, posicaoEm) });
      }
    }

    estado[id] = atual;
  }
  return { estado, eventos };
}

/** Retrato que a página mostra: o motor secundário vai dentro do caminhão (motor2). */
export function montarSnapshot(estado: Record<string, EstadoVeiculo>, meta: Omit<Retrato, "veiculos" | "sem_sinal_min">): Retrato {
  const todos = Object.values(estado);
  const { principalDe, secundarioDe } = parearMotores(todos);
  const veiculos = todos.map((v) => {
    if (principalDe.has(v.id)) return { ...v, motor2_de: principalDe.get(v.id) };
    const sec = estado[secundarioDe.get(v.id) ?? ""];
    if (!sec) return v;
    return {
      ...v,
      motor2: { id: sec.id, placa: sec.placa, status: sec.status, status_cod: sec.status_cod, status_desde: sec.status_desde, posicao_em: sec.posicao_em, sem_sinal: sec.sem_sinal },
    };
  });
  return { ...meta, sem_sinal_min: SEM_SINAL_MIN, veiculos };
}
```

`toStrictEqual` não olha a ordem das chaves, então a paridade vale mesmo com o `base` montado de outro jeito.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/dominio/leitura.test.ts` → PASS.

- [ ] **Step 5: Paridade da leitura e do retrato**

Em `coletor/paridade.test.ts`, troque o import do domínio por:

```ts
import { montarApontamento } from "../src/lib/dominio/apontamento";
import { montarSnapshot, processarLeitura } from "../src/lib/dominio/leitura";
```

e acrescente dentro do `describe.skipIf(...)`, antes do `for`:

```ts
  it("leitura igual (estado e eventos)", () => {
    const a = ler("leitura.json");
    expect(json(processarLeitura(a.estadoAnterior, a.posicoes, a.cercas, new Date(a.agora)))).toStrictEqual(a.saida);
  });
  it("retrato igual", () => {
    const a = ler("snapshot.json");
    expect(json(montarSnapshot(a.estado, a.meta))).toStrictEqual(a.saida);
  });
```

Run: `npm test` → PASS (inclusive a paridade).

- [ ] **Step 6: Commit**

```bash
git add src/lib/dominio/leitura.ts src/lib/dominio/leitura.test.ts coletor/paridade.test.ts
git commit -m "Leitura da frota (estado, eventos e retrato) em TypeScript, igual ao coletor em JS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Coletor em TypeScript

**Files:**
- Create: `coletor/config.ts`, `coletor/gauss.ts`, `coletor/location-online.ts`, `coletor/historico.ts`, `coletor/supabase.ts`, `coletor/run.ts`
- Modify: `coletor/package.json` (substituir), `coletor/package-lock.json` (regerar), `.github/workflows/coletor.yml`, `eslint.config.mjs`
- Delete: `coletor/config.js`, `coletor/frota.js`, `coletor/gauss.js`, `coletor/historico.js`, `coletor/location-online.js`, `coletor/processamento.js`, `coletor/run.js`, `coletor/scripts/`
- Test: `coletor/historico.test.ts`

**Interfaces:**
- Consumes: `montarApontamento`, `paraData` (T6); `processarLeitura`, `montarSnapshot`, `type PosicaoGauss` (T7); `tipoCerca`, `parearMotores` (T4); `diaLocal` (T3); tipos.
- Produces (uso interno do coletor): `verificarAmbiente()`, `credenciais()`, `BASE_URL`; `class GaussFleetClient { login(); post<T>(path, campos) }`, `type Campo`, `estatisticas`, `SESSAO_FILE`; `listarVeiculos(client)`, `buscarPosicoes(client, ids)`, `buscarCercas(client, ids)`, `type VeiculoCadastro`; `HOJE_TTL_MS`, `baixarRota(client, id, dia, horaInicio)`, `mesclarPontos(a, b)`, `diaFechado(dia, agora?)`; `db()`, `ok(p)`, `kvGet<T>(chave)`, `kvSet(chave, valor)`.

**Comportamento idêntico ao JS:** mesmas constantes (intervalo 2 s + até 1 s, backoff 5/10/20 s, 3 tentativas, pausa de 10 min após 5 falhas, sessão ociosa 20 min, timeout 30 s, cadastro 24 h, cercas 7 dias, `MAX_PEDIDOS = 4`, `INTERVALO_S = 300`, `HOJE_TTL_MS` 5 min, `MAX_PAGINAS = 6`, dia fechado 2 h após a meia-noite) e mesma ordem de chamadas ao GAUSS e ao banco.

- [ ] **Step 1: Teste das funções puras do histórico**

`coletor/historico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { diaFechado, mesclarPontos } from "./historico";

const p = (t: string, vel = 0) => ({ t: `2026-10-01 ${t}`, lat: 0, lng: 0, vel, rpm: 0 });

describe("histórico do coletor", () => {
  it("mescla pontos guardados com os novos, sem duplicar, em ordem", () => {
    expect(mesclarPontos([p("08:00:00"), p("08:01:00")], [p("08:01:00", 9), p("07:59:00")]).map((x) => [x.t.slice(11), x.vel])).toEqual([
      ["07:59:00", 0], ["08:00:00", 0], ["08:01:00", 9],
    ]);
  });
  it("dia só fecha 2 h depois da meia-noite (o rastreador descarrega atrasado)", () => {
    expect(diaFechado("2026-10-01", new Date("2026-10-02T01:00:00-03:00").getTime())).toBe(false);
    expect(diaFechado("2026-10-01", new Date("2026-10-02T03:00:00-03:00").getTime())).toBe(true);
  });
});
```

Run: `npx vitest run coletor/historico.test.ts` → FAIL (`./historico` ainda é o JS, sem o parâmetro `agora`).

- [ ] **Step 2: `coletor/package.json` e `coletor/config.ts`**

`coletor/package.json`:

```json
{
  "name": "monitoramento-localizacao-coletor",
  "version": "2.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "coletar": "tsx run.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.117.1",
    "tsx": "4.23.15"
  }
}
```

`coletor/config.ts`:

```ts
export const BASE_URL = "https://usiminas.gaussfleet.com";

const NECESSARIAS = ["GAUSSFLEET_USERNAME", "GAUSSFLEET_PASSWORD", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;

/** Para logo no início se faltar segredo do repositório (Settings > Secrets and variables > Actions). */
export function verificarAmbiente(): void {
  for (const v of NECESSARIAS) if (!process.env[v]) throw new Error(`variável ${v} não configurada (segredos do repositório)`);
  if (process.env.TZ !== "America/Sao_Paulo") console.warn("⚠️  TZ não é America/Sao_Paulo - horários do GAUSS serão lidos errado");
}

export const credenciais = () => ({ username: process.env.GAUSSFLEET_USERNAME ?? "", password: process.env.GAUSSFLEET_PASSWORD ?? "" });
```

- [ ] **Step 3: `coletor/gauss.ts` (porte tipado de `gauss.js`)**

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE_URL, credenciais } from "./config";

const COMMON_HEADERS = {
  "X-Requested-With": "XMLHttpRequest",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// sem isso, uma conexão que trava (sem responder e sem erro) prende o fetch pra sempre
const REQUEST_TIMEOUT_MS = 30_000;

// --- boas práticas de acesso: o GAUSS não é nosso, a automação tem que pesar menos que uma pessoa usando o sistema ---
// uma requisição por vez (fila global do processo), com intervalo mínimo + jitter
const INTERVALO_MIN_MS = 2_000;
const JITTER_MS = 1_000;
// 429/503/timeout: espera crescente (5s, 10s, 20s), respeitando Retry-After
const BACKOFF_BASE_MS = 5_000;
const TENTATIVAS = 3;
// muitas falhas seguidas = para de insistir por um tempo (circuit breaker)
const FALHAS_PARA_PAUSAR = 5;
const PAUSA_MS = 10 * 60 * 1000;
// sessão reaproveitada entre execuções - evita um login a cada execução. Só vale se foi usada com sucesso há
// pouco: não sabemos como o GAUSS responde a uma sessão expirada, então sessão parada há mais que isso é
// descartada e faz login novo - como uma pessoa faria
export const SESSAO_FILE = join(import.meta.dirname, ".sessao-gauss.json");
const SESSAO_OCIOSA_MS = 20 * 60 * 1000;
const GRAVAR_USO_A_CADA_MS = 60 * 1000;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

let fila: Promise<unknown> = Promise.resolve();
let ultimaRequisicao = 0;
let falhasSeguidas = 0;
let pausadoAte = 0;

/** Contadores para acompanhar a carga que geramos no GAUSS. */
export const estatisticas = { desde: new Date().toISOString(), requisicoes: 0, logins: 0, erros: 0, pausadoAte: null as string | null };

// serializa: a próxima só começa depois da anterior terminar + intervalo mínimo
function enfileirar<T>(fn: () => Promise<T>): Promise<T> {
  const tarefa = fila.then(async () => {
    if (Date.now() < pausadoAte) {
      throw new Error(`acesso ao GAUSS pausado até ${new Date(pausadoAte).toLocaleTimeString("pt-BR")} após falhas seguidas`);
    }
    const aguardar = ultimaRequisicao + INTERVALO_MIN_MS + Math.random() * JITTER_MS - Date.now();
    if (aguardar > 0) await espera(aguardar);
    try {
      return await fn();
    } finally {
      ultimaRequisicao = Date.now();
    }
  });
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function fetchComBackoff(url: string, opcoes: RequestInit): Promise<Response> {
  for (let tentativa = 1; ; tentativa++) {
    estatisticas.requisicoes++;
    let res: Response;
    try {
      res = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (tentativa >= TENTATIVAS) throw registrarFalha(err instanceof Error ? err : new Error(String(err)));
      await espera(BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      if (tentativa >= TENTATIVAS) throw registrarFalha(new Error(`HTTP ${res.status} (servidor pediu para desacelerar)`));
      const retryAfter = Number(res.headers.get("retry-after"));
      await espera(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    falhasSeguidas = 0;
    return res;
  }
}

function registrarFalha(err: Error): Error {
  estatisticas.erros++;
  if (++falhasSeguidas >= FALHAS_PARA_PAUSAR) {
    pausadoAte = Date.now() + PAUSA_MS;
    estatisticas.pausadoAte = new Date(pausadoAte).toISOString();
    falhasSeguidas = 0;
  }
  return err;
}

/** Pares [chave, valor] do formulário; repita a chave para listas (ex.: vehicle[]). */
export type Campo = [string, string | number];

export class GaussFleetClient {
  #cookie = "";
  #usoGravadoEm = 0;

  constructor() {
    try {
      if (existsSync(SESSAO_FILE)) {
        const salva = JSON.parse(readFileSync(SESSAO_FILE, "utf-8")) as { cookie?: string; em?: string; usada_em?: string };
        const usadaEm = new Date(salva.usada_em ?? salva.em ?? 0).getTime();
        if (Date.now() - usadaEm < SESSAO_OCIOSA_MS) this.#cookie = salva.cookie ?? "";
      }
    } catch {
      this.#cookie = "";
    }
  }

  #gravarSessao(forcar = false) {
    if (!forcar && Date.now() - this.#usoGravadoEm < GRAVAR_USO_A_CADA_MS) return;
    this.#usoGravadoEm = Date.now();
    const agora = new Date().toISOString();
    let em = agora;
    try {
      em = (JSON.parse(readFileSync(SESSAO_FILE, "utf-8")) as { em?: string }).em ?? agora;
    } catch {
      // primeira sessão: ainda não há arquivo
    }
    writeFileSync(SESSAO_FILE, JSON.stringify({ cookie: this.#cookie, em: forcar ? agora : em, usada_em: agora }), "utf-8");
  }

  /** Reaproveita a sessão salva; só faz login de verdade se não houver uma (ou se forcar). */
  async login({ forcar = false } = {}): Promise<void> {
    if (this.#cookie && !forcar) return;
    const { username, password } = credenciais();
    if (!username || !password) throw new Error("GAUSSFLEET_USERNAME / GAUSSFLEET_PASSWORD não configurados.");

    const body = new URLSearchParams({ username, password });
    const res = await enfileirar(() =>
      fetchComBackoff(`${BASE_URL}/operations/login`, { method: "POST", headers: { ...COMMON_HEADERS, "Content-Type": "application/x-www-form-urlencoded" }, body }),
    );
    estatisticas.logins++;

    const novo = res.headers
      .getSetCookie()
      .filter((c) => !c.toLowerCase().includes("deleted") && !c.startsWith("=deleted"))
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!novo) throw new Error(`Login não retornou cookies de sessão válidos (HTTP ${res.status}). Usuário/senha incorretos?`);

    this.#cookie = novo;
    this.#gravarSessao(true);
  }

  async post<T = unknown>(path: string, campos: Campo[]): Promise<T> {
    if (!this.#cookie) await this.login();
    const body = new URLSearchParams();
    for (const [chave, valor] of campos) body.append(chave, String(valor));

    let { status, texto } = await enviar(path, body, this.#cookie);
    // sessão expirada: o GAUSS responde a página de login (HTML) em vez de JSON. Reloga UMA vez e repete;
    // se continuar, é erro de verdade.
    let json = tentarJSON(texto);
    if ((json === undefined && status < 400) || status === 401 || status === 403) {
      await this.login({ forcar: true });
      ({ status, texto } = await enviar(path, body, this.#cookie));
      json = tentarJSON(texto);
    }
    if (status < 200 || status >= 300) throw new Error(`POST ${path} -> HTTP ${status}`);
    if (json === undefined) throw new Error(`POST ${path} não devolveu JSON (sessão inválida?)`);
    this.#gravarSessao();
    return json as T;
  }
}

function enviar(path: string, body: URLSearchParams, cookie: string): Promise<{ status: number; texto: string }> {
  return enfileirar(async () => {
    const res = await fetchComBackoff(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { ...COMMON_HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie },
      body,
    });
    return { status: res.status, texto: await res.text() };
  });
}

function tentarJSON(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: `coletor/location-online.ts` e `coletor/historico.ts`**

`coletor/location-online.ts`:

```ts
// Tela "Localização" (mapa em tempo real) do GAUSS - mesmas chamadas que o navegador faz em
// #hard-vehicle/vehicles/location-online/ (descobertas lendo o script inline da página e o filterpage.js).
import type { PosicaoGauss } from "../src/lib/dominio/leitura";
import type { CercaGauss } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";

const LOCATION_PATH = "/data/hard-vehicle/vehicles/location-online/";

export interface VeiculoCadastro {
  id: number;
  label: string;
}

/** Lista de veículos que o usuário enxerga no filtro da tela (id + rótulo). */
export async function listarVeiculos(client: GaussFleetClient): Promise<VeiculoCadastro[]> {
  const data = await client.post<{ html?: string }>("/filter/dynamic", [["action", "vehicle"], ["page_id", "location-online"]]);
  const html = data.html ?? "";
  return [...html.matchAll(/name='vehicle\[\]' value='(\d+)'[\s\S]*?<label[^>]*>([^<]*)<\/label>/g)].map(([, id, label]) => ({ id: Number(id), label: label.trim() }));
}

/** Última posição de cada veículo (UMA requisição para a frota inteira). */
export async function buscarPosicoes(client: GaussFleetClient, ids: number[]): Promise<PosicaoGauss[]> {
  const campos: Campo[] = ids.map((id): Campo => ["vehicle[]", id]);
  campos.push(
    // 0 esconde os reservas "[S/ VAGA]" (vinham só 24 de 63 veículos)
    ["display_backup_equipment", 1],
    ["calculate_stoppage", 0],
    ["only_alerts", 0],
    ["alert_map", 0],
  );
  const data = await client.post<{ error?: boolean; msg?: Record<string, PosicaoGauss> | string }>(LOCATION_PATH, campos);
  if (data.error) throw new Error(`location-online respondeu error: ${String(data.msg)}`);
  return Object.values((data.msg ?? {}) as Record<string, PosicaoGauss>);
}

interface PontoCerca {
  name?: string;
  layer?: string | number;
  color?: string;
  lat: string | number;
  lng: string | number;
}

/** Polígonos das cercas (geofences): o mapa desenha as áreas coloridas com isso. */
export async function buscarCercas(client: GaussFleetClient, ids: number[]): Promise<CercaGauss[]> {
  const init = await client.post<{ error?: boolean; msg: { code: number | string }[] }>(LOCATION_PATH, [
    ["action", "init_geofences"],
    ["virtual_geofence", 1],
    ["plot_geofences", 1],
    ...ids.map((id): Campo => ["vehicles[]", id]),
  ]);
  if (init.error) throw new Error("init_geofences respondeu error=true");

  const pontos = await client.post<{ error?: boolean; msg: Record<string, PontoCerca[]> }>(LOCATION_PATH, [
    ["action", "get_geofence_points"],
    ...init.msg.map((g): Campo => ["geofence_code[]", g.code]),
  ]);
  if (pontos.error) throw new Error("get_geofence_points respondeu error=true");

  return Object.entries(pontos.msg).map(([code, pts]) => ({
    code: Number(code),
    name: pts[0]?.name?.trim() ?? "",
    layer: Number(pts[0]?.layer),
    color: pts[0]?.color ?? "#3388ff",
    polygon: pts.map((p): [number, number] => [Number(p.lat), Number(p.lng)]),
  }));
}
```

`coletor/historico.ts`:

```ts
// Rota de um veículo num dia (um ponto a cada ~30 s com velocidade e RPM). O cache fica no Supabase
// (loc_historico) e é o run.ts quem lê/grava; o apontamento sai de src/lib/dominio/apontamento.ts.
import { paraData } from "../src/lib/dominio/apontamento";
import { diaLocal } from "../src/lib/dominio/formato";
import type { PontoRota } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";

export const HOJE_TTL_MS = 5 * 60 * 1000;
const MAX_PAGINAS = 6;
// o rastreador pode descarregar dados atrasados - só considera o dia "fechado" depois disso
const FECHAR_DIA_APOS_MS = 2 * 60 * 60 * 1000;

interface RespostaRota {
  error?: boolean;
  no_data?: boolean;
  board_data?: { datetime: string; location?: { lat: string | number; lng: string | number }; speed_?: string | number; rpm?: string | number }[];
  filter?: Record<string, string>;
}

/** Busca no GAUSS os pontos do veículo no dia a partir de horaInicio (HH:MM). */
export async function baixarRota(client: GaussFleetClient, id: string, dia: string, horaInicio: string): Promise<PontoRota[]> {
  const hoje = dia === diaLocal();
  const fimJanela = hoje ? new Date(Date.now() - 2 * 60000) : paraData(`${dia} 23:58:00`);
  let filtro: Campo[] = [
    ["action", "latlong"], ["vehicle", id],
    ["start_day", dia], ["start_hour", horaInicio],
    ["end_day", dia], ["end_hour", "23:59"],
  ];
  const pontos: PontoRota[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const r = await client.post<RespostaRota>("/data/vehicle/routes/", filtro);
    if (r.error || r.no_data || !r.board_data?.length) break;
    for (const p of r.board_data) {
      pontos.push({ t: p.datetime, lat: Number(p.location?.lat), lng: Number(p.location?.lng), vel: Number(p.speed_) || 0, rpm: Number(p.rpm) || 0 });
    }
    // o GAUSS pagina devolvendo o filtro da próxima página (como o maps.js faz); se o último ponto já cobre a
    // janela, não gasta uma requisição à toa
    const control = r.filter?.control;
    if (!control || paraData(control) >= fimJanela) break;
    filtro = Object.entries(r.filter ?? {});
  }
  return pontos;
}

/** Junta pontos já guardados com os novos (sem duplicar) e ordena por horário. */
export function mesclarPontos(anteriores: PontoRota[], novos: PontoRota[]): PontoRota[] {
  const porHora = new Map(anteriores.map((p) => [p.t, p]));
  for (const p of novos) porHora.set(p.t, p);
  return [...porHora.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export const diaFechado = (dia: string, agora = Date.now()) => agora - paraData(`${dia} 23:59:59`).getTime() > FECHAR_DIA_APOS_MS;
```

- [ ] **Step 5: `coletor/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;
/** Chave secreta (ignora RLS): só existe no segredo do Actions, nunca na página. */
export const db = (): SupabaseClient => (cliente ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }));

export async function ok<T>(promessa: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}

export async function kvGet<T>(chave: string): Promise<T | null> {
  const r = (await ok(db().from("loc_kv").select("valor, atualizado_em").eq("chave", chave).maybeSingle())) as { valor?: unknown } | null;
  return (r?.valor as T | undefined) ?? null;
}
export const kvSet = (chave: string, valor: unknown) => ok(db().from("loc_kv").upsert({ chave, valor, atualizado_em: new Date().toISOString() }));
```

- [ ] **Step 6: `coletor/run.ts` (porte de `run.js`)**

```ts
// Uma execução do coletor (GitHub Actions, disparada pelo Supabase a cada 5 min e a cada pedido de histórico):
//   1. posição da frota no GAUSS (UMA requisição para todos os veículos)
//   2. estado + eventos -> Supabase; retrato (snapshot) para a página
//   3. atende os pedidos de histórico que a página deixou em loc_pedidos
//
// Cuidado com a carga no GAUSS (ver gauss.ts): uma requisição por vez com intervalo, sessão reaproveitada
// entre execuções (guardada no Supabase, chave privada), cadastro e cercas em cache, histórico só quando
// alguém pede, dia encerrado baixado uma única vez, no máximo MAX_PEDIDOS por execução.
//
// Variáveis: GAUSSFLEET_USERNAME, GAUSSFLEET_PASSWORD, SUPABASE_URL, SUPABASE_SECRET_KEY e
// TZ=America/Sao_Paulo (o GAUSS fala em horário local).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { montarApontamento } from "../src/lib/dominio/apontamento";
import { tipoCerca } from "../src/lib/dominio/cercas";
import { diaLocal } from "../src/lib/dominio/formato";
import { parearMotores } from "../src/lib/dominio/frota";
import { montarSnapshot, processarLeitura } from "../src/lib/dominio/leitura";
import type { Cerca, EstadoVeiculo, FonteHistorico, PontoRota } from "../src/lib/tipos";
import { verificarAmbiente } from "./config";
import { GaussFleetClient, SESSAO_FILE, estatisticas } from "./gauss";
import { HOJE_TTL_MS, baixarRota, diaFechado, mesclarPontos } from "./historico";
import { buscarCercas, buscarPosicoes, listarVeiculos, type VeiculoCadastro } from "./location-online";
import { db, kvGet, kvSet, ok } from "./supabase";

const VEICULOS_TTL_MS = 24 * 60 * 60 * 1000;
const CERCAS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PEDIDOS = 4;
const INTERVALO_S = 300; // o ritmo do disparo; a página usa para dizer se o dado está atrasado

type Estado = Record<string, EstadoVeiculo>;
interface Pedido {
  id: number;
  veiculo_id: string;
  dia: string;
}
interface PontosDia {
  pontos: PontoRota[];
  fechado: boolean;
  baixado_em: string;
  fonte: FonteHistorico;
}

verificarAmbiente();

// sessão do GAUSS da execução anterior (o gauss.ts só reaproveita se usada há < 20 min)
const sessao = await kvGet<unknown>("sessao");
if (sessao) writeFileSync(SESSAO_FILE, JSON.stringify(sessao), "utf-8");
const client = new GaussFleetClient();

async function carregarVeiculos(): Promise<VeiculoCadastro[]> {
  const cache = await kvGet<{ baixado_em: string; veiculos: VeiculoCadastro[] }>("veiculos");
  if (cache && Date.now() - new Date(cache.baixado_em).getTime() < VEICULOS_TTL_MS) return cache.veiculos;
  const veiculos = await listarVeiculos(client);
  if (!veiculos.length) throw new Error("lista de veículos do GAUSS veio vazia");
  await kvSet("veiculos", { baixado_em: new Date().toISOString(), veiculos });
  return veiculos;
}

async function carregarCercas(veiculos: VeiculoCadastro[]): Promise<Cerca[]> {
  const cache = await kvGet<{ baixado_em: string; cercas: Cerca[] }>("cercas");
  if (cache && Date.now() - new Date(cache.baixado_em).getTime() < CERCAS_TTL_MS) return cache.cercas;
  const cercas = (await buscarCercas(client, veiculos.map((v) => v.id))).map((c) => ({ ...c, tipo: tipoCerca(c) }));
  await kvSet("cercas", { baixado_em: new Date().toISOString(), cercas });
  return cercas;
}

/** Pontos da rota no dia: do cache (loc_historico) quando dá, senão só a parte nova do GAUSS. */
async function obterPontos(id: string, dia: string): Promise<PontosDia> {
  const reg = (await ok(db().from("loc_historico").select("pontos, fechado, baixado_em").eq("veiculo_id", id).eq("dia", dia).maybeSingle())) as Omit<PontosDia, "fonte"> | null;
  if (reg?.fechado) return { ...reg, fonte: "cache" };
  if (reg && Date.now() - new Date(reg.baixado_em).getTime() < HOJE_TTL_MS) return { ...reg, fonte: "cache" };
  const anteriores = reg?.pontos ?? [];
  const horaInicio = anteriores.length ? anteriores.at(-1)!.t.slice(11, 16) : "00:00";
  const novos = await baixarRota(client, id, dia, horaInicio);
  return { pontos: mesclarPontos(anteriores, novos), fechado: diaFechado(dia), baixado_em: new Date().toISOString(), fonte: anteriores.length ? "incremental" : "gauss" };
}

async function atenderPedido(ped: Pedido, estado: Estado, cercas: Cerca[]) {
  const { veiculo_id: id, dia } = ped;
  // caminhão com motor secundário (placa + "2"): busca também o rastreador dele
  const secId = parearMotores(Object.values(estado)).secundarioDe.get(id);
  const pri = await obterPontos(id, dia);
  let sec: PontosDia | null = null;
  let motor2Erro: string | null = null;
  if (secId) {
    try {
      sec = await obterPontos(secId, dia);
    } catch (err) {
      motor2Erro = err instanceof Error ? err.message : String(err);
    }
  }
  const apont = montarApontamento(pri.pontos, cercas, sec?.pontos ?? null);
  if (apont.motor2 && secId) Object.assign(apont.motor2, { id: secId, placa: estado[secId]?.placa });
  const resultado = { id, dia, fonte: pri.fonte, baixado_em: pri.baixado_em, motor2_erro: motor2Erro, ...apont };
  await ok(db().from("loc_historico").upsert({ veiculo_id: id, dia, pontos: pri.pontos, fechado: pri.fechado, baixado_em: pri.baixado_em, resultado }));
  if (sec && secId) {
    // sem "resultado" no objeto: o upsert não apaga um apontamento que o secundário já tenha
    await ok(db().from("loc_historico").upsert({ veiculo_id: secId, dia, pontos: sec.pontos, fechado: sec.fechado, baixado_em: sec.baixado_em }));
  }
}

async function atenderPedidos(estado: Estado, cercas: Cerca[], veiculos: VeiculoCadastro[]): Promise<number> {
  // pedido que ficou "processando" porque uma execução morreu no meio volta para a fila
  await ok(db().from("loc_pedidos").update({ status: "pendente" }).eq("status", "processando").lt("criado_em", new Date(Date.now() - 15 * 60000).toISOString()));
  const fila = ((await ok(db().from("loc_pedidos").select("id, veiculo_id, dia").eq("status", "pendente").order("criado_em").limit(MAX_PEDIDOS))) ?? []) as Pedido[];
  const conhecidos = new Set(veiculos.map((v) => String(v.id)));
  for (const ped of fila) {
    await ok(db().from("loc_pedidos").update({ status: "processando" }).eq("id", ped.id));
    try {
      // a página é pública: só consulta no GAUSS veículo que está no cadastro
      if (!conhecidos.has(ped.veiculo_id)) throw new Error("veículo fora do cadastro");
      await atenderPedido(ped, estado, cercas);
      await ok(db().from("loc_pedidos").update({ status: "pronto", atendido_em: new Date().toISOString() }).eq("id", ped.id));
      console.log(`  histórico ${ped.veiculo_id} ${ped.dia}: pronto`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ok(db().from("loc_pedidos").update({ status: "erro", erro: msg.slice(0, 300), atendido_em: new Date().toISOString() }).eq("id", ped.id));
      console.error(`  histórico ${ped.veiculo_id} ${ped.dia}: ${msg}`);
    }
  }
  return fila.length;
}

async function limpezaDiaria(hoje: string) {
  const ultima = await kvGet<{ dia: string }>("limpeza");
  if (ultima?.dia === hoje) return;
  const antes = (dias: number) => diaLocal(new Date(Date.now() - dias * 86400000));
  await ok(db().from("loc_eventos").delete().lt("dia", antes(365)));
  await ok(db().from("loc_historico").delete().lt("dia", antes(120)));
  await ok(db().from("loc_pedidos").delete().lt("criado_em", new Date(Date.now() - 30 * 86400000).toISOString()));
  await kvSet("limpeza", { dia: hoje });
}

async function registrarCarga(hoje: string) {
  const anterior = await kvGet<{ dia: string; requisicoes: number; logins: number; erros: number }>("carga");
  const base = anterior?.dia === hoje ? anterior : { dia: hoje, requisicoes: 0, logins: 0, erros: 0 };
  const carga = { dia: hoje, requisicoes: base.requisicoes + estatisticas.requisicoes, logins: base.logins + estatisticas.logins, erros: base.erros + estatisticas.erros };
  await kvSet("carga", carga);
  return carga;
}

async function main() {
  const agora = new Date();
  const hoje = diaLocal(agora);
  let erro: { em: string; msg: string } | null = null;
  let estado: Estado = (await kvGet<Estado>("estado")) ?? {};

  try {
    const veiculos = await carregarVeiculos();
    const cercas = await carregarCercas(veiculos);
    const posicoes = await buscarPosicoes(client, veiculos.map((v) => v.id));
    const r = processarLeitura(estado, posicoes, cercas, agora);
    estado = r.estado;
    await kvSet("estado", estado);
    if (r.eventos.length) {
      await ok(db().from("loc_eventos").insert(r.eventos.map((e) => ({ dia: diaLocal(new Date(e.t)), t: e.t, tipo: e.tipo, veiculo_id: e.id, dados: e }))));
    }
    console.log(`✅ ${posicoes.length} veículos, ${r.eventos.length} eventos`);
    const atendidos = await atenderPedidos(estado, cercas, veiculos);
    if (atendidos) console.log(`✅ ${atendidos} pedido(s) de histórico`);
    await limpezaDiaria(hoje);
  } catch (err) {
    erro = { em: new Date().toISOString(), msg: err instanceof Error ? err.message : String(err) };
    console.error("❌", erro.msg);
    process.exitCode = 1;
  } finally {
    const carga = await registrarCarga(hoje);
    const anterior = (await kvGet<{ lido_em?: string | null }>("snapshot")) ?? {};
    // em caso de erro, a página continua mostrando a última leitura boa, com o aviso
    await kvSet(
      "snapshot",
      montarSnapshot(estado, {
        lido_em: erro ? (anterior.lido_em ?? null) : agora.toISOString(),
        erro,
        intervalo_s: INTERVALO_S,
        gauss: { desde: new Date(`${hoje}T00:00:00`).toISOString(), ...carga, pausadoAte: estatisticas.pausadoAte },
      }),
    );
    if (existsSync(SESSAO_FILE)) await kvSet("sessao", JSON.parse(readFileSync(SESSAO_FILE, "utf-8")));
    console.log(`GAUSS nesta execução: ${estatisticas.requisicoes} requisição(ões), ${estatisticas.logins} login(s)`);
  }
}

await main();
```

- [ ] **Step 7: Apagar o JS, instalar e conferir sem tocar no GAUSS**

```bash
git rm coletor/config.js coletor/frota.js coletor/gauss.js coletor/historico.js coletor/location-online.js coletor/processamento.js coletor/run.js coletor/scripts/gravar-amostras.mjs
(cd coletor && rm -f package-lock.json && npm install)
npm run typecheck && npm test
(cd coletor && npx tsx run.ts; echo "saída: $?")
```

Esperado: typecheck e testes PASS (inclusive `coletor/historico.test.ts` e a paridade). O último comando **não** consulta nada: sem variáveis, termina com `Error: variável GAUSSFLEET_USERNAME não configurada (segredos do repositório)` e `saída: 1` — prova que o `tsx` carrega `run.ts` e os módulos de `src/lib/dominio` em ESM. Se aparecer erro de import/sintaxe em vez dessa mensagem, corrija antes de seguir. **Nunca** rode com as variáveis do `automation/.env`.

Em `eslint.config.mjs`, tire `"coletor/*.js"` e `"coletor/scripts/**"` do `globalIgnores` e rode `npm run lint`.

- [ ] **Step 8: Workflow do coletor**

Substitua `.github/workflows/coletor.yml` por:

```yaml
name: Coletor de localização (GAUSS -> Supabase)

# Quem dispara a cada 5 min é o Supabase (pg_cron + pg_net, supabase/disparo.sql), e também na hora de cada
# pedido de histórico. O "schedule" do GitHub foi retirado: atrasa/pula execuções - e junto com o Supabase
# rodaria em dobro.
on:
  workflow_dispatch: # chamado pelo Supabase; também é o botão "Run workflow"
  # roda também quando o código do coletor (ou as regras que ele usa) muda: valida a mudança na hora
  push:
    branches: [main]
    paths: ['coletor/**', 'src/lib/dominio/**', 'src/lib/tipos.ts', '.github/workflows/coletor.yml']

# nunca duas execuções ao mesmo tempo (evita requisições em dobro ao GAUSS)
concurrency:
  group: coletor-localizacao
  cancel-in-progress: false

permissions:
  contents: read

jobs:
  coletar:
    # só a main consulta o GAUSS: "Run workflow" numa branch de trabalho não roda
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 8
    defaults:
      run:
        working-directory: coletor
    env:
      TZ: America/Sao_Paulo
      GAUSSFLEET_USERNAME: ${{ secrets.GAUSSFLEET_USERNAME }}
      GAUSSFLEET_PASSWORD: ${{ secrets.GAUSSFLEET_PASSWORD }}
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SECRET_KEY: ${{ secrets.SUPABASE_SECRET_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: coletor/package-lock.json
      # só supabase-js e tsx (instalação leve a cada 5 min); o tsx roda o TypeScript sem compilar
      - run: npm ci --omit=dev --no-audit --no-fund
      - run: npx tsx run.ts
```

- [ ] **Step 9: Commit**

```bash
git add -A coletor .github/workflows/coletor.yml eslint.config.mjs
git commit -m "Coletor em TypeScript (tsx), usando as regras e os tipos de src/lib; só roda a partir da main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Camada de dados do site (substitui o `api-supabase.js`)

**Files:**
- Create: `src/lib/supabase/cliente.ts`, `src/lib/dados/leituras.ts`, `src/lib/dados/historico.ts`, `src/lib/dados/use-retrato.ts`, `src/lib/dados/use-eventos.ts`, `src/lib/hooks.ts`
- Test: `src/lib/dados/historico.test.ts`

**Interfaces:**
- Consumes: `validarRetrato`, `validarCercas`, `validarEvento`, `validarHistorico` (T2); `diaLocal` (T3).
- Produces:
  - `db(): SupabaseClient`, `ok<T>(p): Promise<T>` (`src/lib/supabase/cliente.ts`)
  - `lerRetrato(c?)`, `lerCercas(c?)` (cache por aba; não guarda lista vazia), `lerEventos(dia, id?, c?)`, `lerDias(c?)` (sempre inclui hoje)
  - `pedirHistorico(id, dia, op?: { aoAndar?: (e: EtapaPedido) => void; sinal?: AbortSignal; agora?: () => number; esperar?: (ms) => Promise<void> }, c?): Promise<Historico>`; `type EtapaPedido = "fila" | "processando"`
  - `useRetrato(): { retrato: Retrato | null; conectado: boolean; erro: string | null }` (uma assinatura Realtime compartilhada)
  - `useEventos(dia): { eventos: Evento[]; carregando: boolean; erro: string | null }`
  - `useAgora(): number` (muda a cada 30 s), `useCelular(): boolean` (largura < 768 px)

- [ ] **Step 1: Cliente do Supabase**

`src/lib/supabase/cliente.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente do navegador com a chave PÚBLICA (publishable). O RLS (supabase/schema.sql) só deixa ler o retrato,
 * as cercas, os eventos e os apontamentos, e criar pedido de histórico. Não há login.
 */
export function db(): SupabaseClient {
  cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export async function ok<T>(promessa: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}
```

- [ ] **Step 2: Testes do histórico**

`src/lib/dados/historico.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { pedirHistorico } from "./historico";

const AGORA = new Date("2026-10-01T15:00:00Z").getTime();
const resultado = { id: "10", dia: "2026-10-01", fonte: "gauss", baixado_em: "x", motor2_erro: null, temRpm: false, trechos: [], resumo: null, pontos: [], motor2: null };
const linha = (minutosAtras: number, fechado = false) => ({ resultado, fechado, baixado_em: new Date(AGORA - minutosAtras * 60000).toISOString() });

// banco falso: cada leitura de loc_historico / loc_pedidos devolve o próximo item da fila
function falso(r: { historico: (ReturnType<typeof linha> | null)[]; pedidos?: ({ status: string; erro?: string } | null)[]; erroInsert?: { code: string; message: string } }) {
  const historico = [...r.historico];
  const pedidos = [...(r.pedidos ?? [])];
  const inserts: unknown[] = [];
  const cliente = {
    from(tabela: string) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: (tabela === "loc_historico" ? historico.shift() : pedidos.shift()) ?? null, error: null }),
        insert: async (l: unknown) => {
          inserts.push(l);
          return { error: r.erroInsert ?? null };
        },
      };
      return q;
    },
  };
  return { c: cliente as unknown as SupabaseClient, inserts };
}
const op = (extra = {}) => ({ agora: () => AGORA, esperar: async () => {}, ...extra });

describe("pedirHistorico", () => {
  it("dia fechado vem do banco, sem pedido", async () => {
    const f = falso({ historico: [linha(600, true)] });
    expect((await pedirHistorico("10", "2026-10-01", op(), f.c)).fonte).toBe("cache");
    expect(f.inserts).toEqual([]);
  });
  it("hoje baixado há menos de 10 min vem do banco, sem pedido", async () => {
    const f = falso({ historico: [linha(5)] });
    await pedirHistorico("10", "2026-10-01", op(), f.c);
    expect(f.inserts).toEqual([]);
  });
  it("versão antiga de hoje: mostra já e pede atualização", async () => {
    const f = falso({ historico: [linha(20)] });
    const h = await pedirHistorico("10", "2026-10-01", op(), f.c);
    expect(h.aviso).toBe("atualização pedida ao coletor");
    expect(f.inserts).toEqual([{ veiculo_id: "10", dia: "2026-10-01" }]);
  });
  it("sem nada no banco: pede e espera o coletor, avisando o andamento", async () => {
    const aoAndar = vi.fn();
    const f = falso({ historico: [null, linha(0)], pedidos: [{ status: "pendente" }, { status: "processando" }, { status: "pronto" }] });
    const h = await pedirHistorico("10", "2026-10-01", op({ aoAndar }), f.c);
    expect(h.fonte).toBe("gauss");
    expect(aoAndar.mock.calls.map((c) => c[0])).toEqual(["fila", "fila", "processando"]);
  });
  it("pedido com erro mostra a mensagem do coletor", async () => {
    const f = falso({ historico: [null], pedidos: [{ status: "erro", erro: "veículo fora do cadastro" }] });
    await expect(pedirHistorico("10", "2026-10-01", op(), f.c)).rejects.toThrow("veículo fora do cadastro");
  });
  it("pedido já em aberto (23505) não é erro", async () => {
    const f = falso({ historico: [null, linha(0)], pedidos: [{ status: "pronto" }], erroInsert: { code: "23505", message: "duplicado" } });
    expect((await pedirHistorico("10", "2026-10-01", op(), f.c)).id).toBe("10");
  });
  it("recusa id ou dia inválidos", async () => {
    await expect(pedirHistorico("abc", "2026-10-01", op(), falso({ historico: [] }).c)).rejects.toThrow("parâmetros inválidos");
  });
  it("cancelar para de esperar", async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(pedirHistorico("10", "2026-10-01", op({ sinal: ctl.signal }), falso({ historico: [null] }).c)).rejects.toThrow("cancelado");
  });
});
```

Run: `npx vitest run src/lib/dados/historico.test.ts` → FAIL (módulo inexistente).

- [ ] **Step 3: `src/lib/dados/historico.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Historico, StatusPedido } from "../tipos";
import { db, ok } from "../supabase/cliente";
import { validarHistorico } from "./esquemas";

// o coletor roda a cada ~5 min: histórico de hoje mais velho que isso pede atualização (dia encerrado é definitivo)
export const HISTORICO_FRESCO_MS = 10 * 60 * 1000;
export const ESPERA_MAX_MS = 25 * 60 * 1000;
const CONSULTA_MS = 6000;

export type EtapaPedido = "fila" | "processando";
export interface OpcoesHistorico {
  /** chamado enquanto o coletor não atende (para a tela mostrar o andamento) */
  aoAndar?: (etapa: EtapaPedido) => void;
  sinal?: AbortSignal;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
}
interface LinhaHistorico {
  resultado: unknown;
  baixado_em: string;
  fechado: boolean;
}

const ler = async (c: SupabaseClient, id: string, dia: string) =>
  (await ok(c.from("loc_historico").select("resultado, baixado_em, fechado").eq("veiculo_id", id).eq("dia", dia).maybeSingle())) as LinhaHistorico | null;

/**
 * Histórico (rota + apontamento) de um veículo num dia. Se já está no banco e é definitivo/recente, devolve na
 * hora. Senão deixa um pedido para o coletor (GitHub Actions) e espera ele ficar pronto.
 */
export async function pedirHistorico(id: string, dia: string, op: OpcoesHistorico = {}, c: SupabaseClient = db()): Promise<Historico> {
  if (!/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("parâmetros inválidos");
  const agora = op.agora ?? Date.now;
  const esperar = op.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const atual = await ler(c, id, dia);
  const fresco = atual?.resultado && (atual.fechado || agora() - new Date(atual.baixado_em).getTime() < HISTORICO_FRESCO_MS);
  if (atual && fresco) return { ...validarHistorico(atual.resultado), fonte: "cache" };

  const { error } = await c.from("loc_pedidos").insert({ veiculo_id: id, dia });
  // 23505 = já existe pedido em aberto para esse veículo/dia: é só esperar ele
  if (error && error.code !== "23505") throw new Error(error.message);
  // tem versão antiga de hoje: mostra já, a nova chega no próximo ciclo
  if (atual?.resultado) return { ...validarHistorico(atual.resultado), fonte: "cache", aviso: "atualização pedida ao coletor" };

  op.aoAndar?.("fila");
  const limite = agora() + ESPERA_MAX_MS;
  while (agora() < limite) {
    await esperar(CONSULTA_MS);
    if (op.sinal?.aborted) throw new DOMException("cancelado", "AbortError");
    const ped = (await ok(
      c.from("loc_pedidos").select("status, erro").eq("veiculo_id", id).eq("dia", dia).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    )) as { status: StatusPedido; erro: string | null } | null;
    if (ped?.status === "pendente" || ped?.status === "processando") op.aoAndar?.(ped.status === "processando" ? "processando" : "fila");
    if (ped?.status === "erro") throw new Error(ped.erro || "o coletor não conseguiu buscar o histórico");
    if (ped?.status === "pronto") {
      const novo = await ler(c, id, dia);
      if (novo?.resultado) return validarHistorico(novo.resultado); // fonte (gauss/incremental/cache) vem do coletor
    }
  }
  throw new Error("o coletor ainda não atendeu o pedido - confira se o workflow está rodando no GitHub Actions");
}
```

Run: `npx vitest run src/lib/dados/historico.test.ts` → PASS.

- [ ] **Step 4: Leituras**

`src/lib/dados/leituras.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { diaLocal } from "../dominio/formato";
import type { Cerca, Evento, Retrato } from "../tipos";
import { db, ok } from "../supabase/cliente";
import { validarCercas, validarEvento, validarRetrato } from "./esquemas";

/** Retrato da frota (loc_kv.snapshot). Antes da 1ª leitura do coletor: retrato vazio. */
export async function lerRetrato(c: SupabaseClient = db()): Promise<Retrato> {
  const r = (await ok(c.from("loc_kv").select("valor").eq("chave", "snapshot").maybeSingle())) as { valor: unknown } | null;
  return validarRetrato(r?.valor);
}

let cercasCache: Promise<Cerca[]> | null = null;
/** Cercas mudam raramente (o coletor guarda por 7 dias): uma leitura por aba. Lista vazia não fica guardada. */
export function lerCercas(c: SupabaseClient = db()): Promise<Cerca[]> {
  cercasCache ??= ok(c.from("loc_kv").select("valor").eq("chave", "cercas").maybeSingle())
    .then((r) => validarCercas((r as { valor?: { cercas?: unknown } } | null)?.valor?.cercas))
    .then((cercas) => {
      if (!cercas.length) cercasCache = null;
      return cercas;
    })
    .catch((e: unknown) => {
      cercasCache = null;
      throw e;
    });
  return cercasCache;
}

/** Eventos de um dia (opcionalmente de um veículo), do mais antigo para o mais novo. */
export async function lerEventos(dia: string, id?: string, c: SupabaseClient = db()): Promise<Evento[]> {
  let q = c.from("loc_eventos").select("dados").eq("dia", dia);
  if (id) q = q.eq("veiculo_id", id);
  const linhas = (await ok(q.order("t").limit(5000))) as { dados: unknown }[];
  return linhas.map((l) => validarEvento(l.dados));
}

/** Dias com eventos (seletor de dia), do mais novo; hoje sempre aparece. */
export async function lerDias(c: SupabaseClient = db()): Promise<string[]> {
  const dias = ((await ok(c.from("loc_dias").select("dia").order("dia", { ascending: false }).limit(120))) as { dia: string }[]).map((r) => r.dia);
  const hoje = diaLocal();
  return dias.includes(hoje) ? dias : [hoje, ...dias];
}
```

- [ ] **Step 5: Hooks ao vivo**

`src/lib/dados/use-retrato.ts`:

```ts
"use client";

import { useSyncExternalStore } from "react";
import type { Retrato } from "../tipos";
import { db } from "../supabase/cliente";
import { lerRetrato } from "./leituras";

export interface EstadoRetrato {
  retrato: Retrato | null;
  conectado: boolean;
  erro: string | null;
}

// rede de segurança caso o Realtime perca alguma atualização
const RELEITURA_MS = 2 * 60 * 1000;
const INICIAL: EstadoRetrato = { retrato: null, conectado: true, erro: null };

let estado = INICIAL;
const ouvintes = new Set<() => void>();
let parar: (() => void) | null = null;
const mudar = (novo: Partial<EstadoRetrato>) => {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
};

async function reler() {
  try {
    mudar({ retrato: await lerRetrato(), erro: null });
  } catch (e) {
    mudar({ erro: e instanceof Error ? e.message : String(e) });
  }
}

function iniciar(): () => void {
  void reler();
  // relê o retrato inteiro quando o coletor grava (não confia no payload, que pode ser grande)
  const canal = db()
    .channel(`retrato-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "loc_kv", filter: "chave=eq.snapshot" }, () => void reler())
    .subscribe((s) => {
      if (s === "SUBSCRIBED") mudar({ conectado: true });
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") mudar({ conectado: false });
    });
  const timer = setInterval(() => void reler(), RELEITURA_MS);
  return () => {
    clearInterval(timer);
    void db().removeChannel(canal);
  };
}

function assinar(f: () => void) {
  ouvintes.add(f);
  parar ??= iniciar();
  return () => {
    ouvintes.delete(f);
    if (!ouvintes.size) {
      parar?.();
      parar = null;
    }
  };
}

/** Retrato da frota ao vivo. Uma assinatura só (Realtime + releitura a cada 2 min), compartilhada pela barra e pelas telas. */
export function useRetrato(): EstadoRetrato {
  return useSyncExternalStore(assinar, () => estado, () => INICIAL);
}
```

`src/lib/dados/use-eventos.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { diaLocal } from "../dominio/formato";
import type { Evento } from "../tipos";
import { db } from "../supabase/cliente";
import { validarEvento } from "./esquemas";
import { lerEventos } from "./leituras";

interface Carga {
  dia: string;
  eventos: Evento[];
  erro: string | null;
}

/** Eventos do dia; no dia de hoje, os novos chegam ao vivo (Realtime). */
export function useEventos(dia: string): { eventos: Evento[]; carregando: boolean; erro: string | null } {
  const [carga, setCarga] = useState<Carga | null>(null);
  useEffect(() => {
    let vivo = true;
    lerEventos(dia).then(
      (eventos) => {
        if (vivo) setCarga({ dia, eventos, erro: null });
      },
      (e: unknown) => {
        if (vivo) setCarga({ dia, eventos: [], erro: e instanceof Error ? e.message : String(e) });
      },
    );
    if (dia !== diaLocal()) return () => void (vivo = false);
    const canal = db()
      .channel(`eventos-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loc_eventos" }, (p) => {
        const linha = p.new as { dia?: string; dados?: unknown };
        if (linha.dia !== dia || !linha.dados) return;
        try {
          const ev = validarEvento(linha.dados);
          setCarga((c) => (c && c.dia === dia ? { ...c, eventos: [...c.eventos, ev] } : c));
        } catch {
          // formato inesperado: ignora só este evento ao vivo (a leitura completa avisa)
        }
      })
      .subscribe();
    return () => {
      vivo = false;
      void db().removeChannel(canal);
    };
  }, [dia]);
  const atual = carga?.dia === dia ? carga : null;
  return { eventos: atual?.eventos ?? [], carregando: !atual, erro: atual?.erro ?? null };
}
```

`src/lib/hooks.ts`:

```ts
"use client";

import { useSyncExternalStore } from "react";

// relógio compartilhado: idades ("há 2 min") envelhecem mesmo sem leitura nova
let agora = 0;
const ouvintesRelogio = new Set<() => void>();
let relogio: ReturnType<typeof setInterval> | null = null;
function assinarRelogio(f: () => void) {
  ouvintesRelogio.add(f);
  agora = Date.now();
  relogio ??= setInterval(() => {
    agora = Date.now();
    ouvintesRelogio.forEach((g) => g());
  }, 30_000);
  return () => {
    ouvintesRelogio.delete(f);
    if (!ouvintesRelogio.size && relogio) {
      clearInterval(relogio);
      relogio = null;
    }
  };
}
/** Hora atual em ms, atualizada a cada 30 s (0 na geração estática). */
export const useAgora = () => useSyncExternalStore(assinarRelogio, () => agora, () => 0);

const CELULAR = "(max-width: 767px)";
/** Tela de celular (abaixo do breakpoint md do Tailwind). */
export function useCelular(): boolean {
  return useSyncExternalStore(
    (f) => {
      const mq = window.matchMedia(CELULAR);
      mq.addEventListener("change", f);
      return () => mq.removeEventListener("change", f);
    },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}
```

- [ ] **Step 6: Conferir e commitar**

Run: `npm test && npm run typecheck && npm run lint` → tudo PASS.

```bash
git add src/lib/supabase src/lib/dados src/lib/hooks.ts
git commit -m "Camada de dados tipada: retrato ao vivo, eventos, cercas e pedido de histórico (substitui o api-supabase.js)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Componentes base no padrão do SST

**Files:**
- Create: `src/lib/cores.ts`, `src/lib/tema.ts`, `src/components/ui.tsx`, `src/components/icones.tsx`, `src/components/estado-tela.tsx`, `src/components/avisos.tsx`, `src/components/gaveta.tsx`

**Interfaces:**
- Consumes: `Tom` (T2).
- Produces:
  - `corDoTom(t: Tom): string` (CSS `var(...)`), `CLASSE_TOM: Record<Tom, string>`, `corResolvida(t: Tom): string` (cor real, para o Leaflet)
  - `useTema(): ["claro" | "escuro", () => void]` (chave `mon-tema`)
  - `ui.tsx`: `cx`, `Botao({ variante?: "primaria" | "secundaria" | "discreta"; tamanho?: "normal" | "mini" })`, `Entrada`, `Selecao`, `Aviso({ tipo })`, `Ponto({ tom })`, `Selo({ tom })`, `Contador({ n })`, `Chip({ ativo, onClick, tom? })`, `Segmentado<T>({ opcoes, valor, mudar, rotulo })`, `Vazio({ titulo })`, `Campos({ itens: [string, ReactNode][] })`, `SecaoTitulo({ acao? })`
  - `icones.tsx`: `type IconeNome`, `CAMINHOS`, `Icone({ nome, className? })`
  - `estado-tela.tsx`: `Carregando`, `ErroTela` (cópia do SST); `avisos.tsx`: `avisar(texto, opcoes?)`, `Avisos` (cópia); `gaveta.tsx`: `Gaveta` (cópia, chave `mon-gaveta:`)

- [ ] **Step 1: Cópias do SST**

```bash
SST="/c/Users/Meu Computador/Desktop/SST - Mecanizada/sistema"
mkdir -p src/components
cp "$SST/src/components/estado-tela.tsx" "$SST/src/components/avisos.tsx" src/components/
sed 's/sst-gaveta:/mon-gaveta:/g' "$SST/src/components/gaveta.tsx" > src/components/gaveta.tsx
sed 's/"sst-tema"/"mon-tema"/g' "$SST/src/lib/tema.ts" > src/lib/tema.ts
grep -n "mon-gaveta\|mon-tema" src/components/gaveta.tsx src/lib/tema.ts
```

Esperado: o `grep` mostra as chaves trocadas (2 linhas na gaveta, 1 no tema).

- [ ] **Step 2: `src/lib/cores.ts`**

```ts
import type { Tom } from "./tipos";

const VARIAVEL: Record<Tom, string> = {
  ok: "--ok-dot", warn: "--warn-dot", bad: "--bad-dot", na: "--na-dot", neu: "--neu-dot", reg: "--reg-dot", mov: "--serie-1", motor2: "--motor2",
};

/** Cor de destaque de um tom (ponto, borda, marcador no mapa), como variável CSS. */
export const corDoTom = (t: Tom) => `var(${VARIAVEL[t]})`;

/** Fundo + texto do selo de um tom (classes de globals.css). */
export const CLASSE_TOM: Record<Tom, string> = {
  ok: "st-verde", warn: "st-amarelo", bad: "st-vermelho", na: "st-laranja", neu: "st-cinza", reg: "st-cinza-azulado", mov: "st-mov", motor2: "st-motor2",
};

/** O Leaflet desenha as linhas em SVG com cor fixa: lê o valor atual do token (tema claro ou escuro). */
export function corResolvida(t: Tom): string {
  return getComputedStyle(document.documentElement).getPropertyValue(VARIAVEL[t]).trim() || "#888888";
}
```

- [ ] **Step 3: `src/components/ui.tsx`**

```tsx
import { Fragment, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { CLASSE_TOM, corDoTom } from "@/lib/cores";
import type { Tom } from "@/lib/tipos";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Botao({
  variante = "primaria",
  tamanho = "normal",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primaria" | "secundaria" | "discreta"; tamanho?: "normal" | "mini" }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        tamanho === "mini" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variante === "primaria" && "bg-primaria text-primaria-texto shadow-sm hover:brightness-110",
        variante === "secundaria" && "border border-borda bg-superficie text-texto shadow-sm hover:bg-superficie-2",
        variante === "discreta" && "text-link hover:bg-superficie-2",
        className,
      )}
    />
  );
}

const campo = "h-9 min-w-0 rounded-lg border border-borda bg-superficie px-3 text-sm text-texto focus:border-primaria";
export const Entrada = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(campo, className)} />;
export const Selecao = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(campo, "pr-8", className)} />;

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "alerta" | "erro" | "ok"; children: ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cx("rounded-lg px-3.5 py-2.5 text-sm", tipo === "info" && "st-cinza-azulado", tipo === "alerta" && "st-amarelo", tipo === "erro" && "st-vermelho", tipo === "ok" && "st-verde")}
    >
      {children}
    </div>
  );
}

/** Ponto de cor de um tom (sempre acompanhado de rótulo: cor sozinha não informa). */
export function Ponto({ tom, className }: { tom: Tom; className?: string }) {
  return <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: corDoTom(tom) }} />;
}

export function Selo({ tom, children, className }: { tom: Tom; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold", CLASSE_TOM[tom], className)}>
      <Ponto tom={tom} />
      {children}
    </span>
  );
}

export function Contador({ n }: { n: number }) {
  return <span className="rounded-full bg-superficie-2 px-1.5 text-[11px] font-semibold tabular-nums text-suave ring-1 ring-borda">{n}</span>;
}

export function Chip({ ativo, onClick, children, tom }: { ativo: boolean; onClick: () => void; children: ReactNode; tom?: Tom }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition",
        ativo ? "border-primaria/40 bg-primaria-suave text-texto" : "border-borda bg-superficie text-suave hover:text-texto",
      )}
    >
      {tom && <Ponto tom={tom} />}
      {children}
    </button>
  );
}

/** Abas em trilho (Veículos · Áreas · Eventos). */
export function Segmentado<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: { id: T; rotulo: ReactNode }[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === valor}
          onClick={() => mudar(o.id)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition",
            o.id === valor ? "bg-superficie text-texto shadow-sm" : "text-suave hover:text-texto",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Estado vazio com explicação (textos que se explicam sozinhos). */
export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-suave">{children}</div>}
    </div>
  );
}

/** Lista "rótulo: valor" (detalhe do veículo, resumo do dia, detalhe do alerta). */
export function Campos({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {itens.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-suave">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function SecaoTitulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">{children}</p>
      {acao}
    </div>
  );
}
```

- [ ] **Step 4: `src/components/icones.tsx`**

```tsx
import { cx } from "./ui";

export type IconeNome = "mapa" | "timeline" | "alertas" | "busca" | "tema" | "fechar" | "voltar" | "play" | "pausa" | "anterior" | "proximo" | "opcoes" | "baixar" | "alvo";

export const CAMINHOS: Record<IconeNome, string> = {
  mapa: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  timeline: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5v7l6-3.5z",
  alertas: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  busca: "M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z",
  tema: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z",
  fechar: "M6 6l12 12M18 6L6 18",
  voltar: "M15 6l-6 6 6 6",
  play: "M7 5v14l11-7z",
  pausa: "M8 5v14M16 5v14",
  anterior: "M18 6v12l-8-6zM6 6v12",
  proximo: "M6 6v12l8-6zM18 6v12",
  opcoes: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  baixar: "M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3",
  alvo: "M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
};

export function Icone({ nome, className }: { nome: IconeNome; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("h-5 w-5 shrink-0", className)}>
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
```

- [ ] **Step 5: Conferir e commitar**

Run: `npm run typecheck && npm run lint && npm run build` → sem erros.

```bash
git add src/lib/cores.ts src/lib/tema.ts src/components
git commit -m "Componentes base no padrão do SST: botões, selos, abas, campos, gaveta, avisos, tema e ícones

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Casca do sistema: barra superior "Campo", leitura ao vivo e busca Ctrl K

**Files:**
- Create: `src/lib/dominio/conexao.ts`, `src/lib/busca.ts`, `src/lib/menu.ts`, `src/lib/navegacao.ts`, `src/components/indicador-vivo.tsx`, `src/components/paleta.tsx`, `src/components/barra-superior.tsx`, `src/components/casca.tsx`, `src/app/timeline/page.tsx` (provisória), `src/app/alertas/page.tsx` (provisória)
- Modify: `src/app/layout.tsx` (corpo com a casca)
- Test: `src/lib/dominio/conexao.test.ts`, `src/lib/busca.test.ts`, `src/lib/menu.test.ts`

**Interfaces:**
- Consumes: `useRetrato`, `useEventos`, `lerCercas` (T9); `useAgora` (T9); `semMotor2`, `categoria`, `CATEGORIAS` (T3); `textoEvento`, `textoPlano`, `veiculoDoEvento`, `chaveEvento` (T3); `hora`, `horaSeg`, `diaLocal` (T3); componentes da T10.
- Produces:
  - `situacaoLeitura(r: Retrato | null, conectado: boolean, agora?: number): { tom: Tom; texto: string; curto: string; detalhe: string }`; `avisoLeitura(r: Retrato | null, agora?: number): string | null`
  - `norm(s)`, `normPlacaBusca(s)`, `pontuarVeiculo(v, q)`, `ocupacaoPorArea(vs)`, `buscar(d, q)`, `sugestoes(d)`, `lerRecentes()`, `guardarRecente(t)`; `interface DadosBusca { veiculos; cercas; eventos }`
  - `MENU: { href; rotulo; curto; icone: IconeNome }[]`, `telaAtiva(caminho, href)`
  - `pedirNavegacao(p: { tipo: "veiculo"; id: string } | { tipo: "cerca"; nome: string }): boolean`, `ouvirNavegacao(f): () => void` (a tela de Localização atende sem recarregar; senão quem chamou navega por link `/#v=` ou `/#cerca=`)
  - `IndicadorVivo({ curto? })`, `FaixaLeitura()`, `Paleta()`, `abrirPaleta()`, `BarraSuperior()`, `Casca({ children })`

- [ ] **Step 1: Testes**

`src/lib/dominio/conexao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Retrato } from "../tipos";
import { avisoLeitura, situacaoLeitura } from "./conexao";

const r = (o: Partial<Retrato> = {}): Retrato => ({ lido_em: "2026-10-01T15:00:00.000Z", erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [], ...o });
const em = (iso: string) => new Date(iso).getTime();

describe("situação da leitura", () => {
  it("antes da 1ª leitura do coletor", () => {
    expect(situacaoLeitura(null, true, em("2026-10-01T15:05:00Z"))).toMatchObject({ tom: "neu", texto: "aguardando 1ª leitura…" });
    expect(situacaoLeitura(r({ lido_em: null }), true).texto).toBe("aguardando 1ª leitura…");
  });
  it("em dia, atrasada, com erro e sem conexão", () => {
    expect(situacaoLeitura(r(), true, em("2026-10-01T15:05:00Z"))).toMatchObject({ tom: "ok", texto: "atualizado 12:00:00 · a cada 5 min", curto: "12:00" });
    expect(situacaoLeitura(r(), true, em("2026-10-01T15:16:00Z")).tom).toBe("warn");
    expect(situacaoLeitura(r({ erro: { em: "2026-10-01T15:00:00.000Z", msg: "x" } }), true, em("2026-10-01T15:05:00Z")).tom).toBe("bad");
    expect(situacaoLeitura(r(), false).texto).toBe("reconectando…");
  });
  it("faixas de aviso: falha e acesso pausado", () => {
    expect(avisoLeitura(r({ erro: { em: "2026-10-01T15:00:00.000Z", msg: "HTTP 500" } }))).toBe("Falha ao consultar o GAUSS às 12:00: HTTP 500. Mostrando a última leitura (12:00:00).");
    const g = { dia: "2026-10-01", requisicoes: 1, logins: 0, erros: 5, desde: "2026-10-01T03:00:00.000Z" };
    expect(avisoLeitura(r({ gauss: { ...g, pausadoAte: "2026-10-01T15:30:00.000Z" } }), em("2026-10-01T15:05:00Z"))).toBe("Acesso ao GAUSS pausado até 12:30 após falhas seguidas (proteção para não insistir).");
    expect(avisoLeitura(r({ gauss: { ...g, pausadoAte: "2026-10-01T15:00:00.000Z" } }), em("2026-10-01T15:05:00Z"))).toBeNull();
  });
});
```

`src/lib/busca.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buscar, pontuarVeiculo, sugestoes } from "./busca";
import type { Cerca, Evento, Veiculo } from "./tipos";

const v = (id: string, placa: string, o: Partial<Veiculo> = {}): Veiculo => ({
  id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Desligado", status_cod: 2,
  status_desde: null, lat: 0, lng: 0, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});
const veiculos = [
  v("1", "EGC2984", { status: "Em manutenção", status_cod: 9, area: "OFICINA" }),
  v("2", "XEGC298", { area: "PATIO" }),
  v("3", "EOF5208", { status: "Ligado", status_cod: 1, area: "PATIO", motor2: { id: "4", placa: "EOF52082", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
];
const cerca = (name: string): Cerca => ({ code: 1, name, layer: 1, color: "#000", tipo: "area", polygon: [[0, 0], [0, 1], [1, 1]] });
const cercas = [cerca("OFICINA"), cerca("PATIO"), cerca("PATIO 2")];
const eventos: Evento[] = [{ t: "2026-10-01T15:00:00.000Z", id: "3", placa: "EOF5208", vaga: "", tipo: "entrada", area: "PATIO", lat: 0, lng: 0 }];
const d = { veiculos, cercas, eventos };

describe("busca geral", () => {
  it("placa com hífen e minúscula; começo da placa vem antes", () => {
    expect(buscar(d, "egc-2984").veiculos.map((x) => x.placa)).toEqual(["EGC2984"]);
    expect(buscar(d, "egc2").veiculos.map((x) => x.placa)).toEqual(["EGC2984", "XEGC298"]);
  });
  it("placa do motor secundário acha o caminhão", () => {
    expect(buscar(d, "52082").veiculos.map((x) => x.placa)).toEqual(["EOF5208"]);
  });
  it("sem acento: 'manutencao' acha o status 'Em manutenção'", () => {
    expect(pontuarVeiculo(veiculos[0], "manutencao")).toBe(1);
  });
  it("cercas por nome, as mais ocupadas primeiro; eventos pelo texto", () => {
    const r = buscar(d, "patio");
    expect(r.cercas.map((c) => c.name)).toEqual(["PATIO", "PATIO 2"]);
    expect(r.eventos).toHaveLength(1);
  });
  it("sem texto: ligados agora e áreas com mais veículos", () => {
    const s = sugestoes(d);
    expect(s.ligados.map((x) => x.placa)).toEqual(["EOF5208"]);
    expect(s.areas.map((c) => c.name)).toEqual(["PATIO", "OFICINA"]);
  });
});
```

`src/lib/menu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { telaAtiva } from "./menu";

describe("tela ativa", () => {
  it("considera a barra final do endereço (trailingSlash)", () => {
    expect(telaAtiva("/", "/")).toBe(true);
    expect(telaAtiva("/timeline/", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline/", "/")).toBe(false);
    expect(telaAtiva("/alertas/", "/timeline")).toBe(false);
  });
});
```

Run: `npx vitest run src/lib/dominio/conexao.test.ts src/lib/busca.test.ts src/lib/menu.test.ts` → FAIL.

- [ ] **Step 2: Módulos puros**

`src/lib/dominio/conexao.ts`:

```ts
import type { Retrato, Tom } from "../tipos";
import { hora, horaSeg } from "./formato";

export interface SituacaoLeitura {
  tom: Tom;
  texto: string;
  /** versão curta para o celular ("12:05") */
  curto: string;
  /** carga gerada no GAUSS (dica do indicador) */
  detalhe: string;
}

/** Indicador "ao vivo" da barra: a leitura mais recente do coletor está em dia? */
export function situacaoLeitura(r: Retrato | null, conectado: boolean, agora = Date.now()): SituacaoLeitura {
  const g = r?.gauss;
  const detalhe = g ? `Requisições ao GAUSS desde ${new Date(g.desde).toLocaleString("pt-BR")}: ${g.requisicoes} (${g.logins} login(s), ${g.erros} erro(s))` : "";
  if (!conectado) return { tom: "warn", texto: "reconectando…", curto: "…", detalhe };
  if (!r?.lido_em) return { tom: "neu", texto: "aguardando 1ª leitura…", curto: "—", detalhe };
  // o disparo não é pontual: só acusa atraso depois de 3 ciclos sem leitura
  const atrasado = agora - new Date(r.lido_em).getTime() > r.intervalo_s * 3 * 1000;
  const cada = r.intervalo_s >= 60 ? `${r.intervalo_s / 60} min` : `${r.intervalo_s}s`;
  return { tom: r.erro ? "bad" : atrasado ? "warn" : "ok", texto: `atualizado ${horaSeg(r.lido_em)} · a cada ${cada}`, curto: hora(r.lido_em), detalhe };
}

/** Faixa de aviso: falha ao consultar o GAUSS ou acesso pausado pela proteção do coletor. */
export function avisoLeitura(r: Retrato | null, agora = Date.now()): string | null {
  if (r?.erro) return `Falha ao consultar o GAUSS às ${hora(r.erro.em)}: ${r.erro.msg}. Mostrando a última leitura${r.lido_em ? ` (${horaSeg(r.lido_em)})` : ""}.`;
  const p = r?.gauss?.pausadoAte;
  if (p && new Date(p).getTime() > agora) return `Acesso ao GAUSS pausado até ${hora(p)} após falhas seguidas (proteção para não insistir).`;
  return null;
}
```

`src/lib/busca.ts`:

```ts
import { textoEvento, textoPlano } from "./dominio/eventos";
import type { Cerca, Evento, Veiculo } from "./tipos";

/** Sem acento e em maiúsculas. */
export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
/** Placa também sem hífen e espaço (EGC-2984 = egc2984). */
export const normPlacaBusca = (s: unknown) => norm(s).replace(/[^A-Z0-9]/g, "");

/** 3 = começo da placa (ou da placa do motor 2º), 2 = parte da placa, 1 = vaga/motorista/área/rua/grupo/status, 0 = não casa. */
export function pontuarVeiculo(v: Veiculo, q: string): number {
  const qn = norm(q.trim());
  const qp = normPlacaBusca(q);
  const p = normPlacaBusca(v.placa);
  const p2 = normPlacaBusca(v.motor2?.placa);
  if (qp.length >= 2 && (p.startsWith(qp) || (!!p2 && p2.startsWith(qp)))) return 3;
  if (qp.length >= 2 && (p.includes(qp) || (!!p2 && p2.includes(qp)))) return 2;
  if (qn && norm([v.vaga, v.motorista, v.area, v.via, v.grupo, v.status].join(" ")).includes(qn)) return 1;
  return 0;
}

export interface DadosBusca {
  veiculos: Veiculo[];
  cercas: Cerca[];
  eventos: Evento[];
}

export function ocupacaoPorArea(vs: Veiculo[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of vs) if (v.area) m.set(v.area, (m.get(v.area) ?? 0) + 1);
  return m;
}

/** Busca geral (Ctrl K): veículos, áreas/ruas/cercas e eventos de hoje. */
export function buscar(d: DadosBusca, q: string) {
  const qn = norm(q.trim());
  const ocupacao = ocupacaoPorArea(d.veiculos);
  const veiculos = d.veiculos
    .map((v) => [v, pontuarVeiculo(v, q)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].placa.localeCompare(b[0].placa))
    .map(([v]) => v);
  const cercas = d.cercas
    .filter((c) => c.polygon.length >= 3 && norm(c.name).includes(qn))
    .sort((a, b) => (ocupacao.get(b.name) ?? 0) - (ocupacao.get(a.name) ?? 0) || a.name.localeCompare(b.name));
  const eventos = d.eventos.filter((e) => norm(`${textoPlano(textoEvento(e))} ${e.area}`).includes(qn)).sort((a, b) => b.t.localeCompare(a.t));
  return { veiculos, cercas, eventos, ocupacao };
}

/** Sem texto: ligados agora (inclusive motor 2º) e as áreas com mais veículos. */
export function sugestoes(d: DadosBusca) {
  const ocupacao = ocupacaoPorArea(d.veiculos);
  const ligados = d.veiculos.filter((v) => v.status_cod === 1 || v.status_cod === 3 || v.motor2?.status_cod === 1);
  const areas = [...ocupacao.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nome]) => d.cercas.find((c) => c.name === nome))
    .filter((c): c is Cerca => !!c);
  return { ligados, areas, ocupacao };
}

const CHAVE_RECENTES = "mon-buscas";
export function lerRecentes(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function guardarRecente(t: string): void {
  const s = t.trim();
  if (s.length < 2) return;
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify([s, ...lerRecentes().filter((x) => x !== s)].slice(0, 8)));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}
```

Conferência de `sugestoes`: ocupação PATIO = 2 (XEGC298, EOF5208), OFICINA = 1 → `["PATIO", "OFICINA"]`.

`src/lib/menu.ts`:

```ts
import type { IconeNome } from "@/components/icones";

/** Telas do sistema (barra superior, barra inferior do celular e Ctrl K). */
export const MENU: { href: string; rotulo: string; curto: string; icone: IconeNome }[] = [
  { href: "/", rotulo: "Localização", curto: "Mapa", icone: "mapa" },
  { href: "/timeline", rotulo: "Timeline", curto: "Timeline", icone: "timeline" },
  { href: "/alertas", rotulo: "Alertas", curto: "Alertas", icone: "alertas" },
];

/** A tela atual é esta? (o site usa barra no fim do endereço: /timeline/) */
export const telaAtiva = (caminho: string, href: string) => (href === "/" ? caminho === "/" || caminho === "" : caminho === href || caminho.startsWith(`${href}/`));
```

`src/lib/navegacao.ts`:

```ts
/** Pedido para mostrar um veículo ou uma cerca no mapa (busca Ctrl K, alertas, cartões). */
export type PedidoNavegacao = { tipo: "veiculo"; id: string } | { tipo: "cerca"; nome: string };

const ouvintes = new Set<(p: PedidoNavegacao) => boolean>();

/** A tela de Localização escuta enquanto está aberta. */
export function ouvirNavegacao(f: (p: PedidoNavegacao) => boolean): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Atendido pela tela aberta (true) ou não (false: quem pediu navega por link /#v= ou /#cerca=). */
export function pedirNavegacao(p: PedidoNavegacao): boolean {
  for (const f of ouvintes) if (f(p)) return true;
  return false;
}
```

Run: `npx vitest run src/lib/dominio/conexao.test.ts src/lib/busca.test.ts src/lib/menu.test.ts` → PASS.

- [ ] **Step 3: Indicador ao vivo e faixa de aviso**

`src/components/indicador-vivo.tsx`:

```tsx
"use client";

import { corDoTom } from "@/lib/cores";
import { useRetrato } from "@/lib/dados/use-retrato";
import { avisoLeitura, situacaoLeitura } from "@/lib/dominio/conexao";
import { useAgora } from "@/lib/hooks";
import { cx } from "./ui";

/** "atualizado 12:05:39 · a cada 5 min" na barra; no celular, só "12:05". */
export function IndicadorVivo({ curto = false }: { curto?: boolean }) {
  const { retrato, conectado } = useRetrato();
  const agora = useAgora();
  const s = situacaoLeitura(retrato, conectado, agora || undefined);
  return (
    <span
      title={[s.texto, s.detalhe].filter(Boolean).join("\n")}
      className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[12.5px] text-nav-suave"
    >
      <span aria-hidden className={cx("h-2 w-2 rounded-full", s.tom === "ok" && "animate-pulse")} style={{ background: corDoTom(s.tom) }} />
      <span className="tabular-nums">{curto ? s.curto : s.texto}</span>
      {!curto && retrato?.gauss && <span className="hidden border-l border-white/10 pl-2 text-[11px] font-semibold xl:inline">GAUSS: {retrato.gauss.requisicoes} req</span>}
    </span>
  );
}

/** Faixa amarela sob a barra quando o coletor falhou ou o acesso ao GAUSS está pausado. */
export function FaixaLeitura() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const texto = avisoLeitura(retrato, agora || undefined);
  return texto ? (
    <div role="alert" className="st-amarelo border-b border-borda px-4 py-2 text-[13px]">
      {texto}
    </div>
  ) : null;
}
```

- [ ] **Step 4: Busca geral Ctrl K**

`src/components/paleta.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buscar, guardarRecente, lerRecentes, norm, sugestoes } from "@/lib/busca";
import { corDoTom } from "@/lib/cores";
import { lerCercas } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { chaveEvento, textoEvento, veiculoDoEvento } from "@/lib/dominio/eventos";
import { diaLocal, hora } from "@/lib/dominio/formato";
import { CATEGORIAS, categoria, semMotor2 } from "@/lib/dominio/veiculo";
import { MENU, telaAtiva } from "@/lib/menu";
import { pedirNavegacao } from "@/lib/navegacao";
import { useTema } from "@/lib/tema";
import type { Cerca, Evento, Veiculo } from "@/lib/tipos";
import { CAMINHOS } from "./icones";
import { cx } from "./ui";

/** Busca geral (Ctrl K, ⌘K ou "/"): veículos, áreas/ruas/cercas, eventos de hoje, telas e tema. */
let aberta = false;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};
export function abrirPaleta() {
  aberta = true;
  emitir();
}
const fecharPaleta = () => {
  aberta = false;
  emitir();
};

/** Montada uma vez na casca. Os dados só são lidos com a janela aberta. */
export function Paleta() {
  const ok = useSyncExternalStore(assinar, () => aberta, () => false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const digitando = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !digitando)) {
        e.preventDefault();
        if (aberta) fecharPaleta();
        else abrirPaleta();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  return ok ? <Janela /> : null;
}

interface Item {
  chave: string;
  rotulo: string;
  sub: string;
  cor?: string;
  icone?: string;
  executar: () => void;
  extra?: { rotulo: string; executar: () => void };
}
const TIPO_CERCA = { area: "Área", via: "Rua / via", planta: "Planta" } as const;

function Janela() {
  const router = useRouter();
  const caminho = usePathname();
  const { retrato } = useRetrato();
  const [hoje] = useState(() => diaLocal());
  const { eventos } = useEventos(hoje);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const [tema, alternarTema] = useTema();
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [recentes] = useState(lerRecentes);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const destino = telaAtiva(caminho, "/timeline") ? "timeline" : "mapa";
  const dados = { veiculos: semMotor2(retrato?.veiculos ?? []), cercas, eventos };
  const termo = q.trim();

  const sair = () => {
    guardarRecente(q);
    fecharPaleta();
  };
  const irVeiculo = (id: string, para: "mapa" | "timeline") => {
    sair();
    if (para === "timeline") router.push(`/timeline/?v=${encodeURIComponent(id)}&dia=${hoje}`);
    else if (!pedirNavegacao({ tipo: "veiculo", id })) router.push(`/#v=${encodeURIComponent(id)}`);
  };
  const irCerca = (nome: string) => {
    sair();
    if (!pedirNavegacao({ tipo: "cerca", nome })) router.push(`/#cerca=${encodeURIComponent(nome)}`);
  };

  const itemVeiculo = (v: Veiculo): Item => {
    const outro = destino === "mapa" ? "timeline" : "mapa";
    return {
      chave: `v:${v.id}`,
      rotulo: v.motor2 ? `${v.placa} · ⚙ ${v.motor2.placa}` : v.placa,
      sub: [v.motor2 ? `${v.status} · ⚙ 2º ${v.motor2.status}` : v.status, v.vaga || "sem vaga", v.area || v.via || "fora de cerca", v.motorista].filter(Boolean).join(" · "),
      cor: corDoTom(CATEGORIAS[categoria(v)].tom),
      executar: () => irVeiculo(v.id, destino),
      extra: { rotulo: outro === "timeline" ? "Timeline" : "Mapa", executar: () => irVeiculo(v.id, outro) },
    };
  };
  const itemCerca = (c: Cerca, ocupacao: Map<string, number>): Item => {
    const n = ocupacao.get(c.name) ?? 0;
    return { chave: `c:${c.name}`, rotulo: c.name, sub: `${TIPO_CERCA[c.tipo]}${n ? ` · ${n} veículo${n > 1 ? "s" : ""} agora` : ""}`, cor: c.color, executar: () => irCerca(c.name) };
  };
  const itemEvento = (e: Evento): Item => {
    const t = textoEvento(e);
    return {
      chave: `e:${chaveEvento(e)}`,
      rotulo: `${t.quem}${t.motor2 ? " ⚙ motor 2º" : ""} · ${hora(e.t)}`,
      sub: `${t.acao} ${t.alvo}${t.extra}`.trim(),
      cor: "var(--neu-dot)",
      executar: () => irVeiculo(veiculoDoEvento(e), destino),
    };
  };
  const telas: Item[] = MENU.map((m) => ({
    chave: `t:${m.href}`,
    rotulo: m.rotulo,
    sub: "tela",
    icone: CAMINHOS[m.icone],
    executar: () => {
      fecharPaleta();
      router.push(m.href);
    },
  }));
  const acoes: Item[] = [
    {
      chave: "a:tema",
      rotulo: tema === "escuro" ? "Tema claro" : "Tema escuro",
      sub: "aparência",
      icone: CAMINHOS.tema,
      executar: () => {
        alternarTema();
        fecharPaleta();
      },
    },
  ];
  const casa = (i: Item) => norm(`${i.rotulo} ${i.sub}`).includes(norm(termo));

  let grupos: { nome: string; itens: Item[] }[];
  if (!termo) {
    const s = sugestoes(dados);
    grupos = [
      { nome: "Ligados agora", itens: s.ligados.slice(0, 8).map(itemVeiculo) },
      { nome: "Áreas com mais veículos", itens: s.areas.map((c) => itemCerca(c, s.ocupacao)) },
      { nome: "Telas", itens: telas },
      { nome: "Ações", itens: acoes },
    ];
  } else {
    const r = buscar(dados, termo);
    grupos = [
      { nome: "Veículos", itens: r.veiculos.slice(0, 20).map(itemVeiculo) },
      { nome: "Áreas, ruas e cercas", itens: r.cercas.slice(0, 15).map((c) => itemCerca(c, r.ocupacao)) },
      { nome: "Eventos de hoje", itens: r.eventos.slice(0, 12).map(itemEvento) },
      { nome: "Telas", itens: telas.filter(casa) },
      { nome: "Ações", itens: acoes.filter(casa) },
    ];
  }
  grupos = grupos.filter((g) => g.itens.length);
  const plano = grupos.flatMap((g) => g.itens);
  const sel = Math.min(ativo, Math.max(0, plano.length - 1));

  return (
    <dialog
      ref={dialogo}
      aria-label="Buscar"
      onClose={fecharPaleta}
      onClick={(e) => e.target === e.currentTarget && dialogo.current?.close()}
      className="m-0 mx-auto mt-[72px] w-[min(640px,calc(100vw-24px))] max-w-none overflow-hidden rounded-xl border border-borda bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex h-[58px] items-center gap-3 border-b border-borda px-4">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-suave" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d={CAMINHOS.busca} />
        </svg>
        <input
          autoFocus
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo(Math.min(plano.length - 1, sel + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo(Math.max(0, sel - 1));
            } else if (e.key === "Enter" && plano[sel]) {
              e.preventDefault();
              plano[sel].executar();
            }
          }}
          placeholder="Placa, motorista, vaga, área, rua…"
          aria-label="Buscar veículo, área, rua ou evento"
          className="h-full flex-1 bg-transparent text-base"
          style={{ border: 0, boxShadow: "none" }}
        />
        <kbd className="hidden rounded border border-borda px-1.5 py-0.5 text-[11px] text-suave md:inline">Esc</kbd>
      </div>
      {!termo && recentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-borda px-4 py-2.5">
          {recentes.map((r) => (
            <button key={r} type="button" onClick={() => setQ(r)} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs text-suave hover:text-texto">
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[min(420px,60dvh)] space-y-0.5 overflow-y-auto p-2" role="listbox" aria-label="Resultados">
        {(() => {
          let i = -1;
          return grupos.map((g) => (
            <div key={g.nome}>
              <p className="flex justify-between px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-suave">
                <span>{g.nome}</span>
                <span>{g.itens.length}</span>
              </p>
              {g.itens.map((it) => {
                i++;
                const meu = i;
                return (
                  <div
                    key={it.chave}
                    role="option"
                    aria-selected={meu === sel}
                    onMouseEnter={() => setAtivo(meu)}
                    onClick={it.executar}
                    className={cx("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5", meu === sel && "bg-superficie-2")}
                  >
                    {it.icone ? (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-borda bg-superficie-2 text-suave">
                        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={it.icone} />
                        </svg>
                      </span>
                    ) : (
                      <span aria-hidden className="mx-2.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.cor }} />
                    )}
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block truncate font-medium">{it.rotulo}</span>
                      <span className="block truncate text-xs text-suave">{it.sub}</span>
                    </span>
                    {it.extra && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          it.extra!.executar();
                        }}
                        className="shrink-0 rounded-md border border-borda px-2 py-1 text-xs font-semibold text-link hover:bg-superficie"
                      >
                        {it.extra.rotulo}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ));
        })()}
        {!plano.length && <p className="px-4 py-9 text-center text-suave">Nada encontrado para “{q}”.</p>}
        {!termo && <p className="px-3 pb-2 pt-3 text-xs text-suave">Busque por placa (com ou sem hífen), motor secundário, motorista, vaga, área, rua ou evento.</p>}
      </div>
    </dialog>
  );
}
```

- [ ] **Step 5: Barra superior e casca**

`src/components/barra-superior.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MARCA } from "@/lib/marca";
import { MENU, telaAtiva } from "@/lib/menu";
import { useTema } from "@/lib/tema";
import { CAMINHOS, Icone } from "./icones";
import { IndicadorVivo } from "./indicador-vivo";
import { abrirPaleta } from "./paleta";
import { cx } from "./ui";

/**
 * Barra superior "Campo" (a mesma do SST): logo, telas com ícone num trilho próprio, leitura ao vivo,
 * busca Ctrl K e tema. No celular: cabeçalho compacto + barra inferior com as telas e a busca.
 */
export function BarraSuperior() {
  const caminho = usePathname();
  const [tema, alternarTema] = useTema();
  const atual = MENU.find((m) => telaAtiva(caminho, m.href));

  const logo = (tam: string) => (
    <span className={cx("flex shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm ring-1 ring-black/5", tam)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARCA.logo} alt={MARCA.dona} className="h-full w-full object-contain" />
    </span>
  );
  const botaoTema = (
    <button
      type="button"
      onClick={alternarTema}
      title={tema === "escuro" ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-nav-texto transition-colors hover:bg-white/[0.1]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    </button>
  );
  const iconeBusca = (tam: string) => (
    <svg viewBox="0 0 24 24" className={tam} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d={CAMINHOS.busca} />
    </svg>
  );

  return (
    <>
      {/* computador */}
      <header className="sticky top-0 z-[1000] hidden h-[62px] items-center gap-3 border-b border-nav-borda bg-nav px-5 text-nav-texto shadow-[0_1px_0_rgba(255,255,255,0.04),0_6px_16px_-8px_rgba(0,0,0,0.5)] md:flex">
        <Link href="/" className="flex shrink-0 items-center gap-3 whitespace-nowrap hover:no-underline">
          {logo("h-9 w-9")}
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-white">
              {MARCA.sigla} <span className="font-normal text-nav-suave">·</span> {MARCA.empresa}
            </span>
            <span className="block text-[12px] text-nav-suave">{MARCA.area}</span>
          </span>
        </Link>
        <span aria-hidden className="mx-3 h-7 w-px shrink-0 bg-nav-borda lg:mx-5" />
        <nav aria-label="Menu principal" className="flex min-w-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {MENU.map((m) => {
            const ativo = telaAtiva(caminho, m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={ativo ? "page" : undefined}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:no-underline",
                  ativo ? "bg-nav-ativo text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-nav-suave hover:bg-nav-hover hover:text-white",
                )}
              >
                <Icone nome={m.icone} className={cx("h-[17px] w-[17px]", ativo ? "text-[#8fb1f5]" : "opacity-80")} />
                {m.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <IndicadorVivo />
        <button
          type="button"
          onClick={abrirPaleta}
          title="Buscar (Ctrl K)"
          className="flex h-9 min-w-9 shrink items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[13px] text-nav-suave transition-colors hover:border-white/15 hover:bg-white/[0.08] hover:text-nav-texto min-[1400px]:w-60"
        >
          {iconeBusca("h-[15px] w-[15px] shrink-0")}
          <span className="hidden flex-1 text-left min-[1400px]:inline">Buscar veículo, área…</span>
          <kbd className="hidden rounded-md border border-white/10 bg-white/[0.06] px-1.5 text-[11px] min-[1400px]:inline">Ctrl K</kbd>
        </button>
        {botaoTema}
      </header>

      {/* celular */}
      <header className="sticky top-0 z-[1000] flex h-14 items-center gap-2.5 border-b border-nav-borda bg-nav px-3.5 text-nav-texto md:hidden">
        {logo("h-[34px] w-[34px]")}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">
            {MARCA.sigla} · {MARCA.area}
          </p>
          <p className="truncate text-[11px] text-nav-suave">{atual?.rotulo}</p>
        </div>
        <IndicadorVivo curto />
        {botaoTema}
      </header>
      <nav aria-label="Telas" className="fixed inset-x-0 bottom-0 z-[1000] flex h-16 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        {MENU.map((m) => {
          const ativo = telaAtiva(caminho, m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={ativo ? "page" : undefined}
              className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold hover:no-underline", ativo ? "text-link" : "text-suave")}
            >
              <Icone nome={m.icone} className="h-[21px] w-[21px]" />
              {m.curto}
            </Link>
          );
        })}
        <button type="button" onClick={abrirPaleta} className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-suave">
          {iconeBusca("h-[21px] w-[21px]")}
          Buscar
        </button>
      </nav>
    </>
  );
}
```

`src/components/casca.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { Avisos } from "./avisos";
import { BarraSuperior } from "./barra-superior";
import { Paleta } from "./paleta";

/** Moldura de todas as telas: barra superior (e inferior no celular), busca Ctrl K e avisos. */
export function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BarraSuperior />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      <Paleta />
      <Avisos />
    </div>
  );
}
```

Em `src/app/layout.tsx`, importe `import { Casca } from "@/components/casca";` e troque `<body className="min-h-full font-sans">{children}</body>` por:

```tsx
      <body className="min-h-full font-sans">
        <Casca>{children}</Casca>
      </body>
```

Páginas provisórias (trocadas nas Tarefas 14 e 15):

`src/app/timeline/page.tsx`:

```tsx
import { Vazio } from "@/components/ui";

export default function Pagina() {
  return <Vazio titulo="Timeline">Em construção.</Vazio>;
}
```

`src/app/alertas/page.tsx`:

```tsx
import { Vazio } from "@/components/ui";

export default function Pagina() {
  return <Vazio titulo="Alertas">Em construção.</Vazio>;
}
```

- [ ] **Step 6: Conferir no navegador**

Run: `npm test && npm run typecheck && npm run lint && npm run build`.

No http://localhost:3000 (computador): barra escura com logo SGE, "Monitoramento · Grupo GPS / Mecanizada", trilho Localização · Timeline · Alertas (a atual destacada), indicador "atualizado HH:MM:SS · a cada 5 min" com ponto verde, botão de busca e tema. Ctrl K abre a busca com "Ligados agora" (dados reais do Supabase); digitar uma placa com hífen acha o veículo. Tema escuro alterna sem piscar ao recarregar. No modo celular do navegador (390 px): cabeçalho compacto e barra inferior Mapa · Timeline · Alertas · Buscar.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "Casca no padrão do SST: barra superior Campo, leitura ao vivo, busca geral Ctrl K e barra inferior no celular

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Mapa base (Leaflet só no navegador), marcadores e rota

**Files:**
- Create: `src/components/mapa/leaflet.ts`, `src/components/mapa/use-mapa.ts`, `src/components/mapa/legenda.tsx`, `src/components/mapa/rota.ts`, `src/lib/mapa/marcador.ts`, `src/lib/mapa/rota.ts`
- Test: `src/lib/mapa/marcador.test.ts`, `src/lib/mapa/rota.test.ts`

**Interfaces:**
- Consumes: `categoria`, `frescor`, `FRESCOR`, `CATEGORIAS`, `motor2Ligado`, `ESTADOS_TRECHO` (T3); `idadeCurta`, `fmtMin`, `hhmm` (T3); `corDoTom`, `corResolvida` (T10).
- Produces:
  - `carregarLeaflet(): Promise<typeof Leaflet>` (com o markercluster registrado); `iconeHtml(L, html): Leaflet.DivIcon` (sem tamanho fixo)
  - `useMapa(zoomInicial?): { ref: RefObject<HTMLDivElement | null>; pronto: MapaPronto | null }`; `interface MapaPronto { L; mapa: Leaflet.Map; camadasBase: Record<string, Leaflet.TileLayer> }`
  - `Legenda({ itens: { rotulo; cor; tracejado? }[] })`
  - `desenharRota(L, camada, h: Historico, aoClicarParada: (i) => void): Leaflet.LatLngBounds | null`
  - `esc(s)`, `htmlMarcador(v, sel, semSinalMin, agora): string`, `htmlRotulo(texto, cor): string`
  - `sequenciasPorEstado(pontos: PontoMapa[]): { estado; pts: LatLng[] }[]`, `paradasRelevantes(trechos)`, `pontosDoTrecho(h, i): LatLng[]`

- [ ] **Step 1: Testes**

`src/lib/mapa/marcador.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { htmlMarcador } from "./marcador";

const AGORA = new Date("2026-10-01T15:00:00Z").getTime();
const v = (o: Partial<Veiculo> = {}): Veiculo => ({
  id: "1", placa: "EOF<5208>", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 90, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: "2026-10-01T14:59:00Z", area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});

describe("marcador do veículo", () => {
  it("ligado ao vivo: cor do status, seta na direção, placa escapada e idade", () => {
    const h = htmlMarcador(v(), false, 30, AGORA);
    expect(h).toContain("--c:var(--ok-dot)");
    expect(h).toContain("rotate(90deg)");
    expect(h).toContain("EOF&lt;5208&gt;");
    expect(h).toContain("<small>1m</small>");
    expect(h).not.toContain("semsinal");
  });
  it("sem sinal fica tracejado e sem seta", () => {
    const h = htmlMarcador(v({ posicao_em: "2026-10-01T13:00:00Z" }), false, 30, AGORA);
    expect(h).toContain('class="mk semsinal"');
    expect(h).toContain("●");
  });
  it("selecionado e com motor 2º ligado", () => {
    const h = htmlMarcador(v({ motor2: { id: "2", placa: "X", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }), true, 30, AGORA);
    expect(h).toContain('class="mk sel"');
    expect(h).toContain('class="m2"');
  });
});
```

`src/lib/mapa/rota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { PontoMapa, Trecho } from "../tipos";
import { paradasRelevantes, pontosDoTrecho, sequenciasPorEstado } from "./rota";

const pontos: PontoMapa[] = [
  [1, 1, "08:00:00", 0, "parado", null],
  [2, 2, "08:01:00", 30, "movimento", null],
  [3, 3, "08:02:00", 30, "movimento", null],
  [4, 4, "08:03:00", 0, "parado", null],
];

describe("rota no mapa", () => {
  it("uma linha por sequência de mesmo estado, emendada na próxima", () => {
    expect(sequenciasPorEstado(pontos)).toEqual([
      { estado: "parado", pts: [[1, 1], [2, 2]] },
      { estado: "movimento", pts: [[2, 2], [3, 3], [4, 4]] },
      { estado: "parado", pts: [[4, 4]] },
    ]);
  });
  it("paradas de 10 min ou mais, com posição, viram marcador", () => {
    const trechos: Trecho[] = [
      { estado: "movimento", inicio: "a", fim: "b", duracao_min: 30, de: "", para: "", percurso: [], km: 1, vel_max: 30 },
      { estado: "parado_ligado", inicio: "a", fim: "b", duracao_min: 12, local: "PATIO", lat: 1, lng: 2 },
      { estado: "desligado", inicio: "a", fim: "b", duracao_min: 5, local: "PATIO", lat: 1, lng: 2 },
      { estado: "sem_sinal", inicio: "a", fim: "b", duracao_min: 40, local: "" },
    ];
    expect(paradasRelevantes(trechos).map((p) => p.i)).toEqual([1]);
  });
  it("pontos de um trecho (para enquadrar)", () => {
    const trechos: Trecho[] = [{ estado: "movimento", inicio: "2026-10-01 08:01:00", fim: "2026-10-01 08:02:00", duracao_min: 1, de: "", para: "", percurso: [], km: 0, vel_max: 30 }];
    expect(pontosDoTrecho({ pontos, trechos }, 0)).toEqual([[2, 2], [3, 3]]);
    expect(pontosDoTrecho({ pontos, trechos }, 5)).toEqual([]);
  });
});
```

Run: `npx vitest run src/lib/mapa` → FAIL.

- [ ] **Step 2: Funções puras do mapa**

`src/lib/mapa/marcador.ts`:

```ts
import { corDoTom } from "../cores";
import { idadeCurta } from "../dominio/formato";
import { CATEGORIAS, FRESCOR, categoria, frescor, motor2Ligado } from "../dominio/veiculo";
import type { Veiculo } from "../tipos";

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escapa texto que vai dentro do HTML de marcadores e dicas do Leaflet. */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** HTML do marcador (Leaflet divIcon): cor do status, seta na direção quando anda ao vivo, ⚙ com o motor 2º ligado e idade da posição. */
export function htmlMarcador(v: Veiculo, sel: boolean, semSinalMin: number, agora: number): string {
  const cat = categoria(v);
  const fr = frescor(v, semSinalMin, agora);
  const seta = cat === "ligado" && fr === "vivo" ? `<span class="seta" style="transform:rotate(${Number(v.direcao) || 0}deg)">▲</span>` : '<span class="seta">●</span>';
  const m2 = motor2Ligado(v) ? '<span class="m2" title="Motor secundário ligado">⚙</span>' : "";
  const titulo = `${v.placa} · ${v.status}${v.motor2 ? ` · motor 2º ${v.motor2.status}` : ""} · ${FRESCOR[fr].rotulo}`;
  const classe = `mk${fr === "semsinal" ? " semsinal" : ""}${sel ? " sel" : ""}`;
  return `<div class="${classe}" style="--c:${corDoTom(CATEGORIAS[cat].tom)}" title="${esc(titulo)}">${seta}${esc(v.placa)}${m2} <small>${idadeCurta(v.posicao_em, agora)}</small></div>`;
}

/** Rótulo em pílula (início e fim da rota). */
export const htmlRotulo = (texto: string, cor: string) => `<div class="mk" style="--c:${cor}">${esc(texto)}</div>`;
```

`src/lib/mapa/rota.ts`:

```ts
import type { EstadoTrecho, Historico, LatLng, PontoMapa, Trecho, TrechoParado } from "../tipos";

/** Uma linha por sequência de mesmo estado; cada sequência emenda na próxima (sem buraco visual). */
export function sequenciasPorEstado(pontos: PontoMapa[]): { estado: EstadoTrecho; pts: LatLng[] }[] {
  const seqs: { estado: EstadoTrecho; pts: LatLng[] }[] = [];
  for (const [lat, lng, , , estado] of pontos) {
    const atual = seqs.at(-1);
    if (atual && atual.estado === estado) {
      atual.pts.push([lat, lng]);
      continue;
    }
    if (atual) atual.pts.push([lat, lng]);
    seqs.push({ estado, pts: [[lat, lng]] });
  }
  return seqs;
}

/** Paradas que viram marcador no mapa: 10 min ou mais, com posição. */
export function paradasRelevantes(trechos: Trecho[]): { trecho: TrechoParado; i: number; lat: number; lng: number }[] {
  return trechos.flatMap((t, i) =>
    t.estado === "movimento" || t.estado === "sem_sinal" || t.duracao_min < 10 || t.lat == null || t.lng == null ? [] : [{ trecho: t, i, lat: t.lat, lng: t.lng }],
  );
}

/** Pontos do trecho i (para enquadrar no mapa ao clicar no apontamento). */
export function pontosDoTrecho(h: Pick<Historico, "pontos" | "trechos">, i: number): LatLng[] {
  const t = h.trechos[i];
  if (!t) return [];
  const ini = t.inicio.slice(11, 19);
  const fim = t.fim.slice(11, 19);
  return h.pontos.filter((p) => p[2] >= ini && p[2] <= fim).map((p): LatLng => [p[0], p[1]]);
}
```

Run: `npx vitest run src/lib/mapa` → PASS.

- [ ] **Step 3: Leaflet no navegador**

`src/components/mapa/leaflet.ts`:

```ts
import type * as Leaflet from "leaflet";

export type L = typeof Leaflet;

let promessa: Promise<L> | null = null;

/**
 * Leaflet + markercluster baixados só no navegador (o site é gerado estático e o Leaflet usa `window`).
 * O plugin de agrupamento procura o `L` global, por isso ele é registrado antes.
 */
export function carregarLeaflet(): Promise<L> {
  promessa ??= (async () => {
    const m = await import("leaflet");
    const L = ((m as unknown as { default?: L }).default ?? m) as L;
    (window as unknown as { L: L }).L = L;
    await import("leaflet.markercluster");
    return L;
  })();
  return promessa;
}

/** Ícone a partir de HTML, sem tamanho fixo (a pílula cresce com o texto). */
export const iconeHtml = (L: L, html: string) => L.divIcon({ html, className: "", iconSize: null as unknown as Leaflet.PointExpression });
```

`src/components/mapa/use-mapa.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { carregarLeaflet, type L } from "./leaflet";

export interface MapaPronto {
  L: L;
  mapa: Leaflet.Map;
  camadasBase: Record<string, Leaflet.TileLayer>;
}

const CENTRO: [number, number] = [-19.48, -42.53]; // Usiminas Ipatinga
// a imagem de satélite da Esri só existe até o zoom 18 nesta região; acima disso o Leaflet amplia o tile 18
// (senão aparece "Map data not yet available")
const SATELITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const RUAS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Cria o mapa (satélite + ruas) no div de `ref`. Acompanha o tamanho do div (gaveta, painel). */
export function useMapa(zoomInicial = 14) {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useRef(zoomInicial);
  const [pronto, setPronto] = useState<MapaPronto | null>(null);
  useEffect(() => {
    let vivo = true;
    let mapa: Leaflet.Map | null = null;
    let obs: ResizeObserver | null = null;
    void carregarLeaflet().then((L) => {
      const el = ref.current;
      if (!vivo || !el) return;
      const satelite = L.tileLayer(SATELITE, { maxZoom: 21, maxNativeZoom: 18, attribution: "Imagens © Esri" });
      const ruas = L.tileLayer(RUAS, { maxZoom: 21, maxNativeZoom: 19, attribution: "© OpenStreetMap" });
      const m = L.map(el, { layers: [satelite], zoomControl: true, maxZoom: 21 }).setView(CENTRO, zoom.current);
      mapa = m;
      obs = new ResizeObserver(() => m.invalidateSize());
      obs.observe(el);
      setPronto({ L, mapa: m, camadasBase: { "Satélite": satelite, Mapa: ruas } });
    });
    return () => {
      vivo = false;
      obs?.disconnect();
      mapa?.remove();
    };
  }, []);
  return { ref, pronto };
}
```

`src/components/mapa/legenda.tsx`:

```tsx
import { cx } from "../ui";

/** Legenda no canto do mapa (só no computador). */
export function Legenda({ itens }: { itens: { rotulo: string; cor: string; tracejado?: boolean }[] }) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-1.5">
          <i className={cx("h-[9px] w-[9px] rounded-full", i.tracejado && "opacity-70 outline-1 outline-dashed outline-texto/60")} style={{ background: i.cor }} />
          {i.rotulo}
        </div>
      ))}
    </div>
  );
}
```

`src/components/mapa/rota.ts`:

```ts
import type * as Leaflet from "leaflet";
import { corResolvida } from "@/lib/cores";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { esc, htmlRotulo } from "@/lib/mapa/marcador";
import { paradasRelevantes, sequenciasPorEstado } from "@/lib/mapa/rota";
import type { Historico } from "@/lib/tipos";
import { iconeHtml, type L } from "./leaflet";

/**
 * Desenha a rota do dia (cor por estado, contorno escuro por baixo para destacar no satélite e sobre as
 * cercas), as paradas de 10 min ou mais e os rótulos de início e fim. Devolve os limites para enquadrar.
 */
export function desenharRota(L: L, camada: Leaflet.LayerGroup, h: Historico, aoClicarParada: (i: number) => void): Leaflet.LatLngBounds | null {
  camada.clearLayers();
  if (!h.pontos.length) return null;
  const seqs = sequenciasPorEstado(h.pontos);
  for (const s of seqs) L.polyline(s.pts, { color: "#0b1220", weight: 11, opacity: 0.75, lineJoin: "round" }).addTo(camada);
  for (const s of seqs) L.polyline(s.pts, { color: corResolvida(ESTADOS_TRECHO[s.estado].tom), weight: 7, opacity: 1, lineJoin: "round", lineCap: "round" }).addTo(camada);
  for (const p of paradasRelevantes(h.trechos)) {
    const e = ESTADOS_TRECHO[p.trecho.estado];
    L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 2, fillColor: corResolvida(e.tom), fillOpacity: 1 })
      .bindTooltip(`${hhmm(p.trecho.inicio)}–${hhmm(p.trecho.fim)} · ${e.rotulo} · ${fmtMin(p.trecho.duracao_min)}<br>${esc(p.trecho.local)}`, { sticky: true })
      .on("click", () => aoClicarParada(p.i))
      .addTo(camada);
  }
  const ini = h.pontos[0];
  const fim = h.pontos.at(-1)!;
  L.marker([ini[0], ini[1]], { icon: iconeHtml(L, htmlRotulo(`Início ${ini[2].slice(0, 5)}`, "var(--ok-dot)")) }).addTo(camada);
  L.marker([fim[0], fim[1]], { icon: iconeHtml(L, htmlRotulo(`Fim ${fim[2].slice(0, 5)}`, "var(--primaria)")) }).addTo(camada);
  return L.latLngBounds(h.pontos.map((p): [number, number] => [p[0], p[1]]));
}
```

- [ ] **Step 4: Conferir e commitar**

Run: `npm test && npm run typecheck && npm run lint && npm run build` → PASS (o build prova que o Leaflet não é executado na geração estática).

```bash
git add src/components/mapa src/lib/mapa
git commit -m "Mapa base com Leaflet só no navegador, marcador do veículo e desenho da rota do dia

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Tela de Localização (computador e celular)

**Files:**
- Create: `src/lib/dominio/historico.ts`, `src/lib/dominio/csv.ts`, `src/lib/arquivo.ts`, `src/components/evento-texto.tsx`, `src/components/folha.tsx`, `src/components/historico/andamento.tsx`, `src/components/historico/tempo-area.tsx`, `src/components/historico/trechos.tsx`, `src/components/historico/historico-dia.tsx`, `src/app/_localizacao/mapa-frota.ts`, `src/app/_localizacao/painel.tsx`, `src/app/_localizacao/detalhe.tsx`, `src/app/_localizacao/resumo-celular.tsx`, `src/app/_localizacao/localizacao.tsx`
- Modify: `src/app/page.tsx` (substituir)
- Test: `src/lib/dominio/historico.test.ts`, `src/lib/dominio/csv.test.ts`

**Interfaces:**
- Consumes: tudo das Tarefas 2 a 12.
- Produces:
  - `itensResumo(h: Historico): { rotulo; valor; nota?; motor2? }[]`, `FONTE: Record<FonteHistorico, string>` (`dominio/historico.ts`)
  - `csvApontamento(h: Pick<Historico, "dia" | "trechos">, placa): string`, `nomeCsv(placa, dia)`; `baixarTexto(nome, texto)`
  - `EventoTexto({ e })`; `Folha({ estado, mudar, resumo, children })`, `type EstadoFolha`
  - `Andamento({ etapa, desde })`, `TempoPorArea({ areas })`, `ListaTrechos({ trechos, sel, aoEscolher })` (cada item tem `data-trecho={i}`), `HistoricoDia({ h, placa, trechoSel, focarTrecho })` — usados também pela Timeline
  - Comportamento: links `/#v=<id>[&hist=AAAA-MM-DD]` e `/#cerca=<nome>`; atende `pedirNavegacao` enquanto aberta.

- [ ] **Step 1: Testes do resumo e do CSV**

`src/lib/dominio/historico.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Historico } from "../tipos";
import { itensResumo } from "./historico";

const base: Historico = {
  id: "10", dia: "2026-10-01", fonte: "cache", baixado_em: "x", motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null, motor2: null, pontos: [], trechos: [],
  resumo: { primeiro: "2026-10-01 08:00:00", ultimo: "2026-10-01 17:30:00", pontos: 10, km: 12.5, vel_max: 42, movimento_min: 95, parado_ligado_min: 30, desligado_min: 400, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: null, areas: [] },
};

describe("resumo do dia", () => {
  it("com RPM: parado ligado e desligado", () => {
    expect(itensResumo(base).map((i) => [i.rotulo, i.valor])).toEqual([
      ["Período", "08:00 – 17:30"], ["Distância", "12,5 km · máx 42 km/h"], ["Em deslocamento", "1h35"], ["Parado ligado", "30 min"], ["Desligado", "6h40"],
    ]);
  });
  it("RPM travado: só 'Parado', com a explicação; motor 2º e sem sinal", () => {
    const h: Historico = { ...base, temRpm: false, rpm_travado: 1316, motor2: { intervalos: [], placa: "EOF52082" }, resumo: { ...base.resumo!, parado_min: 430, sem_sinal_min: 12, motor2_ligado_min: 65 } };
    const itens = itensResumo(h);
    expect(itens.find((i) => i.rotulo === "Parado")?.nota).toContain("travado em 1316");
    expect(itens.find((i) => i.rotulo === "Sem sinal")?.valor).toBe("12 min");
    expect(itens.find((i) => i.rotulo === "Motor 2º ligado")).toMatchObject({ valor: "⚙ 1h05", nota: "EOF52082", motor2: true });
  });
  it("dia sem pontos não tem resumo", () => {
    expect(itensResumo({ ...base, resumo: null })).toEqual([]);
  });
});
```

`src/lib/dominio/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { csvApontamento, nomeCsv } from "./csv";

describe("CSV do apontamento", () => {
  it("uma linha por trecho, separador ;, aspas dobradas", () => {
    const csv = csvApontamento(
      {
        dia: "2026-10-01",
        trechos: [
          { estado: "movimento", inicio: "2026-10-01 08:00:00", fim: "2026-10-01 08:10:00", duracao_min: 10, de: "", para: "", percurso: ["PATIO", "RUA 1"], km: 1.2, vel_max: 40, motor2_min: 3 },
          { estado: "parado_ligado", inicio: "2026-10-01 08:10:00", fim: "2026-10-01 08:20:00", duracao_min: 10, local: 'PA"TIO' },
        ],
      },
      "EOF5208",
    );
    expect(csv.split("\r\n")).toEqual([
      '"placa";"dia";"inicio";"fim";"duracao_min";"situacao";"local_ou_percurso";"km";"vel_max";"motor2_ligado_min"',
      '"EOF5208";"2026-10-01";"08:00:00";"08:10:00";"10";"Em deslocamento";"PATIO > RUA 1";"1.2";"40";"3"',
      '"EOF5208";"2026-10-01";"08:10:00";"08:20:00";"10";"Parado ligado";"PA""TIO";"";"";""',
    ]);
    expect(nomeCsv("EOF5208", "2026-10-01")).toBe("apontamento-EOF5208-2026-10-01.csv");
  });
});
```

Run: `npx vitest run src/lib/dominio/historico.test.ts src/lib/dominio/csv.test.ts` → FAIL.

- [ ] **Step 2: Módulos puros**

`src/lib/dominio/historico.ts`:

```ts
import type { FonteHistorico, Historico } from "../tipos";
import { fmtMin, hhmm } from "./formato";

export const FONTE: Record<FonteHistorico, string> = { cache: "do banco", incremental: "atualizado (só a parte nova)", gauss: "baixado do GAUSS" };

export interface ItemResumo {
  rotulo: string;
  valor: string;
  /** explicação curta ao lado do valor */
  nota?: string;
  motor2?: boolean;
}

/** Números do dia (Localização e Timeline). Sem RPM confiável, não afirma motor ligado/desligado. */
export function itensResumo(h: Historico): ItemResumo[] {
  const r = h.resumo;
  if (!r) return [];
  const itens: ItemResumo[] = [
    { rotulo: "Período", valor: `${hhmm(r.primeiro)} – ${hhmm(r.ultimo)}` },
    { rotulo: "Distância", valor: `${r.km.toLocaleString("pt-BR")} km · máx ${r.vel_max} km/h` },
    { rotulo: "Em deslocamento", valor: fmtMin(r.movimento_min) },
  ];
  if (h.temRpm) itens.push({ rotulo: "Parado ligado", valor: fmtMin(r.parado_ligado_min) }, { rotulo: "Desligado", valor: fmtMin(r.desligado_min) });
  else
    itens.push({
      rotulo: "Parado",
      valor: fmtMin(r.parado_min),
      nota: h.rpm_travado ? `RPM do rastreador travado em ${h.rpm_travado} o dia todo: sem informação confiável de motor ligado/desligado` : "veículo não envia RPM",
    });
  if (r.sem_sinal_min) itens.push({ rotulo: "Sem sinal", valor: fmtMin(r.sem_sinal_min) });
  if (h.motor2) itens.push({ rotulo: "Motor 2º ligado", valor: `⚙ ${fmtMin(r.motor2_ligado_min)}`, nota: h.motor2.placa, motor2: true });
  if (h.motor2_erro) itens.push({ rotulo: "Motor 2º", valor: "não carregou", nota: h.motor2_erro });
  return itens;
}
```

`src/lib/dominio/csv.ts`:

```ts
import type { Historico } from "../tipos";
import { ESTADOS_TRECHO } from "./veiculo";

/** Apontamento em CSV (Excel em português: separador ";"). Mesmo arquivo na Localização e na Timeline. */
export function csvApontamento(h: Pick<Historico, "dia" | "trechos">, placa: string): string {
  const cab = ["placa", "dia", "inicio", "fim", "duracao_min", "situacao", "local_ou_percurso", "km", "vel_max", "motor2_ligado_min"];
  const linhas = h.trechos.map((t) => [
    placa, h.dia, t.inicio.slice(11, 19), t.fim.slice(11, 19), t.duracao_min, ESTADOS_TRECHO[t.estado].rotulo,
    t.estado === "movimento" ? t.percurso.join(" > ") : t.local,
    t.estado === "movimento" ? t.km : "", t.estado === "movimento" ? t.vel_max : "", t.motor2_min ?? "",
  ]);
  return [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

export const nomeCsv = (placa: string, dia: string) => `apontamento-${placa}-${dia}.csv`;
```

`src/lib/arquivo.ts`:

```ts
/** Baixa um texto como arquivo (com BOM, para o Excel abrir os acentos). */
export function baixarTexto(nome: string, texto: string, tipo = "text/csv;charset=utf-8") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\uFEFF" + texto], { type: tipo }));
  a.download = nome;
  a.click();
  URL.revokeObjectURL(a.href);
}
```

Run: `npx vitest run src/lib/dominio/historico.test.ts src/lib/dominio/csv.test.ts` → PASS.

- [ ] **Step 3: Componentes do histórico (compartilhados com a Timeline)**

`src/components/evento-texto.tsx`:

```tsx
import { textoEvento } from "@/lib/dominio/eventos";
import type { Evento } from "@/lib/tipos";

/** "EOF5208 ⚙ motor 2º entrou em PATIO · ficou 15 min" com placa e alvo em negrito. */
export function EventoTexto({ e }: { e: Evento }) {
  const t = textoEvento(e);
  return (
    <>
      <b>{t.quem}</b>
      {t.motor2 && <span className="text-motor2"> ⚙ motor 2º</span>} {t.acao} <b>{t.alvo}</b>
      {t.extra}
    </>
  );
}
```

`src/components/historico/andamento.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import type { EtapaPedido } from "@/lib/dados/historico";
import { Vazio } from "../ui";

/** Enquanto o histórico não chega: em que etapa está o pedido e há quanto tempo. */
export function Andamento({ etapa, desde }: { etapa: EtapaPedido | "buscando"; desde: number }) {
  const [agora, setAgora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((agora - desde) / 1000));
  const tempo = s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
  const titulo = etapa === "buscando" ? "Buscando histórico…" : etapa === "processando" ? "O coletor está buscando no GAUSS agora" : "Pedido na fila do coletor";
  return (
    <Vazio titulo={titulo}>
      Se este dia ainda não está no banco, o pedido vai para o coletor (roda a cada ~5 min no GitHub) e aparece aqui sozinho quando chegar. Depois fica guardado.
      {etapa !== "buscando" && desde > 0 && <b className="mt-1.5 block text-texto">{tempo}</b>}
    </Vazio>
  );
}
```

`src/components/historico/tempo-area.tsx`:

```tsx
import { fmtMin } from "@/lib/dominio/formato";

/** Barras com o tempo em cada área (as 8 maiores). */
export function TempoPorArea({ areas }: { areas: { area: string; min: number }[] }) {
  if (!areas.length) return null;
  const max = areas[0].min || 1;
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {areas.slice(0, 8).map((a) => (
        <div key={a.area} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-xs">
          <span className="truncate">{a.area}</span>
          <b className="tabular-nums">{fmtMin(a.min)}</b>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-superficie-2">
            <span className="block h-full rounded-full bg-primaria" style={{ width: `${(a.min / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
```

`src/components/historico/trechos.tsx`:

```tsx
import { CLASSE_TOM } from "@/lib/cores";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Trecho } from "@/lib/tipos";
import { cx } from "../ui";

/** Apontamento: um item por trecho (clicar foca no mapa). */
export function ListaTrechos({ trechos, sel, aoEscolher }: { trechos: Trecho[]; sel: number | null; aoEscolher: (i: number) => void }) {
  return (
    <div>
      {trechos.map((t, i) => {
        const e = ESTADOS_TRECHO[t.estado];
        return (
          <button
            key={`${t.inicio}-${i}`}
            type="button"
            data-trecho={i}
            onClick={() => aoEscolher(i)}
            aria-current={sel === i ? "true" : undefined}
            className={cx("grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-4 py-2.5 text-left hover:bg-superficie-2", sel === i && "bg-primaria-suave")}
          >
            <span className={cx("grid h-7 w-7 place-items-center rounded-md text-xs font-bold", CLASSE_TOM[e.tom])}>{e.icone}</span>
            <span className="min-w-0 text-[13px] leading-snug">
              <b>{e.rotulo}</b>
              {t.estado === "movimento" ? (
                <>
                  {" "}· {t.km} km · máx {t.vel_max} km/h
                  <span className="block text-suave">{t.percurso.length ? t.percurso.join(" → ") : "sem cercas no caminho"}</span>
                </>
              ) : t.estado === "sem_sinal" ? (
                " · nenhuma posição recebida"
              ) : (
                ` em ${t.local}`
              )}
              {!!t.motor2_min && <span className="block font-semibold text-motor2">⚙ motor 2º ligado {fmtMin(t.motor2_min)}</span>}
            </span>
            <span className="text-right text-xs tabular-nums text-suave">
              {hhmm(t.inicio)}–{hhmm(t.fim)}
              <br />
              <span className="font-medium text-texto">{fmtMin(t.duracao_min)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

`src/components/historico/historico-dia.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { baixarTexto } from "@/lib/arquivo";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR } from "@/lib/dominio/formato";
import { FONTE, itensResumo, type ItemResumo } from "@/lib/dominio/historico";
import type { Historico } from "@/lib/tipos";
import { Icone } from "../icones";
import { Botao, Campos, SecaoTitulo, Vazio, cx } from "../ui";
import { TempoPorArea } from "./tempo-area";
import { ListaTrechos } from "./trechos";

function ValorResumo({ item }: { item: ItemResumo }) {
  return (
    <>
      <span className={cx(item.motor2 && "font-semibold text-motor2")}>{item.valor}</span>
      {item.nota && <span className="text-suave"> ({item.nota})</span>}
    </>
  );
}

/** Histórico de um dia no detalhe do veículo: resumo, tempo por área, CSV e apontamento. */
export function HistoricoDia({ h, placa, trechoSel, focarTrecho }: { h: Historico; placa: string; trechoSel: number | null; focarTrecho: (i: number) => void }) {
  if (!h.trechos.length || !h.resumo) return <Vazio titulo="Sem dados neste dia">O GAUSS não tem posições do veículo para a data escolhida.</Vazio>;
  return (
    <>
      <SecaoTitulo>
        Resumo de {diaBR(h.dia)} <span className="normal-case tracking-normal">· {FONTE[h.fonte]}</span>
      </SecaoTitulo>
      {h.aviso && <p className="px-4 pb-2 text-xs text-suave">{h.aviso}</p>}
      <div className="px-4 pb-3">
        <Link href={`/timeline/?v=${encodeURIComponent(h.id)}&dia=${h.dia}`} className="btn-pri h-8 px-3 text-[13px] hover:no-underline">
          <Icone nome="play" className="h-4 w-4" />
          Reproduzir trajetória na Timeline
        </Link>
      </div>
      <div className="px-4 pb-2">
        <Campos itens={itensResumo(h).map((i): [string, ReactNode] => [i.rotulo, <ValorResumo key={i.rotulo} item={i} />])} />
      </div>
      {h.resumo.areas.length > 0 && (
        <>
          <SecaoTitulo>Tempo por área</SecaoTitulo>
          <TempoPorArea areas={h.resumo.areas} />
        </>
      )}
      <SecaoTitulo
        acao={
          <Botao variante="secundaria" tamanho="mini" onClick={() => baixarTexto(nomeCsv(placa, h.dia), csvApontamento(h, placa))}>
            <Icone nome="baixar" className="h-4 w-4" />
            Exportar CSV
          </Botao>
        }
      >
        Apontamento ({h.trechos.length} trechos)
      </SecaoTitulo>
      <ListaTrechos trechos={h.trechos} sel={trechoSel} aoEscolher={focarTrecho} />
    </>
  );
}
```

- [ ] **Step 4: Gaveta de baixo do celular**

`src/components/folha.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { cx } from "./ui";

export type EstadoFolha = "fechada" | "meio" | "cheia";
const ORDEM: EstadoFolha[] = ["fechada", "meio", "cheia"];

/**
 * Gaveta de baixo do celular (o foco é o mapa): fechada mostra só o resumo; meio e cheia mostram a lista.
 * Arrasta pela alça ou pelo resumo; toque na alça alterna fechada/meio.
 */
export function Folha({ estado, mudar, resumo, children }: { estado: EstadoFolha; mudar: (e: EstadoFolha) => void; resumo: ReactNode; children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ y: number; h: number; t: number; moveu: boolean } | null>(null);
  const arrastou = useRef(false);
  const [medidas, setMedidas] = useState({ fechada: 96, max: 520 });
  const [altura, setAltura] = useState<number | null>(null);

  // a altura fechada acompanha o resumo; a cheia, o espaço do mapa
  useEffect(() => {
    const el = raiz.current;
    const t = topo.current;
    const pai = el?.parentElement;
    if (!el || !t || !pai) return;
    const obs = new ResizeObserver(() => setMedidas({ fechada: t.offsetHeight + 6, max: Math.max(260, pai.clientHeight - 6) }));
    obs.observe(t);
    obs.observe(pai);
    return () => obs.disconnect();
  }, []);

  const alturas: Record<EstadoFolha, number> = { fechada: medidas.fechada, meio: Math.round(medidas.max * 0.5), cheia: medidas.max };
  const alternar = () => mudar(estado === "fechada" ? "meio" : "fechada");

  const inicio = (e: EventoPonteiro<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, select, a")) return;
    arraste.current = { y: e.clientY, h: raiz.current?.getBoundingClientRect().height ?? alturas[estado], t: performance.now(), moveu: false };
  };
  const mover = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a) return;
    const dy = a.y - e.clientY;
    if (Math.abs(dy) > 6 && !a.moveu) {
      a.moveu = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (a.moveu) setAltura(Math.max(alturas.fechada - 20, Math.min(alturas.cheia, a.h + dy)));
  };
  const fim = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arraste.current;
    arraste.current = null;
    if (!a) return;
    if (!a.moveu) {
      // toque sem arrastar: só a alça alterna; nos botões o clique segue normal
      if ((e.target as HTMLElement).closest("[data-alca]")) alternar();
      return;
    }
    const h = a.h + (a.y - e.clientY);
    const vel = (a.y - e.clientY) / Math.max(1, performance.now() - a.t); // px/ms, + = para cima
    let alvo = ORDEM.reduce((m, k) => (Math.abs(alturas[k] - h) < Math.abs(alturas[m] - h) ? k : m), "fechada" as EstadoFolha);
    if (Math.abs(vel) > 0.5) alvo = ORDEM[Math.max(0, Math.min(2, ORDEM.indexOf(estado) + (vel > 0 ? 1 : -1)))];
    setAltura(null);
    mudar(alvo);
    // o clique que o navegador gera no fim do arraste não pode acionar botão
    arrastou.current = true;
    setTimeout(() => {
      arrastou.current = false;
    }, 80);
  };

  return (
    <div
      ref={raiz}
      style={{ height: altura ?? alturas[estado] }}
      className={cx(
        "absolute inset-x-0 bottom-0 z-[600] flex flex-col overflow-hidden rounded-t-2xl border-t border-borda bg-superficie shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)]",
        altura == null && "transition-[height] duration-200",
      )}
    >
      <div
        ref={topo}
        className="shrink-0 touch-none"
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerCancel={fim}
        onClickCapture={(e) => {
          if (!arrastou.current) return;
          e.stopPropagation();
          e.preventDefault();
          arrastou.current = false;
        }}
      >
        <div
          data-alca
          role="button"
          tabIndex={0}
          aria-label="Arrastar para ver mais ou menos da lista"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") alternar();
          }}
          className="flex justify-center py-2"
        >
          <span className="h-1.5 w-10 rounded-full bg-borda-2" />
        </div>
        {resumo}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}
```

- [ ] **Step 5: Camadas do mapa da frota**

`src/app/_localizacao/mapa-frota.ts`:

```ts
import type * as Leaflet from "leaflet";
import { iconeHtml, type L } from "@/components/mapa/leaflet";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { esc, htmlMarcador } from "@/lib/mapa/marcador";
import type { Cerca, LatLng, Veiculo } from "@/lib/tipos";

export interface Camadas {
  cercas: Leaflet.LayerGroup;
  hist: Leaflet.LayerGroup;
  cluster: Leaflet.MarkerClusterGroup;
  marcadores: Map<string, { m: Leaflet.Marker; chave: string }>;
}

/** Cercas, histórico e veículos (agrupados até o zoom 18), com o seletor de camadas. */
export function criarCamadas({ L, mapa, camadasBase }: MapaPronto): Camadas {
  const cercas = L.layerGroup().addTo(mapa);
  const hist = L.layerGroup().addTo(mapa);
  const cluster = L.markerClusterGroup({
    disableClusteringAtZoom: 18,
    maxClusterRadius: 45,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => L.divIcon({ html: `<div class="cl">${c.getChildCount()}</div>`, className: "", iconSize: [38, 38] }),
  }).addTo(mapa);
  L.control.layers(camadasBase, { Cercas: cercas, "Veículos": cluster, "Histórico": hist }).addTo(mapa);
  return { cercas, hist, cluster, marcadores: new Map() };
}

export function desenharCercas(L: L, camada: Leaflet.LayerGroup, cercas: Cerca[]) {
  camada.clearLayers();
  for (const c of cercas) {
    if (c.polygon.length < 3) continue;
    const planta = c.tipo === "planta";
    const via = c.tipo === "via";
    L.polygon(c.polygon, { color: c.color, weight: planta ? 2 : 1, dashArray: planta ? "6 4" : undefined, fillOpacity: planta ? 0 : via ? 0.12 : 0.22, interactive: !planta })
      .bindTooltip(esc(c.name), { sticky: true, className: "rotulo-cerca" })
      .addTo(camada);
  }
}

/** Cria/atualiza os marcadores sem recriar os que não mudaram (a lista ao vivo não pisca). */
export function sincronizarMarcadores(
  L: L,
  c: Camadas,
  veiculos: Veiculo[],
  visiveis: Set<string>,
  sel: string | null,
  comHistorico: boolean,
  semSinalMin: number,
  agora: number,
  aoClicar: (id: string) => void,
) {
  for (const v of veiculos) {
    if (!v.lat || !v.lng) continue;
    // com histórico aberto, só o selecionado fica no mapa; o selecionado aparece mesmo que o filtro o esconda
    const mostrar = (visiveis.has(v.id) || v.id === sel) && (!comHistorico || v.id === sel);
    const html = htmlMarcador(v, v.id === sel, semSinalMin, agora);
    const chave = `${v.lat},${v.lng}|${html}`;
    let reg = c.marcadores.get(v.id);
    if (!reg) {
      const m = L.marker([v.lat, v.lng], { icon: iconeHtml(L, html), riseOnHover: true });
      m.on("click", () => aoClicar(v.id));
      reg = { m, chave };
      c.marcadores.set(v.id, reg);
    } else if (reg.chave !== chave) {
      const moveu = !reg.m.getLatLng().equals([v.lat, v.lng]);
      if (moveu && c.cluster.hasLayer(reg.m)) {
        c.cluster.removeLayer(reg.m);
        reg.m.setLatLng([v.lat, v.lng]);
        c.cluster.addLayer(reg.m);
      } else if (moveu) reg.m.setLatLng([v.lat, v.lng]);
      reg.m.setIcon(iconeHtml(L, html));
      reg.chave = chave;
    }
    reg.m.setZIndexOffset(v.id === sel ? 1000 : 0);
    if (mostrar && !c.cluster.hasLayer(reg.m)) c.cluster.addLayer(reg.m);
    if (!mostrar && c.cluster.hasLayer(reg.m)) c.cluster.removeLayer(reg.m);
  }
}

/** Contorno amarelo piscando por 7 s na cerca achada pela busca. */
export function destacarCerca(L: L, mapa: Leaflet.Map, poligono: LatLng[]) {
  const d = L.polygon(poligono, { color: "#facc15", weight: 5, fill: false, className: "cerca-achada", interactive: false }).addTo(mapa);
  setTimeout(() => mapa.removeLayer(d), 7000);
}
```

- [ ] **Step 6: Painel (abas Veículos · Áreas · Eventos)**

`src/app/_localizacao/painel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Chip, Contador, Entrada, Ponto, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { GRUPOS, TODOS_GRUPOS, contarPorGrupo, filtrarEventos, grupoDoEvento, veiculoDoEvento, chaveEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { fmtMin, hora, idadeCurta, minutosDesde, rotuloDia } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, INDICADORES, agruparPorArea, categoria, frescor, motor2Ligado, nomeArea, resumoAreas, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, Veiculo } from "@/lib/tipos";

export type Aba = "veiculos" | "areas" | "eventos";

interface Props {
  aba: Aba;
  setAba: (a: Aba) => void;
  veiculos: Veiculo[];
  visiveis: Veiculo[];
  filtro: FiltroVeiculos;
  setFiltro: (f: FiltroVeiculos) => void;
  eventos: Evento[];
  dias: string[];
  diaEventos: string;
  setDiaEventos: (d: string) => void;
  semSinalMin: number;
  agora: number;
  abrir: (id: string) => void;
  escolherArea: (area: string) => void;
}

export function Painel(p: Props) {
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [buscaEv, setBuscaEv] = useState("");
  const nAreas = new Set(p.veiculos.map((v) => v.area).filter(Boolean)).size;
  const conta = contarPorGrupo(p.eventos);
  const dias = p.dias.includes(p.diaEventos) ? p.dias : [p.diaEventos, ...p.dias];
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <Segmentado
          rotulo="O que listar"
          valor={p.aba}
          mudar={p.setAba}
          opcoes={[
            { id: "veiculos", rotulo: <>Veículos <Contador n={p.visiveis.length} /></> },
            { id: "areas", rotulo: <>Áreas <Contador n={nAreas} /></> },
            { id: "eventos", rotulo: <>Eventos <Contador n={p.eventos.length} /></> },
          ]}
        />
        {p.aba === "veiculos" && (
          <>
            <Entrada type="search" value={p.filtro.busca} onChange={(e) => p.setFiltro({ ...p.filtro, busca: e.target.value })} placeholder="Buscar placa, vaga, área, motorista…" aria-label="Buscar veículo" autoComplete="off" className="w-full" />
            {(p.filtro.indicador || p.filtro.area) && (
              <div className="flex flex-wrap gap-1.5">
                {p.filtro.indicador && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, indicador: null })}>
                    {INDICADORES.find((i) => i.id === p.filtro.indicador)?.rotulo} ✕
                  </Chip>
                )}
                {p.filtro.area && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, area: null })}>
                    {nomeArea(p.filtro.area)} ✕
                  </Chip>
                )}
              </div>
            )}
          </>
        )}
        {p.aba === "eventos" && (
          <>
            <div className="flex gap-2">
              <Selecao value={p.diaEventos} onChange={(e) => p.setDiaEventos(e.target.value)} aria-label="Dia dos eventos" className="w-36">
                {dias.map((d) => (
                  <option key={d} value={d}>
                    {rotuloDia(d)}
                  </option>
                ))}
              </Selecao>
              <Entrada type="search" value={buscaEv} onChange={(e) => setBuscaEv(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar evento" autoComplete="off" className="flex-1" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TODOS_GRUPOS.map((g) => (
                <Chip key={g} ativo={grupos.has(g)} tom={GRUPOS[g].tom} onClick={() => alternarGrupo(g)}>
                  {GRUPOS[g].rotulo} <Contador n={conta[g]} />
                </Chip>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.aba === "veiculos" && <ListaVeiculos lista={p.visiveis} semSinalMin={p.semSinalMin} agora={p.agora} abrir={p.abrir} />}
        {p.aba === "areas" && <ListaAreas veiculos={p.veiculos} escolher={p.escolherArea} />}
        {p.aba === "eventos" && <ListaEventos eventos={filtrarEventos(p.eventos, grupos, buscaEv)} abrir={p.abrir} />}
      </div>
    </div>
  );
}

function ListaVeiculos({ lista, semSinalMin, agora, abrir }: { lista: Veiculo[]; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  if (!lista.length) return <Vazio titulo="Nenhum veículo">Ajuste a busca ou os filtros.</Vazio>;
  return (
    <>
      {agruparPorArea(lista).map((g) => (
        <section key={g.area || "fora"}>
          <h3 className="sticky top-0 z-10 flex items-center justify-between border-b border-borda bg-superficie-2 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave">
            <span className="truncate">{nomeArea(g.area)}</span>
            <Contador n={g.veiculos.length} />
          </h3>
          {g.veiculos.map((v) => (
            <ItemVeiculo key={v.id} v={v} semSinalMin={semSinalMin} agora={agora} abrir={abrir} />
          ))}
        </section>
      ))}
    </>
  );
}

function ItemVeiculo({ v, semSinalMin, agora, abrir }: { v: Veiculo; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const fr = frescor(v, semSinalMin, agora);
  const onde = v.area ? (v.area_desde ? `há ${fmtMin(minutosDesde(v.area_desde, agora))} na área` : "na área") : v.via || "fora de cerca";
  return (
    <button type="button" onClick={() => abrir(v.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-borda px-3.5 py-2.5 text-left hover:bg-superficie-2">
      <Ponto tom={CATEGORIAS[categoria(v)].tom} className="h-2.5 w-2.5" />
      <span className="truncate font-semibold">{v.placa}</span>
      <span className="flex items-center gap-1.5 text-xs tabular-nums text-suave" title={FRESCOR[fr].rotulo}>
        <Ponto tom={FRESCOR[fr].tom} className="h-1.5 w-1.5" />
        {idadeCurta(v.posicao_em, agora)}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {v.status} · {v.vaga || "sem vaga"}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {onde}
        {v.demora ? ` · ${v.demora}` : ""}
      </span>
      {v.motor2 && (
        <span className={cx("col-span-2 col-start-2 text-xs", motor2Ligado(v) ? "font-semibold text-motor2" : "text-suave")}>
          ⚙ Motor 2º: {v.motor2.status}
          {motor2Ligado(v) && v.motor2.status_desde ? ` há ${fmtMin(minutosDesde(v.motor2.status_desde, agora))}` : ""}
        </span>
      )}
    </button>
  );
}

function ListaAreas({ veiculos, escolher }: { veiculos: Veiculo[]; escolher: (area: string) => void }) {
  return (
    <>
      {resumoAreas(veiculos).map((a) => (
        <button key={a.area} type="button" onClick={() => escolher(a.area)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-borda px-3.5 py-2.5 text-left hover:bg-superficie-2">
          <span className="truncate font-semibold">{nomeArea(a.area)}</span>
          <b className="tabular-nums">{a.total}</b>
          <span className="col-span-2 flex h-1.5 overflow-hidden rounded-full bg-superficie-2">
            {a.porCategoria.map(([c, n]) => (
              <span key={c} title={`${CATEGORIAS[c].rotulo}: ${n}`} style={{ width: `${(n / a.total) * 100}%`, background: corDoTom(CATEGORIAS[c].tom) }} />
            ))}
          </span>
          <span className="col-span-2 text-xs text-suave">{a.porCategoria.map(([c, n]) => `${n} ${CATEGORIAS[c].rotulo.toLowerCase()}`).join(" · ")}</span>
        </button>
      ))}
    </>
  );
}

function ListaEventos({ eventos, abrir }: { eventos: Evento[]; abrir: (id: string) => void }) {
  if (!eventos.length) {
    return (
      <Vazio titulo="Nenhum evento">Eventos são gerados a partir de quando o monitoramento está rodando. Para o dia completo de um veículo, abra-o e use “Ver histórico”.</Vazio>
    );
  }
  return (
    <>
      {eventos.slice(0, 400).map((e) => (
        <button key={chaveEvento(e)} type="button" onClick={() => abrir(veiculoDoEvento(e))} className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-3.5 py-2.5 text-left text-[13px] hover:bg-superficie-2">
          <span className="mt-0.5 text-base leading-none" style={{ color: corDoTom(GRUPOS[grupoDoEvento(e)].tom) }} aria-hidden>
            {GRUPOS[grupoDoEvento(e)].icone}
          </span>
          <span className="min-w-0 leading-snug">
            <EventoTexto e={e} />
          </span>
          <span className="text-xs tabular-nums text-suave">{hora(e.t)}</span>
        </button>
      ))}
    </>
  );
}
```

- [ ] **Step 7: Detalhe do veículo**

`src/app/_localizacao/detalhe.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Andamento } from "@/components/historico/andamento";
import { HistoricoDia } from "@/components/historico/historico-dia";
import { Icone } from "@/components/icones";
import { Aviso, Botao, Campos, Entrada, Selo } from "@/components/ui";
import { pedirHistorico, type EtapaPedido } from "@/lib/dados/historico";
import { diaLocal, fmtMin, hora, horaSeg, idadeCurta, minutosDesde } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, categoria, frescor } from "@/lib/dominio/veiculo";
import type { Historico, Veiculo } from "@/lib/tipos";

interface Props {
  v: Veiculo;
  agora: number;
  semSinalMin: number;
  hist: Historico | null;
  aoCarregarHist: (h: Historico | null) => void;
  /** dia pedido pelo link #hist= (carrega ao abrir) */
  diaInicial: string | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
  voltar: () => void;
  centralizar: () => void;
}
type Busca = { etapa: EtapaPedido | "buscando"; desde: number } | null;

/** Detalhe do veículo no painel (use com key = id do veículo). */
export function Detalhe(p: Props) {
  const { v, agora, aoCarregarHist, diaInicial } = p;
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(diaInicial ?? hoje);
  const [busca, setBusca] = useState<Busca>(() => (diaInicial ? { etapa: "buscando", desde: 0 } : null));
  const [erro, setErro] = useState<string | null>(null);
  const controle = useRef<AbortController | null>(null);

  const buscar = useCallback(
    async (d: string, c: AbortController, desde: number) => {
      try {
        const h = await pedirHistorico(v.id, d, { sinal: c.signal, aoAndar: (etapa) => setBusca({ etapa, desde }) });
        if (!c.signal.aborted) aoCarregarHist(h);
      } catch (e) {
        if (!c.signal.aborted) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (controle.current === c) setBusca(null);
      }
    },
    [v.id, aoCarregarHist],
  );

  // link direto com #hist=: carrega ao abrir
  useEffect(() => {
    if (!diaInicial) return;
    const c = new AbortController();
    controle.current = c;
    void buscar(diaInicial, c, Date.now());
    return () => c.abort();
  }, [diaInicial, buscar]);
  // sair do detalhe cancela a espera
  useEffect(() => {
    const ref = controle;
    return () => ref.current?.abort();
  }, []);

  const verHistorico = () => {
    controle.current?.abort();
    const c = new AbortController();
    controle.current = c;
    const desde = Date.now();
    setErro(null);
    aoCarregarHist(null);
    setBusca({ etapa: "buscando", desde });
    void buscar(dia, c, desde);
  };

  const cat = categoria(v);
  const fr = frescor(v, p.semSinalMin, agora);
  const campos: [string, ReactNode][] = [
    ["Última posição", `${horaSeg(v.posicao_em)} (há ${idadeCurta(v.posicao_em, agora)})`],
    ["Status desde", v.status_desde ? `${hora(v.status_desde)} · ${fmtMin(minutosDesde(v.status_desde, agora))}` : "antes do início do monitoramento"],
    ["Área", v.area ? `${v.area}${v.area_desde ? ` · desde ${hora(v.area_desde)} (${fmtMin(minutosDesde(v.area_desde, agora))})` : ""}` : "Fora de área"],
    ["Via", v.via || "—"],
    ["Endereço", v.endereco || "—"],
    ...(v.motor2 ? ([["Motor secundário", `${v.motor2.status} · ${v.motor2.placa}${v.motor2.status_desde ? ` · desde ${hora(v.motor2.status_desde)}` : ""}`]] as [string, ReactNode][]) : []),
    ["Motorista", v.motorista || "Não identificado"],
    ["Demora", v.demora || "—"],
    ["Coordenadas", v.lat != null && v.lng != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}` : "—"],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <div className="flex items-center gap-2">
          <Botao variante="secundaria" tamanho="mini" onClick={p.voltar}>
            <Icone nome="voltar" className="h-4 w-4" />
            Voltar
          </Botao>
          <Botao variante="secundaria" tamanho="mini" onClick={p.centralizar}>
            <Icone nome="alvo" className="h-4 w-4" />
            Centralizar no mapa
          </Botao>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{v.placa}</span>
            <Selo tom={CATEGORIAS[cat].tom}>{v.status}</Selo>
            <Selo tom={FRESCOR[fr].tom}>{FRESCOR[fr].rotulo}</Selo>
          </div>
          <p className="text-[13px] text-suave">
            {v.vaga || "Sem vaga"}
            {v.grupo ? ` · ${v.grupo}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Entrada type="date" value={dia} max={hoje} onChange={(e) => setDia(e.target.value || hoje)} aria-label="Dia do histórico" className="flex-1" />
          <Botao onClick={verHistorico} disabled={!!busca}>
            Ver histórico
          </Botao>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <Campos itens={campos} />
        </div>
        {busca && <Andamento etapa={busca.etapa} desde={busca.desde} />}
        {erro && (
          <div className="px-4 pb-4">
            <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
          </div>
        )}
        {p.hist && <HistoricoDia h={p.hist} placa={v.placa} trechoSel={p.trechoSel} focarTrecho={p.focarTrecho} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Resumo da gaveta no celular**

`src/app/_localizacao/resumo-celular.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Icone } from "@/components/icones";
import { Chip, Ponto } from "@/components/ui";
import { diaLocal, idadeCurta } from "@/lib/dominio/formato";
import { CATEGORIAS, INDICADORES, categoria, motor2Ligado, noIndicador, nomeArea, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

interface Props {
  veiculos: Veiculo[];
  filtro: FiltroVeiculos;
  vSel: Veiculo | null;
  agora: number;
  semSinalMin: number;
  mudarFiltro: (f: FiltroVeiculos) => void;
  abrirFolha: () => void;
  fechar: () => void;
}

/** Gaveta fechada: números da frota tocáveis, ou o cartão do caminhão escolhido. */
export function ResumoCelular({ veiculos, filtro, vSel, agora, semSinalMin, mudarFiltro, abrirFolha, fechar }: Props) {
  if (vSel) {
    return (
      <div className="flex items-center gap-3 px-4 pb-3">
        <button type="button" onClick={abrirFolha} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Ponto tom={CATEGORIAS[categoria(vSel)].tom} className="h-3 w-3" />
          <span className="min-w-0 leading-snug">
            <b className="block text-base">{vSel.placa}</b>
            <span className="block truncate text-xs text-suave">
              {vSel.status}
              {motor2Ligado(vSel) ? " · ⚙ 2º ligado" : ""} · há {idadeCurta(vSel.posicao_em, agora)}
            </span>
            <span className="block truncate text-xs text-suave">{vSel.area || vSel.via || "fora de cerca"}</span>
          </span>
        </button>
        <Link href={`/timeline/?v=${encodeURIComponent(vSel.id)}&dia=${diaLocal()}`} aria-label={`Timeline de ${vSel.placa}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primaria text-white">
          <Icone nome="play" className="h-4 w-4" />
        </Link>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-borda">
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </div>
    );
  }
  const numeros = INDICADORES.map((i) => ({ i, total: veiculos.filter((v) => noIndicador(i.id, v, semSinalMin, agora)).length })).filter((x) => x.total);
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
      <button type="button" onClick={abrirFolha} className="shrink-0 rounded-full bg-primaria px-3 py-1 text-xs font-semibold text-white">
        <b>{veiculos.length}</b> veículos
      </button>
      {numeros.map(({ i, total }) => (
        <Chip key={i.id} ativo={filtro.indicador === i.id} tom={i.tom} onClick={() => mudarFiltro({ ...filtro, indicador: filtro.indicador === i.id ? null : i.id })}>
          <b>{total}</b> {i.curto}
        </Chip>
      ))}
      {filtro.area && (
        <Chip ativo tom="warn" onClick={() => mudarFiltro({ ...filtro, area: null })}>
          {nomeArea(filtro.area)} ✕
        </Chip>
      )}
    </div>
  );
}
```

- [ ] **Step 9: A tela**

`src/app/_localizacao/localizacao.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folha, type EstadoFolha } from "@/components/folha";
import { FaixaLeitura } from "@/components/indicador-vivo";
import { Legenda } from "@/components/mapa/legenda";
import { desenharRota } from "@/components/mapa/rota";
import { useMapa } from "@/components/mapa/use-mapa";
import { corDoTom } from "@/lib/cores";
import { lerCercas, lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { diaLocal } from "@/lib/dominio/formato";
import { CATEGORIAS, areaInicial, filtrarVeiculos, semMotor2, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import { useAgora, useCelular } from "@/lib/hooks";
import { pontosDoTrecho } from "@/lib/mapa/rota";
import { ouvirNavegacao } from "@/lib/navegacao";
import type { Cerca, Historico, LatLng } from "@/lib/tipos";
import { Detalhe } from "./detalhe";
import { criarCamadas, desenharCercas, destacarCerca, sincronizarMarcadores, type Camadas } from "./mapa-frota";
import { Painel, type Aba } from "./painel";
import { ResumoCelular } from "./resumo-celular";

const LEGENDA = [
  ...(["ligado", "parado", "desligado", "manut", "semcom"] as const).map((c) => ({ rotulo: CATEGORIAS[c].rotulo, cor: corDoTom(CATEGORIAS[c].tom) })),
  { rotulo: "Tracejado = sem sinal", cor: corDoTom("neu"), tracejado: true },
];

/** Localização: lista/áreas/eventos à esquerda e mapa ao vivo; no celular, o mapa com uma gaveta embaixo. */
export function Localizacao() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const celular = useCelular();
  const { ref, pronto } = useMapa(14);
  const camadas = useRef<Camadas | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [dias, setDias] = useState<string[]>([]);
  const [aba, setAba] = useState<Aba>("veiculos");
  const [filtro, setFiltro] = useState<FiltroVeiculos>({ indicador: null, busca: "", area: null });
  const [sel, setSel] = useState<string | null>(null);
  const [hist, setHist] = useState<Historico | null>(null);
  const [diaHist, setDiaHist] = useState<string | null>(null);
  const [trechoSel, setTrechoSel] = useState<{ i: number; vez: number } | null>(null);
  const [folha, setFolha] = useState<EstadoFolha>("fechada");
  const [diaEventos, setDiaEventos] = useState(() => diaLocal());
  const { eventos } = useEventos(diaEventos);

  const semSinalMin = retrato?.sem_sinal_min ?? 30;
  const veiculos = useMemo(() => semMotor2(retrato?.veiculos ?? []), [retrato]);
  const visiveis = useMemo(() => filtrarVeiculos(veiculos, filtro, semSinalMin, agora || undefined), [veiculos, filtro, semSinalMin, agora]);
  const poligonos = useMemo(() => {
    const p: Record<string, LatLng[]> = {};
    for (const c of cercas) if (c.tipo === "area" && !p[c.name]) p[c.name] = c.polygon;
    return p;
  }, [cercas]);
  const vSel = sel ? (veiculos.find((v) => v.id === sel) ?? null) : null;

  // cercas: leitura única por aba; tenta de novo quando chega a 1ª leitura do coletor
  const lido = retrato?.lido_em;
  useEffect(() => {
    if (!cercas.length) lerCercas().then(setCercas, () => undefined);
  }, [lido, cercas.length]);
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);

  const fechar = useCallback(() => {
    setSel(null);
    setHist(null);
    setTrechoSel(null);
    setDiaHist(null);
  }, []);
  const abrir = useCallback(
    (id: string, dia: string | null = null) => {
      if (id !== sel) {
        setHist(null);
        setTrechoSel(null);
      }
      setDiaHist(dia);
      setSel(id);
      const v = veiculos.find((x) => x.id === id);
      const m = pronto?.mapa;
      if (!m || v?.lat == null || v.lng == null) return;
      if (celular) {
        // zoom 18: acima do limite de agrupamento; centro deslocado para o caminhão ficar acima do cartão
        setFolha("fechada");
        const z = Math.max(m.getZoom(), 18);
        m.flyTo(m.unproject(m.project([v.lat, v.lng], z).add([0, 70]), z), z, { duration: 0.8 });
      } else m.flyTo([v.lat, v.lng], Math.max(m.getZoom(), 17));
    },
    [sel, veiculos, pronto, celular],
  );
  const focarCerca = useCallback(
    (nome: string) => {
      const c = cercas.find((x) => x.name === nome);
      if (!c || !pronto) return;
      fechar();
      destacarCerca(pronto.L, pronto.mapa, c.polygon);
      if (veiculos.some((v) => v.area === nome)) {
        setFiltro((f) => ({ ...f, area: nome }));
        setAba("veiculos");
      }
      if (celular) setFolha("fechada");
      pronto.mapa.fitBounds(pronto.L.latLngBounds(c.polygon), { paddingTopLeft: [20, 20], paddingBottomRight: [20, celular ? 160 : 20], maxZoom: 18 });
    },
    [cercas, pronto, veiculos, celular, fechar],
  );
  // marcadores, links e a busca chamam a versão mais recente
  const abrirRef = useRef(abrir);
  const focarCercaRef = useRef(focarCerca);
  useEffect(() => {
    abrirRef.current = abrir;
    focarCercaRef.current = focarCerca;
  });

  const escolherArea = (area: string) => {
    setFiltro((f) => ({ ...f, area }));
    setAba("veiculos");
    const p = poligonos[area];
    if (p && pronto) pronto.mapa.fitBounds(pronto.L.latLngBounds(p).pad(0.08));
  };
  const centralizar = () => {
    if (vSel?.lat != null && vSel.lng != null) pronto?.mapa.flyTo([vSel.lat, vSel.lng], 18);
  };
  const focarTrecho = useCallback((i: number) => setTrechoSel((t) => ({ i, vez: (t?.vez ?? 0) + 1 })), []);

  // camadas (uma vez)
  useEffect(() => {
    if (!pronto) return;
    camadas.current = criarCamadas(pronto);
    // no toque, a dica da cerca abre e não fecha mais (não há "mouse saindo"): some sozinha
    pronto.mapa.on("tooltipopen", (e) => {
      if (window.matchMedia("(max-width: 767px)").matches) setTimeout(() => pronto.mapa.closeTooltip(e.tooltip), 2500);
    });
  }, [pronto]);
  useEffect(() => {
    if (pronto && camadas.current) desenharCercas(pronto.L, camadas.current.cercas, cercas);
  }, [pronto, cercas]);
  useEffect(() => {
    if (!pronto || !camadas.current) return;
    sincronizarMarcadores(pronto.L, camadas.current, veiculos, new Set(visiveis.map((v) => v.id)), sel, !!hist, semSinalMin, agora || Date.now(), (id) => abrirRef.current(id));
  }, [pronto, veiculos, visiveis, sel, hist, semSinalMin, agora]);

  // zoom inicial (área com mais veículos) e links diretos #v=<id>[&hist=AAAA-MM-DD] e #cerca=<nome>
  const zoomFeito = useRef(false);
  useEffect(() => {
    if (!pronto || zoomFeito.current || !veiculos.length || !cercas.length) return;
    zoomFeito.current = true;
    const { L, mapa } = pronto;
    const area = areaInicial(veiculos, poligonos, semSinalMin);
    if (area) mapa.fitBounds(L.latLngBounds(poligonos[area]).pad(0.08));
    else {
      const pts = veiculos.flatMap((v): LatLng[] => (v.lat != null && v.lng != null ? [[v.lat, v.lng]] : []));
      if (pts.length) mapa.fitBounds(L.latLngBounds(pts).pad(0.1));
    }
    const h = new URLSearchParams(window.location.hash.slice(1));
    const v = h.get("v");
    const cerca = h.get("cerca");
    if (v && veiculos.some((x) => x.id === v)) abrirRef.current(v, h.get("hist"));
    else if (cerca) setTimeout(() => focarCercaRef.current(cerca), 400);
  }, [pronto, veiculos, cercas, poligonos, semSinalMin]);

  // busca Ctrl K e cartões: atende aqui mesmo, sem recarregar
  useEffect(
    () =>
      ouvirNavegacao((p) => {
        if (p.tipo === "veiculo") abrirRef.current(p.id);
        else focarCercaRef.current(p.nome);
        return true;
      }),
    [],
  );

  // histórico do dia no mapa
  useEffect(() => {
    const c = camadas.current;
    if (!pronto || !c) return;
    if (!hist) {
      c.hist.clearLayers();
      return;
    }
    const limites = desenharRota(pronto.L, c.hist, hist, focarTrecho);
    if (limites) pronto.mapa.fitBounds(limites.pad(0.05));
  }, [pronto, hist, focarTrecho]);
  useEffect(() => {
    if (!pronto || !hist || !trechoSel) return;
    const pts = pontosDoTrecho(hist, trechoSel.i);
    const t = hist.trechos[trechoSel.i];
    if (pts.length > 1) pronto.mapa.fitBounds(pronto.L.latLngBounds(pts).pad(0.2), { maxZoom: 18 });
    else if (t && t.estado !== "movimento" && t.lat != null && t.lng != null) pronto.mapa.flyTo([t.lat, t.lng], 18);
  }, [pronto, hist, trechoSel]);

  const conteudo = vSel ? (
    <Detalhe
      key={vSel.id}
      v={vSel}
      agora={agora}
      semSinalMin={semSinalMin}
      hist={hist}
      aoCarregarHist={setHist}
      diaInicial={diaHist}
      trechoSel={trechoSel?.i ?? null}
      focarTrecho={focarTrecho}
      voltar={fechar}
      centralizar={centralizar}
    />
  ) : (
    <Painel
      aba={aba}
      setAba={setAba}
      veiculos={veiculos}
      visiveis={visiveis}
      filtro={filtro}
      setFiltro={setFiltro}
      eventos={eventos}
      dias={dias}
      diaEventos={diaEventos}
      setDiaEventos={setDiaEventos}
      semSinalMin={semSinalMin}
      agora={agora}
      abrir={abrir}
      escolherArea={escolherArea}
    />
  );

  return (
    <div className="altura-tela flex flex-col">
      <FaixaLeitura />
      <div className="relative flex min-h-0 flex-1 md:gap-3 md:p-3">
        {!celular && <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-md">{conteudo}</aside>}
        <div
          className="relative min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md"
          onPointerDown={() => {
            // tocar no mapa = foco no mapa: recolhe a gaveta
            if (celular && folha !== "fechada") setFolha("fechada");
          }}
        >
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={LEGENDA} />
        </div>
        {celular && (
          <Folha
            estado={folha}
            mudar={setFolha}
            resumo={
              <ResumoCelular
                veiculos={veiculos}
                filtro={filtro}
                vSel={vSel}
                agora={agora}
                semSinalMin={semSinalMin}
                mudarFiltro={(f) => {
                  setFiltro(f);
                  setAba("veiculos");
                  setFolha("meio");
                }}
                abrirFolha={() => setFolha("meio")}
                fechar={() => {
                  fechar();
                  setFolha("fechada");
                }}
              />
            }
          >
            {conteudo}
          </Folha>
        )}
      </div>
    </div>
  );
}
```

`src/app/page.tsx` (substitui a provisória):

```tsx
import { Localizacao } from "./_localizacao/localizacao";

export default function Pagina() {
  return <Localizacao />;
}
```

`Localizacao` é client component ("use client" no arquivo dela); a página continua sendo gerada estática.

- [ ] **Step 10: Conferir**

Run: `npm test && npm run typecheck && npm run lint && npm run build`.

Compare http://localhost:3000 com o site antigo (http://localhost:5800), lado a lado:
- **Computador:** mapa com satélite, cercas e marcadores coloridos (agrupados longe, separados de perto); painel com abas Veículos/Áreas/Eventos e contadores; busca filtra; aba Áreas → clicar numa área filtra e enquadra; aba Eventos com dia e chips. Clicar num veículo (lista ou mapa) abre o detalhe e aproxima; "Ver histórico" para **ontem** de um veículo (um pedido no máximo) mostra o andamento e depois rota colorida, resumo, tempo por área, apontamento (clicar num trecho enquadra) e "Exportar CSV". `http://localhost:3000/#v=<id>` abre o veículo; `#cerca=<nome>` destaca a cerca. Ctrl K → escolher um veículo abre o detalhe sem recarregar.
- **Celular** (modo dispositivo do navegador, 390 × 844): mapa ocupa a tela; gaveta fechada com "N veículos" e números tocáveis; arrastar a alça abre meio/cheia; tocar no mapa recolhe; escolher veículo mostra o cartão (▶ leva à Timeline, ✕ fecha).

- [ ] **Step 11: Commit**

```bash
git add src
git commit -m "Tela de Localização: lista, áreas, eventos, detalhe com histórico do dia e gaveta no celular

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Tela da Timeline com o player

**Files:**
- Create: `src/lib/player.ts`, `src/components/historico/use-player.ts`, `src/components/historico/barra-tempo.tsx`, `src/app/timeline/_componentes/seletor-veiculo.tsx`, `src/app/timeline/_componentes/conteudo.tsx`, `src/app/timeline/_componentes/timeline.tsx`
- Modify: `src/lib/dominio/veiculo.ts` (acrescentar `resolverVeiculo`), `src/lib/dominio/veiculo.test.ts`, `src/app/timeline/page.tsx` (substituir)
- Test: `src/lib/player.test.ts`

**Interfaces:**
- Consumes: Tarefas 2 a 13 (`HistoricoDia` não; usa `ListaTrechos`, `TempoPorArea`, `Andamento`, `itensResumo`, `FONTE`, `csvApontamento`).
- Produces:
  - `resolverVeiculo(todos: Veiculo[], chave: string): Veiculo | null` (id ou placa; motor 2º → caminhão principal)
  - `player.ts`: `interface PontoPlayer`, `VELOCIDADES`, `prepararPontos`, `indiceEm`, `rumoEntre`, `posicaoEm`, `avancar`, `deslocamentoVizinho`, `trechoEm`, `fracao`
  - `usePlayer(pronto, h): Player` (usar com `key` do histórico)
  - Endereço: `/timeline/?v=<id ou placa>&dia=AAAA-MM-DD` abre e carrega.

- [ ] **Step 1: Testes**

Acrescente ao fim de `src/lib/dominio/veiculo.test.ts` (e `resolverVeiculo` ao import da primeira linha de imports de `./veiculo`):

```ts
describe("resolverVeiculo (links da Timeline)", () => {
  const todos = [v({ id: "10", placa: "EOF5208" }), v({ id: "11", placa: "EOF52082", motor2_de: "10" })];
  it("por id ou placa", () => {
    expect(resolverVeiculo(todos, "10")?.placa).toBe("EOF5208");
    expect(resolverVeiculo(todos, "EOF5208")?.id).toBe("10");
  });
  it("link antigo com o motor secundário abre o caminhão principal", () => {
    expect(resolverVeiculo(todos, "11")?.id).toBe("10");
    expect(resolverVeiculo(todos, "EOF52082")?.id).toBe("10");
  });
  it("veículo que não existe mais", () => {
    expect(resolverVeiculo(todos, "99")).toBeNull();
  });
});
```

`src/lib/player.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { segDe } from "./dominio/formato";
import { avancar, deslocamentoVizinho, indiceEm, posicaoEm, prepararPontos, rumoEntre, trechoEm } from "./player";
import type { Trecho } from "./tipos";

const pts = prepararPontos([
  [0, 0, "08:00:00", 0, "parado", null],
  [0, 0.001, "08:01:00", 30, "movimento", null],
  [0.001, 0.001, "08:02:00", 30, "movimento", 1],
  [0.001, 0.001, "08:30:00", 0, "parado", 0],
]);
const trecho = (estado: Trecho["estado"], ini: string, fim: string): Trecho =>
  estado === "movimento"
    ? { estado, inicio: `2026-10-01 ${ini}:00`, fim: `2026-10-01 ${fim}:00`, duracao_min: 0, de: "", para: "", percurso: [], km: 0, vel_max: 0 }
    : { estado, inicio: `2026-10-01 ${ini}:00`, fim: `2026-10-01 ${fim}:00`, duracao_min: 0, local: "" };
const trechos = [trecho("movimento", "08:01", "08:05"), trecho("parado", "08:05", "08:20"), trecho("movimento", "08:20", "08:30")];

describe("player", () => {
  it("acha o ponto do instante (busca binária)", () => {
    expect(indiceEm(pts, 0)).toBe(0);
    expect(indiceEm(pts, segDe("08:01:30"))).toBe(1);
    expect(indiceEm(pts, segDe("09:00"))).toBe(3);
  });
  it("interpola entre pontos próximos e mantém o rumo", () => {
    const p = posicaoEm(pts, segDe("08:01:30"), 0);
    expect(p.i).toBe(1);
    expect(p.lat).toBeCloseTo(0.0005);
    expect(p.lng).toBeCloseTo(0.001);
    expect(p.rumo).toBeCloseTo(0);
  });
  it("buraco de mais de 10 min não é interpolado (o caminhão não 'voa')", () => {
    const p = posicaoEm(pts, segDe("08:10:00"), 45);
    expect([p.i, p.lat, p.lng, p.rumo]).toEqual([2, 0.001, 0.001, 45]);
  });
  it("rumo: leste = 90°; parado = sem rumo", () => {
    expect(rumoEntre({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeCloseTo(90);
    expect(rumoEntre({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeNull();
  });
  it("avança o relógio: limite de 0,25 s por quadro, paradas 20x mais rápidas, para no fim", () => {
    expect(avancar(100, 1, 120, false, true, 1e6)).toBe(130);
    expect(avancar(100, 0.1, 120, true, true, 1e6)).toBe(340);
    expect(avancar(100, 0.1, 120, true, false, 1e6)).toBe(112);
    expect(avancar(100, 1, 120, false, true, 110)).toBe(110);
  });
  it("⏮/⏭ pulam para o início do deslocamento anterior/seguinte", () => {
    expect(deslocamentoVizinho(trechos, segDe("08:10"), 1)).toBe(segDe("08:20"));
    expect(deslocamentoVizinho(trechos, segDe("08:10"), -1)).toBe(segDe("08:01"));
    expect(deslocamentoVizinho(trechos, segDe("08:25"), 1)).toBeNull();
  });
  it("trecho em que o caminhão está", () => {
    expect(trechoEm(trechos, segDe("08:06"))).toBe(1);
    expect(trechoEm(trechos, segDe("07:00"))).toBe(-1);
  });
});
```

Run: `npx vitest run src/lib/player.test.ts src/lib/dominio/veiculo.test.ts` → FAIL.

- [ ] **Step 2: `resolverVeiculo` e `src/lib/player.ts`**

Acrescente ao fim de `src/lib/dominio/veiculo.ts`:

```ts
/** Veículo de um link (?v=<id ou placa>): o motor secundário abre o caminhão principal. */
export function resolverVeiculo(todos: Veiculo[], chave: string): Veiculo | null {
  const sec = todos.find((x) => x.motor2_de && (x.id === chave || x.placa === chave));
  const alvo = sec?.motor2_de ?? chave;
  return todos.find((x) => !x.motor2_de && (x.id === alvo || x.placa === alvo)) ?? null;
}
```

`src/lib/player.ts`:

```ts
// Reprodução da trajetória: tempo virtual em segundos do dia. A cada quadro avança (tempo real × velocidade),
// acha o ponto do GAUSS daquele instante (busca binária) e interpola até o próximo. Buraco > 10 min entre
// pontos não é interpolado: o caminhão fica parado no último ponto conhecido em vez de "voar" em linha reta.
import { segDe } from "./dominio/formato";
import type { EstadoTrecho, PontoMapa, Trecho } from "./tipos";

export interface PontoPlayer {
  lat: number;
  lng: number;
  /** segundos do dia */
  s: number;
  vel: number;
  estado: EstadoTrecho;
  m2: 0 | 1 | null;
}

export const VELOCIDADES: [number, string][] = [[10, "10x"], [30, "30x"], [60, "1 min/s"], [120, "2 min/s"], [300, "5 min/s"], [900, "15 min/s"]];
const BURACO_S = 600;

export const prepararPontos = (pontos: PontoMapa[]): PontoPlayer[] => pontos.map((p) => ({ lat: p[0], lng: p[1], s: segDe(p[2]), vel: p[3], estado: p[4], m2: p[5] }));

/** Índice do último ponto com horário <= s. */
export function indiceEm(pts: PontoPlayer[], s: number): number {
  if (s <= pts[0].s) return 0;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (pts[m].s <= s) lo = m;
    else hi = m - 1;
  }
  return lo;
}

/** Rumo em graus (0 = norte, 90 = leste); null se praticamente não se moveu. */
export function rumoEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number | null {
  const dy = b.lat - a.lat;
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  if (Math.abs(dy) + Math.abs(dx) < 2e-6) return null;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** Posição no instante s (com o rumo anterior mantido quando parado). */
export function posicaoEm(pts: PontoPlayer[], s: number, rumoAnterior: number) {
  const i = indiceEm(pts, s);
  const a = pts[i];
  const b = pts[i + 1];
  let lat = a.lat;
  let lng = a.lng;
  let rumo = rumoAnterior;
  if (b && b.s - a.s <= BURACO_S && s > a.s) {
    const f = Math.min(1, (s - a.s) / (b.s - a.s));
    lat = a.lat + (b.lat - a.lat) * f;
    lng = a.lng + (b.lng - a.lng) * f;
  }
  if (b && b.s - a.s <= BURACO_S) {
    const r = rumoEntre(a, b);
    if (r != null) rumo = r;
  }
  return { i, lat, lng, rumo, p: a };
}

/** Avança o relógio virtual (no máximo 0,25 s de tempo real por quadro); paradas 20x mais rápido se pedido. */
export function avancar(t: number, dtSeg: number, velocidade: number, parado: boolean, acelerarParadas: boolean, fim: number): number {
  return Math.min(fim, t + Math.min(0.25, dtSeg) * velocidade * (acelerarParadas && parado ? 20 : 1));
}

/** ⏮/⏭: início do deslocamento anterior/seguinte (sem assistir parada longa). */
export function deslocamentoVizinho(trechos: Trecho[], agora: number, direcao: 1 | -1): number | null {
  const inicios = trechos.filter((t) => t.estado === "movimento").map((t) => segDe(t.inicio.slice(11, 19)));
  const alvo = direcao > 0 ? inicios.find((s) => s > agora + 1) : [...inicios].reverse().find((s) => s < agora - 2);
  return alvo ?? null;
}

/** Índice do trecho em que o instante s cai (-1 fora do dia). */
export const trechoEm = (trechos: Trecho[], s: number) => trechos.findIndex((t) => s >= segDe(t.inicio.slice(11, 19)) && s < segDe(t.fim.slice(11, 19)));

/** Posição de 0 a 1 do instante t entre t0 e t1 (cursor da linha do tempo). */
export const fracao = (t: number, t0: number, t1: number) => (t - t0) / Math.max(t1 - t0, 1);
```

> Diferença do JS antigo: o rumo só é recalculado entre pontos próximos (o JS também calculava através de um buraco grande, girando o caminhão parado). O teste "buraco de mais de 10 min" fixa isso.

Run: `npx vitest run src/lib/player.test.ts src/lib/dominio/veiculo.test.ts` → PASS.

- [ ] **Step 3: Hook do player**

`src/components/historico/use-player.ts`:

```ts
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { corDoTom } from "@/lib/cores";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { avancar, deslocamentoVizinho, indiceEm, posicaoEm, prepararPontos, trechoEm, type PontoPlayer } from "@/lib/player";
import type { Historico } from "@/lib/tipos";
import { iconeHtml } from "../mapa/leaflet";
import type { MapaPronto } from "../mapa/use-mapa";

export interface Player {
  t: number;
  t0: number;
  t1: number;
  tocando: boolean;
  ponto: PontoPlayer | null;
  trecho: number;
  velocidade: number;
  acelerar: boolean;
  seguir: boolean;
  alternar: () => void;
  irPara: (s: number, centralizar?: boolean) => void;
  pular: (direcao: 1 | -1) => void;
  setVelocidade: (v: number) => void;
  setAcelerar: (v: boolean) => void;
  setSeguir: (v: boolean) => void;
}

/**
 * Caminhão andando sobre a rota do dia. Use com `key` do histórico: um histórico novo monta um player novo.
 * O marcador anda a cada quadro direto no Leaflet; a tela (cursor, horário) atualiza ~10x por segundo.
 */
export function usePlayer(pronto: MapaPronto | null, h: Historico): Player {
  const [pts] = useState(() => prepararPontos(h.pontos));
  const t0 = pts[0]?.s ?? 0;
  const t1 = pts.at(-1)?.s ?? 0;
  const [t, setT] = useState(t0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState(120);
  const [acelerar, setAcelerar] = useState(true);
  const [seguir, setSeguir] = useState(true);
  const m = useRef({
    t: t0, rumo: 0, idxPerc: -1, raf: 0, ultimoTs: 0, ultimoRender: 0, tocando: false,
    marcador: null as Leaflet.Marker | null, percorrido: null as Leaflet.Polyline | null,
    opcoes: { velocidade: 120, acelerar: true, seguir: true },
  });
  useEffect(() => {
    m.current.opcoes = { velocidade, acelerar, seguir };
  }, [velocidade, acelerar, seguir]);

  const desenhar = useCallback(
    (centralizar: boolean) => {
      const s = m.current;
      if (!pronto || !s.marcador || !s.percorrido || !pts.length) return;
      const pos = posicaoEm(pts, s.t, s.rumo);
      s.rumo = pos.rumo;
      s.marcador.setLatLng([pos.lat, pos.lng]);
      const el = s.marcador.getElement()?.querySelector<HTMLElement>(".mk-play");
      if (el) {
        el.style.setProperty("--c", corDoTom(ESTADOS_TRECHO[pos.p.estado].tom));
        const seta = el.querySelector<HTMLElement>(".seta-play");
        if (seta) seta.style.transform = `rotate(${pos.rumo}deg)`;
        const selo = el.querySelector(".m2");
        if (pos.p.m2 === 1 && !selo) el.insertAdjacentHTML("beforeend", '<span class="m2" title="Motor secundário ligado">⚙</span>');
        else if (pos.p.m2 !== 1 && selo) selo.remove();
      }
      // rastro já percorrido (branco tracejado por cima da rota)
      if (pos.i !== s.idxPerc) {
        s.idxPerc = pos.i;
        s.percorrido.setLatLngs([...pts.slice(0, pos.i + 1).map((p): [number, number] => [p.lat, p.lng]), [pos.lat, pos.lng]]);
      } else {
        const ll = s.percorrido.getLatLngs() as Leaflet.LatLng[];
        if (ll.length) {
          ll[ll.length - 1] = pronto.L.latLng(pos.lat, pos.lng);
          s.percorrido.setLatLngs(ll);
        }
      }
      const mapa = pronto.mapa;
      if (centralizar) mapa.setView([pos.lat, pos.lng], Math.max(mapa.getZoom(), 16));
      else if (s.tocando && s.opcoes.seguir && !mapa.getBounds().pad(-0.25).contains([pos.lat, pos.lng])) mapa.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    },
    [pronto, pts],
  );

  // marcador do caminhão e rastro
  useEffect(() => {
    if (!pronto || !pts.length) return;
    const { L, mapa } = pronto;
    const s = m.current;
    const camada = L.layerGroup().addTo(mapa);
    s.percorrido = L.polyline([], { color: "#ffffff", weight: 3, opacity: 0.95, dashArray: "2 7", lineCap: "round", interactive: false }).addTo(camada);
    s.marcador = L.marker([pts[0].lat, pts[0].lng], { icon: iconeHtml(L, '<div class="mk-play"><span class="seta-play">▲</span></div>'), zIndexOffset: 2000, interactive: false }).addTo(camada);
    s.idxPerc = -1;
    desenhar(false);
    return () => {
      s.tocando = false;
      cancelAnimationFrame(s.raf);
      camada.remove();
      s.marcador = null;
      s.percorrido = null;
    };
  }, [pronto, pts, desenhar]);

  const pausar = useCallback(() => {
    const s = m.current;
    s.tocando = false;
    cancelAnimationFrame(s.raf);
    setTocando(false);
  }, []);

  const tocar = useCallback(() => {
    const s = m.current;
    if (!pts.length || !pronto) return;
    if (s.t >= t1) s.t = t0;
    s.tocando = true;
    setTocando(true);
    // ▶ com o mapa afastado (rota do dia inteiro) ou fora da tela: aproxima no caminhão; daí ele acompanha
    const pos = posicaoEm(pts, s.t, s.rumo);
    if (!pronto.mapa.getBounds().contains([pos.lat, pos.lng]) || pronto.mapa.getZoom() < 15) pronto.mapa.setView([pos.lat, pos.lng], Math.max(pronto.mapa.getZoom(), 16));
    s.ultimoTs = performance.now();
    const passo = (ts: number) => {
      if (!s.tocando) return;
      const dt = (ts - s.ultimoTs) / 1000;
      s.ultimoTs = ts;
      const parado = pts[indiceEm(pts, s.t)].estado !== "movimento";
      s.t = avancar(s.t, dt, s.opcoes.velocidade, parado, s.opcoes.acelerar, t1);
      desenhar(false);
      const fim = s.t >= t1;
      if (fim || ts - s.ultimoRender > 100) {
        s.ultimoRender = ts;
        setT(s.t);
      }
      if (fim) {
        s.tocando = false;
        setTocando(false);
        return;
      }
      s.raf = requestAnimationFrame(passo);
    };
    s.raf = requestAnimationFrame(passo);
  }, [pts, pronto, t0, t1, desenhar]);

  const alternar = useCallback(() => {
    if (m.current.tocando) pausar();
    else tocar();
  }, [pausar, tocar]);

  const irPara = useCallback(
    (x: number, centralizar?: boolean) => {
      if (!pts.length) return;
      const s = m.current;
      s.t = Math.min(t1, Math.max(t0, x));
      desenhar(centralizar ?? !s.tocando);
      setT(s.t);
    },
    [pts, t0, t1, desenhar],
  );

  const pular = useCallback(
    (direcao: 1 | -1) => {
      const alvo = deslocamentoVizinho(h.trechos, m.current.t, direcao);
      if (alvo != null) irPara(alvo);
    },
    [h.trechos, irPara],
  );

  // espaço = play/pausa (fora de campos e botões)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.code === "Space" && pts.length && !(e.target as HTMLElement | null)?.closest?.("input, select, textarea, button")) {
        e.preventDefault();
        alternar();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [pts, alternar]);

  return {
    t, t0, t1, tocando,
    ponto: pts.length ? pts[indiceEm(pts, t)] : null,
    trecho: trechoEm(h.trechos, t),
    velocidade, acelerar, seguir, alternar, irPara, pular, setVelocidade, setAcelerar, setSeguir,
  };
}
```

- [ ] **Step 4: Linha do tempo e controles**

`src/components/historico/barra-tempo.tsx`:

```tsx
"use client";

import type { PointerEvent as EventoPonteiro } from "react";
import { corDoTom } from "@/lib/cores";
import { fmtHora, fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { VELOCIDADES, fracao } from "@/lib/player";
import type { Historico } from "@/lib/tipos";
import { Icone } from "../icones";
import { Botao, Selecao } from "../ui";
import type { Player } from "./use-player";

/** Linha do tempo colorida por estado (clicar/arrastar leva o caminhão ao horário) + faixa do motor 2º. */
export function BarraTempo({ h, player }: { h: Historico; player: Player }) {
  const { t0, t1 } = player;
  const total = Math.max(t1 - t0, 1);
  const ir = (e: EventoPonteiro<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    player.irPara(t0 + Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) * total);
  };
  const arrastar = {
    onPointerDown: (e: EventoPonteiro<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      ir(e);
    },
    onPointerMove: (e: EventoPonteiro<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) ir(e);
    },
  };
  return (
    <div>
      <div
        {...arrastar}
        role="slider"
        tabIndex={0}
        aria-label="Linha do tempo"
        aria-valuemin={t0}
        aria-valuemax={t1}
        aria-valuenow={Math.round(player.t)}
        aria-valuetext={fmtHora(player.t)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") player.irPara(player.t + 60);
          if (e.key === "ArrowLeft") player.irPara(player.t - 60);
        }}
        className="relative flex h-[22px] cursor-pointer touch-none overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10"
      >
        {h.trechos.map((tr, i) => {
          const a = segDe(tr.inicio.slice(11, 19));
          const b = segDe(tr.fim.slice(11, 19));
          return (
            <span
              key={i}
              title={`${ESTADOS_TRECHO[tr.estado].rotulo}: ${fmtMin(tr.duracao_min)}`}
              className="block h-full shrink-0"
              style={{ width: `${(Math.max(b - a, 60) / total) * 100}%`, minWidth: 2, background: corDoTom(ESTADOS_TRECHO[tr.estado].tom) }}
            />
          );
        })}
        <span aria-hidden className="pointer-events-none absolute -bottom-0.5 -top-0.5 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: `${fracao(player.t, t0, t1) * 100}%` }} />
      </div>
      {h.motor2 && (
        <>
          <div {...arrastar} className="relative mt-1 h-[7px] cursor-pointer touch-none rounded bg-superficie-2" title="Motor secundário ligado">
            {h.motor2.intervalos.map(([a, b]) => (
              <span key={a} className="absolute inset-y-0 rounded-sm bg-motor2" style={{ left: `${fracao(segDe(a), t0, t1) * 100}%`, width: `${Math.max(((segDe(b) - segDe(a)) / total) * 100, 0.3)}%` }} />
            ))}
          </div>
          <p className="mt-0.5 text-[10px] text-suave">⚙ motor secundário ligado{h.motor2.placa ? ` (${h.motor2.placa})` : ""}</p>
        </>
      )}
      {!h.motor2 && h.motor2_erro && <p className="mt-0.5 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-suave">
        <span>{h.resumo ? hhmm(h.resumo.primeiro) : ""}</span>
        <span>{h.resumo ? hhmm(h.resumo.ultimo) : ""}</span>
      </div>
    </div>
  );
}

/** ⏮ ▶ ⏭, velocidade, acelerar paradas e seguir o caminhão. */
export function ControlesPlayer({ player }: { player: Player }) {
  const pequeno = "grid h-8 w-8 place-items-center rounded-lg border border-borda bg-superficie text-suave hover:text-texto";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={pequeno} onClick={() => player.pular(-1)} aria-label="Deslocamento anterior" title="Deslocamento anterior">
        <Icone nome="anterior" className="h-4 w-4" />
      </button>
      <Botao tamanho="mini" onClick={player.alternar} title="Espaço">
        <Icone nome={player.tocando ? "pausa" : "play"} className="h-4 w-4" />
        {player.tocando ? "Pausar" : "Reproduzir"}
      </Botao>
      <button type="button" className={pequeno} onClick={() => player.pular(1)} aria-label="Próximo deslocamento" title="Próximo deslocamento">
        <Icone nome="proximo" className="h-4 w-4" />
      </button>
      <Selecao value={player.velocidade} onChange={(e) => player.setVelocidade(Number(e.target.value))} aria-label="Velocidade" className="h-8 w-28 text-[13px]">
        {VELOCIDADES.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </Selecao>
      <label className="flex items-center gap-1.5 text-xs text-suave" title="Paradas passam 20x mais rápido">
        <input type="checkbox" checked={player.acelerar} onChange={(e) => player.setAcelerar(e.target.checked)} /> Acelerar paradas
      </label>
      <label className="flex items-center gap-1.5 text-xs text-suave">
        <input type="checkbox" checked={player.seguir} onChange={(e) => player.setSeguir(e.target.checked)} /> Seguir caminhão
      </label>
    </div>
  );
}

/** "08:42:10 · Em deslocamento · 32 km/h · ⚙ motor 2º ligado" */
export function InfoPlayer({ player }: { player: Player }) {
  const p = player.ponto;
  if (!p) return null;
  return (
    <p className="text-xs tabular-nums">
      <b>{fmtHora(player.t)}</b> · {ESTADOS_TRECHO[p.estado].rotulo}
      {p.estado === "movimento" ? ` · ${p.vel} km/h` : ""}
      {p.m2 === 1 && <span className="font-semibold text-motor2"> · ⚙ motor 2º ligado</span>}
      {p.m2 === 0 && " · motor 2º desligado"}
    </p>
  );
}
```

- [ ] **Step 5: Seletor de veículo**

`src/app/timeline/_componentes/seletor-veiculo.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Entrada, Ponto, cx } from "@/components/ui";
import { CATEGORIAS, categoria } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

/** Campo de busca com lista de veículos (placa, vaga ou motorista). */
export function SeletorVeiculo({ veiculos, escolhido, escolher, paraCima = false }: { veiculos: Veiculo[]; escolhido: Veiculo | null; escolher: (v: Veiculo) => void; paraCima?: boolean }) {
  const [texto, setTexto] = useState<string | null>(null); // null = mostra a placa escolhida
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const q = (texto ?? "").trim().toUpperCase();
  const lista = q ? veiculos.filter((v) => [v.placa, v.vaga, v.motorista].join(" ").toUpperCase().includes(q)) : veiculos.slice(0, 30);
  return (
    <div ref={caixa} className="relative min-w-0 flex-1">
      <Entrada
        type="search"
        value={texto ?? escolhido?.placa ?? ""}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        placeholder="Placa, vaga ou motorista…"
        aria-label="Veículo"
        autoComplete="off"
        className="w-full"
      />
      {aberto && (
        <div role="listbox" className={cx("absolute inset-x-0 z-[1200] max-h-72 overflow-y-auto rounded-xl border border-borda bg-superficie p-1 shadow-xl", paraCima ? "bottom-full mb-1" : "top-full mt-1")}>
          {lista.length ? (
            lista.map((v) => (
              <button
                key={v.id}
                type="button"
                role="option"
                aria-selected={v.id === escolhido?.id}
                onClick={() => {
                  escolher(v);
                  setTexto(null);
                  setAberto(false);
                }}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-superficie-2"
              >
                <Ponto tom={CATEGORIAS[categoria(v)].tom} />
                <span className="font-semibold">
                  {v.placa}
                  {v.motor2 && (
                    <span className="ml-1 text-motor2" title="tem motor secundário">
                      ⚙
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-suave">{v.vaga}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-suave">Nenhum veículo encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Conteúdo do histórico (painel no computador, player flutuante no celular)**

`src/app/timeline/_componentes/conteudo.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BarraTempo, ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { TempoPorArea } from "@/components/historico/tempo-area";
import { ListaTrechos } from "@/components/historico/trechos";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Aviso, Botao, SecaoTitulo, cx } from "@/components/ui";
import { baixarTexto } from "@/lib/arquivo";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";

interface Props {
  h: Historico;
  placa: string;
  vaga: string;
  pronto: MapaPronto | null;
  celular: boolean;
  /** camada sobre o mapa (para o horário do player e, no celular, o player inteiro) */
  sobreMapa: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
}

/** Histórico carregado (use com key do histórico). */
export function ConteudoHistorico({ h, placa, vaga, pronto, celular, sobreMapa, trechoSel, focarTrecho }: Props) {
  const player = usePlayer(pronto, h);
  const { trecho, tocando } = player;
  // destaca no apontamento o trecho em que o caminhão está
  useEffect(() => {
    if (tocando && trecho >= 0) document.querySelector(`[data-trecho="${trecho}"]`)?.scrollIntoView({ block: "nearest" });
  }, [trecho, tocando]);
  const escolher = (i: number) => {
    focarTrecho(i);
    player.irPara(segDe(h.trechos[i].inicio.slice(11, 19)), false);
  };
  const andou = tocando || player.t > player.t0 || trechoSel != null;

  const horario = andou && player.ponto && (
    <div className="absolute left-1/2 top-2.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#0b1220]/90 px-3.5 py-1.5 text-[13px] tabular-nums text-white shadow-md">
      <b className="mr-2 text-lg">{fmtHora(player.t)}</b>
      {placa} · {ESTADOS_TRECHO[player.ponto.estado].rotulo}
      {player.ponto.estado === "movimento" ? ` · ${player.ponto.vel} km/h` : ""}
      {player.ponto.m2 === 1 ? " · ⚙ 2º ligado" : ""}
    </div>
  );

  if (celular) {
    return sobreMapa
      ? createPortal(
          <>
            {horario}
            <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-borda bg-superficie/95 p-3 shadow-xl">
              <InfoPlayer player={player} />
              <div className="my-2">
                <BarraTempo h={h} player={player} />
              </div>
              <ControlesPlayer player={player} />
            </div>
          </>,
          sobreMapa,
        )
      : null;
  }

  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      <div className="border-b border-borda px-4 py-3">
        <p className="text-lg font-semibold">{placa}</p>
        <p className="text-[13px] text-suave">
          {vaga || "Sem vaga"} · {diaBR(h.dia)} · {FONTE[h.fonte]}
        </p>
        {h.aviso && <p className="mt-1 text-xs text-suave">{h.aviso}</p>}
      </div>
      {h.rpm_travado != null && (
        <div className="px-4 pt-3">
          <Aviso tipo="alerta">RPM do rastreador travado em {h.rpm_travado} o dia todo: não dá para afirmar motor ligado/desligado, as paradas aparecem só como “Parado”.</Aviso>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-px border-y border-borda bg-borda">
        {itensResumo(h)
          .filter((i) => i.rotulo !== "Período")
          .map((i) => (
            <div key={i.rotulo} className="bg-superficie px-4 py-2.5">
              <p className={cx("text-base font-semibold tabular-nums", i.motor2 && "text-motor2")}>{i.valor}</p>
              <p className="text-[11px] text-suave">{i.rotulo}</p>
            </div>
          ))}
      </div>
      <div className="space-y-2 border-b border-borda px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-suave">Linha do tempo · clique para ir ao horário</p>
        <BarraTempo h={h} player={player} />
        <ControlesPlayer player={player} />
        <InfoPlayer player={player} />
      </div>
      {!!h.resumo?.areas.length && (
        <>
          <SecaoTitulo>Tempo por área</SecaoTitulo>
          <TempoPorArea areas={h.resumo.areas} />
        </>
      )}
      <SecaoTitulo
        acao={
          <Botao variante="secundaria" tamanho="mini" onClick={() => baixarTexto(nomeCsv(placa, h.dia), csvApontamento(h, placa))}>
            <Icone nome="baixar" className="h-4 w-4" />
            Exportar CSV
          </Botao>
        }
      >
        Apontamento ({h.trechos.length} trechos)
      </SecaoTitulo>
      <ListaTrechos trechos={h.trechos} sel={andou && trecho >= 0 ? trecho : null} aoEscolher={escolher} />
    </>
  );
}
```

- [ ] **Step 7: A tela**

`src/app/timeline/_componentes/timeline.tsx`:

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Andamento } from "@/components/historico/andamento";
import { Icone } from "@/components/icones";
import { Legenda } from "@/components/mapa/legenda";
import { desenharRota } from "@/components/mapa/rota";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Botao, Selecao, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { pedirHistorico, type EtapaPedido } from "@/lib/dados/historico";
import { useRetrato } from "@/lib/dados/use-retrato";
import { diaBR, diaLocal, fmtMin, hhmm, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO, resolverVeiculo, semMotor2 } from "@/lib/dominio/veiculo";
import { useCelular } from "@/lib/hooks";
import { pontosDoTrecho } from "@/lib/mapa/rota";
import type { EstadoTrecho, Historico } from "@/lib/tipos";
import { ConteudoHistorico } from "./conteudo";
import { SeletorVeiculo } from "./seletor-veiculo";

const LEGENDA = (Object.keys(ESTADOS_TRECHO) as EstadoTrecho[]).map((e) => ({ rotulo: ESTADOS_TRECHO[e].rotulo, cor: corDoTom(ESTADOS_TRECHO[e].tom) }));
type Carga = { etapa: EtapaPedido | "buscando"; desde: number } | null;

/** Timeline: trajeto de um veículo num dia, com player. Endereço: /timeline/?v=<id ou placa>&dia=AAAA-MM-DD */
export function Timeline() {
  const params = useSearchParams();
  const { retrato } = useRetrato();
  const celular = useCelular();
  const { ref, pronto } = useMapa(13);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [sobreMapa, setSobreMapa] = useState<HTMLDivElement | null>(null);
  const [hoje] = useState(() => diaLocal());
  const [chave, setChave] = useState<string | null>(() => params.get("v"));
  const [dia, setDia] = useState(() => params.get("dia") || hoje);
  const [pedido, setPedido] = useState<{ chave: string; dia: string; n: number } | null>(() => {
    const v = params.get("v");
    return v ? { chave: v, dia: params.get("dia") || hoje, n: 0 } : null;
  });
  const [carga, setCarga] = useState<Carga>(() => (params.get("v") ? { etapa: "buscando", desde: 0 } : null));
  const [hist, setHist] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trechoSel, setTrechoSel] = useState<{ i: number; vez: number } | null>(null);
  // celular: opções (veículo e dia) abertas quando não veio veículo no endereço
  const [opcoes, setOpcoes] = useState(() => !params.get("v"));

  const todos = retrato?.veiculos;
  const lista = useMemo(() => semMotor2(todos ?? []).sort((a, b) => a.placa.localeCompare(b.placa)), [todos]);
  const escolhido = useMemo(() => (chave && todos ? resolverVeiculo(todos, chave) : null), [chave, todos]);
  const alvo = useMemo(() => (pedido && todos ? resolverVeiculo(todos, pedido.chave) : null), [pedido, todos]);
  const alvoId = alvo?.id ?? null;
  // a rota do GAUSS existe para qualquer dia: oferece os últimos 30
  const dias = useMemo(() => {
    const d = ultimosDias(30);
    return d.includes(dia) ? d : [dia, ...d];
  }, [dia]);

  // pede o histórico (o coletor atende se o dia ainda não está no banco)
  useEffect(() => {
    if (!pedido || !alvoId) return;
    const c = new AbortController();
    const desde = Date.now();
    pedirHistorico(alvoId, pedido.dia, { sinal: c.signal, aoAndar: (etapa) => setCarga({ etapa, desde }) }).then(
      (h) => {
        if (c.signal.aborted) return;
        setHist(h);
        setCarga(null);
      },
      (e: unknown) => {
        if (c.signal.aborted) return;
        setErro(e instanceof Error ? e.message : String(e));
        setCarga(null);
      },
    );
    return () => c.abort();
  }, [pedido, alvoId]);

  const ver = () => {
    if (!escolhido) return;
    setHist(null);
    setErro(null);
    setTrechoSel(null);
    setOpcoes(false);
    setCarga({ etapa: "buscando", desde: Date.now() });
    setPedido((p) => ({ chave: escolhido.id, dia, n: (p?.n ?? 0) + 1 }));
  };
  const focarTrecho = useCallback((i: number) => setTrechoSel((t) => ({ i, vez: (t?.vez ?? 0) + 1 })), []);

  useEffect(() => {
    if (!pronto) return;
    camada.current = pronto.L.layerGroup().addTo(pronto.mapa);
    pronto.L.control.layers(pronto.camadasBase).addTo(pronto.mapa);
  }, [pronto]);
  useEffect(() => {
    if (!pronto || !camada.current) return;
    if (!hist) {
      camada.current.clearLayers();
      return;
    }
    const limites = desenharRota(pronto.L, camada.current, hist, focarTrecho);
    if (limites) pronto.mapa.fitBounds(limites.pad(0.06));
  }, [pronto, hist, focarTrecho]);
  useEffect(() => {
    if (!pronto || !hist || !trechoSel) return;
    const pts = pontosDoTrecho(hist, trechoSel.i);
    const t = hist.trechos[trechoSel.i];
    if (pts.length > 1) pronto.mapa.fitBounds(pronto.L.latLngBounds(pts).pad(0.2), { maxZoom: 18 });
    else if (t && t.estado !== "movimento" && t.lat != null && t.lng != null) pronto.mapa.flyTo([t.lat, t.lng], 17);
  }, [pronto, hist, trechoSel]);

  const naoAchado = !!pedido && !!todos && !alvo;
  const placa = alvo?.placa ?? hist?.id ?? "";
  const situacao = naoAchado ? (
    <Vazio titulo="Veículo não encontrado">O endereço aponta para um veículo que não está mais na frota.</Vazio>
  ) : carga ? (
    <Andamento etapa={carga.etapa} desde={carga.desde} />
  ) : erro ? (
    <div className="p-4">
      <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
    </div>
  ) : !hist ? (
    <Vazio titulo="Selecione um veículo">Escolha a placa e o dia para ver a rota e o apontamento completo.</Vazio>
  ) : !hist.trechos.length ? (
    <Vazio titulo="Sem dados neste dia">
      O GAUSS não tem posições para {placa} em {diaBR(hist.dia)}.
    </Vazio>
  ) : null;

  const formulario = (
    <div className="space-y-2.5 p-3">
      <div className="flex gap-2">
        <SeletorVeiculo veiculos={lista} escolhido={escolhido} escolher={(v) => setChave(v.id)} paraCima={celular} />
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-32">
          {dias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
      </div>
      <Botao onClick={ver} disabled={!escolhido || !!carga} className="w-full">
        Ver timeline
      </Botao>
    </div>
  );
  const conteudo =
    hist && hist.trechos.length > 0 && !carga ? (
      <ConteudoHistorico
        key={`${hist.id}|${hist.dia}|${hist.baixado_em}`}
        h={hist}
        placa={placa}
        vaga={alvo?.vaga ?? ""}
        pronto={pronto}
        celular={celular}
        sobreMapa={sobreMapa}
        trechoSel={trechoSel?.i ?? null}
        focarTrecho={focarTrecho}
      />
    ) : null;
  const tSel = hist && trechoSel ? hist.trechos[trechoSel.i] : null;

  return (
    <div className="altura-tela relative flex md:gap-3 md:p-3">
      {!celular && (
        <section aria-label="Seleção e timeline do veículo" className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-md">
          <div className="border-b border-borda">{formulario}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {situacao}
            {conteudo}
          </div>
        </section>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md" onPointerDown={() => setOpcoes(false)}>
        <div ref={ref} className="absolute inset-0" />
        <Legenda itens={LEGENDA} />
        <div ref={setSobreMapa} className="pointer-events-none absolute inset-0 z-[500] [&>*]:pointer-events-auto" />
        {!celular && tSel && (
          <div className="absolute bottom-6 right-3 z-[500] w-64 rounded-xl border border-borda bg-superficie/95 p-3 text-[13px] shadow-lg">
            <p className="font-semibold">{placa}</p>
            <p>
              <b>{ESTADOS_TRECHO[tSel.estado].rotulo}</b>
            </p>
            <p>
              {hhmm(tSel.inicio)} – {hhmm(tSel.fim)} · <b>{fmtMin(tSel.duracao_min)}</b>
            </p>
            {tSel.estado === "movimento" ? (
              <p>
                {tSel.km} km · máx {tSel.vel_max} km/h
              </p>
            ) : (
              tSel.local && <p className="mt-1 text-suave">{tSel.local}</p>
            )}
          </div>
        )}
        {celular && (
          <button
            type="button"
            onClick={() => setOpcoes(true)}
            className="absolute left-1/2 top-2.5 z-[600] flex max-w-[calc(100%-110px)] -translate-x-1/2 items-center gap-2 rounded-full border border-borda bg-superficie/95 px-3.5 py-2 text-[13px] shadow-md"
          >
            <span className="truncate">{escolhido ? <><b>{escolhido.placa}</b> · {rotuloDia(dia, hoje)}</> : "Escolher veículo"}</span>
            <Icone nome="opcoes" className="h-4 w-4 text-suave" />
          </button>
        )}
        {celular && situacao && (
          <div className="absolute inset-x-2 bottom-2 z-[600] rounded-2xl border border-borda bg-superficie/95 shadow-xl">
            {situacao}
            {!carga && (
              <div className="px-3 pb-3">
                <Botao variante="secundaria" className="w-full" onClick={() => setOpcoes(true)}>
                  Escolher veículo e dia
                </Botao>
              </div>
            )}
          </div>
        )}
        {celular && conteudo}
      </div>
      {celular && opcoes && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-label="Veículo e dia">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={() => setOpcoes(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-3">
              <b>Veículo e dia</b>
              <button type="button" aria-label="Fechar" onClick={() => setOpcoes(false)} className="grid h-9 w-9 place-items-center rounded-lg text-suave">
                <Icone nome="fechar" className="h-4 w-4" />
              </button>
            </div>
            {formulario}
            <p className="px-4 pb-4 text-xs text-suave">No celular o foco é o mapa. Resumo completo, tempo por área e CSV ficam no computador.</p>
          </div>
        </div>
      )}
    </div>
  );
}
```

`src/app/timeline/page.tsx` (substitui a provisória):

```tsx
import { Suspense } from "react";
import { Timeline } from "./_componentes/timeline";

// useSearchParams num site estático precisa de Suspense: os parâmetros são lidos no navegador
export default function Pagina() {
  return (
    <Suspense>
      <Timeline />
    </Suspense>
  );
}
```

- [ ] **Step 8: Conferir**

Run: `npm test && npm run typecheck && npm run lint && npm run build`.

No http://localhost:3000/timeline/ (compare com http://localhost:5800/timeline.html):
- **Computador:** escolher veículo e "Ontem" → "Ver timeline" (um pedido, se o dia não estiver no banco) → rota colorida, números do dia, linha do tempo; ▶ anda com o caminhão (seta gira, rastro branco, horário em cima do mapa), espaço pausa, arrastar a linha do tempo move o caminhão, ⏮/⏭ pulam deslocamentos, "Acelerar paradas" e "Seguir caminhão" funcionam; clicar num trecho enquadra e mostra o cartão do trecho; CSV baixa.
- `/timeline/?v=<id do motor secundário>&dia=<ontem>` abre o caminhão principal.
- **Celular:** mapa em tela cheia, pílula "PLACA · dia" em cima, player embaixo (horário, linha do tempo, ⏮ ▶ ⏭, velocidade); "Escolher veículo e dia" abre as opções por baixo.

- [ ] **Step 9: Commit**

```bash
git add src
git commit -m "Tela da Timeline com player (seta, rastro, velocidades, pular deslocamentos) e versão de celular

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Tela de Alertas

**Files:**
- Create: `src/app/alertas/_componentes/alertas.tsx`
- Modify: `src/app/alertas/page.tsx` (substituir)

**Interfaces:**
- Consumes: `useEventos`, `lerDias` (T9); `filtrarEventos`, `contarPorGrupo`, `agruparPorHora`, `GRUPOS`, `TODOS_GRUPOS`, `ROTULO_TIPO`, `chaveEvento`, `veiculoDoEvento`, `grupoDoEvento` (T3); `Gaveta`, `Campos`, `Chip`, `Selo` (T10); `EventoTexto` (T13).
- Produces: `/alertas/` e `/alertas/?placa=ABC1234` (já filtrado).

- [ ] **Step 1: Escrever a tela**

`src/app/alertas/_componentes/alertas.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Campos, Chip, Contador, Entrada, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { CLASSE_TOM, corDoTom } from "@/lib/cores";
import { lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { GRUPOS, ROTULO_TIPO, TODOS_GRUPOS, agruparPorHora, chaveEvento, contarPorGrupo, filtrarEventos, grupoDoEvento, veiculoDoEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { dataHora, diaLocal, fmtMin, hora, horaSeg, rotuloDia } from "@/lib/dominio/formato";
import { useCelular } from "@/lib/hooks";
import type { Evento } from "@/lib/tipos";

/** Alertas: entradas/saídas de área, mudanças de status e perda/volta de sinal, por dia. */
export function Alertas() {
  const params = useSearchParams();
  const celular = useCelular();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [dias, setDias] = useState<string[]>([]);
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);
  const { eventos, carregando, erro } = useEventos(dia);
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [busca, setBusca] = useState(() => (params.get("placa") ?? "").toUpperCase());
  const [lidos, setLidos] = useState<Set<string>>(() => new Set());
  const [aberto, setAberto] = useState<Evento | null>(null);

  const conta = contarPorGrupo(eventos);
  const lista = useMemo(() => filtrarEventos(eventos, grupos, busca), [eventos, grupos, busca]);
  const blocos = useMemo(() => agruparPorHora(lista), [lista]);
  const todos = grupos.size === TODOS_GRUPOS.length;
  const opcoesDias = dias.includes(dia) ? dias : [dia, ...dias];

  // indicador: só aquele grupo; clicar de novo (ou em Total) volta a mostrar todos
  const indicador = (id: GrupoEvento | "todos") => {
    if (id === "todos") setGrupos(new Set(TODOS_GRUPOS));
    else setGrupos(todos || !grupos.has(id) ? new Set([id]) : new Set(TODOS_GRUPOS));
  };
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n.size ? n : new Set(TODOS_GRUPOS));
  };
  const abrir = (e: Evento) => {
    setLidos((l) => new Set(l).add(chaveEvento(e)));
    setAberto(e);
  };

  const cartoes: { id: GrupoEvento | "todos"; rotulo: string; n: number; cor: string; ativo: boolean }[] = [
    { id: "todos", rotulo: "Total", n: eventos.length, cor: "var(--primaria)", ativo: todos },
    ...TODOS_GRUPOS.map((g) => ({ id: g, rotulo: GRUPOS[g].rotulo, n: conta[g], cor: corDoTom(GRUPOS[g].tom), ativo: !todos && grupos.size === 1 && grupos.has(g) })),
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        {cartoes.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.ativo}
            onClick={() => indicador(c.id)}
            className={cx("rounded-xl border bg-superficie px-4 py-3 text-left shadow-sm transition hover:shadow-md", c.ativo ? "border-primaria ring-2 ring-[var(--anel)]" : "border-borda")}
          >
            <span className="block text-2xl font-semibold tabular-nums" style={{ color: c.cor }}>
              {c.n}
            </span>
            <span className="text-xs text-suave">{c.rotulo}</span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
          <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36">
            {opcoesDias.map((d) => (
              <option key={d} value={d}>
                {rotuloDia(d, hoje)}
              </option>
            ))}
          </Selecao>
          <Entrada type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar alerta" autoComplete="off" className="min-w-40 flex-1" />
          <div className="flex flex-wrap gap-1.5">
            {TODOS_GRUPOS.map((g) => (
              <Chip key={g} ativo={grupos.has(g)} tom={GRUPOS[g].tom} onClick={() => alternarGrupo(g)}>
                {GRUPOS[g].rotulo} <Contador n={conta[g]} />
              </Chip>
            ))}
          </div>
          <span className="ml-auto text-xs text-suave">
            {eventos.length} eventos · {rotuloDia(dia, hoje).toLowerCase()}
          </span>
        </div>
        {erro && (
          <div className="p-3">
            <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
          </div>
        )}
        {carregando ? (
          <Vazio titulo="Carregando alertas…" />
        ) : !lista.length ? (
          <Vazio titulo="Nenhum evento encontrado">Ajuste os filtros ou escolha outro dia.</Vazio>
        ) : (
          blocos.map((b) => (
            <div key={b.rotulo}>
              <h3 className="sticky top-[56px] z-10 flex items-center justify-between border-b border-borda bg-superficie-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave md:top-[62px]">
                <span>{b.rotulo}</span>
                <Contador n={b.eventos.length} />
              </h3>
              {b.eventos.map((e) => {
                const k = chaveEvento(e);
                const g = GRUPOS[grupoDoEvento(e)];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => abrir(e)}
                    className={cx(
                      "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 border-b border-l-[3px] border-b-borda px-4 py-2.5 text-left text-[13px] hover:bg-superficie-2",
                      aberto && chaveEvento(aberto) === k ? "bg-primaria-suave" : !lidos.has(k) && "font-medium",
                    )}
                    style={{ borderLeftColor: corDoTom(g.tom) }}
                  >
                    <span className={cx("grid h-7 w-7 place-items-center rounded-md text-xs font-bold", CLASSE_TOM[g.tom])}>{g.icone}</span>
                    <span className="min-w-0 leading-snug">
                      <EventoTexto e={e} />
                    </span>
                    <span className="text-xs tabular-nums text-suave">{hora(e.t)}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </section>

      {aberto && <DetalheAlerta e={aberto} eventos={eventos} modal={celular} fechar={() => setAberto(null)} />}
    </div>
  );
}

function DetalheAlerta({ e, eventos, modal, fechar }: { e: Evento; eventos: Evento[]; modal: boolean; fechar: () => void }) {
  const g = GRUPOS[grupoDoEvento(e)];
  const veiculo = veiculoDoEvento(e);
  const diaEv = diaLocal(new Date(e.t));
  const campos: [string, ReactNode][] = [];
  if (e.area) campos.push(["Área", e.area]);
  if (e.tipo === "status") campos.push(["De", e.de], ["Para", <b key="para">{e.para}</b>]);
  if (e.tipo === "status" && e.duracao_min != null) campos.push(["Duração anterior", fmtMin(e.duracao_min)]);
  if (e.tipo === "saida" && e.permanencia_min != null) campos.push(["Permanência", fmtMin(e.permanencia_min)]);
  if (e.tipo === "sinal_perdido" && e.ultima_posicao) campos.push(["Última posição", horaSeg(e.ultima_posicao)]);
  if (e.tipo === "sinal_retomado" && e.sem_sinal_min != null) campos.push(["Sem sinal por", fmtMin(e.sem_sinal_min)]);
  const mesmo = eventos.filter((x) => veiculoDoEvento(x) === veiculo).sort((a, b) => b.t.localeCompare(a.t));
  return (
    <Gaveta
      titulo={e.motor2 ? `${e.principal ?? e.placa} · motor 2º` : e.placa}
      sub={
        <span className="flex flex-wrap items-center gap-2">
          <Selo tom={g.tom}>{ROTULO_TIPO[e.tipo]}</Selo>
          {dataHora(e.t)}
        </span>
      }
      modal={modal}
      fechar={fechar}
      largura="min(480px, 100vw)"
      rodape={
        <div className="flex flex-wrap gap-2">
          <Link href={`/timeline/?v=${encodeURIComponent(veiculo)}&dia=${diaEv}`} className="btn-pri h-9 text-sm hover:no-underline">
            Ver timeline
          </Link>
          <Link href={`/#v=${encodeURIComponent(veiculo)}`} className="btn-sec h-9 text-sm hover:no-underline">
            Ver no mapa
          </Link>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-snug">
        <EventoTexto e={e} />
      </p>
      {campos.length > 0 && <Campos itens={campos} />}
      {mesmo.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Outros eventos de {e.motor2 ? (e.principal ?? e.placa) : e.placa} neste dia</p>
          <ol className="space-y-1.5 border-l-2 border-borda pl-3">
            {mesmo.map((x) => (
              <li key={chaveEvento(x)} className={cx("text-[13px] leading-snug", chaveEvento(x) === chaveEvento(e) && "font-semibold")}>
                <span className="mr-2 tabular-nums text-suave">{hora(x.t)}</span>
                <EventoTexto e={x} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </Gaveta>
  );
}
```

`src/app/alertas/page.tsx` (substitui a provisória):

```tsx
import { Suspense } from "react";
import { Alertas } from "./_componentes/alertas";

// ?placa= é lido no navegador (site estático): precisa de Suspense
export default function Pagina() {
  return (
    <Suspense>
      <Alertas />
    </Suspense>
  );
}
```

- [ ] **Step 2: Conferir**

Run: `npm test && npm run typecheck && npm run lint && npm run build`.

No http://localhost:3000/alertas/ (compare com http://localhost:5800/alertas.html): cartões Total/Entradas/Saídas/Status/Sinal (clicar filtra; de novo, volta); dia, busca e chips; lista agrupada por hora **local**; item não lido em negrito; clicar abre a gaveta à direita com o texto, campos, "Ver timeline", "Ver no mapa" e os outros eventos do veículo no dia. `/alertas/?placa=EOF5208` já abre filtrado. No celular a gaveta cobre a tela.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "Tela de Alertas: indicadores por tipo, lista por hora local e detalhe em gaveta

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Publicação no GitHub Pages, limpeza do site antigo e documentação

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/pages.yml`, `public/timeline.html`, `public/alertas.html`, `AGENTS.md`, `CLAUDE.md`
- Modify: `README.md` (reescrever), `eslint.config.mjs` (tirar `"*.js"` do ignore), `../../LEIA-ME.md` (fora do repositório)
- Delete: `index.html`, `timeline.html`, `alertas.html`, `app.js`, `mobile.js`, `api-supabase.js`, `theme.css`, `style.css`, `mobile.css` (todos na raiz)

**Interfaces:**
- Produces: build publicado em `https://grupogps-mecanizada.github.io/Monitoramento-De-Produtividade/` (quando o dono fizer o merge e trocar a fonte do Pages); endereços antigos `timeline.html` e `alertas.html` continuam funcionando.

- [ ] **Step 1: Workflows**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  qualidade:
    runs-on: ubuntu-latest
    env:
      TZ: America/Sao_Paulo
      NEXT_PUBLIC_SUPABASE_URL: https://exemplo.supabase.co
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      # a paridade com o coletor antigo é pulada aqui (amostras com dados reais ficam fora do git)
      - run: npm test
      - run: npm run build
```

`.github/workflows/pages.yml`:

```yaml
name: Publicar site (GitHub Pages)

# Settings > Pages > Source: "GitHub Actions" (troca feita pelo dono no dia da publicação)
on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  publicar:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    env:
      TZ: America/Sao_Paulo
      BASE_PATH: /Monitoramento-De-Produtividade
      # valores públicos: a chave publishable só lê e cria pedido de histórico (RLS em supabase/schema.sql)
      NEXT_PUBLIC_SUPABASE_URL: https://mfsyrsegkvjmefcdaegh.supabase.co
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sb_publishable_rw878qLgcmUdixI8QsejBA_lSXYAsIv
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Endereços antigos**

`public/timeline.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Timeline</title>
<!-- endereço antigo (timeline.html?v=...&dia=...): leva para a tela nova mantendo os parâmetros -->
<script>location.replace("./timeline/" + location.search + location.hash)</script>
<meta http-equiv="refresh" content="0; url=./timeline/">
</head>
<body><a href="./timeline/">Abrir a Timeline</a></body>
</html>
```

`public/alertas.html`:

```html
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Alertas</title>
<!-- endereço antigo (alertas.html?placa=...): leva para a tela nova mantendo os parâmetros -->
<script>location.replace("./alertas/" + location.search + location.hash)</script>
<meta http-equiv="refresh" content="0; url=./alertas/">
</head>
<body><a href="./alertas/">Abrir os Alertas</a></body>
</html>
```

- [ ] **Step 3: Tirar o site antigo**

```bash
git rm index.html timeline.html alertas.html app.js mobile.js api-supabase.js theme.css style.css mobile.css
```

Em `eslint.config.mjs`, apague a linha `"*.js",` e o comentário acima dela no `globalIgnores`.

Run: `npm run lint && npm run build && ls out/index.html out/timeline/index.html out/alertas/index.html out/timeline.html out/alertas.html`.

Teste o build como no Pages (com o subcaminho):

```bash
rm -rf /tmp/pages && mkdir -p /tmp/pages
BASE_PATH=/Monitoramento-De-Produtividade npm run build && cp -r out /tmp/pages/Monitoramento-De-Produtividade
npx serve /tmp/pages -l 3300 --no-clipboard   # em segundo plano
```

Abra http://localhost:3300/Monitoramento-De-Produtividade/ (mapa, logo, fontes e ícones carregam; navegação entre telas mantém o subcaminho) e http://localhost:3300/Monitoramento-De-Produtividade/timeline.html?v=1&dia=2026-10-01 (redireciona para `/timeline/?v=1&dia=...`). Pare o `serve` depois e rode `npm run build` de novo (sem `BASE_PATH`) para o `out/` voltar ao normal.

- [ ] **Step 4: Documentação no padrão do SST**

`AGENTS.md`: copie o bloco `<!-- BEGIN:nextjs-agent-rules --> ... <!-- END:nextjs-agent-rules -->` de `$SST/AGENTS.md` (é o aviso de que o Next 16 é diferente; o `next dev` recria esse bloco).

`CLAUDE.md`:

```
@AGENTS.md
@README.md
```

`README.md` (substitui o atual):

````markdown
# Monitoramento de Localização · Grupo GPS · Mecanizada

Mapa ao vivo da frota (ALTA PRESSÃO / AUTO VÁCUO / HIPER VÁCUO / aspiradores) na Usiminas Ipatinga, trajeto do dia com reprodução (player) e apontamento por veículo, e alertas de entrada/saída de área, status e sinal. Os dados vêm da tela "Localização" do GAUSS FLEET, que **não tem API pública**: o coletor usa as mesmas chamadas da página, com cuidado para não sobrecarregar o servidor.

- **No ar:** https://grupogps-mecanizada.github.io/Monitoramento-De-Produtividade/ (GitHub Pages, site estático, público)
- **Banco:** Supabase **PRODUTIVIDADE** (`mfsyrsegkvjmefcdaegh`), tabelas `loc_*`
- **Estrutura e visual:** os mesmos do sistema **SST - Mecanizada** (Next.js + TypeScript + Tailwind, identidade "Campo")

> Para quem continuar o trabalho: leia primeiro os **Pontos de atenção do dono**.

---

## Pontos de atenção do dono (leia antes de mudar qualquer coisa)

1. **Cautela com o GAUSS.** Carga mínima: uma requisição por vez, sessão reaproveitada, cadastro e cercas em cache, histórico só quando alguém pede, dia encerrado baixado uma vez. Nunca rodar duas coletas ao mesmo tempo (ex.: a versão antiga de `_arquivo` junto com esta).
2. **O coletor só roda a partir da `main`** (GitHub Actions). Não rode o `coletor/run.ts` no seu computador com as credenciais.
3. **A página é pública** (decisão de 01/10/2026): só lê e cria pedido de histórico. A chave secreta do Supabase fica só nos segredos do repositório.
4. **Visual igual ao SST:** cantos arredondados, camadas com sombra, sem títulos grandes, poucos botões, textos que se explicam. Cor nunca sozinha (sempre com rótulo). Mudança de cor vale para os dois sistemas (`src/app/globals.css`).
5. **Regras da frota:** motor secundário = placa + `2` (EOF5208 → EOF52082), vai junto do caminhão; RPM que não muda o dia inteiro é sensor travado (não afirma ligado/desligado).
6. **Publicar só quando o dono pedir.** Antes: `npm run lint && npm run typecheck && npm test && npm run build` e `npm run e2e`.
7. Explique em português simples, com o que mudou, o que foi testado e o que falta.

## Como funciona

```
Supabase (pg_cron a cada 5 min e a cada pedido de histórico)
   └─ dispara ─▶ GitHub Actions: coletor/run.ts consulta o GAUSS ─▶ grava no Supabase (loc_*)
                                                                     │
                     site (GitHub Pages) lê do Supabase ◀────────────┘  e atualiza sozinho (Realtime)
```

## Como rodar

```bash
npm install
cp .env.example .env.local     # valores públicos
npm run dev                    # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
npm run e2e                    # testes de navegador (dados sintéticos, nada é gravado)
```

**Publicar:** merge na `main` → o workflow `pages.yml` gera e publica `out/` (Settings → Pages → Source: **GitHub Actions**).

## Arquitetura

| Caminho | O que é |
|---|---|
| `src/app/page.tsx` + `_localizacao/` | Localização: painel (veículos, áreas, eventos), detalhe com histórico, gaveta no celular |
| `src/app/timeline/` | Timeline com player (`?v=<id ou placa>&dia=AAAA-MM-DD`) |
| `src/app/alertas/` | Alertas por tipo e hora, detalhe em gaveta (`?placa=`) |
| `src/components/` | Barra "Campo", busca Ctrl K, gaveta, folha do celular, mapa (`mapa/`), histórico (`historico/`) |
| `src/lib/tipos.ts` | Formatos dos dados (site **e** coletor) |
| `src/lib/dominio/` | Regras puras com testes: categoria/frescor, eventos, frota (motor 2º), geometria, apontamento, leitura do GAUSS |
| `src/lib/dados/` | Leituras do Supabase validadas (zod), retrato ao vivo, pedido de histórico |
| `coletor/` | Coletor em TypeScript (`tsx`), usa `src/lib/dominio` |
| `supabase/` | `schema.sql` (tabelas, RLS, Realtime) e `disparo.sql` (pg_cron + token no Vault) |
| `e2e/` | Playwright (computador e celular, só leitura) |

## Configuração (uma vez)

1. **Banco:** `supabase/schema.sql` no SQL Editor do PRODUTIVIDADE.
2. **Segredos do repositório:** `GAUSSFLEET_USERNAME`, `GAUSSFLEET_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
3. **Pages:** Settings → Pages → Source: **GitHub Actions**.
4. **Disparo:** token fine-grained (só este repositório, Actions: Read and write) e `supabase/disparo.sql` no SQL Editor com o token na linha 12, **sem salvar o token no arquivo**.

## Cuidados

- O token do GitHub no Vault do Supabase **vence**: nesse dia o mapa para de atualizar — gere outro e rode `supabase/disparo.sql` de novo.
- O disparo não é pontual: atrasos de alguns minutos são normais. O indicador da barra fica amarelo depois de 3 ciclos sem leitura.
- `coletor/paridade.test.ts` compara o coletor com amostras do coletor antigo em JS (`coletor/__amostras__/`, fora do git por ter dados reais). O script que as gerou está no histórico do git (`coletor/scripts/gravar-amostras.mjs`).

## Pendências e estado atual (02/10/2026)

| # | Pendência | Onde / como |
|---|---|---|
| 1 | Publicar a repaginação: merge da branch `repaginacao-campo` e trocar a fonte do Pages para "GitHub Actions" | Quando o dono pedir |
````

Em `../../LEIA-ME.md` (pasta `automatização GAUSS FLEET`, fora do repositório), na seção "1. Monitoramento de Localização", acrescente depois da linha do site:

```markdown
- **Desde 10/2026:** mesma estrutura e visual do SST - Mecanizada (Next.js + TypeScript + Tailwind, identidade "Campo"); coletor em TypeScript. Detalhes no `README.md` do repositório.
```

e, no "Mapa das pastas", troque as linhas de `deploy/Monitoramento-De-Produtividade/` por:

```
│   └── Monitoramento-De-Produtividade/   ✅ sistema publicado (repositório do GitHub)
│       ├── src/app/                 telas: Localização, Timeline, Alertas
│       ├── src/components/, src/lib/  componentes, regras (com testes) e leituras do Supabase
│       ├── coletor/                 roda no GitHub Actions (consulta o GAUSS), em TypeScript
│       ├── supabase/                schema.sql e disparo.sql (estrutura do banco)
│       └── .github/workflows/       coletor, publicação do site (Pages) e CI
```

- [ ] **Step 5: Commit**

```bash
git add -A .github public README.md AGENTS.md CLAUDE.md eslint.config.mjs
git commit -m "Publicação pelo GitHub Actions, endereços antigos redirecionados, site antigo removido e README no padrão do SST

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(O `LEIA-ME.md` fica fora do repositório: não entra no commit.)

---

### Task 17: Testes de navegador (Playwright, só leitura)

**Files:**
- Create: `playwright.config.ts`, `e2e/apoio.ts`, `e2e/localizacao.spec.ts`, `e2e/timeline.spec.ts`, `e2e/alertas.spec.ts`

**Interfaces:**
- Consumes: as três telas (T13–T15).
- Produces: `npm run e2e` (computador 1440 × 900 e celular Pixel 7) com todas as leituras do Supabase interceptadas por dados sintéticos e nenhuma gravação.

- [ ] **Step 1: Configuração e dados sintéticos**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_URL ?? "http://localhost:3210", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "computador", use: { viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_URL ? undefined : { command: "npx serve out -l 3210 --no-clipboard", port: 3210, reuseExistingServer: false, timeout: 120_000 },
});
```

`e2e/apoio.ts`:

```ts
import type { Page } from "@playwright/test";

const pad = (n: number) => String(n).padStart(2, "0");
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const quadrado = (lat: number, lng: number, lado: number) => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

export const CERCAS = [
  { code: 1, name: "PATIO", layer: 1, color: "#2a78d6", tipo: "area", polygon: quadrado(-19.481, -42.531, 0.002) },
  { code: 2, name: "OFICINA", layer: 1, color: "#eb6834", tipo: "area", polygon: quadrado(-19.476, -42.526, 0.002) },
];

const veiculo = (o: Record<string, unknown>) => ({
  vaga: "VAGA 1", grupo: "ALTA PRESSÃO", motorista: "", endereco: "Rua A", demora: "", direcao: 0, status_desde: minutosAtras(30),
  posicao_em: minutosAtras(1), area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});
export const retrato = () => ({
  lido_em: minutosAtras(1), erro: null, intervalo_s: 300, sem_sinal_min: 30,
  gauss: { dia: hoje(), requisicoes: 42, logins: 1, erros: 0, desde: minutosAtras(600), pausadoAte: null },
  veiculos: [
    veiculo({ id: "10", placa: "EOF5208", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", area_desde: minutosAtras(20),
      motor2: { id: "11", placa: "EOF52082", status: "Ligado", status_cod: 1, status_desde: minutosAtras(5), posicao_em: minutosAtras(1), sem_sinal: false } }),
    veiculo({ id: "11", placa: "EOF52082", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", motor2_de: "10" }),
    veiculo({ id: "20", placa: "EGC2984", status: "Desligado", status_cod: 2, lat: -19.475, lng: -42.525, area: "OFICINA" }),
    veiculo({ id: "30", placa: "DTW5E38", status: "Em manutenção", status_cod: 9, lat: -19.470, lng: -42.520, via: "RUA 1", posicao_em: minutosAtras(90) }),
  ],
});
export const eventos = () => [
  { t: minutosAtras(50), id: "10", placa: "EOF5208", vaga: "VAGA 1", tipo: "entrada", area: "PATIO", lat: -19.48, lng: -42.53 },
  { t: minutosAtras(40), id: "20", placa: "EGC2984", vaga: "VAGA 2", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
];
export const historico = () => {
  const dia = hoje();
  const pontos = Array.from({ length: 21 }, (_, i) => [-19.481 + i * 0.0002, -42.531 + i * 0.0001, `08:${pad(i)}:00`, i < 10 ? 35 : 0, i < 10 ? "movimento" : "parado_ligado", i >= 2 && i <= 5 ? 1 : 0]);
  return {
    id: "10", dia, fonte: "cache", baixado_em: minutosAtras(60), motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null,
    motor2: { intervalos: [["08:02:00", "08:05:00"]], id: "11", placa: "EOF52082" },
    trechos: [
      { estado: "movimento", inicio: `${dia} 08:00:00`, fim: `${dia} 08:10:00`, duracao_min: 10, de: "PATIO", para: "", percurso: ["PATIO"], km: 2.1, vel_max: 35, motor2_min: 3 },
      { estado: "parado_ligado", inicio: `${dia} 08:10:00`, fim: `${dia} 08:20:00`, duracao_min: 10, local: "PATIO", lat: -19.479, lng: -42.53, motor2_min: 0 },
    ],
    resumo: { primeiro: `${dia} 08:00:00`, ultimo: `${dia} 08:20:00`, pontos: 21, km: 2.1, vel_max: 35, movimento_min: 10, parado_ligado_min: 10, desligado_min: 0, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: 3, areas: [{ area: "PATIO", min: 20 }] },
    pontos,
  };
};

/**
 * Responde as leituras do Supabase com os dados acima (o banco real nunca é lido nem gravado) e corta os
 * tiles do mapa. Devolve a lista de tentativas de gravação: os testes exigem que fique vazia.
 */
export async function prepararDados(page: Page): Promise<string[]> {
  const gravacoes: string[] = [];
  await page.route(/arcgisonline\.com|tile\.openstreetmap\.org/, (r) => r.abort());
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      gravacoes.push(`${req.method()} ${url.pathname}`);
      return route.fulfill({ status: 201, body: "" });
    }
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    const tabela = url.pathname.split("/").pop();
    if (tabela === "loc_kv") return json(url.searchParams.get("chave") === "eq.cercas" ? [{ valor: { cercas: CERCAS } }] : [{ valor: retrato() }]);
    if (tabela === "loc_eventos") return json(eventos().map((dados) => ({ dados })));
    if (tabela === "loc_dias") return json([{ dia: hoje() }]);
    if (tabela === "loc_historico") return json([{ resultado: historico(), baixado_em: minutosAtras(60), fechado: true }]);
    return json([]);
  });
  return gravacoes;
}
```

O `maybeSingle()` do supabase-js aceita a resposta em lista (pega o único item); por isso todas as respostas são listas.

- [ ] **Step 2: Testes**

`e2e/localizacao.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Localização: lista, detalhe e histórico do dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    await expect(page.getByText(/atualizado \d\d:\d\d:\d\d/)).toBeVisible();
    const painel = page.locator("aside");
    await expect(painel.getByRole("button", { name: /EGC2984/ })).toBeVisible();
    await painel.getByRole("button", { name: /EOF5208/ }).click();
    await expect(painel.getByText("Motor secundário")).toBeVisible();
    await painel.getByRole("button", { name: "Ver histórico" }).click();
    await expect(painel.getByText("Apontamento (2 trechos)")).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /3 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Busca Ctrl K acha placa com hífen", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "atalho de teclado");
  await prepararDados(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").getByRole("searchbox").fill("egc-2984");
  await expect(page.getByRole("option", { name: /EGC2984/ })).toBeVisible();
});
```

`e2e/timeline.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: abre pelo link e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  await play.click();
  await expect(page.getByRole("button", { name: /Pausar/ })).toBeVisible();
  if (info.project.name === "computador") await expect(page.getByText("Apontamento (2 trechos)")).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Timeline: link com o motor secundário abre o caminhão", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "o nome aparece no painel do computador");
  await prepararDados(page);
  await page.goto(`/timeline/?v=EOF52082&dia=${hoje()}`);
  await expect(page.locator("section").getByText("EOF5208", { exact: true })).toBeVisible();
});
```

`e2e/alertas.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Alertas: indicadores, lista e detalhe", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/alertas/");
  await expect(page.getByRole("button", { name: /Total/ })).toContainText("2");
  await page.getByRole("button", { name: /EGC2984/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Desligado");
  await expect(page.getByRole("link", { name: "Ver timeline" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 3: Rodar**

```bash
npx playwright install chromium
npm run build && npm run e2e
```

Esperado: 8 execuções (5 testes × 2 projetos, 2 pulados no celular) — todas PASS. Se um seletor não achar o elemento, confira o texto na tela (nunca relaxe o `expect(gravacoes).toEqual([])`).

Rode também `npm run lint` (os arquivos de `e2e/` entram no lint).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "Testes de navegador (computador e celular) com dados sintéticos e sem gravar no banco

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Conferência final e entrega**

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run e2e
git log --oneline main..HEAD
git status --short
```

Esperado: tudo PASS, árvore limpa. **Não** faça push nem merge. Entregue ao dono: o que mudou, o que foi testado (incluindo a paridade com as amostras reais) e os dois passos dele no dia da publicação — (1) autorizar o merge/push da branch, (2) GitHub → Settings → Pages → Source: **GitHub Actions**; depois, conferir o site no ar e a execução seguinte do coletor no Actions.

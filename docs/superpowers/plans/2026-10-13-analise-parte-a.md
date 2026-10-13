# Análise — Parte A (linha única, satélite recortado, sem Mata CDP/USIPA, mapa de calor) — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filtros numa linha só (nas duas abas), mapa de satélite só dentro das plantas com preto em volta, Mata CDP e USIPA fora do mapa e das contas, e mapa de calor no lugar das bolhas com as áreas clicáveis.

**Architecture:** Regras puras novas em `src/lib/dominio/analise.ts` (excluídas, furos da máscara, pontos do calor). `AbasAnalise` monta abas + período e entrega como `topo` para a aba aberta, que põe na mesma linha dos seus filtros. `camada-analise.ts` troca `desenharBolhas` por `desenharCalor` (máscara num painel próprio abaixo do calor; `leaflet.heat` no overlayPane; áreas em SVG por cima).

**Tech Stack:** Next.js estático, React, TypeScript, Tailwind, Leaflet 1.9.4 + `leaflet.heat` 0.2.0, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-analise-satelite-calor-design.md` (Parte A)

## Global Constraints
- Satélite: o mesmo `SATELITE` (Esri World Imagery) de `use-mapa.ts`; sem custo.
- Saem: `PLANTA MATA CDP`, `MATA CDP`, `PLANTA USIPA`, `USIPA` (nome exato, sem diferenciar maiúsculas). `ESTACIONAMENTO RESTAURANTE DA MATA` fica.
- Sem SQL novo, sem chamada ao GAUSS. Dependências novas só `leaflet.heat@0.2.0` e `@types/leaflet.heat@0.2.5` (dev).
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

## Review Focus
1. Planta dentro de outra (ex.: oficinas dentro da PLANTA USIMINAS): o furo de dentro não pode voltar a ficar preto. Coberto em `analise.test.ts` (`buracosDaMascara`).
2. Uma parada enorme (ex.: 20 h) não pode apagar o calor das outras: o peso é limitado pelo percentil 95. Coberto em `analise.test.ts` (`pontosDoCalor`).
3. Parada dentro da Mata CDP sem a cerca anotada (área null) também sai. Coberto em `analise.test.ts`.
4. Aba Disponibilidade carregando, com erro ou sem boletim: as abas continuam visíveis (senão não dá para voltar). Coberto no e2e da Tarefa 2 (os testes de erro/vazio já clicam e conferem textos; acrescentar a conferência das abas).
5. Clicar na área com o calor por cima: o calor não pode roubar o clique (`pointer-events: none`). Coberto no e2e da Tarefa 3.

---

### Task 1: Regras — excluídas, furos da máscara e pontos do calor

**Files:**
- Modify: `src/lib/dominio/analise.ts`
- Test: `src/lib/dominio/analise.test.ts`

**Interfaces:**
- Produces: `ehExcluidaDaAnalise(nome: string | null): boolean`, `semExcluidas<C extends { name: string }>(cercas: C[]): C[]`, `plantasExcluidas(cercas: { name: string; tipo: string; polygon: LatLng[] }[]): LatLng[][]`, `montarLocais(paradas, areas, equip, usina = null, excluidas: LatLng[][] = [])`, `buracosDaMascara(plantas: { polygon: LatLng[] }[]): LatLng[][]`, `pontosDoCalor(paradas: ParadaAnalise[]): [number, number, number][]`.

- [ ] **Step 1: Testes que falham** — acrescentar ao import de `./analise` em `analise.test.ts`: `buracosDaMascara, ehExcluidaDaAnalise, plantasExcluidas, pontosDoCalor, semExcluidas`. No fim do arquivo:

```ts
describe("Mata CDP e USIPA fora da análise", () => {
  it("planta ou cerca com o nome; o estacionamento da Mata e o resto ficam", () => {
    expect(["PLANTA MATA CDP", "MATA CDP", "PLANTA USIPA", " usipa ", "ESTACIONAMENTO RESTAURANTE DA MATA", "ALTO FORNO 3"].map(ehExcluidaDaAnalise)).toEqual([true, true, true, true, false, false]);
    expect(ehExcluidaDaAnalise(null)).toBe(false);
  });
  it("tira as cercas excluídas e separa os polígonos das plantas excluídas", () => {
    const cercas = [
      { name: "PLANTA MATA CDP", tipo: "planta", polygon: quad(-19.4, -42.6) },
      { name: "MATA CDP", tipo: "area", polygon: quad(-19.4, -42.6) },
      { name: "ALTO FORNO 3", tipo: "area", polygon: quad(-19.48, -42.53) },
    ];
    expect(semExcluidas(cercas).map((c) => c.name)).toEqual(["ALTO FORNO 3"]);
    expect(plantasExcluidas(cercas)).toEqual([quad(-19.4, -42.6)]);
  });
  it("a parada sai pela cerca anotada e pelo ponto dentro da planta excluída", () => {
    const { paradas } = montarLocais(
      [p({}), p({ area: "MATA CDP" }), p({ area: null, lat: -19.399, lng: -42.599 })],
      AREAS,
      equipDaFrota(FROTA),
      AREAS[0].polygon,
      [quad(-19.4, -42.6)],
    );
    expect(paradas.map((x) => x.local)).toEqual(["ALTO FORNO 3"]);
  });
});

describe("mapa de satélite e calor", () => {
  it("furos da máscara: só as plantas que não estão dentro de outra maior", () => {
    const grande: [number, number][] = [[-19.5, -42.6], [-19.5, -42.4], [-19.3, -42.4], [-19.3, -42.6]];
    const dentro = quad(-19.45, -42.5);
    const fora = quad(-19.0, -42.0);
    expect(buracosDaMascara([{ polygon: dentro }, { polygon: grande }, { polygon: fora }])).toEqual([grande, fora]);
  });
  it("pontos do calor: peso = minutos ÷ percentil 95, no máximo 1; sem paradas, nada", () => {
    const ps = [p({ ini: 0, fim: 60 * 60 }), p({ ini: 0, fim: 30 * 60, lat: -19.47 }), p({ ini: 0, fim: 600 * 60, lat: -19.46 })];
    expect(pontosDoCalor(ps)).toEqual([[-19.479, -42.529, 1], [-19.47, -42.529, 0.5], [-19.46, -42.529, 1]]);
    expect(pontosDoCalor([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: FAIL (`ehExcluidaDaAnalise is not a function` / importações inexistentes).

- [ ] **Step 3: Implementar em `analise.ts`** — garantir `dentroDoPoligono` no import de `./geo`. Logo depois de `ehPatioDaBase`:

```ts
/** Mata CDP e USIPA saem da análise (decisão do dono, 13/10/2026): a planta e a cerca de mesmo nome. "ESTACIONAMENTO RESTAURANTE DA MATA" fica. */
export const ehExcluidaDaAnalise = (nome: string | null) => !!nome && /^(PLANTA )?(MATA CDP|USIPA)$/i.test(nome.trim());
/** Cercas sem as excluídas da análise. */
export const semExcluidas = <C extends { name: string }>(cercas: C[]): C[] => cercas.filter((c) => !ehExcluidaDaAnalise(c.name));
/** Polígonos das plantas excluídas: a parada que cai dentro delas sai mesmo sem a cerca anotada. */
export const plantasExcluidas = (cercas: { name: string; tipo: string; polygon: LatLng[] }[]): LatLng[][] =>
  cercas.filter((c) => c.tipo === "planta" && c.polygon.length >= 3 && ehExcluidaDaAnalise(c.name)).map((c) => c.polygon);
```
Em `montarLocais`, novo último parâmetro `excluidas: LatLng[][] = []` e o filtro da parada:
```ts
    return e && !ehPatioDaBase(p.area) && !ehExcluidaDaAnalise(p.area) && !excluidas.some((pl) => dentroDoPoligono(p.lat, p.lng, pl)) ? [{ ...p, equip: e, local: p.area ?? "" }] : [];
```
E no fim do arquivo:
```ts
/** Furos da máscara preta: as plantas que não estão dentro de outra maior (furo dentro de furo voltaria a ficar preto). */
export function buracosDaMascara(plantas: { polygon: LatLng[] }[]): LatLng[][] {
  const ps = plantas.filter((pl) => pl.polygon.length >= 3);
  return ps
    .filter((pl) => {
      const [lat, lng] = centro(pl.polygon);
      const a = areaPoligono(pl.polygon);
      return !ps.some((q) => q !== pl && areaPoligono(q.polygon) > a && dentroDoPoligono(lat, lng, q.polygon));
    })
    .map((pl) => pl.polygon);
}

/** Pontos do mapa de calor: [lat, lng, peso]; peso = minutos ÷ percentil 95 das paradas, no máximo 1 (uma parada enorme não apaga as outras). */
export function pontosDoCalor(paradas: ParadaAnalise[]): [number, number, number][] {
  const mins = paradas.map(minutos).sort((a, b) => a - b);
  const p95 = mins[Math.floor(0.95 * (mins.length - 1))] ?? 0;
  return p95 <= 0 ? [] : paradas.map((p) => [p.lat, p.lng, Math.min(1, minutos(p) / p95)]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/analise.test.ts && npm run typecheck`
Expected: PASS; typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/analise.ts src/lib/dominio/analise.test.ts
git commit -m "Análise: Mata CDP e USIPA fora, furos da máscara e pontos do mapa de calor"
```

### Task 2: Uma linha de filtros nas duas abas

**Files:**
- Modify: `src/app/analise/_componentes/abas-analise.tsx`, `analise.tsx`, `barra-filtros.tsx`, `disponibilidade/disponibilidade.tsx`
- Test: `e2e/analise.spec.ts`, `e2e/disponibilidade.spec.ts`

**Interfaces:**
- Produces: `Analise({ periodo, topo }: { periodo: Periodo; topo: ReactNode })`, `Disponibilidade({ topo }: { topo: ReactNode })`, `BarraFiltros({ topo, ... })`.

- [ ] **Step 1: Testes que falham.** Em `e2e/analise.spec.ts`, primeiro teste, logo depois de `await expect(periodo).toBeVisible();`:

```ts
  // uma linha só: abas, período e filtros (no computador; no celular a linha quebra)
  if (test.info().project.name !== "celular") {
    const abas = (await page.getByRole("tablist", { name: "Análise" }).boundingBox())!;
    for (const nome of ["Tipo", "Supervisor", "Regime"]) {
      const b = (await page.getByLabel(nome, { exact: true }).boundingBox())!;
      expect(Math.abs(b.y + b.height / 2 - (abas.y + abas.height / 2))).toBeLessThan(8);
    }
  }
```
Em `e2e/disponibilidade.spec.ts`, no primeiro teste depois da linha que confere `"GPS 2026-10"`:
```ts
  if (test.info().project.name !== "celular") {
    const abas = (await page.getByRole("tablist", { name: "Análise" }).boundingBox())!;
    const ciclo = (await page.getByRole("combobox", { name: "Ciclo da medição" }).boundingBox())!;
    expect(Math.abs(ciclo.y + ciclo.height / 2 - (abas.y + abas.height / 2))).toBeLessThan(8);
  }
```
E nos testes "avisa quando o SQL não foi rodado" e "nenhum boletim baixado ainda", no fim de cada um:
```ts
  await expect(page.getByRole("tablist", { name: "Análise" })).toBeVisible();
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run build && npx playwright test e2e/analise.spec.ts e2e/disponibilidade.spec.ts`
Expected: FAIL no computador (Tipo/Ciclo abaixo das abas, diferença > 8 px).

- [ ] **Step 3: Implementar.** `abas-analise.tsx` (componente inteiro):

```tsx
export function AbasAnalise() {
  const [aba, setAba] = useOpcao<Aba>("mon-analise-aba", ABAS, "paradas");
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  // abas e período vão para a linha de filtros da aba aberta: uma linha só
  const topo = (
    <>
      <div className="w-[260px]">
        <Segmentado rotulo="Análise" valor={aba} mudar={setAba} opcoes={[{ id: "paradas", rotulo: "Paradas" }, { id: "disponibilidade", rotulo: "Disponibilidade" }]} />
      </div>
      {aba === "paradas" && (
        <div className="w-[240px]">
          <Segmentado<Periodo> rotulo="Período" valor={periodo} mudar={setPeriodo} opcoes={PERIODOS.map((p) => ({ id: p, rotulo: <span className="whitespace-nowrap">{p} dias</span> }))} />
        </div>
      )}
    </>
  );
  return <div className="altura-tela flex flex-col">{aba === "paradas" ? <Analise periodo={periodo} topo={topo} /> : <Disponibilidade topo={topo} />}</div>;
}
```
(Atualizar o comentário do componente: "abas e período entram na linha de filtros da aba aberta".)

`barra-filtros.tsx`: novo prop `topo: ReactNode` (import `type ReactNode` de `react`), renderizado como primeiro filho da linha `flex flex-wrap items-center gap-2`, antes do `Selecao` de Tipo. Comentário: "Uma linha: abas e período (vêm de fora), tipo, supervisor e regime; embaixo, as etiquetas...".

`analise.tsx`: assinatura `export function Analise({ periodo, topo }: { periodo: Periodo; topo: ReactNode })` (import `type ReactNode`), e `<BarraFiltros topo={topo} ... />`.

`disponibilidade.tsx`: assinatura `export function Disponibilidade({ topo }: { topo: ReactNode })`; logo antes do primeiro `if (boletins.erro)`:
```tsx
  // abas da Análise + filtros desta aba numa linha só (as abas aparecem também carregando, com erro ou sem boletim)
  const linha = (extra?: ReactNode) => <div className="flex flex-wrap items-center gap-2">{topo}{extra}</div>;
```
Os três retornos antecipados passam a ser:
```tsx
  if (boletins.erro) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {linha()}
        <Aviso tipo="erro">{mensagem(boletins.erro)}</Aviso>
      </div>
    );
  }
  if (boletins.carregando) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {linha()}
        <p className="text-sm text-suave">Carregando os boletins…</p>
      </div>
    );
  }
  if (!boletim) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {linha()}
        <Vazio titulo="Nenhum boletim baixado ainda">O coletor baixa o boletim quando ele fecha no GAUSS (uma vez por dia, a partir das 07:00).</Vazio>
      </div>
    );
  }
```
E no retorno principal, a `div` `flex flex-wrap items-center gap-2` com `Selecao` + `Selo` vira `{linha(<>…Selecao…<Selo tom="ok">Oficial</Selo></>)}`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test e2e/analise.spec.ts e2e/disponibilidade.spec.ts`
Expected: PASS nos dois aparelhos.

- [ ] **Step 5: Commit**

```bash
git add src/app/analise e2e/analise.spec.ts e2e/disponibilidade.spec.ts
git commit -m "Análise: abas, período e filtros numa linha só (Paradas e Disponibilidade)"
```

### Task 3: Satélite recortado e mapa de calor

**Files:**
- Modify: `package.json` / `package-lock.json` (`npm i leaflet.heat@0.2.0 && npm i -D @types/leaflet.heat@0.2.5`)
- Modify: `src/components/mapa/leaflet.ts` (carregar `leaflet.heat`)
- Modify: `src/app/analise/_componentes/camada-analise.ts` (troca `desenharBolhas` por `desenharCalor`)
- Create: `src/app/analise/_componentes/legenda-calor.tsx`
- Delete: `src/app/analise/_componentes/cores-analise.ts` (e o teste dele, se existir)
- Modify: `src/app/analise/_componentes/analise.tsx`, `src/app/globals.css`
- Test: `e2e/apoio.ts` (parada na MATA CDP), `e2e/analise.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`semExcluidas`, `plantasExcluidas`, `buracosDaMascara`, `pontosDoCalor`, `montarLocais(..., excluidas)`).
- Produces: `desenharCalor(L, camada, mapa, { plantas, buracos, areas, resumos, pontos, sel, aoClicar })`, `LegendaCalor()`.

- [ ] **Step 1: Teste que falha.** Em `e2e/apoio.ts`, `paradasAnalise()`, acrescentar ao fim da lista:
```ts
    // Mata CDP e USIPA saem da análise
    p("10", "EGC2985", 10 * 3600, "MATA CDP", -19.47, -42.52, { stopped: 60 }),
```
Em `e2e/analise.spec.ts`, novo teste depois do primeiro:
```ts
test("Análise: satélite só nas plantas, mapa de calor e área clicável; Mata CDP fora", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await expect(page.locator(".mapa-analise .mascara-analise")).toHaveCount(1);
  await expect(page.locator(".mapa-analise .leaflet-heatmap-layer")).toHaveCount(1);
  await expect(page.locator('.mapa-analise img.leaflet-tile[src*="World_Imagery"]').first()).toBeAttached();
  const lugares = page.getByRole("region", { name: "Lugares" });
  await expect(lugares.getByRole("button").first()).toBeVisible();
  await expect(lugares).not.toContainText("MATA CDP");
  // a área recebe o clique mesmo com o calor por cima
  await page.getByRole("button", { name: "OFICINA", exact: true }).click();
  await expect(page.getByRole("group", { name: "Filtrando" }).getByRole("button", { name: "Tirar filtro: OFICINA" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run build && npx playwright test e2e/analise.spec.ts -g "satélite"`
Expected: FAIL (não acha `.mascara-analise`).

- [ ] **Step 3: Dependência e carregador.** `npm i leaflet.heat@0.2.0 && npm i -D @types/leaflet.heat@0.2.5`. Em `leaflet.ts`, depois de `await import("leaflet.markercluster");`:
```ts
    await import("leaflet.heat");
```
(e o comentário: "Leaflet + markercluster + heat ... os plugins procuram o `L` global").

- [ ] **Step 4: `camada-analise.ts` (arquivo inteiro)**

```ts
import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;
/** O mundo inteiro: a máscara preta é ele com furos nas plantas. */
const MUNDO: LatLng[] = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
/** Painel da máscara: acima do satélite (200) e abaixo do calor e das áreas (overlayPane, 400). */
export const PAINEL_MASCARA = "mascara";
/** Azul (pouco) → vermelho (muito), legível sobre o satélite. */
export const GRADIENTE_CALOR: Record<number, string> = { 0.2: "#2563eb", 0.45: "#22d3ee", 0.65: "#facc15", 0.85: "#f97316", 1: "#dc2626" };

/**
 * Mapa de calor sobre o satélite: preto fora das plantas (máscara com furos), contorno fino das plantas e das áreas e o calor
 * com o peso de cada parada. As áreas com parada recebem o mouse (nome e horas) e o clique (escolhe/desfaz o lugar).
 */
export function desenharCalor(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: {
    plantas: { name: string; polygon: LatLng[] }[];
    buracos: LatLng[][];
    areas: { name: string; polygon: LatLng[] }[];
    resumos: ResumoLocal[];
    pontos: [number, number, number][];
    sel: string | null;
    aoClicar: (chave: string) => void;
  },
) {
  camada.clearLayers();
  L.polygon([MUNDO, ...o.buracos], { pane: PAINEL_MASCARA, className: "mascara-analise", stroke: false, fillOpacity: 1, interactive: false }).addTo(camada);
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { className: "planta-contorno", weight: 1.5, fill: false, interactive: false }).addTo(camada);
  if (o.pontos.length) L.heatLayer(o.pontos, { radius: 22, blur: 18, maxZoom: 17, max: 1, minOpacity: 0.3, gradient: GRADIENTE_CALOR }).addTo(camada);
  const porLocal = new Map(o.resumos.map((r) => [r.local.chave, r]));
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porLocal.get(a.name);
    const pol = L.polygon(a.polygon, { className: a.name === o.sel ? "area-calor area-selecionada" : "area-calor", weight: 1, fillOpacity: 0, interactive: !!r });
    if (r) {
      pol
        .bindTooltip(`<b>${esc(a.name)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}`, { sticky: true, className: "rotulo-cerca" })
        .on("click", () => o.aoClicar(a.name));
    }
    pol.addTo(camada);
    if (r) {
      pol.getElement()?.setAttribute("role", "button");
      pol.getElement()?.setAttribute("aria-label", a.name);
    }
  }
  // nome das plantas de fora da usina (a Usiminas é o mapa inteiro), quando cabem
  const postos: { x: number; y: number }[] = [];
  for (const pl of o.plantas) {
    if (/^PLANTA USIMINAS$/i.test(pl.name)) continue;
    const c = L.polygon(pl.polygon).getBounds().getCenter();
    const pt = mapa.latLngToContainerPoint(c);
    if (postos.some((q) => Math.abs(q.x - pt.x) < LARG && Math.abs(q.y - pt.y) < ALT)) continue;
    postos.push(pt);
    L.marker(c, { interactive: false, icon: L.divIcon({ className: "rotulo-planta", iconSize: [0, 0], html: `<span>${esc(pl.name.replace(/^PLANTA (DAS |DA |DO |DE )?/i, ""))}</span>` }) }).addTo(camada);
  }
}
```

- [ ] **Step 5: `legenda-calor.tsx`**

```tsx
import { GRADIENTE_CALOR } from "./camada-analise";

/** Legenda do mapa de calor (só no computador): pouco → muito tempo parado. */
export function LegendaCalor() {
  return (
    <div aria-label="Legenda do mapa de calor" className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden items-center gap-2 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      <span>pouco</span>
      <span aria-hidden className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${Object.values(GRADIENTE_CALOR).join(", ")})` }} />
      <span>muito tempo parado</span>
    </div>
  );
}
```

- [ ] **Step 6: Ligar em `analise.tsx`**
- `useMapa(14, false)` → `useMapa(14, true)` (satélite).
- Imports: tirar `Legenda`, `cores-analise` e `servicosPrincipais`; trazer `buracosDaMascara, plantasExcluidas, pontosDoCalor, semExcluidas` de `@/lib/dominio/analise`; `desenharCalor, PAINEL_MASCARA` de `./camada-analise`; `LegendaCalor` de `./legenda-calor`.
- Cercas:
```ts
  // Mata CDP e USIPA saem do mapa e das contas
  const validas = useMemo(() => semExcluidas(cercas), [cercas]);
  const excluidas = useMemo(() => plantasExcluidas(cercas), [cercas]);
  const usina = useMemo(() => contornoDaUsina(validas), [validas]);
  const areas = useMemo(() => areasDaRegiao(validas.filter((c) => c.tipo === "area"), usina), [validas, usina]);
  const plantas = useMemo(() => plantasDaRegiao(validas), [validas]);
  const buracos = useMemo(() => buracosDaMascara(plantas), [plantas]);
```
- `base`: `montarLocais(paradas, validas.filter((c) => c.tipo === "area"), equip, usina, excluidas)` com dependências `[paradas, validas, equip, usina, excluidas]`.
- Tirar `principais`, `legenda` e o `marca` de `itensServico`.
- Depois de `dentro/fora`: `const pontos = useMemo(() => pontosDoCalor(recorte("local")), [recorte]);`
- `clicarBolha` → `clicarArea` (mesmo corpo).
- No efeito de montagem do mapa, depois de `pronto.mapa.zoomControl.remove();`:
```ts
    if (!pronto.mapa.getPane(PAINEL_MASCARA)) pronto.mapa.createPane(PAINEL_MASCARA).style.zIndex = "350";
```
- Efeito de desenho:
```ts
  useEffect(() => {
    if (pronto && camada.current) desenharCalor(pronto.L, camada.current, pronto.mapa, { plantas, buracos, areas, resumos: dentro, pontos, sel: sel.local, aoClicar: clicarArea });
  }, [pronto, plantas, buracos, areas, dentro, pontos, sel.local, zoom, clicarArea]);
```
- `<Legenda itens={legenda} />` → `<LegendaCalor />`.
- Comentário do componente: "mapa de satélite (só as plantas, preto em volta) com o calor das paradas à esquerda…".

- [ ] **Step 7: CSS (`globals.css`)** — trocar as linhas `.usina-contorno`, `.area-sem-dado`, `.bolha`, `.bolha-selecionada`, `.bolha-apagada` (e o comentário "mapa só das cercas da região, sem imagem") por:
```css
/* Análise: satélite só dentro das plantas, preto em volta (igual nos dois temas), calor por baixo das áreas */
.mapa-analise.leaflet-container { background: #000; }
.mascara-analise { fill: #000; }
.planta-contorno { stroke: rgba(255, 255, 255, 0.55); }
.area-calor { stroke: rgba(255, 255, 255, 0.35); fill: #fff; cursor: pointer; }
.area-selecionada { stroke: #fff; stroke-width: 3px; }
.mapa-analise .leaflet-heatmap-layer { pointer-events: none; z-index: 1; }
.mapa-analise .leaflet-overlay-pane > svg { z-index: 2; }
```
(manter a linha `.mapa-analise.leaflet-container` uma vez só.)

- [ ] **Step 8: Rodar e ver passar**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test e2e/analise.spec.ts`
Expected: PASS nos dois aparelhos.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src e2e
git commit -m "Análise: satélite só nas plantas com preto em volta e mapa de calor no lugar das bolhas"
```

### Task 4: CHANGELOG, README e verificação completa

- [ ] **Step 1:** CHANGELOG, seção "Análise mais limpa · 13/10/2026": acrescentar
```md
- **Uma linha só** no topo: abas, período e filtros (também na Disponibilidade).
- **Mapa de satélite** só dentro das plantas, com preto em volta, e **mapa de calor** no lugar das bolhas (azul = pouco, vermelho = muito tempo parado). Clicar numa área cercada continua filtrando o resto.
- **Mata CDP e USIPA** saem do mapa e das contas (como o Pátio da base).
```
README item 12: trocar "**bolha por lugar** (tamanho = horas paradas; cor = serviço principal...)" por "**mapa de calor** sobre o satélite (só dentro das plantas, preto em volta; Mata CDP e USIPA fora)" e "clicar numa bolha" por "clicar numa área".
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` → tudo verde.
- [ ] **Step 3:** `git add CHANGELOG.md README.md && git commit -m "Análise: CHANGELOG e README da Parte A"`

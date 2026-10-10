# Painel da Análise — plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a tela Análise (mapa pintado por 6 medidas + funil + lista) por um painel: filtros e placar em cima, mapa de bolhas à esquerda e 3 gráficos à direita, em que clicar num lugar, serviço ou hora filtra o resto.

**Architecture:** As contas novas (seleção cruzada, por serviço, por hora, placar, raio da bolha, serviços principais) são funções puras em `src/lib/dominio/analise.ts`, testadas no Vitest. A tela (`src/app/analise/_componentes/`) só guarda o estado (período, filtros do topo, seleção) e desenha: placar, gráficos em HTML/CSS e o mapa Leaflet com bolhas. Os dados continuam vindo de `analise_paradas` por `useParadasAnalise()`; o banco não muda.

**Tech Stack:** Next.js 16 (export estático), React 19, TypeScript estrito, Tailwind v4, Leaflet 1.9, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-10-painel-analise-design.md`

## Global Constraints

- Nenhuma biblioteca nova (gráficos em HTML/CSS/SVG feitos à mão); nada pago.
- Nomes de funções, variáveis e textos em português do Brasil, simples.
- O banco não muda; nenhuma gravação no Supabase a partir da tela (o e2e confere `gravacoes` vazio).
- Nunca abrir nem mostrar `.env` / `.env.local`.
- Não publicar (sem push) — só commits locais no ramo `timeline-e-analises`.
- Cores do mapa: `#3987e5`, `#d95926`, `#199e70` (3 serviços principais, nessa ordem) e `#6b7280` (Outros / sem apontamento) — validadas com `validate_palette.js --mode dark --pairs all --surface #000000`.
- Computador/TV primeiro (≥ 1024px: mapa ~60% + coluna de gráficos ~40%); abaixo disso, uma coluna só.
- Esta versão do Next.js tem mudanças: antes de usar qualquer API do Next que não esteja já no projeto, ler `node_modules/next/dist/docs/` (este plano não usa API nova).

## Review Focus

- Filtros que deixam o recorte vazio (ex.: Tipo = Aspirador + "Longe da região"): placar com "0h00"/"—", gráficos com "Nada neste filtro.", nenhuma tela branca. → teste no e2e (Task 2).
- Lugar escolhido que some do recorte ao mudar Tipo/Supervisor/Regime: a etiqueta continua no topo (para a pessoa entender por que esvaziou e poder tirar). → e2e (Task 2) e `filtrarSelecao` com local inexistente (Task 1).
- "Longe da região" escolhido no ranking: não existe bolha nem coordenada; o mapa não pode voar para (0,0). → `escolherLugar` só aproxima quando o lugar está em `dentro`; `filtrarSelecao` com `CHAVE_FORA` testado (Task 1).
- Parada com 2 apontamentos (ou o mesmo repetido): conta uma vez em cada serviço e uma vez só no placar "Serviços". → Task 1.
- Tipo sem regra de produtividade (Hiper Vácuo, Aspirador): "Produtivo" e "% produtivo" mostram "—", nunca "0%". → Task 1 e e2e (Task 2).
- Barra "Outros" do gráfico de serviços não é um serviço: não pode virar filtro (botão desabilitado). → Task 1 (conta) e Task 2 (`clicavel: false`).

---

### Task 1: Regras do painel (puras, com testes)

**Files:**
- Modify: `src/lib/dominio/analise.ts` (acrescentar no fim do arquivo)
- Test: `src/lib/dominio/analise.test.ts` (acrescentar um `describe` no fim e os nomes novos no `import`)

**Interfaces:**
- Consumes: `ParadaNoLocal`, `Local`, `CHAVE_FORA`, `valoresDaParada`, `minutos` (interno), `H` (interno) — já existem em `analise.ts`.
- Produces:
  - `interface SelecaoCruzada { local: string | null; servico: string | null; hora: number | null }`
  - `type DimensaoSelecao = keyof SelecaoCruzada`
  - `const SELECAO_VAZIA: SelecaoCruzada`
  - `horaDe(ini: number): number` (0–23)
  - `filtrarSelecao(paradas: ParadaNoLocal[], sel: SelecaoCruzada, locais: Map<string, Local>, ignorar?: DimensaoSelecao): ParadaNoLocal[]`
  - `const OUTROS = "Outros"`
  - `porServico(paradas: ParadaNoLocal[]): { nome: string; n: number; min: number }[]`
  - `servicosPrincipais(paradas: ParadaNoLocal[], n?: number): string[]`
  - `porHora(paradas: ParadaNoLocal[]): number[]` (24 posições, minutos)
  - `interface Placar { produtivo: number | null; pct: number | null; parado: number; servicos: number }`
  - `placar(paradas: ParadaNoLocal[], locais: Map<string, Local>): Placar`
  - `raioDaBolha(min: number, max: number): number` (pixels, 5 a 28)

- [ ] **Step 1: Escrever os testes que falham**

No `import` do topo de `src/lib/dominio/analise.test.ts`, acrescentar: `CHAVE_FORA, OUTROS, SELECAO_VAZIA, filtrarSelecao, horaDe, placar, porHora, porServico, raioDaBolha, servicosPrincipais`.

No fim do arquivo, acrescentar:

```ts
describe("painel: seleção cruzada, serviços, horas e placar", () => {
  const equip = equipDaFrota(FROTA);
  const usina = AREAS[0].polygon;
  // ALTO FORNO 3 (caminhão 1, Alta Pressão): 8h–9h com Vácuo e Transbordo; 14h–16h com Vácuo.
  // GALPÃO LONGE (caminhão 2, Alto Vácuo, em Recife): 10h–11h, sem apontamento e sem dado de motor.
  const { paradas, locais } = montarLocais(
    [
      p({ apont: ["Vácuo", "Transbordo"], motor: { secondary_motor_on: 30, stopped: 30 } }),
      p({ ini: 14 * H, fim: 16 * H, apont: ["Vácuo"], motor: { stopped: 120 } }),
      p({ veiculo_id: "2", placa: "EGC2993", area: "GALPÃO LONGE", lat: -8.05, lng: -34.9, ini: 10 * H, fim: 11 * H }),
    ],
    AREAS,
    equip,
    usina,
  );
  const sel = (o: Partial<typeof SELECAO_VAZIA>) => ({ ...SELECAO_VAZIA, ...o });

  it("hora do início (0–23)", () => {
    expect([horaDe(0), horaDe(14 * H), horaDe(24 * H - 1), horaDe(24 * H)]).toEqual([0, 14, 23, 23]);
  });
  it("seleção vazia não filtra; serviço, hora e lugar filtram", () => {
    expect(filtrarSelecao(paradas, SELECAO_VAZIA, locais)).toHaveLength(3);
    expect(filtrarSelecao(paradas, sel({ servico: "Vácuo" }), locais)).toHaveLength(2);
    expect(filtrarSelecao(paradas, sel({ servico: "Transbordo" }), locais)).toHaveLength(1);
    expect(filtrarSelecao(paradas, sel({ hora: 14 }), locais).map((x) => x.ini)).toEqual([14 * H]);
    expect(filtrarSelecao(paradas, sel({ local: "ALTO FORNO 3" }), locais)).toHaveLength(2);
  });
  it("'Longe da região' pega as paradas dos lugares fora da região; lugar que não existe no recorte esvazia", () => {
    expect(filtrarSelecao(paradas, sel({ local: CHAVE_FORA }), locais).map((x) => x.local)).toEqual(["GALPÃO LONGE"]);
    expect(filtrarSelecao(paradas, sel({ local: "OFICINA QUE SUMIU" }), locais)).toEqual([]);
  });
  it("ignorar uma dimensão: o gráfico dela mostra todas e as outras seleções continuam valendo", () => {
    const s = sel({ servico: "Transbordo", hora: 14 });
    expect(filtrarSelecao(paradas, s, locais)).toEqual([]);
    expect(filtrarSelecao(paradas, s, locais, "hora").map((x) => x.ini)).toEqual([8 * H]);
    expect(filtrarSelecao(paradas, s, locais, "servico").map((x) => x.ini)).toEqual([14 * H]);
  });
  it("por serviço: a parada com 2 apontamentos conta nos dois; o mesmo apontamento repetido conta uma vez", () => {
    expect(porServico(paradas)).toEqual([
      { nome: "Vácuo", n: 2, min: 180 },
      { nome: "Transbordo", n: 1, min: 60 },
    ]);
    const repetido = montarLocais([p({ apont: ["Vácuo", "Vácuo"] })], AREAS, equip, usina).paradas;
    expect(porServico(repetido)).toEqual([{ nome: "Vácuo", n: 1, min: 60 }]);
  });
  it("por serviço: depois do 10º, o resto soma em 'Outros'", () => {
    const nomes = Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
    const r = porServico(montarLocais([p({ apont: nomes })], AREAS, equip, usina).paradas);
    expect(r).toHaveLength(11);
    expect(r[9].nome).toBe("S10");
    expect(r[10]).toEqual({ nome: OUTROS, n: 2, min: 120 });
  });
  it("serviços principais: os 3 com mais paradas, sem 'Outros'", () => {
    expect(servicosPrincipais(paradas)).toEqual(["Vácuo", "Transbordo"]);
    const nomes = Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
    expect(servicosPrincipais(montarLocais([p({ apont: nomes })], AREAS, equip, usina).paradas)).toEqual(["S01", "S02", "S03"]);
  });
  it("por hora: minutos parados pela hora de início", () => {
    const h = porHora(paradas);
    expect(h).toHaveLength(24);
    expect([h[8], h[10], h[14], h[15]]).toEqual([60, 60, 120, 0]);
    expect(h.reduce((s, x) => s + x, 0)).toBe(240);
  });
  it("placar: produtivo e % só das paradas com regra e dado de motor; serviços = paradas com apontamento", () => {
    expect(placar(paradas, locais)).toEqual({ produtivo: 30, pct: 30 / 180, parado: 240, servicos: 2 });
  });
  it("placar: tipo sem regra de produtividade mostra '—' (null), nunca 0%", () => {
    const hv = montarLocais([p({ veiculo_id: "3", placa: "EAM3257", motor: { stopped: 60 } })], AREAS, equip, usina);
    expect(placar(hv.paradas, hv.locais)).toEqual({ produtivo: null, pct: null, parado: 60, servicos: 0 });
    expect(placar([], new Map())).toEqual({ produtivo: null, pct: null, parado: 0, servicos: 0 });
  });
  it("raio da bolha: a área cresce com as horas; mínimo de 5 px para dar para clicar", () => {
    expect(raioDaBolha(0, 0)).toBe(5);
    expect(raioDaBolha(100, 100)).toBe(28);
    expect(raioDaBolha(25, 100)).toBe(14);
    expect(raioDaBolha(1, 10000)).toBe(5);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: FAIL (`filtrarSelecao`, `porServico`... não são exportados / `is not a function`).

- [ ] **Step 3: Escrever as regras**

Acrescentar no **fim** de `src/lib/dominio/analise.ts` (depois de `porTipo`; usa `CHAVE_FORA`, `minutos`, `H` e `valoresDaParada`, que já existem no arquivo):

```ts
/** Clique no painel: o lugar (bolha ou ranking), o serviço (apontamento) e a hora de início escolhidos. */
export interface SelecaoCruzada {
  local: string | null;
  servico: string | null;
  hora: number | null;
}
export type DimensaoSelecao = keyof SelecaoCruzada;
export const SELECAO_VAZIA: SelecaoCruzada = { local: null, servico: null, hora: null };
/** Hora (0–23) do início da parada. */
export const horaDe = (ini: number) => Math.min(23, Math.floor(ini / H));

/** Paradas da seleção. `ignorar` pula uma dimensão: o gráfico dela mostra todas as opções e destaca a escolhida. */
export function filtrarSelecao(paradas: ParadaNoLocal[], sel: SelecaoCruzada, locais: Map<string, Local>, ignorar?: DimensaoSelecao): ParadaNoLocal[] {
  const noLocal = (p: ParadaNoLocal) => (sel.local === CHAVE_FORA ? locais.get(p.local)?.naRegiao === false : p.local === sel.local);
  return paradas.filter(
    (p) =>
      (ignorar === "local" || !sel.local || noLocal(p)) &&
      (ignorar === "servico" || !sel.servico || p.apont.includes(sel.servico)) &&
      (ignorar === "hora" || sel.hora == null || horaDe(p.ini) === sel.hora),
  );
}

/** Nome da barra que junta os serviços depois dos 10 primeiros (não é um serviço: não vira filtro). */
export const OUTROS = "Outros";
const MAX_SERVICOS = 10;
/** Paradas por apontamento do tablet, do maior ao menor (a parada com 2 apontamentos conta nos dois); depois do 10º, "Outros". */
export function porServico(paradas: ParadaNoLocal[]): { nome: string; n: number; min: number }[] {
  const m = new Map<string, { nome: string; n: number; min: number }>();
  for (const p of paradas) {
    for (const a of new Set(p.apont)) {
      const s = m.get(a) ?? { nome: a, n: 0, min: 0 };
      s.n++;
      s.min += minutos(p);
      m.set(a, s);
    }
  }
  const xs = [...m.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
  if (xs.length <= MAX_SERVICOS) return xs;
  const resto = xs.slice(MAX_SERVICOS);
  return [...xs.slice(0, MAX_SERVICOS), { nome: OUTROS, n: resto.reduce((s, x) => s + x.n, 0), min: resto.reduce((s, x) => s + x.min, 0) }];
}
/** Os n serviços com mais paradas: ganham cor no mapa. Calcular sobre os 30 dias inteiros, para a cor não trocar ao filtrar. */
export const servicosPrincipais = (paradas: ParadaNoLocal[], n = 3): string[] =>
  porServico(paradas)
    .filter((s) => s.nome !== OUTROS)
    .slice(0, n)
    .map((s) => s.nome);

/** Minutos parados pela hora de início (0–23). */
export function porHora(paradas: ParadaNoLocal[]): number[] {
  const h = Array<number>(24).fill(0);
  for (const p of paradas) h[horaDe(p.ini)] += minutos(p);
  return h;
}

/** Os 4 números do placar. `produtivo` e `pct` = null quando nenhuma parada tem regra de produtividade com dado de motor. */
export interface Placar {
  produtivo: number | null;
  pct: number | null;
  parado: number;
  servicos: number;
}
export function placar(paradas: ParadaNoLocal[], locais: Map<string, Local>): Placar {
  let produtivo = 0;
  let comRegra = 0;
  let parado = 0;
  let servicos = 0;
  for (const p of paradas) {
    const min = minutos(p);
    parado += min;
    if (p.apont.length) servicos++;
    const v = valoresDaParada(p, locais.get(p.local)?.naBase ?? false);
    if (v.produtivo != null && Object.keys(p.motor).length) {
      produtivo += v.produtivo;
      comRegra += min;
    }
  }
  return { produtivo: comRegra ? produtivo : null, pct: comRegra ? produtivo / comRegra : null, parado, servicos };
}

const RAIO_MIN = 5;
const RAIO_MAX = 28;
/** Raio da bolha em pixels: a ÁREA cresce com as horas paradas (raiz quadrada), com um mínimo que dá para clicar. */
export const raioDaBolha = (min: number, max: number) => (max <= 0 ? RAIO_MIN : Math.max(RAIO_MIN, RAIO_MAX * Math.sqrt(min / max)));
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: PASS (todos, inclusive os antigos).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/analise.ts src/lib/dominio/analise.test.ts
git commit -m "Análise: regras do painel (seleção cruzada, por serviço, por hora, placar, bolhas)"
```

---

### Task 2: A tela nova (placar, gráficos, mapa de bolhas e filtros cruzados)

**Files:**
- Test: `e2e/analise.spec.ts` (troca o 1º teste; os 2 de aviso ficam)
- Create: `src/app/analise/_componentes/barra-filtros.tsx`, `placar.tsx`, `grafico-barras.tsx`, `grafico-horas.tsx`
- Rewrite: `src/app/analise/_componentes/analise.tsx`, `camada-analise.ts`, `cores-analise.ts`
- Delete: `src/app/analise/_componentes/filtros.tsx`, `ranking.tsx`, `resumo-periodo.tsx`, `detalhe-local.tsx`
- Modify: `src/app/globals.css` (classes das bolhas, logo depois da linha `.area-sem-dado { ... }`)

**Interfaces:**
- Consumes (Task 1): `SelecaoCruzada`, `DimensaoSelecao`, `SELECAO_VAZIA`, `filtrarSelecao`, `OUTROS`, `porServico`, `servicosPrincipais`, `porHora`, `placar`, `Placar`, `raioDaBolha`. Já existentes: `CHAVE_FORA`, `PERIODOS`, `Periodo`, `EquipAnalise`, `areasDaRegiao`, `contornoDaUsina`, `equipDaFrota`, `filtrar`, `montarLocais`, `plantasDaRegiao`, `ranking`, `resumir`, `separarFora`, `ordemDeDesenho`, `ResumoLocal`; `useParadasAnalise`, `lerCercas`, `useRetrato`, `useMapa`, `Legenda`, `Aviso`, `Vazio`, `Segmentado`, `Selecao`, `cx`, `useOpcao`, `fmtHoras`, `diaLocal`, `esc`, `ORDEM_TIPOS`, `TIPOS_EQUIP`.
- Produces: `desenharBolhas(...)`, `corDoServico(nome, principais)`, `CORES_SERVICO`, `COR_OUTROS`, componentes `BarraFiltros`, `PlacarAnalise`, `GraficoBarras`, `GraficoHoras`.

- [ ] **Step 1: Trocar o 1º teste do e2e (vai falhar)**

Em `e2e/analise.spec.ts`, substituir o teste `"Análise: mapa em tela cheia, funil com medida/período/filtros e lista com áreas, resumo e detalhe"` inteiro por:

```ts
test("Análise: painel com placar, mapa e gráficos que se filtram", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const placar = page.getByRole("region", { name: "Placar" });
  const lugares = page.getByRole("region", { name: "Lugares" });
  const servicos = page.getByRole("region", { name: "Por serviço" });
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  // sem funil, lista, "Ir para" nem troca de fundo
  await expect(page.getByRole("button", { name: "Filtros da análise" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Áreas e resumo" })).toHaveCount(0);
  // placar: produtivo só do caminhão de Alta Pressão (motor 2º); o Pátio da base e a placa de fora da frota não entram
  await expect(placar).toContainText("1h30");
  await expect(placar).toContainText("38%");
  await expect(placar).toContainText("5h00");
  // lugares: PATIO (2 paradas da frota) em primeiro; "Longe da região" no fim
  await expect(lugares.getByRole("button").first()).toHaveAccessibleName(/^PATIO, 2h00/);
  await expect(page.getByText("PÁTIO DO TRANSPORTE RODOVIÁRIO", { exact: true })).toHaveCount(0);
  await expect(lugares.getByRole("button", { name: /Longe da região/ })).toBeVisible();
  // serviço: vira etiqueta e filtra placar e lugares; o gráfico de serviços continua com todos e marca o escolhido
  await servicos.getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await expect(lugares).toContainText("OFICINA");
  await expect(placar).toContainText("1h00");
  await expect(servicos.getByRole("button", { name: /^Aguardando Área/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(filtrando).toHaveCount(0);
  // hora do dia: só a parada que começou às 14h (PATIO)
  await page.getByRole("region", { name: "Hora do dia" }).getByRole("button", { name: /^14h,/ }).click();
  await expect(placar).toContainText("1h00");
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await filtrando.getByRole("button", { name: "Tirar filtro: 14h" }).click();
  // lugar pelo ranking; "Longe da região" troca o lugar escolhido
  await lugares.getByRole("button", { name: /^PATIO/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: PATIO" })).toBeVisible();
  await expect(placar).toContainText("2h00");
  await lugares.getByRole("button", { name: /Longe da região/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  await expect(placar).toContainText("1h00");
  // filtro do topo esvazia o recorte: a etiqueta continua e os gráficos avisam, sem quebrar
  await page.getByLabel("Tipo").selectOption("as");
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  await expect(servicos).toContainText("Nada neste filtro.");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  // aspirador não tem regra de produtividade: "—", nunca 0%
  await expect(placar.getByText("—").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run build; npx playwright test e2e/analise.spec.ts`
Expected: FAIL no teste novo (não existe região "Placar"); os 2 testes de aviso passam.

- [ ] **Step 3: Cores e mapa de bolhas**

Substituir todo `src/app/analise/_componentes/cores-analise.ts` por:

```ts
/** Cor dos 3 serviços principais no mapa, nesta ordem (validada no fundo preto: validate_palette.js --mode dark --pairs all, 10/10/2026). */
export const CORES_SERVICO = ["#3987e5", "#d95926", "#199e70"] as const;
/** Os outros serviços e as paradas sem apontamento. */
export const COR_OUTROS = "#6b7280";
/** Cor do serviço pela posição entre os principais (a cor segue o serviço; não muda quando o filtro muda). */
export function corDoServico(nome: string | null, principais: string[]): string {
  const i = nome ? principais.indexOf(nome) : -1;
  return i >= 0 && i < CORES_SERVICO.length ? CORES_SERVICO[i] : COR_OUTROS;
}
```

Substituir todo `src/app/analise/_componentes/camada-analise.ts` por:

```ts
import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, raioDaBolha, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import { corDoServico } from "./cores-analise";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;

/**
 * Mapa da região (sem imagem): contorno das plantas e das cercas, apagados, só de referência; uma bolha por lugar com
 * a área proporcional às horas paradas e a cor do serviço principal (3 cores + cinza). Com um lugar escolhido, ele ganha
 * contorno branco e os outros ficam apagados. Passar o mouse = nome, horas e serviço; clicar = escolhe/desfaz o lugar.
 */
export function desenharBolhas(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: { name: string; polygon: LatLng[] }[]; areas: { name: string; polygon: LatLng[] }[]; resumos: ResumoLocal[]; principais: string[]; sel: string | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { className: "usina-contorno", weight: 1.5, fillOpacity: 1, interactive: false }).addTo(camada);
  for (const a of ordemDeDesenho(o.areas)) L.polygon(a.polygon, { className: "area-sem-dado", weight: 1, fillOpacity: 1, interactive: false }).addTo(camada);
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
  const max = Math.max(0, ...o.resumos.map((r) => r.parado));
  // da maior para a menor: a bolha pequena fica por cima e recebe o clique
  for (const r of [...o.resumos].sort((a, b) => b.parado - a.parado)) {
    const principal = r.apont[0]?.nome ?? null;
    const classe = o.sel == null ? "bolha" : r.local.chave === o.sel ? "bolha bolha-selecionada" : "bolha bolha-apagada";
    L.circleMarker([r.local.lat, r.local.lng], { className: classe, radius: raioDaBolha(r.parado, max), color: "#000", weight: 2, fillColor: corDoServico(principal, o.principais), fillOpacity: 0.85 })
      .bindTooltip(`<b>${esc(r.local.nome)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}<br>${esc(principal ?? "sem apontamento")}`, { sticky: true, className: "rotulo-cerca" })
      .on("click", () => o.aoClicar(r.local.chave))
      .addTo(camada);
  }
}
```

Em `src/app/globals.css`, logo depois da linha `.area-sem-dado { fill: #1a1f29; stroke: #2b3240; }`, acrescentar:

```css
.bolha { cursor: pointer; }
.bolha-selecionada { stroke: #fff; stroke-width: 3px; }
.bolha-apagada { opacity: 0.25; }
```

- [ ] **Step 4: Barra de filtros e placar**

Criar `src/app/analise/_componentes/barra-filtros.tsx`:

```tsx
"use client";

import { Segmentado, Selecao } from "@/components/ui";
import { PERIODOS, type DimensaoSelecao, type EquipAnalise, type Periodo } from "@/lib/dominio/analise";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import type { TipoEquip } from "@/lib/tipos";

/** Filtros do topo (valem para tudo). */
export interface FiltrosTopo {
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
}
export const FILTROS_TOPO_VAZIOS: FiltrosTopo = { tipo: null, supervisor: null, regime: null };
/** Uma escolha feita com clique no mapa ou num gráfico. */
export interface Etiqueta {
  dim: DimensaoSelecao;
  texto: string;
}
const distintos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

/** Uma linha: período, tipo, supervisor e regime; embaixo, as etiquetas do que foi clicado ("Servitec ×") e "Limpar tudo". */
export function BarraFiltros({
  periodo,
  mudarPeriodo,
  filtros,
  mudarFiltros,
  equip,
  etiquetas,
  tirar,
  limpar,
}: {
  periodo: Periodo;
  mudarPeriodo: (p: Periodo) => void;
  filtros: FiltrosTopo;
  mudarFiltros: (p: Partial<FiltrosTopo>) => void;
  equip: EquipAnalise[];
  etiquetas: Etiqueta[];
  tirar: (d: DimensaoSelecao) => void;
  limpar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-[240px]">
          <Segmentado<Periodo> rotulo="Período" valor={periodo} mudar={mudarPeriodo} opcoes={PERIODOS.map((p) => ({ id: p, rotulo: <span className="whitespace-nowrap">{p} dias</span> }))} />
        </div>
        <Selecao aria-label="Tipo" value={filtros.tipo ?? ""} onChange={(e) => mudarFiltros({ tipo: (e.target.value || null) as TipoEquip | null })} className="w-auto min-w-[160px]">
          <option value="">Todos os tipos</option>
          {ORDEM_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPOS_EQUIP[t].rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Supervisor" value={filtros.supervisor ?? ""} onChange={(e) => mudarFiltros({ supervisor: e.target.value || null })} className="w-auto min-w-[180px]">
          <option value="">Todos os supervisores</option>
          {distintos(equip.map((e) => e.supervisor)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
        <Selecao aria-label="Regime" value={filtros.regime ?? ""} onChange={(e) => mudarFiltros({ regime: e.target.value || null })} className="w-auto min-w-[160px]">
          <option value="">Todos os regimes</option>
          {distintos(equip.map((e) => e.regime)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
      </div>
      {etiquetas.length > 0 && (
        <div role="group" aria-label="Filtrando" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-suave">Filtrando:</span>
          {etiquetas.map((e) => (
            <button
              key={e.dim}
              type="button"
              onClick={() => tirar(e.dim)}
              aria-label={`Tirar filtro: ${e.texto}`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-primaria/40 bg-primaria-suave px-2.5 font-medium text-texto"
            >
              {e.texto}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" onClick={limpar} className="font-semibold text-primaria hover:underline">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}
```

Criar `src/app/analise/_componentes/placar.tsx`:

```tsx
import type { Placar } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-suave">{rotulo}</dt>
      <dd className="text-2xl font-bold tabular-nums text-texto">{valor}</dd>
      {nota && <p className="text-[11px] text-suave">{nota}</p>}
    </div>
  );
}

/** Os 4 números do recorte (filtros do topo + tudo o que foi clicado), sempre exatos. */
export function PlacarAnalise({ p }: { p: Placar }) {
  return (
    <section aria-label="Placar">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Numero rotulo="Produtivo" valor={p.produtivo == null ? "—" : fmtHoras(p.produtivo)} nota={p.produtivo == null ? "sem regra de produtividade" : undefined} />
        <Numero rotulo="% produtivo" valor={p.pct == null ? "—" : `${Math.round(p.pct * 100)}%`} />
        <Numero rotulo="Parado" valor={fmtHoras(p.parado)} />
        <Numero rotulo="Serviços" valor={p.servicos.toLocaleString("pt-BR")} nota="paradas com apontamento" />
      </dl>
    </section>
  );
}
```

- [ ] **Step 5: Gráficos**

Criar `src/app/analise/_componentes/grafico-barras.tsx`:

```tsx
"use client";

import { cx } from "@/components/ui";

/** Uma barra: `dica` é o nome falado e o texto ao passar o mouse; `marca` é a bolinha com a cor do serviço no mapa. */
export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number;
  texto: string;
  dica: string;
  marca?: string;
  clicavel?: boolean;
}

/** Barras horizontais com o número escrito ao lado. Clicar escolhe (ou desfaz); com uma escolhida, as outras ficam apagadas. */
export function GraficoBarras({ titulo, sub, itens, selecionada, escolher, vazio }: { titulo: string; sub: string; itens: ItemBarra[]; selecionada: string | null; escolher: (chave: string) => void; vazio: string }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return (
    <section aria-label={titulo} className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        {titulo} <span className="font-normal normal-case tracking-normal">· {sub}</span>
      </h2>
      {itens.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {itens.map((i) => (
            <li key={i.chave}>
              <button
                type="button"
                disabled={i.clicavel === false}
                aria-pressed={selecionada === i.chave}
                aria-label={i.dica}
                title={i.dica}
                onClick={() => escolher(i.chave)}
                className={cx(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2 disabled:cursor-default disabled:hover:bg-transparent",
                  selecionada != null && selecionada !== i.chave && "opacity-40",
                  selecionada === i.chave && "bg-primaria-suave",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {i.marca && <i aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: i.marca }} />}
                  <span className="truncate">{i.rotulo}</span>
                </span>
                <b className="tabular-nums text-texto">{i.texto}</b>
                <span aria-hidden className="col-span-2 mt-0.5 h-1.5 rounded-full bg-superficie-2">
                  <span className="block h-full rounded-full bg-primaria" style={{ width: `${max > 0 ? Math.max(2, (i.valor / max) * 100) : 0}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Criar `src/app/analise/_componentes/grafico-horas.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { fmtHoras } from "@/lib/dominio/formato";

/** 24 colunas (0h–23h) com as horas paradas pela hora de início. Passar o mouse mostra o valor; clicar escolhe a hora. */
export function GraficoHoras({ minutos, selecionada, escolher, vazio }: { minutos: number[]; selecionada: number | null; escolher: (h: number) => void; vazio: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(0, ...minutos);
  const h = foco ?? selecionada;
  return (
    <section aria-label="Hora do dia" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Hora do dia <span className="font-normal normal-case tracking-normal">· horas paradas pela hora de início</span>
      </h2>
      {max <= 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <p className="mt-1 h-4 text-[11px] text-texto">{h != null ? `${h}h · ${fmtHoras(minutos[h])} parado` : ""}</p>
          <div role="group" aria-label="Horas" className="mt-1 flex h-24 items-end gap-[2px]" onMouseLeave={() => setFoco(null)}>
            {minutos.map((m, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={selecionada === i}
                aria-label={`${i}h, ${fmtHoras(m)} parado`}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                onClick={() => escolher(i)}
                className={cx("flex h-full flex-1 items-end rounded-sm hover:bg-superficie-2", selecionada != null && selecionada !== i && "opacity-40")}
              >
                <span className="block w-full rounded-t-[4px] bg-primaria" style={{ height: `${m > 0 ? Math.max(3, (m / max) * 100) : 0}%` }} />
              </button>
            ))}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-[10px] text-suave">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 6: A tela e a limpeza dos componentes antigos**

Apagar: `git rm src/app/analise/_componentes/filtros.tsx src/app/analise/_componentes/ranking.tsx src/app/analise/_componentes/resumo-periodo.tsx src/app/analise/_componentes/detalhe-local.tsx`

Substituir todo `src/app/analise/_componentes/analise.tsx` por:

```tsx
"use client";

import type * as Leaflet from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Legenda } from "@/components/mapa/legenda";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Vazio } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import {
  CHAVE_FORA, OUTROS, PERIODOS, SELECAO_VAZIA, areasDaRegiao, contornoDaUsina, equipDaFrota, filtrar, filtrarSelecao, montarLocais, placar, plantasDaRegiao,
  porHora, porServico, ranking, resumir, separarFora, servicosPrincipais,
  type DimensaoSelecao, type Periodo, type SelecaoCruzada,
} from "@/lib/dominio/analise";
import { diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { BarraFiltros, FILTROS_TOPO_VAZIOS, type Etiqueta, type FiltrosTopo } from "./barra-filtros";
import { desenharBolhas } from "./camada-analise";
import { COR_OUTROS, corDoServico } from "./cores-analise";
import { GraficoBarras, type ItemBarra } from "./grafico-barras";
import { GraficoHoras } from "./grafico-horas";
import { PlacarAnalise } from "./placar";

/**
 * Painel da Análise (desenho: docs/superpowers/specs/2026-10-10-painel-analise-design.md): filtros e placar em cima,
 * mapa de bolhas à esquerda e os gráficos à direita. Clicar numa bolha, num lugar, num serviço ou numa hora filtra o resto;
 * o placar aplica tudo, cada gráfico aplica as escolhas dos outros e marca a sua.
 */
export function Analise() {
  const { retrato } = useRetrato();
  const { paradas, carregando, erro } = useParadasAnalise();
  const { ref, pronto } = useMapa(14, false);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [hoje] = useState(() => diaLocal());
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  const [filtros, setFiltros] = useState<FiltrosTopo>(FILTROS_TOPO_VAZIOS);
  const [sel, setSel] = useState<SelecaoCruzada>(SELECAO_VAZIA);
  // o zoom muda quais nomes de planta cabem no mapa
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const usina = useMemo(() => contornoDaUsina(cercas), [cercas]);
  const areas = useMemo(() => areasDaRegiao(cercas.filter((c) => c.tipo === "area"), usina), [cercas, usina]);
  const plantas = useMemo(() => plantasDaRegiao(cercas), [cercas]);
  const equip = useMemo(() => equipDaFrota(retrato?.veiculos ?? []), [retrato]);
  const base = useMemo(() => montarLocais(paradas, cercas.filter((c) => c.tipo === "area"), equip, usina), [paradas, cercas, equip, usina]);
  // cor fixa por serviço: os 3 principais dos 30 dias inteiros (não trocam ao filtrar)
  const principais = useMemo(() => servicosPrincipais(base.paradas), [base]);
  const doFiltro = useMemo(() => filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros, faixas: [], diasSemana: [] }), [base, hoje, periodo, filtros]);
  const recorte = useCallback((ignorar?: DimensaoSelecao) => filtrarSelecao(doFiltro, sel, base.locais, ignorar), [doFiltro, sel, base]);
  const numeros = useMemo(() => placar(recorte(), base.locais), [recorte, base]);
  const { dentro, fora } = useMemo(() => separarFora(resumir(recorte("local"), base.locais)), [recorte, base]);
  const servicos = useMemo(() => porServico(recorte("servico")), [recorte]);
  const horas = useMemo(() => porHora(recorte("hora")), [recorte]);

  const alternar = useCallback(<K extends DimensaoSelecao,>(k: K, v: SelecaoCruzada[K]) => setSel((s) => ({ ...s, [k]: s[k] === v ? null : v })), []);
  const clicarBolha = useCallback((chave: string) => alternar("local", chave), [alternar]);
  // pelo ranking: aproxima o mapa só quando o lugar tem bolha ("Longe da região" não tem coordenada)
  const escolherLugar = (chave: string) => {
    const r = dentro.find((x) => x.local.chave === chave);
    if (sel.local !== chave && r && pronto) pronto.mapa.flyTo([r.local.lat, r.local.lng], Math.max(pronto.mapa.getZoom(), 16), { duration: 0.6 });
    alternar("local", chave);
  };

  // mapa limpo (zoom pela roda ou pinça); abre na usina e não deixa sair da região
  useEffect(() => {
    if (!pronto) return;
    pronto.mapa.getContainer().classList.add("mapa-analise");
    pronto.mapa.zoomControl.remove();
    const g = pronto.L.layerGroup().addTo(pronto.mapa);
    camada.current = g;
    const aoZoom = () => setZoom(pronto.mapa.getZoom());
    pronto.mapa.on("zoomend", aoZoom);
    return () => {
      pronto.mapa.off("zoomend", aoZoom);
      g.remove();
    };
  }, [pronto]);
  useEffect(() => {
    if (!pronto || !usina) return;
    const regiao = pronto.L.latLngBounds(plantas.flatMap((pl) => pl.polygon));
    pronto.mapa.setMaxBounds(regiao.pad(0.15));
    pronto.mapa.setMinZoom(Math.max(0, pronto.mapa.getBoundsZoom(regiao) - 1));
    pronto.mapa.fitBounds(pronto.L.polygon(usina).getBounds(), { padding: [12, 12] });
  }, [pronto, usina, plantas]);
  useEffect(() => {
    if (pronto && camada.current) desenharBolhas(pronto.L, camada.current, pronto.mapa, { plantas, areas, resumos: dentro, principais, sel: sel.local, aoClicar: clicarBolha });
  }, [pronto, plantas, areas, dentro, principais, sel.local, zoom, clicarBolha]);

  const lugares: ItemBarra[] = [...ranking(dentro, "parado", 10), ...(fora ? [fora] : [])].map((r) => ({
    chave: r.local.chave,
    rotulo: r.local.nome,
    valor: r.parado,
    texto: fmtHoras(r.parado),
    dica: `${r.local.nome}, ${fmtHoras(r.parado)} parado`,
  }));
  const itensServico: ItemBarra[] = servicos.map((s) => ({
    chave: s.nome,
    rotulo: s.nome,
    valor: s.n,
    texto: s.n.toLocaleString("pt-BR"),
    dica: `${s.nome}, ${s.n} ${s.n === 1 ? "parada" : "paradas"}, ${fmtHoras(s.min)}`,
    marca: s.nome === OUTROS ? undefined : corDoServico(s.nome, principais),
    clicavel: s.nome !== OUTROS,
  }));
  const etiquetas: Etiqueta[] = [];
  if (sel.local) etiquetas.push({ dim: "local", texto: sel.local === CHAVE_FORA ? "Longe da região" : (base.locais.get(sel.local)?.nome ?? sel.local) });
  if (sel.servico) etiquetas.push({ dim: "servico", texto: sel.servico });
  if (sel.hora != null) etiquetas.push({ dim: "hora", texto: `${sel.hora}h` });
  const legenda = principais.length ? [...principais.map((n) => ({ rotulo: n, cor: corDoServico(n, principais) })), { rotulo: "Outros / sem apontamento", cor: COR_OUTROS }] : [];

  // tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
  const aviso = erro
    ? /could not find the table|does not exist|PGRST205|42P01/i.test(erro)
      ? "A tabela da análise ainda não foi criada: rode supabase/analise.sql no Supabase."
      : `Não foi possível carregar: ${erro}`
    : null;
  const semHistorico = !carregando && !erro && !paradas.length;
  const vazio = carregando ? "Carregando o histórico…" : "Nada neste filtro.";

  return (
    <div className="altura-tela flex flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
      <BarraFiltros
        periodo={periodo}
        mudarPeriodo={setPeriodo}
        filtros={filtros}
        mudarFiltros={(p) => setFiltros((f) => ({ ...f, ...p }))}
        equip={[...equip.values()]}
        etiquetas={etiquetas}
        tirar={(d) => setSel((s) => ({ ...s, [d]: null }))}
        limpar={() => setSel(SELECAO_VAZIA)}
      />
      <PlacarAnalise p={numeros} />
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] lg:grid-rows-[minmax(0,1fr)]">
        <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-xl border border-borda lg:h-full">
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={legenda} />
          {(aviso || semHistorico) && (
            <div className="absolute left-1/2 top-1/2 z-[600] w-[min(380px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 p-1 shadow-xl">
              {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : <Vazio titulo="O histórico ainda não foi enviado">Rode o “Enviar Historico ao Site.bat” no PC.</Vazio>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <GraficoBarras titulo="Lugares" sub="mais tempo parado" itens={lugares} selecionada={sel.local} escolher={escolherLugar} vazio={vazio} />
          <GraficoBarras titulo="Por serviço" sub="paradas com o apontamento" itens={itensServico} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />
          <GraficoHoras minutos={horas} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Conferir tipos e regras de código**

Run: `npx tsc --noEmit; npm run lint`
Expected: sem erros. (Se o lint reclamar de import sem uso em `analise.tsx`, tirar só aquele nome.)

- [ ] **Step 8: Rodar o e2e e ver passar**

Run: `npm run build; npx playwright test e2e/analise.spec.ts`
Expected: PASS nos 3 testes, nos projetos `computador` e `celular`.

- [ ] **Step 9: Olhar a tela de verdade**

Run: `npm run dev` (em segundo plano) e abrir `http://localhost:3000/analise/` no computador (≥ 1280px).
Conferir a olho: placar numa linha; mapa à esquerda com bolhas e legenda; 3 gráficos à direita sem texto encavalado; clicar numa bolha cria a etiqueta e apaga as outras bolhas; abaixo de 1024px vira uma coluna só.

- [ ] **Step 10: Commit**

```bash
git add -A src/app/analise src/app/globals.css e2e/analise.spec.ts
git commit -m "Análise: painel com placar, mapa de bolhas e gráficos que se filtram (sai funil, lista, medidas e Ir para)"
```

---

### Task 3: Limpeza das regras antigas, documentação e verificação final

**Files:**
- Modify: `src/lib/dominio/analise.ts` (apagar `faixaDeCor`, `porDia`, `porTipo`)
- Modify: `src/lib/dominio/analise.test.ts` (apagar os testes dessas 3 e tirar do `import`)
- Modify: `src/app/globals.css` (apagar estilos que só a tela antiga usava)
- Modify: `README.md` (item 12), `CHANGELOG.md` (entrada nova no topo)

**Interfaces:**
- Consumes: nada novo.
- Produces: nada novo (só remove código sem uso).

- [ ] **Step 1: Confirmar que ninguém mais usa as 3 funções**

Run: `grep -rn -E "faixaDeCor|porDia|porTipo" src coletor e2e`
Expected: só aparecem em `src/lib/dominio/analise.ts` e `src/lib/dominio/analise.test.ts`. (Se aparecer em outro arquivo, NÃO apagar aquela função.)

- [ ] **Step 2: Apagar as funções e os testes delas**

Em `src/lib/dominio/analise.ts`, apagar as declarações completas de `faixaDeCor` (a linha `export const faixaDeCor = ...` com o comentário de cima), `porDia` e `porTipo` (com o comentário de cima de cada uma). Se `ORDEM_TIPOS` ficar sem uso, tirar do `import`.

Em `src/lib/dominio/analise.test.ts`, tirar `faixaDeCor`, `porDia` e `porTipo` do `import` e apagar cada `it(...)` que os chama (achar com `grep -n -E "faixaDeCor|porDia|porTipo" src/lib/dominio/analise.test.ts`). Se um `describe` ficar vazio, apagar o `describe`.

- [ ] **Step 3: Apagar os estilos da tela antiga**

Em `src/app/globals.css`, apagar as regras: `.area-selecionada`, `.rotulo-area` e `.rotulo-area > span` (e `b`), `.mapa-analise.mapa-claro.leaflet-container` e todas as que começam com `.mapa-claro`. Manter `.mapa-analise.leaflet-container`, `.usina-contorno`, `.area-sem-dado`, `.rotulo-planta*` e as `.bolha*`.
Conferir: `grep -rn -E "rotulo-area|area-selecionada|mapa-claro" src` não deve achar nada.

- [ ] **Step 4: README**

Em `README.md`, trocar o texto do item **12. Mapa de análise** por:

```md
12. **Painel de análise** (`/analise`, decisão do dono, 10/10/2026; desenho em `docs/superpowers/specs/2026-10-10-painel-analise-design.md`): feito para computador/TV. Em cima, uma linha de filtros (período 7/15/30 dias, tipo, supervisor, regime) e o **placar** (produtivo, % produtivo, parado, serviços). À esquerda, o **mapa da região** com uma **bolha por lugar** (tamanho = horas paradas; cor = serviço principal, só os 3 que mais aparecem nos 30 dias; o resto em cinza). À direita, **Lugares** (10 com mais tempo parado + "Longe da região"), **Por serviço** (paradas por apontamento do tablet) e **Hora do dia** (0h–23h). **Um filtra o outro:** clicar numa bolha, num lugar, num serviço ou numa hora vira uma etiqueta no topo ("Servitec ×") e filtra o resto; cada gráfico continua mostrando as opções dele com a escolhida marcada. O **Pátio do Transporte Rodoviário (a base) fica fora**; o que fica a mais de 50 km vira "Longe da região". Lê a tabela `analise_paradas` (`supabase/analise.sql`): só fatos, no máximo 30 dias; as regras ficam em `src/lib/dominio/analise.ts`.
```

E na tabela de pastas, trocar a linha de `src/app/analise/` por:

```md
| `src/app/analise/` | Painel de análise: placar, mapa de bolhas e gráficos (lugares, serviços, hora do dia) que se filtram (`analise_paradas`, 30 dias) |
```

- [ ] **Step 5: CHANGELOG**

Em `CHANGELOG.md`, logo abaixo do título `# CHANGELOG · Monitoramento de Localização`, acrescentar:

```md
## Análise em painel · 10/10/2026 (não publicado)
- **A tela Análise virou um painel de apresentação** (computador/TV): filtros e placar em cima (produtivo, % produtivo, parado, serviços), mapa de bolhas à esquerda e 3 gráficos à direita (Lugares, Por serviço, Hora do dia), todos com o número exato escrito.
- **Um filtra o outro:** clicar numa bolha, num lugar, num serviço ou numa hora vira uma etiqueta no topo e filtra o resto; o × tira só aquela e "Limpar tudo" volta.
- **Saíram:** o funil, o botão de lista, as 6 medidas, o "Ir para", a troca de fundo preto/branco, os filtros de faixa do dia e dia da semana e o detalhe "quem atende" (pedido do dono: menos botões, dados precisos).
- Mapa: só os 3 serviços com mais paradas ganham cor (testadas para daltonismo); os outros ficam cinza.
```

- [ ] **Step 6: Verificação completa**

Run: `npx tsc --noEmit; npm run lint; npx vitest run; npm run build; npx playwright test`
Expected: tudo passa (tipos, lint, todos os testes de unidade e todos os e2e nos 2 projetos). Se algum e2e de outra tela falhar, ver se a falha já existia antes (`git stash` não deve ser usado; comparar rodando o mesmo teste no commit anterior com `git worktree add`), e só corrigir o que esta mudança quebrou.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/dominio/analise.ts src/lib/dominio/analise.test.ts src/app/globals.css README.md CHANGELOG.md
git commit -m "Análise: tira as regras e estilos da tela antiga; README e CHANGELOG do painel"
```

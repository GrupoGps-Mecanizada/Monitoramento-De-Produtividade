# Análise — visualização inteligente (cor por tempo parado, grade hora × dia, barra por status) — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) seletor "Cor do mapa: Da cerca | Tempo parado" — em Tempo parado as cercas ganham 5 tons de azul pelo tempo parado e as que mais pesam mostram as horas escritas; (2) grade "Quando para" (dia da semana × hora) no lugar de "Hora do dia", clicável (filtra hora e dia); (3) na aba Status do motor, barra por placa dividida por status com o destaque ("Parado ligado" ou o status escolhido) e o total.

**Architecture:** Contas puras em `assuntos.ts` (grade, faixas, placas por status) e seleção cruzada com a dimensão `dia` em `analise.ts` (`ignorar` aceita lista). Tela: `cores-analise.ts` (rampa azul validada), `grade-quando.tsx`, `barras-status.tsx`, `legenda-tempo.tsx`; `camada-analise.ts` ganha o modo de cor.

**Tech Stack:** Next.js estático, React, TypeScript, Tailwind, Leaflet, vitest, Playwright.

**Spec:** desenho curto aprovado no chat em 14/10/2026 (base: `6 - Pesquisas da Web/2026-10-14 Visualização de paradas de frota.md` no cofre e `docs/superpowers/specs/2026-10-13-analise-satelite-calor-design.md`).

## Global Constraints
- Rampa sequencial azul validada (dataviz): `#cde2fb, #86b6ef, #3987e5, #1c5cab, #0d366b` (claro = pouco, escuro = muito). Nada de arco-íris.
- Barra por status: destaque em `#2a78d6`; os outros status em cinza alternado (`#8b95a7`, `#b4bcc8`); 2 px entre partes; o número fica em texto, nunca só na cor.
- "Cor do mapa" padrão = "Da cerca" (pedido do dono); a escolha fica no navegador (`mon-analise-cor`).
- Sem SQL, sem GAUSS, sem dependência nova. Arquivos de outra sessão (`src/app/cronoanalise/`, `cronoanalise.ts`) não são tocados.
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

## Review Focus
1. Poucas cercas ou valores iguais: as faixas não podem repetir limite nem dar índice fora da rampa. Coberto em `assuntos.test.ts`.
2. Grade sem nenhuma parada: "Nada neste filtro.", sem quebrar. Coberto no e2e (Tipo que esvazia).
3. Clicar no mesmo quadradinho de novo desfaz hora e dia. Coberto no e2e.
4. Status escolhido que some com um filtro: as barras voltam ao destaque "Parado ligado" (regra da Parte B). Coberto no e2e existente.
5. Etiquetas: hora e dia viram duas etiquetas; "Limpar tudo" limpa as duas. Coberto no e2e.

---

### Task 1: Contas — grade, faixas, placas por status e a dimensão `dia`

**Files:** Modify `src/lib/dominio/analise.ts`, `src/lib/dominio/assuntos.ts`; Test `src/lib/dominio/analise.test.ts`, `src/lib/dominio/assuntos.test.ts`.

**Interfaces (Produces):** `SelecaoCruzada.dia: number | null`; `DIAS_CURTOS: string[]` (0 = dom); `filtrarSelecao(paradas, sel, locais, ignorar?: DimensaoSelecao | DimensaoSelecao[])`; `gradeHoraDia(ps, peso): number[][]` (7 × 24, linha = dia da semana 0..6); `faixasDe(valores: number[]): number[]`; `faixaDe(v: number, limites: number[]): number`; `ORDEM_STATUS: string[]`; `type PlacaStatus {chave,nome,total,destaque,partes: StatusSoma[]}`; `placasPorStatus(ps, destaque: string, n = 10): PlacaStatus[]`.

- [ ] **Step 1: Testes que falham.** Em `analise.test.ts` (import `DIAS_CURTOS`), dentro do describe da seleção cruzada:
```ts
  it("dia da semana: filtra; ignorar uma lista pula hora e dia juntos", () => {
    // 2026-10-01 é quinta (4)
    expect(DIAS_CURTOS[4]).toBe("qui");
    expect(filtrarSelecao(paradas, sel({ dia: 4 }), locais)).toHaveLength(3);
    expect(filtrarSelecao(paradas, sel({ dia: 0 }), locais)).toEqual([]);
    expect(filtrarSelecao(paradas, sel({ dia: 0, hora: 3 }), locais, ["hora", "dia"])).toHaveLength(3);
  });
```
Em `assuntos.test.ts` (import `faixaDe, faixasDe, gradeHoraDia, placasPorStatus`):
```ts
describe("visualização: grade, faixas e placas por status", () => {
  it("grade dia da semana × hora pelo peso (2026-10-01 = quinta)", () => {
    const g = gradeHoraDia(paradas, pesoParado);
    expect(g).toHaveLength(7);
    expect(g[4]).toHaveLength(24);
    expect([g[4][8], g[4][14], g[4][10], g[4][20]]).toEqual([60, 120, 60, 60]);
    expect(g[0].every((x) => x === 0)).toBe(true);
  });
  it("faixas: quintis dos valores > 0 sem repetir; faixaDe dá 0..n", () => {
    expect(faixasDe([10, 20, 30, 40, 50, 0])).toEqual([10, 20, 30, 40]);
    expect(faixasDe([5, 5, 5])).toEqual([5]);
    expect(faixasDe([0, 0])).toEqual([]);
    expect([faixaDe(10, [10, 20, 30, 40]), faixaDe(11, [10, 20, 30, 40]), faixaDe(99, [10, 20, 30, 40]), faixaDe(7, [])]).toEqual([0, 1, 4, 0]);
  });
  it("placas por status: partes na ordem fixa, ordenadas pelo destaque e depois pelo total", () => {
    const r = placasPorStatus(paradas, "stopped");
    expect(r.map((l) => [l.nome, l.destaque, l.total])).toEqual([["EGC2985", 140, 240], ["EGC2993", 0, 60]]);
    expect(r[0].partes.map((x) => x.cod)).toEqual(["stopped", "secondary_motor_on"]);
    expect(placasPorStatus(paradas, "off").map((l) => l.nome)).toEqual(["EGC2993", "EGC2985"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/analise.test.ts src/lib/dominio/assuntos.test.ts` → FAIL.

- [ ] **Step 3: Implementar.** `analise.ts`:
```ts
/** Clique no painel: o lugar (bolha ou ranking), o serviço (apontamento), a hora de início, a placa e o dia da semana escolhidos. */
export interface SelecaoCruzada {
  local: string | null;
  servico: string | null;
  hora: number | null;
  placa: string | null;
  /** 0 = domingo ... 6 = sábado */
  dia: number | null;
}
export type DimensaoSelecao = keyof SelecaoCruzada;
export const SELECAO_VAZIA: SelecaoCruzada = { local: null, servico: null, hora: null, placa: null, dia: null };
/** Nome curto do dia da semana (0 = domingo). */
export const DIAS_CURTOS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
```
`filtrarSelecao(..., ignorar?: DimensaoSelecao | DimensaoSelecao[])`, com `const pula = (d: DimensaoSelecao) => (Array.isArray(ignorar) ? ignorar.includes(d) : ignorar === d);`, trocando cada `ignorar === "x"` por `pula("x")` e acrescentando `&& (pula("dia") || sel.dia == null || diaDaSemana(p.dia) === sel.dia)`. Comentário: "`ignorar` pula uma dimensão (ou várias, como hora e dia da grade)".

`assuntos.ts` (import `diaDaSemana` de `./analise`):
```ts
/** Peso por dia da semana (linha 0 = domingo) e hora de início (coluna 0–23): a grade "Quando para". */
export function gradeHoraDia(ps: ParadaNoLocal[], peso: Peso): number[][] {
  const g = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const p of ps) g[diaDaSemana(p.dia)][horaDe(p.ini)] += peso(p);
  return g;
}

/** Limites de até 5 faixas (quintis dos valores acima de 0, sem repetir): valor ≤ limites[i] cai na faixa i. */
export function faixasDe(valores: number[]): number[] {
  const vs = valores.filter((v) => v > 0).sort((a, b) => a - b);
  if (!vs.length) return [];
  return [...new Set([0.2, 0.4, 0.6, 0.8].map((q) => vs[Math.floor(q * (vs.length - 1))]))];
}
/** Faixa do valor: 0 (até o 1º limite) ... limites.length (acima do último). */
export function faixaDe(v: number, limites: number[]): number {
  let i = 0;
  while (i < limites.length && v > limites[i]) i++;
  return i;
}

/** Ordem fixa dos status nas barras (a cor segue o status, nunca a posição). */
export const ORDEM_STATUS = ["stopped", "on", MOTOR2, "categorized_stop", "off", "main_switch_off", "maintenance", "out_of_plant", "not_appropriated", "no_data"];
const posStatus = (cod: string) => {
  const i = ORDEM_STATUS.indexOf(cod);
  return i < 0 ? ORDEM_STATUS.length : i;
};
export interface PlacaStatus {
  chave: string;
  nome: string;
  /** minutos de motor (todos os status) */
  total: number;
  /** minutos do status em destaque */
  destaque: number;
  partes: StatusSoma[];
}
/** Placas com o tempo de cada status do motor, ordenadas pelo status em destaque e depois pelo total (top n). */
export function placasPorStatus(ps: ParadaNoLocal[], destaque: string, n = 10): PlacaStatus[] {
  const m = new Map<string, Map<string, number>>();
  for (const p of ps) {
    const partes = m.get(p.placa) ?? new Map<string, number>();
    for (const [cod, min] of Object.entries(p.motor)) if (min > 0) partes.set(cod, (partes.get(cod) ?? 0) + min);
    m.set(p.placa, partes);
  }
  return [...m]
    .map(([placa, partes]) => {
      const lista = [...partes].map(([cod, min]) => ({ cod, rotulo: rotuloStatus(cod), min })).sort((a, b) => posStatus(a.cod) - posStatus(b.cod));
      return { chave: placa, nome: placa, total: lista.reduce((s, x) => s + x.min, 0), destaque: partes.get(destaque) ?? 0, partes: lista };
    })
    .filter((l) => l.total > 0)
    .sort((a, b) => b.destaque - a.destaque || b.total - a.total || a.nome.localeCompare(b.nome))
    .slice(0, n);
}
```

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/lib/dominio && npx tsc --noEmit` → PASS (o tipo novo de `ignorar` pode exigir ajustar `recorte` em `analise.tsx`: `(ignorar?: DimensaoSelecao | DimensaoSelecao[])`).

- [ ] **Step 5: Commit** — `git add src/lib/dominio src/app/analise/_componentes/analise.tsx && git commit -m "Análise: grade hora × dia, faixas, placas por status e o dia da semana na seleção"`

### Task 2: Tela — cor do mapa, grade "Quando para" e barras por status

**Files:** Create `src/app/analise/_componentes/cores-analise.ts`, `grade-quando.tsx`, `barras-status.tsx`, `legenda-tempo.tsx`; Modify `camada-analise.ts`, `analise.tsx`, `assunto/painel-status.tsx`, `assunto/painel-motor2.tsx`, `familia/painel-familia.tsx` (tipo do `recorte`), `globals.css`; Delete `grafico-horas.tsx` (se ficar sem uso); Test `e2e/analise.spec.ts`.

- [ ] **Step 1: e2e que falha.**
No primeiro teste, trocar `await page.getByRole("region", { name: "Hora do dia" }).getByRole("button", { name: /^14h,/ }).click();` por
```ts
  await page.getByRole("region", { name: "Quando para" }).getByRole("button", { name: /14h, 1h00/ }).click();
```
No teste de Status, trocar
```ts
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Placas" })).toContainText("1h30");
```
por
```ts
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button").first()).toHaveAccessibleName(/^EGC2985, Motor 2º ligado 1h30 de/);
```
Novo teste:
```ts
test("Análise: cor do mapa por tempo parado com as horas nas cercas; grade 'Quando para' filtra hora e dia", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const cor = page.getByRole("tablist", { name: "Cor do mapa" });
  await expect(cor.getByRole("tab", { name: "Da cerca" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[aria-label="Legenda do tempo parado"]')).toHaveCount(0);
  await cor.getByRole("tab", { name: "Tempo parado" }).click();
  await expect(page.locator('[aria-label="Legenda do tempo parado"]')).toBeVisible();
  await expect(page.locator(".mapa-analise .rotulo-horas").first()).toBeAttached();
  // grade: o quadradinho das 14h (PATIO) vira duas etiquetas: hora e dia; clicar de novo desfaz
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  const quadro = page.getByRole("region", { name: "Quando para" }).getByRole("button", { name: /14h, 1h00/ });
  await quadro.click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: 14h" })).toBeVisible();
  await expect(filtrando.getByRole("button", { name: /^Tirar filtro: (dom|seg|ter|qua|qui|sex|sáb)$/ })).toBeVisible();
  await quadro.click();
  await expect(filtrando).toHaveCount(0);
  // a escolha da cor fica guardada
  await page.reload();
  await expect(page.getByRole("tablist", { name: "Cor do mapa" }).getByRole("tab", { name: "Tempo parado" })).toHaveAttribute("aria-selected", "true");
  // filtro que esvazia: a grade avisa
  await page.getByLabel("Tipo").selectOption("hv");
  await expect(page.getByRole("region", { name: "Quando para" })).toContainText("Nada neste filtro.");
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run build && npx playwright test e2e/analise.spec.ts` → FAIL ("Cor do mapa" / "Quando para" inexistentes).

- [ ] **Step 3: `cores-analise.ts`**
```ts
import { fmtHoras } from "@/lib/dominio/formato";

/** Rampa sequencial azul (validada para daltonismo): claro = pouco, escuro = muito. */
export const RAMPA_AZUL = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
/** Cor da faixa i de n faixas, espalhada pela rampa (com poucas faixas, sem pular para o escuro). */
export const corDaFaixa = (i: number, n: number) => RAMPA_AZUL[n <= 1 ? 2 : Math.round((i * (RAMPA_AZUL.length - 1)) / (n - 1))];
/** Rótulo de cada faixa a partir dos limites (minutos): "até 2h00", "2h00 a 5h00", ..., "mais de 20h00". */
export function rotulosDasFaixas(limites: number[]): string[] {
  if (!limites.length) return [];
  return [`até ${fmtHoras(limites[0])}`, ...limites.slice(1).map((l, i) => `${fmtHoras(limites[i])} a ${fmtHoras(l)}`), `mais de ${fmtHoras(limites[limites.length - 1])}`];
}
/** Destaque das barras por status e os cinzas dos outros status. */
export const COR_DESTAQUE = "#2a78d6";
export const CINZAS = ["#8b95a7", "#b4bcc8"];
```

- [ ] **Step 4: `camada-analise.ts`** — `desenharCercas` ganha `modo: "cerca" | "tempo"` em `o`. Em `"tempo"`: `const limites = faixasDe(o.resumos.map((r) => r.parado));` (import `faixaDe, faixasDe` de `@/lib/dominio/assuntos`, `corDaFaixa` de `./cores-analise`); a área com resumo usa `const cor = corDaFaixa(faixaDe(r.parado, limites), limites.length + 1)` com `color: cor, fillColor: cor, fillOpacity: escolhida ? 0.9 : 0.7`; área sem resumo: `color: "#ffffff", weight: 1, opacity: 0.35, fillOpacity: 0`. Em `"cerca"`: o desenho de hoje. Depois das áreas, só em `"tempo"`, as horas nas 12 áreas com mais tempo parado:
```ts
  if (o.modo === "tempo") {
    const porNome = new Map(o.areas.map((a) => [a.name, a]));
    for (const r of [...o.resumos].sort((a, b) => b.parado - a.parado).slice(0, 12)) {
      const a = porNome.get(r.local.chave);
      if (!a) continue;
      L.marker(L.polygon(a.polygon).getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className: "rotulo-horas", iconSize: [0, 0], html: `<span>${esc(fmtHoras(r.parado))}</span>` }) }).addTo(camada);
    }
  }
```
Comentário do topo: "…nas cores do GAUSS (modo 'cerca') ou em 5 tons de azul pelo tempo parado com as horas escritas nas 12 que mais pesam (modo 'tempo')".

- [ ] **Step 5: `legenda-tempo.tsx`**
```tsx
import { corDaFaixa, rotulosDasFaixas } from "./cores-analise";

/** Legenda do modo "Tempo parado": um quadradinho por faixa com o intervalo de horas (só no computador). */
export function LegendaTempo({ limites }: { limites: number[] }) {
  const rotulos = rotulosDasFaixas(limites);
  if (!rotulos.length) return null;
  return (
    <div aria-label="Legenda do tempo parado" className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      <span className="font-semibold text-texto">Tempo parado</span>
      {rotulos.map((r, i) => (
        <span key={r} className="flex items-center gap-1.5">
          <i aria-hidden className="h-3 w-3 rounded-sm" style={{ background: corDaFaixa(i, rotulos.length) }} />
          {r}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: `grade-quando.tsx`**
```tsx
"use client";

import { cx } from "@/components/ui";
import { DIAS_CURTOS } from "@/lib/dominio/analise";
import { faixaDe, faixasDe } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { corDaFaixa } from "./cores-analise";

/** seg a dom (a semana de trabalho primeiro) */
const LINHAS = [1, 2, 3, 4, 5, 6, 0];
const COM_NUMERO = 5;

/**
 * "Quando para": dia da semana × hora de início, mais escuro = mais tempo. Os 5 quadradinhos mais fortes mostram as horas;
 * passar o mouse mostra o valor de qualquer um; clicar escolhe hora e dia (clicar de novo desfaz).
 */
export function GradeQuando({ grade, hora, dia, escolher, vazio }: { grade: number[][]; hora: number | null; dia: number | null; escolher: (dia: number, hora: number) => void; vazio: string }) {
  const valores = grade.flat();
  const limites = faixasDe(valores);
  const fortes = new Set([...valores].filter((v) => v > 0).sort((a, b) => b - a).slice(0, COM_NUMERO));
  const temDado = valores.some((v) => v > 0);
  return (
    <section aria-label="Quando para" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Quando para <span className="font-normal normal-case tracking-normal">· dia da semana × hora de início</span>
      </h2>
      {!temDado ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <div className="mt-2 grid gap-[2px]">
          {LINHAS.map((d) => (
            <div key={d} className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] items-center gap-[2px]">
              <span className="text-[10px] text-suave">{DIAS_CURTOS[d]}</span>
              {grade[d].map((v, h) => {
                const f = faixaDe(v, limites);
                const escolhido = hora === h && dia === d;
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={escolhido}
                    aria-label={`${DIAS_CURTOS[d]} ${h}h, ${fmtHoras(v)}`}
                    title={`${DIAS_CURTOS[d]} ${h}h · ${fmtHoras(v)}`}
                    onClick={() => escolher(d, h)}
                    className={cx("flex h-6 items-center justify-center rounded-[3px] text-[9px] font-semibold leading-none", escolhido && "ring-2 ring-texto", hora != null && !escolhido && "opacity-40")}
                    style={{ background: v > 0 ? corDaFaixa(f, limites.length + 1) : "var(--superficie-2)", color: f >= 2 ? "#fff" : "var(--texto)" }}
                  >
                    {fortes.has(v) && v > 0 ? `${Math.round(v / 60)}h` : ""}
                  </button>
                );
              })}
            </div>
          ))}
          <div aria-hidden className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] text-[9px] text-suave">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center">{h % 6 === 0 ? `${h}h` : ""}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
```
(Se `var(--superficie-2)` / `var(--texto)` não existirem com esse nome em `globals.css`, usar os nomes reais das variáveis dos tokens `bg-superficie-2` e `text-texto`.)

- [ ] **Step 7: `barras-status.tsx`**
```tsx
"use client";

import { cx } from "@/components/ui";
import { rotuloStatus, type PlacaStatus } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { CINZAS, COR_DESTAQUE } from "./cores-analise";

/** Uma barra por placa dividida pelo tempo de cada status; o status em destaque em azul, os outros em cinza; destaque e total escritos. */
export function BarrasStatus({ linhas, destaque, selecionada, escolher, vazio }: { linhas: PlacaStatus[]; destaque: string; selecionada: string | null; escolher: (placa: string) => void; vazio: string }) {
  const rotulo = rotuloStatus(destaque);
  return (
    <section aria-label="Placas" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Placas <span className="font-normal normal-case tracking-normal">· tempo de cada status do motor</span>
      </h2>
      {linhas.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <ul className="mt-2 grid gap-1">
            {linhas.map((l) => {
              let cinza = 0;
              return (
                <li key={l.chave}>
                  <button
                    type="button"
                    aria-pressed={selecionada === l.chave}
                    aria-label={`${l.nome}, ${rotulo} ${fmtHoras(l.destaque)} de ${fmtHoras(l.total)}`}
                    onClick={() => escolher(l.chave)}
                    className={cx("grid w-full gap-1 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2", selecionada != null && selecionada !== l.chave && "opacity-40", selecionada === l.chave && "bg-primaria-suave")}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{l.nome}</span>
                      <span className="shrink-0 tabular-nums text-suave">
                        <b className="text-texto">{fmtHoras(l.destaque)}</b> de {fmtHoras(l.total)}
                      </span>
                    </span>
                    <span aria-hidden className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
                      {l.partes.map((p) => (
                        <span key={p.cod} title={`${p.rotulo}: ${fmtHoras(p.min)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.min / l.total) * 100}%`, background: p.cod === destaque ? COR_DESTAQUE : CINZAS[cinza++ % CINZAS.length] }} />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-suave">
            <span className="flex items-center gap-1"><i aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_DESTAQUE }} />{rotulo}</span>
            <span className="flex items-center gap-1"><i aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: CINZAS[0] }} />outros status (passe o mouse)</span>
          </p>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 8: Ligar.**
- `analise.tsx`: `const [cor, setCor] = useOpcao<"cerca" | "tempo">("mon-analise-cor", ["cerca", "tempo"], "cerca");`; `recorte` com `ignorar?: DimensaoSelecao | DimensaoSelecao[]`; etiqueta do dia `if (sel.dia != null) etiquetas.push({ dim: "dia", texto: DIAS_CURTOS[sel.dia] });`; `const escolherQuando = (dia: number, hora: number) => setSel((s) => (s.dia === dia && s.hora === hora ? { ...s, dia: null, hora: null } : { ...s, dia, hora }));`; `desenharCercas(..., { ..., modo: cor })` (+ `cor` nas dependências); `const limitesTempo = useMemo(() => faixasDe(dentro.map((r) => r.parado)), [dentro]);`; sobre o mapa, canto superior esquerdo:
```tsx
          <div className="absolute left-2 top-2 z-[500] w-[230px]">
            <Segmentado<"cerca" | "tempo"> rotulo="Cor do mapa" valor={cor} mudar={setCor} opcoes={[{ id: "cerca", rotulo: "Da cerca" }, { id: "tempo", rotulo: "Tempo parado" }]} />
          </div>
          {cor === "tempo" && <LegendaTempo limites={limitesTempo} />}
```
Na Visão geral, `GraficoHoras` vira `<GradeQuando grade={gradeHoraDia(recorte(["hora", "dia"]), pesoParado)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} />`; passar `escolherQuando` aos painéis.
- `painel-status.tsx`: `PropsAssunto` ganha `escolherQuando: (dia: number, hora: number) => void` e `recorte: (ignorar?: DimensaoSelecao | DimensaoSelecao[]) => ParadaNoLocal[]`; "Placas" vira `<BarrasStatus linhas={placasPorStatus(recorte("placa"), status ?? "stopped")} destaque={status ?? "stopped"} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />`; `GraficoHoras` vira `<GradeQuando grade={gradeHoraDia(recorte(["hora", "dia"]), peso)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} />`.
- `painel-motor2.tsx`: `GraficoHoras` vira `<GradeQuando grade={gradeHoraDia(paradasMotor2(recorte(["hora", "dia"])), BOMBA)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} />`.
- `familia/painel-familia.tsx`: tipo do `recorte` igual ao de `PropsAssunto`.
- Apagar `grafico-horas.tsx` se ninguém mais usar; tirar `porHora`/`horas` sem uso de `analise.tsx`.
- `globals.css`, junto das regras da Análise:
```css
.rotulo-horas { background: none; border: 0; }
.rotulo-horas > span {
  position: absolute; transform: translate(-50%, -50%); white-space: nowrap; pointer-events: none;
  font: 800 11px var(--font-sans); color: #fff; text-shadow: 0 0 3px #000, 0 0 2px #000;
}
```

- [ ] **Step 9: Rodar e ver passar** — `npm run lint && npm run typecheck && npm run build && npx playwright test e2e/analise.spec.ts` → PASS.

- [ ] **Step 10: Commit** — `git add src/app e2e/analise.spec.ts && git commit -m "Análise: cor do mapa por tempo parado, grade 'Quando para' e barras por status"`

### Task 3: CHANGELOG, README e verificação completa
- [ ] CHANGELOG (seção "Análise mais limpa"): "- **Visualização inteligente** (pesquisa de 14/10/2026): seletor **Cor do mapa** (Da cerca | Tempo parado: 5 tons de azul e as horas escritas nas 12 cercas que mais pesam), grade **Quando para** (dia da semana × hora, clicável) no lugar de 'Hora do dia' e, em Status do motor, **barra por placa dividida por status** com o destaque e o total."
- [ ] README item 12: uma frase com o mesmo conteúdo.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` → verde; commit "Análise: CHANGELOG e README da visualização".

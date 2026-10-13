# Análise — Parte B (subabas Status do motor e Motor secundário) — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na coluna da direita da aba Paradas, abas de assunto `Status do motor | Motor secundário | Apontamentos` (padrão: Status do motor). Status e Motor 2º seguem o molde: 3 números → frases → gráfico principal → placas → lugares → hora do dia. Apontamentos guarda o que já existe (Visão geral + famílias).

**Architecture:** Regras puras em `src/lib/dominio/assuntos.ts` com um "peso" por parada (minutos parados, minutos de um status do GAUSS ou da bomba). Componentes em `src/app/analise/_componentes/assunto/`. `analise.tsx` escolhe o painel pela aba de assunto; a família só filtra dentro de Apontamentos.

**Tech Stack:** Next.js estático, React, TypeScript, Tailwind, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-analise-satelite-calor-design.md` (Parte B). Mudança aprovada depois do spec: mapa de satélite normal com cercas coloridas, sem calor (o "calor muda com a subaba" não se aplica).

## Global Constraints
- Dados: só `analise_paradas.motor` (minutos por status do GAUSS durante a parada), já carregado. Sem SQL, sem GAUSS, sem dependência nova.
- Rótulos dos status: `STATUS_GAUSS` de `src/lib/dominio/gauss-dia.ts` (ex.: `stopped` = "Parado ligado").
- Motor secundário = status `secondary_motor_on`, só nas paradas dos equipamentos cujo status produtivo é ele (`equip.produtivo === "secondary_motor_on"`: Alta Pressão; o DSY6472 produz "parado ligado" e fica fora).
- Ligado = `on`, `stopped`, `secondary_motor_on` (a mesma lista `LIGADO` de `analise.ts`).
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

## Review Focus
1. Parada sem dado de motor (`motor = {}`): conta nas horas paradas, mas não no % ligado (base = minutos com dado de motor); sem nenhum dado, "—", nunca 0%. Coberto em `assuntos.test.ts`.
2. Filtro de Tipo que esvazia o Motor 2º (ex.: Vácuo): números "—" e "Nada neste filtro.", sem quebrar. Coberto no e2e.
3. Status escolhido no gráfico: placas, lugares e hora passam a pesar só aquele status; clicar de novo volta ao tempo parado. Coberto no e2e.
4. Trocar de aba de assunto com serviço escolhido: a etiqueta do serviço sai (ele só existe em Apontamentos). Coberto no e2e.
5. Pico de 2 horas no empate: ganha a janela que começa na hora mais cheia (mesma regra das famílias; agora uma função só, `picoDuasHoras`). Coberto em `assuntos.test.ts` e nos testes das famílias.

---

### Task 1: Regras dos assuntos (`assuntos.ts`)

**Files:**
- Create: `src/lib/dominio/assuntos.ts`, `src/lib/dominio/assuntos.test.ts`
- Modify: `src/lib/dominio/familias.ts` (usar `picoDuasHoras`)

**Interfaces:**
- Produces: `ASSUNTOS = ["status","motor2","apontamentos"] as const`, `type Assunto`, `ROTULO_ASSUNTO`, `type Peso = (p: ParadaNoLocal) => number`, `pesoParado`, `pesoStatus(cod)`, `MOTOR2`, `rotuloStatus(cod)`, `type Linha {chave,nome,n,min}`, `placasPorPeso(ps, peso, n=10)`, `lugaresPorPeso(ps, locais, peso, n=10)`, `porHoraPeso(ps, peso): number[]`, `picoDuasHoras(h: number[]): number`, `type StatusSoma {cod,rotulo,min}`, `somarStatus(ps): StatusSoma[]`, `numerosStatus(ps): {parado, comMotor, ligadoPct: number|null, maior: StatusSoma|null}`, `paradasMotor2(ps)`, `numerosMotor2(ps): {bomba, pct: number|null, campea: Linha|null}`, `frasesAssunto({rotulo, paradas, peso, locais}): string[]`.

- [ ] **Step 1: Teste que falha** (`src/lib/dominio/assuntos.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { CHAVE_FORA, equipDaFrota, montarLocais, type ParadaAnalise } from "./analise";
import {
  MOTOR2, frasesAssunto, lugaresPorPeso, numerosMotor2, numerosStatus, paradasMotor2, pesoParado, pesoStatus, picoDuasHoras, placasPorPeso, porHoraPeso, somarStatus,
} from "./assuntos";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [{ name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) }];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv"): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor: "OZIAS", regime: "ADM" } }) as Veiculo;
const equip = equipDaFrota([v("1", "EGC2985", "ap"), v("2", "EGC2993", "av"), v("3", "EAM3257", "hv")]);
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });

// a: AP 8h–9h bomba 40 + parado ligado 20; b: AP 14h–16h parado ligado 120; c: Vácuo 10h–11h desligado 60;
// d: Hiper 15h–16h sem dado de motor; e: AP longe (Recife) 20h–21h bomba 60
const { paradas, locais } = montarLocais(
  [
    p({ motor: { secondary_motor_on: 40, stopped: 20 } }),
    p({ ini: 14 * H, fim: 16 * H, motor: { stopped: 120 } }),
    p({ veiculo_id: "2", placa: "EGC2993", ini: 10 * H, fim: 11 * H, motor: { off: 60 } }),
    p({ veiculo_id: "3", placa: "EAM3257", ini: 15 * H, fim: 16 * H }),
    p({ area: "GALPÃO LONGE", lat: -8.05, lng: -34.9, ini: 20 * H, fim: 21 * H, motor: { secondary_motor_on: 60 } }),
  ],
  AREAS,
  equip,
  AREAS[0].polygon,
);

describe("assuntos: pesos e somas", () => {
  it("peso: tempo parado ou minutos de um status", () => {
    expect(paradas.map(pesoParado)).toEqual([60, 120, 60, 60, 60]);
    expect(paradas.map(pesoStatus("stopped"))).toEqual([20, 120, 0, 0, 0]);
  });
  it("placas pelo peso: só quem tem peso, do maior ao menor", () => {
    expect(placasPorPeso(paradas, pesoStatus(MOTOR2))).toEqual([{ chave: "EGC2985", nome: "EGC2985", n: 2, min: 100 }]);
    expect(placasPorPeso(paradas, pesoParado).map((l) => [l.nome, l.min])).toEqual([["EGC2985", 240], ["EAM3257", 60], ["EGC2993", 60]]);
  });
  it("lugares pelo peso: longe da região juntos em 'Longe da região'", () => {
    expect(lugaresPorPeso(paradas, locais, pesoStatus(MOTOR2))).toEqual([
      { chave: CHAVE_FORA, nome: "Longe da região", n: 1, min: 60 },
      { chave: "ALTO FORNO 3", nome: "ALTO FORNO 3", n: 1, min: 40 },
    ]);
  });
  it("por hora pelo peso e pico de 2 horas (empate: a janela que começa na hora mais cheia)", () => {
    const h = porHoraPeso(paradas, pesoStatus("stopped"));
    expect([h[8], h[14], h[15]]).toEqual([20, 120, 0]);
    expect(picoDuasHoras(h)).toBe(14);
    const so8 = Array<number>(24).fill(0);
    so8[8] = 60;
    expect(picoDuasHoras(so8)).toBe(8);
  });
});

describe("status do motor", () => {
  it("soma por status com o nome em português, do maior ao menor", () => {
    expect(somarStatus(paradas)).toEqual([
      { cod: "stopped", rotulo: "Parado ligado", min: 140 },
      { cod: "secondary_motor_on", rotulo: "Motor 2º ligado", min: 100 },
      { cod: "off", rotulo: "Motor desligado", min: 60 },
    ]);
  });
  it("números: horas paradas (todas), % ligado só sobre o tempo com dado de motor, status que mais pesa", () => {
    expect(numerosStatus(paradas)).toEqual({ parado: 360, comMotor: 300, ligadoPct: 240 / 300, maior: { cod: "stopped", rotulo: "Parado ligado", min: 140 } });
    const semMotor = paradas.filter((x) => x.placa === "EAM3257");
    expect(numerosStatus(semMotor)).toEqual({ parado: 60, comMotor: 0, ligadoPct: null, maior: null });
  });
});

describe("motor secundário", () => {
  it("só os equipamentos cuja produção é a bomba (Alta Pressão)", () => {
    expect(paradasMotor2(paradas).map((x) => x.placa)).toEqual(["EGC2985", "EGC2985", "EGC2985"]);
  });
  it("números: horas de bomba, % do tempo com dado de motor e a placa campeã; sem dado, '—'", () => {
    expect(numerosMotor2(paradas)).toEqual({ bomba: 100, pct: 100 / 240, campea: { chave: "EGC2985", nome: "EGC2985", n: 2, min: 100 } });
    expect(numerosMotor2(paradas.filter((x) => x.placa === "EGC2993"))).toEqual({ bomba: 0, pct: null, campea: null });
  });
});

describe("frases do assunto", () => {
  it("total, concentração, pico e lugar pelo peso", () => {
    expect(frasesAssunto({ rotulo: "Parado ligado", paradas, peso: pesoStatus("stopped"), locais })).toEqual([
      "Parado ligado: 2h20 em 2 paradas.",
      "A placa EGC2985 sozinha soma 100% desse tempo.",
      "O pico é das 14h às 16h.",
      "Onde mais acontece: ALTO FORNO 3, 2h20.",
    ]);
  });
  it("lugar longe vira 'Longe da região'; sem peso, nenhuma frase", () => {
    const f = frasesAssunto({ rotulo: "Bomba ligada", paradas: paradas.filter((x) => x.area === "GALPÃO LONGE"), peso: pesoStatus(MOTOR2), locais });
    expect(f[f.length - 1]).toBe("Onde mais acontece: Longe da região, 1h00.");
    expect(frasesAssunto({ rotulo: "X", paradas, peso: () => 0, locais })).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/lib/dominio/assuntos.test.ts` → FAIL (`Cannot find module './assuntos'`).

- [ ] **Step 3: Implementar `src/lib/dominio/assuntos.ts`**

```ts
import { CHAVE_FORA, horaDe, minutos, type Local, type ParadaNoLocal } from "./analise";
import { fmtHoras } from "./formato";
import { STATUS_GAUSS } from "./gauss-dia";

/** Abas de assunto da coluna da direita (a Disponibilidade entra na Parte D). */
export const ASSUNTOS = ["status", "motor2", "apontamentos"] as const;
export type Assunto = (typeof ASSUNTOS)[number];
export const ROTULO_ASSUNTO: Record<Assunto, string> = { status: "Status do motor", motor2: "Motor secundário", apontamentos: "Apontamentos" };

/** Quanto cada parada pesa no assunto, em minutos. */
export type Peso = (p: ParadaNoLocal) => number;
export const pesoParado: Peso = minutos;
export const pesoStatus =
  (cod: string): Peso =>
  (p) =>
    p.motor[cod] ?? 0;
export const MOTOR2 = "secondary_motor_on";
const LIGADOS = ["on", "stopped", MOTOR2];
export const rotuloStatus = (cod: string) => STATUS_GAUSS[cod]?.rotulo ?? cod;

export interface Linha {
  chave: string;
  nome: string;
  n: number;
  /** minutos */
  min: number;
}
const somaPeso = (ps: ParadaNoLocal[], peso: Peso) => ps.reduce((s, p) => s + peso(p), 0);
const somaMotor = (p: ParadaNoLocal) => Object.values(p.motor).reduce((s, m) => s + m, 0);

/** Soma o peso por chave (só paradas com peso), do maior ao menor, top n. */
function somarPorPeso(ps: ParadaNoLocal[], chave: (p: ParadaNoLocal) => string, nome: (k: string) => string, peso: Peso, n: number): Linha[] {
  const m = new Map<string, Linha>();
  for (const p of ps) {
    const w = peso(p);
    if (w <= 0) continue;
    const k = chave(p);
    const l = m.get(k) ?? { chave: k, nome: nome(k), n: 0, min: 0 };
    l.n++;
    l.min += w;
    m.set(k, l);
  }
  return [...m.values()].sort((a, b) => b.min - a.min || a.nome.localeCompare(b.nome)).slice(0, n);
}
/** Placas com mais peso. */
export const placasPorPeso = (ps: ParadaNoLocal[], peso: Peso, n = 10) => somarPorPeso(ps, (p) => p.placa, (k) => k, peso, n);
/** Lugares com mais peso; os longe da região somam juntos em "Longe da região" (chave CHAVE_FORA, que a seleção entende). */
export const lugaresPorPeso = (ps: ParadaNoLocal[], locais: Map<string, Local>, peso: Peso, n = 10) =>
  somarPorPeso(
    ps,
    (p) => (locais.get(p.local)?.naRegiao === false ? CHAVE_FORA : p.local),
    (k) => (k === CHAVE_FORA ? "Longe da região" : (locais.get(k)?.nome ?? k)),
    peso,
    n,
  );

/** Peso pela hora de início (0–23). */
export function porHoraPeso(ps: ParadaNoLocal[], peso: Peso): number[] {
  const h = Array<number>(24).fill(0);
  for (const p of ps) h[horaDe(p.ini)] += peso(p);
  return h;
}
/** Hora de início da janela de 2 horas com mais minutos; no empate, a que começa na hora mais cheia (parada só às 8h = 8). */
export function picoDuasHoras(h: number[]): number {
  const janela = (i: number) => h[i] + h[i + 1];
  let pico = 0;
  for (let i = 1; i < 23; i++) if (janela(i) > janela(pico) || (janela(i) === janela(pico) && h[i] > h[pico])) pico = i;
  return pico;
}

export interface StatusSoma {
  cod: string;
  rotulo: string;
  min: number;
}
/** Minutos de cada status do GAUSS nas paradas, do maior ao menor. */
export function somarStatus(ps: ParadaNoLocal[]): StatusSoma[] {
  const m = new Map<string, number>();
  for (const p of ps) for (const [cod, min] of Object.entries(p.motor)) m.set(cod, (m.get(cod) ?? 0) + min);
  return [...m]
    .filter(([, min]) => min > 0)
    .map(([cod, min]) => ({ cod, rotulo: rotuloStatus(cod), min }))
    .sort((a, b) => b.min - a.min);
}
/** Os 3 números do Status: horas paradas (todas), % com motor ligado (sobre o tempo com dado de motor) e o status que mais pesa. */
export function numerosStatus(ps: ParadaNoLocal[]) {
  const comMotor = ps.reduce((s, p) => s + somaMotor(p), 0);
  const ligado = ps.reduce((s, p) => s + LIGADOS.reduce((n, c) => n + (p.motor[c] ?? 0), 0), 0);
  return { parado: somaPeso(ps, pesoParado), comMotor, ligadoPct: comMotor > 0 ? ligado / comMotor : null, maior: somarStatus(ps)[0] ?? null };
}

/** Paradas dos equipamentos que produzem com a bomba (motor 2º): Alta Pressão. */
export const paradasMotor2 = (ps: ParadaNoLocal[]) => ps.filter((p) => p.equip.produtivo === MOTOR2);
/** Os 3 números do Motor 2º: horas de bomba ligada, % do tempo com dado de motor e a placa campeã (só Alta Pressão). */
export function numerosMotor2(ps: ParadaNoLocal[]) {
  const base = paradasMotor2(ps);
  const comMotor = base.reduce((s, p) => s + somaMotor(p), 0);
  const bomba = somaPeso(base, pesoStatus(MOTOR2));
  return { bomba, pct: comMotor > 0 ? bomba / comMotor : null, campea: placasPorPeso(base, pesoStatus(MOTOR2), 1)[0] ?? null };
}

const CONCENTRACAO = 0.2;
/** Conclusões curtas pelo peso (só as que têm dado): total, placa que concentra, pico de 2 horas e lugar. */
export function frasesAssunto({ rotulo, paradas, peso, locais }: { rotulo: string; paradas: ParadaNoLocal[]; peso: Peso; locais: Map<string, Local> }): string[] {
  const com = paradas.filter((p) => peso(p) > 0);
  const total = somaPeso(com, peso);
  if (total <= 0) return [];
  const out = [`${rotulo}: ${fmtHoras(total)} em ${com.length} ${com.length === 1 ? "parada" : "paradas"}.`];
  const [top] = placasPorPeso(com, peso, 1);
  if (top && top.min / total > CONCENTRACAO) out.push(`A placa ${top.nome} sozinha soma ${Math.round((top.min / total) * 100)}% desse tempo.`);
  const pico = picoDuasHoras(porHoraPeso(com, peso));
  out.push(`O pico é das ${pico}h às ${pico + 2}h.`);
  const [lugar] = lugaresPorPeso(com, locais, peso, 1);
  if (lugar) out.push(`Onde mais acontece: ${lugar.nome}, ${fmtHoras(lugar.min)}.`);
  return out;
}
```

- [ ] **Step 4: `familias.ts` usa `picoDuasHoras`** — importar de `./assuntos` e trocar o bloco do pico em `frases` por `const pico = picoDuasHoras(porHora(atual));` (tirar o comentário e as variáveis `h`/`janela` locais).

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/lib/dominio && npm run typecheck` → PASS.

- [ ] **Step 6: Commit** — `git add src/lib/dominio && git commit -m "Análise: regras de Status do motor e Motor secundário (pesos, números, frases)"`

### Task 2: Tela — abas de assunto, painéis Status e Motor 2º

**Files:**
- Create: `src/app/analise/_componentes/assunto/abas-assunto.tsx`, `numeros.tsx`, `frases.tsx`, `painel-status.tsx`, `painel-motor2.tsx`
- Modify: `src/app/analise/_componentes/familia/painel-familia.tsx` (usar `Frases`), `src/app/analise/_componentes/analise.tsx`
- Test: `e2e/analise.spec.ts`

**Interfaces:**
- Consumes: Task 1 inteira; `GraficoBarras`/`ItemBarra`, `GraficoHoras`; `recorte(ignorar?)`, `alternar`, `sel` de `analise.tsx`.
- Produces: `AbasAssunto({ valor, mudar })`, `Numeros({ itens })`, `Frases({ textos, vazio })`, `PainelStatus(props)`, `PainelMotor2(props)` com props `{ recorte; locais; sel; alternar; vazio }`.

- [ ] **Step 1: e2e que falha.** Nos testes existentes "painel com mapa e gráficos que se filtram..." e "subabas por família...", logo depois de `await page.goto("/analise/");` acrescentar:
```ts
  await page.getByRole("tablist", { name: "Assunto" }).getByRole("tab", { name: "Apontamentos" }).click();
```
Novo teste (depois do teste do mapa):
```ts
test("Análise: Status do motor (padrão) e Motor secundário com números, frases e gráficos", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const assunto = page.getByRole("tablist", { name: "Assunto" });
  await expect(assunto.getByRole("tab", { name: "Status do motor" })).toHaveAttribute("aria-selected", "true");
  // 5 paradas da frota (OFICINA, PATIO x2, ATERRO, longe): 5h00 paradas; todo o tempo com dado de motor está ligado
  const numeros = page.getByRole("region", { name: "Números" });
  await expect(numeros).toContainText("5h00");
  await expect(numeros).toContainText("100%");
  await expect(numeros).toContainText("Parado ligado");
  await expect(page.getByRole("list", { name: "Frases automáticas" })).toContainText("Tempo parado: 5h00 em 5 paradas.");
  // escolher um status: placas pesam só ele; clicar de novo volta
  const porStatus = page.getByRole("region", { name: "Por status" });
  await porStatus.getByRole("button", { name: /^Motor 2º ligado/ }).click();
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button")).toHaveCount(1);
  await expect(page.getByRole("region", { name: "Placas" })).toContainText("1h30");
  await porStatus.getByRole("button", { name: /^Motor 2º ligado/ }).click();
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button")).toHaveCount(2);
  // serviço escolhido em Apontamentos sai ao trocar de assunto
  await assunto.getByRole("tab", { name: "Apontamentos" }).click();
  await page.getByRole("region", { name: "Por serviço" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await assunto.getByRole("tab", { name: "Motor secundário" }).click();
  await expect(page.getByRole("group", { name: "Filtrando" })).toHaveCount(0);
  // motor 2º: só o Alta Pressão (bomba 40 + 30 + 20 min = 1h30)
  await expect(page.getByRole("region", { name: "Números" })).toContainText("1h30");
  await expect(page.getByRole("region", { name: "Números" })).toContainText("EGC2985");
  await expect(page.getByRole("region", { name: "Lugares" }).getByRole("button").first()).toHaveAccessibleName(/^OFICINA/);
  // filtro de tipo que esvazia: "—" e aviso, sem quebrar
  await page.getByLabel("Tipo").selectOption("as");
  await expect(page.getByRole("region", { name: "Números" })).toContainText("—");
  await expect(page.getByText("Nada neste filtro.").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run build && npx playwright test e2e/analise.spec.ts` → FAIL (não acha o tablist "Assunto").

- [ ] **Step 3: Componentes**

`assunto/abas-assunto.tsx`:
```tsx
"use client";

import { cx } from "@/components/ui";
import { ASSUNTOS, ROTULO_ASSUNTO, type Assunto } from "@/lib/dominio/assuntos";

/** Abas de assunto acima dos gráficos: Status do motor, Motor secundário e Apontamentos. */
export function AbasAssunto({ valor, mudar }: { valor: Assunto; mudar: (a: Assunto) => void }) {
  return (
    <div role="tablist" aria-label="Assunto" className="grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {ASSUNTOS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === valor}
          onClick={() => mudar(id)}
          className={cx("rounded-md px-2 py-2 text-[13px] font-semibold transition", id === valor ? "bg-primaria text-white shadow-sm" : "text-suave hover:text-texto")}
        >
          {ROTULO_ASSUNTO[id]}
        </button>
      ))}
    </div>
  );
}
```

`assunto/numeros.tsx`:
```tsx
/** Três números-chave lado a lado. */
export function Numeros({ itens }: { itens: { rotulo: string; valor: string; sub?: string }[] }) {
  return (
    <section aria-label="Números" className="grid grid-cols-3 gap-2">
      {itens.map((i) => (
        <div key={i.rotulo} className="min-w-0 rounded-xl border border-borda bg-superficie p-3">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-suave">{i.rotulo}</p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-texto">{i.valor}</p>
          {i.sub && <p className="truncate text-[11px] text-suave">{i.sub}</p>}
        </div>
      ))}
    </section>
  );
}
```

`assunto/frases.tsx` (o bloco que hoje está dentro de `painel-familia.tsx`):
```tsx
/** "O que os dados dizem": as frases automáticas, ou o aviso de vazio. */
export function Frases({ textos, vazio }: { textos: string[]; vazio: string }) {
  return (
    <section aria-label="O que os dados dizem" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">O que os dados dizem</h2>
      {textos.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <ul aria-label="Frases automáticas" className="mt-2 grid gap-1 text-[13px] text-texto">
          {textos.map((t) => (
            <li key={t} className="flex gap-1.5">
              <span aria-hidden className="text-primaria">•</span>
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```
Em `painel-familia.tsx`, trocar a `<section aria-label="O que os dados dizem">…</section>` por `<Frases textos={textos} vazio={vazio} />` (import `{ Frases } from "../assunto/frases"`).

`assunto/painel-status.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { DimensaoSelecao, Local, ParadaNoLocal, SelecaoCruzada } from "@/lib/dominio/analise";
import { frasesAssunto, lugaresPorPeso, numerosStatus, pesoParado, pesoStatus, placasPorPeso, porHoraPeso, rotuloStatus, somarStatus, type Linha } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { GraficoBarras, type ItemBarra } from "../grafico-barras";
import { GraficoHoras } from "../grafico-horas";
import { Frases } from "./frases";
import { Numeros } from "./numeros";

export interface PropsAssunto {
  /** paradas com as escolhas feitas; `ignorar` pula uma dimensão (o gráfico dela mostra todas e marca a escolhida) */
  recorte: (ignorar?: DimensaoSelecao) => ParadaNoLocal[];
  locais: Map<string, Local>;
  sel: SelecaoCruzada;
  alternar: (d: "local" | "placa" | "hora", v: string | number) => void;
  vazio: string;
}
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
export const itemLinha = (l: Linha): ItemBarra => ({ chave: l.chave, rotulo: l.nome, valor: l.min, texto: fmtHoras(l.min), dica: `${l.nome}, ${fmtHoras(l.min)} em ${l.n} ${l.n === 1 ? "parada" : "paradas"}` });

/** Status do motor: horas paradas, % ligado e o status que mais pesa; clicar num status faz placas, lugares e hora pesarem só ele. */
export function PainelStatus({ recorte, locais, sel, alternar, vazio }: PropsAssunto) {
  const [status, setStatus] = useState<string | null>(null);
  const todas = recorte();
  const n = numerosStatus(todas);
  const peso = status ? pesoStatus(status) : pesoParado;
  const rotulo = status ? rotuloStatus(status) : "Tempo parado";
  const porStatus: ItemBarra[] = somarStatus(todas).map((s) => ({ chave: s.cod, rotulo: s.rotulo, valor: s.min, texto: fmtHoras(s.min), dica: `${s.rotulo}, ${fmtHoras(s.min)}` }));
  return (
    <div className="flex flex-col gap-2">
      <Numeros
        itens={[
          { rotulo: "Horas paradas", valor: fmtHoras(n.parado) },
          { rotulo: "Motor ligado", valor: pct(n.ligadoPct), sub: "do tempo com dado de motor" },
          { rotulo: "Mais pesa", valor: n.maior?.rotulo ?? "—", sub: n.maior ? fmtHoras(n.maior.min) : undefined },
        ]}
      />
      <Frases textos={frasesAssunto({ rotulo, paradas: todas, peso, locais })} vazio={vazio} />
      <GraficoBarras titulo="Por status" sub="horas de cada status do GAUSS nas paradas" itens={porStatus} selecionada={status} escolher={(c) => setStatus((s) => (s === c ? null : c))} vazio={vazio} />
      <GraficoBarras titulo="Placas" sub={rotulo.toLowerCase()} itens={placasPorPeso(recorte("placa"), peso).map(itemLinha)} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
      <GraficoBarras titulo="Lugares" sub={rotulo.toLowerCase()} itens={lugaresPorPeso(recorte("local"), locais, peso).map(itemLinha)} selecionada={sel.local} escolher={(c) => alternar("local", c)} vazio={vazio} />
      <GraficoHoras minutos={porHoraPeso(recorte("hora"), peso)} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
    </div>
  );
}
```

`assunto/painel-motor2.tsx`:
```tsx
"use client";

import { MOTOR2, frasesAssunto, lugaresPorPeso, numerosMotor2, paradasMotor2, pesoStatus, placasPorPeso, porHoraPeso } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { GraficoBarras } from "../grafico-barras";
import { GraficoHoras } from "../grafico-horas";
import { Frases } from "./frases";
import { Numeros } from "./numeros";
import { itemLinha, type PropsAssunto } from "./painel-status";

const BOMBA = pesoStatus(MOTOR2);
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

/** Motor secundário (bomba do Alta Pressão): horas de bomba, % do tempo e a placa campeã; lugares, placas e hora pela bomba. */
export function PainelMotor2({ recorte, locais, sel, alternar, vazio }: PropsAssunto) {
  const todas = recorte();
  const n = numerosMotor2(todas);
  return (
    <div className="flex flex-col gap-2">
      <Numeros
        itens={[
          { rotulo: "Bomba ligada", valor: n.bomba > 0 ? fmtHoras(n.bomba) : "—" },
          { rotulo: "Do tempo parado", valor: pct(n.pct), sub: "com dado de motor" },
          { rotulo: "Placa campeã", valor: n.campea?.nome ?? "—", sub: n.campea ? fmtHoras(n.campea.min) : undefined },
        ]}
      />
      <Frases textos={frasesAssunto({ rotulo: "Bomba (motor 2º) ligada", paradas: paradasMotor2(todas), peso: BOMBA, locais })} vazio={vazio} />
      <GraficoBarras titulo="Lugares" sub="bomba ligada" itens={lugaresPorPeso(paradasMotor2(recorte("local")), locais, BOMBA).map(itemLinha)} selecionada={sel.local} escolher={(c) => alternar("local", c)} vazio={vazio} />
      <GraficoBarras titulo="Placas" sub="bomba ligada" itens={placasPorPeso(paradasMotor2(recorte("placa")), BOMBA).map(itemLinha)} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
      <GraficoHoras minutos={porHoraPeso(paradasMotor2(recorte("hora")), BOMBA)} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
    </div>
  );
}
```
(O `pct` repetido: mover para `numeros.tsx` como `export const pct` e importar nos dois painéis.)

- [ ] **Step 4: Ligar em `analise.tsx`**
- Imports: `ASSUNTOS, type Assunto` de `@/lib/dominio/assuntos`; `AbasAssunto`, `PainelStatus`, `PainelMotor2`.
- Estado: `const [assunto, setAssunto] = useOpcao<Assunto>("mon-analise-assunto", ASSUNTOS, "status");`
- Família só em Apontamentos: `const doFamilia = useMemo(() => (assunto !== "apontamentos" || familia === "geral" ? doFiltro : paradasDaFamilia(doFiltro, familia)), [doFiltro, familia, assunto]);` e no `anterior`: `if (assunto !== "apontamentos" || familia === "geral" || n * 2 > DIAS_GUARDADOS) return null;` (acrescentar `assunto` às dependências). `novos`: `assunto === "apontamentos" && familia === "manutencao"`.
- `const trocarAssunto = (a: Assunto) => { setAssunto(a); setSel((s) => ({ ...s, servico: null })); };`
- Coluna da direita:
```tsx
        <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <AbasAssunto valor={assunto} mudar={trocarAssunto} />
          {velho && (…o aviso de hoje…)}
          {assunto === "status" ? (
            <PainelStatus recorte={recorte} locais={base.locais} sel={sel} alternar={alternar} vazio={vazio} />
          ) : assunto === "motor2" ? (
            <PainelMotor2 recorte={recorte} locais={base.locais} sel={sel} alternar={alternar} vazio={vazio} />
          ) : (
            <>
              <SubabasFamilia valor={familia} mudar={trocarFamilia} />
              {familia === "geral" ? (…os 3 gráficos de hoje…) : (…PainelFamilia de hoje…)}
            </>
          )}
        </div>
```
- O `alternar` de hoje é genérico `<K extends DimensaoSelecao>(k: K, v: SelecaoCruzada[K])`; para os painéis, passar `alternar={(d, v) => alternar(d, v as never)}` se o tipo não fechar.

- [ ] **Step 5: Rodar e ver passar** — `npm run lint && npm run typecheck && npm run build && npx playwright test e2e/analise.spec.ts` → PASS nos dois aparelhos.

- [ ] **Step 6: Commit** — `git add src/app/analise e2e/analise.spec.ts && git commit -m "Análise: abas de assunto com Status do motor e Motor secundário"`

### Task 3: CHANGELOG, README e verificação completa
- [ ] CHANGELOG, seção "Análise mais limpa · 13/10/2026": "- **Abas de assunto** ao lado do mapa: **Status do motor** (padrão: horas paradas, % com motor ligado, status que mais pesa; clicar num status faz placas, lugares e hora pesarem só ele), **Motor secundário** (bomba do Alta Pressão: horas, % do tempo, placa campeã, lugares, placas e hora) e **Apontamentos** (a Visão geral e as famílias de antes)."
- [ ] README item 12: acrescentar a frase das abas de assunto.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` → verde; commit "Análise: CHANGELOG e README da Parte B".

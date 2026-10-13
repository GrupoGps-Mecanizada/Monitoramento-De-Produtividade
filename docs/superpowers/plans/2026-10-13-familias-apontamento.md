# Subabas por família de apontamento — plano de execução

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na aba Paradas da Análise, subabas por família de apontamento (Aguardando, Pausas e pessoas, Logística, Preparação e bloqueio, Manutenção e clima, Sem apontamento) com frases automáticas, barras por apontamento, quem mais para (placas e supervisores) e tendência por dia; a família filtra também o mapa.

**Architecture:** Regras puras num arquivo novo `src/lib/dominio/familias.ts` (testado com vitest). A seleção cruzada de `analise.ts` ganha a dimensão `placa`. A tela ganha `src/app/analise/_componentes/familia/` (subabas, painel, gráfico de dias) e `analise.tsx` troca a coluna da direita entre a Visão geral (de sempre) e o painel da família. Mesmos dados já carregados (`analise_paradas`).

**Tech Stack:** Next.js (export estático), React, TypeScript, Tailwind, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-familias-apontamento-design.md`

## Global Constraints
- Sem SQL novo, sem chamada ao GAUSS, sem dependência nova, sem custo.
- Nomes e textos em português; números de horas com `fmtHoras` (ex.: `3h30`).
- A comparação com o período anterior só existe quando `periodo × 2 ≤ 30` (a tabela guarda 30 dias): 7 e 15 dias.
- Concentração só aparece acima de 20% do tempo da família.
- Apontamento fora da tabela vai para "Manutenção e clima" e a subaba avisa "Apontamento novo sem família: X".
- Antes de entregar: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.

## Review Focus
1. Família sem paradas no filtro (ex.: Pausas no e2e): todas as seções dizem "Nada neste filtro." e nada quebra. Coberto no e2e da Tarefa 3.
2. Serviço escolhido numa família e troca de subaba: a etiqueta do serviço sai (senão a família nova fica vazia sem motivo). Coberto no e2e da Tarefa 3.
3. Histórico parado (último dia antes de ontem): aparece "Último dia com dados: dd/mm/aaaa". Coberto em `analise.test.ts` (Tarefa 2).
4. Período de 30 dias: frase sem comparação; anterior com total 0 também sem comparação (não pode dizer "∞% a mais"). Coberto em `familias.test.ts` (Tarefa 1).
5. Variações de nome do tablet (maiúsculas, acento, " - LM"): mesma família e mesma barra. Coberto em `familias.test.ts` (Tarefa 1). Limite conhecido: clicar na barra filtra pelo nome exato da primeira variação (a seleção cruzada compara nome exato); hoje o tablet manda um nome só por apontamento.

---

### Task 1: Regras das famílias (`familias.ts`)

**Files:**
- Create: `src/lib/dominio/familias.ts`
- Create: `src/lib/dominio/familias.test.ts`
- Modify: `src/lib/dominio/analise.ts` (exportar `minutos`)

**Interfaces:**
- Consumes: de `analise.ts`: `minutos`, `porHora`, `diaMenos`, `type ParadaNoLocal`, `type Local`; de `formato.ts`: `fmtHoras`.
- Produces: `FAMILIAS`, `type Familia`, `ROTULO_FAMILIA`, `ABAS_FAMILIA`, `type AbaFamilia`, `DIAS_GUARDADOS`, `normalizar(s)`, `familiaDe(apont): Familia`, `paradasDaFamilia(paradas, f): ParadaNoLocal[]`, `apontNovos(paradas): string[]`, `type Soma {nome,n,min}`, `porApontamento(paradas, f): Soma[]`, `type LinhaRanking {chave,nome,n,min,media}`, `SEM_SUPERVISOR`, `rankingPlacas(paradas, n=10)`, `rankingSupervisores(paradas, n=10)`, `porDia(paradas, hoje, periodo): {dia,min}[]`, `frases({rotulo, atual, anterior, dias, locais}): string[]`.

- [ ] **Step 1: Exportar `minutos` em `analise.ts`**

Trocar `const minutos = (p: ParadaAnalise) => (p.fim - p.ini) / 60;` por:
```ts
export const minutos = (p: ParadaAnalise) => (p.fim - p.ini) / 60;
```

- [ ] **Step 2: Escrever o teste que falha** (`src/lib/dominio/familias.test.ts`)

```ts
import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { equipDaFrota, montarLocais, type ParadaAnalise } from "./analise";
import {
  SEM_SUPERVISOR, apontNovos, familiaDe, frases, normalizar, paradasDaFamilia, porApontamento, porDia, rankingPlacas, rankingSupervisores,
} from "./familias";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [{ name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) }];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", supervisor: string | undefined): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor, regime: "ADM" } }) as Veiculo;
const equip = equipDaFrota([v("1", "EGC2985", "ap", "OZIAS"), v("2", "EGC2993", "av", "ISRAEL"), v("3", "EAM3257", "hv", undefined)]);
const usina = AREAS[0].polygon;
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });
const montar = (ps: ParadaAnalise[]) => montarLocais(ps, AREAS, equip, usina);

// a1 2h Aguardando Área; a2 1h variação do nome + Refeição; a3 30 min semáforo (outro caminhão); b1 DDS sem " - LM"; b2 apontamento novo; b3 sem apontamento
const { paradas, locais } = montar([
  p({ apont: ["Aguardando Área"], ini: 14 * H, fim: 16 * H }),
  p({ dia: "2026-10-03", apont: ["AGUARDANDO AREA", "Refeição Motorista"], ini: 15 * H, fim: 16 * H }),
  p({ dia: "2026-10-03", veiculo_id: "2", placa: "EGC2993", apont: ["Aguardando semáforo/cancela"], ini: 8 * H, fim: 8 * H + 1800 }),
  p({ apont: ["DDS/Check-List"], ini: 6 * H, fim: 7 * H }),
  p({ apont: ["Lavagem de pátio"], ini: 9 * H, fim: 10 * H }),
  p({ veiculo_id: "3", placa: "EAM3257", ini: 20 * H, fim: 21 * H }),
]);
const aguardando = paradasDaFamilia(paradas, "aguardando");

describe("famílias de apontamento", () => {
  it("nome normalizado: sem acento, minúsculo, espaços simples e sem ' - LM'", () => {
    expect(normalizar("  DDS/Check-List   - LM ")).toBe("dds/check-list");
    expect(normalizar("Aguardando Área")).toBe(normalizar("AGUARDANDO AREA"));
  });
  it("os 18 apontamentos do tablet caem na família certa; novo vai para Manutenção e clima", () => {
    const esperado: [string, string][] = [
      ["Aguardando Área", "aguardando"], ["Aguardando semáforo/cancela", "aguardando"], ["Aguardando Auto Vácuo descarregar", "aguardando"], ["Aguardando carreta bascular", "aguardando"],
      ["Refeição Motorista", "pausas"], ["Pausas Diversas (água, banheiro)", "pausas"], ["Inicio de turno", "pausas"], ["DDS/Check-List - LM", "pausas"], ["Abordagem de Segurança", "pausas"],
      ["Abastecimento (Água) - LM", "logistica"], ["Abastecimento (Combustível)", "logistica"], ["Descarregando equipamento", "logistica"], ["Troca de Equipamento", "logistica"],
      ["Documentação", "preparacao"], ["Preparação - LM", "preparacao"], ["Bloqueio - LM", "preparacao"],
      ["Pequenas manutenções", "manutencao"], ["Condições Climáticas (chuva, etc)", "manutencao"],
      ["Lavagem de pátio", "manutencao"],
    ];
    for (const [nome, f] of esperado) expect([nome, familiaDe(nome)]).toEqual([nome, f]);
  });
  it("paradas da família: a parada com 2 famílias entra nas duas; 'sem' = sem apontamento", () => {
    expect(aguardando.map((x) => x.ini)).toEqual([14 * H, 15 * H, 8 * H]);
    expect(paradasDaFamilia(paradas, "pausas").map((x) => x.ini)).toEqual([15 * H, 6 * H]);
    expect(paradasDaFamilia(paradas, "manutencao").map((x) => x.ini)).toEqual([9 * H]);
    expect(paradasDaFamilia(paradas, "sem").map((x) => x.placa)).toEqual(["EAM3257"]);
    expect(paradasDaFamilia(paradas, "logistica")).toEqual([]);
  });
  it("apontamentos novos (fora da tabela)", () => {
    expect(apontNovos(paradas)).toEqual(["Lavagem de pátio"]);
  });
  it("por apontamento: variações do nome somam juntas, do maior tempo ao menor; repetido na mesma parada conta 1 vez", () => {
    expect(porApontamento(paradas, "aguardando")).toEqual([
      { nome: "Aguardando Área", n: 2, min: 180 },
      { nome: "Aguardando semáforo/cancela", n: 1, min: 30 },
    ]);
    const rep = montar([p({ apont: ["Aguardando Área", "Aguardando Área - LM"] })]).paradas;
    expect(porApontamento(rep, "aguardando")).toEqual([{ nome: "Aguardando Área", n: 1, min: 60 }]);
  });
  it("quem mais para: placas e supervisores com horas, paradas e média", () => {
    expect(rankingPlacas(aguardando)).toEqual([
      { chave: "EGC2985", nome: "EGC2985", n: 2, min: 180, media: 90 },
      { chave: "EGC2993", nome: "EGC2993", n: 1, min: 30, media: 30 },
    ]);
    expect(rankingSupervisores(paradas).map((r) => [r.nome, r.min, r.n, r.media])).toEqual([
      ["OZIAS", 300, 4, 75],
      [SEM_SUPERVISOR, 60, 1, 60],
      ["ISRAEL", 30, 1, 30],
    ]);
    expect(rankingPlacas(aguardando, 1)).toHaveLength(1);
  });
  it("por dia: um item por dia do período, dia sem parada = 0", () => {
    expect(porDia(aguardando, "2026-10-03", 3)).toEqual([
      { dia: "2026-10-01", min: 120 },
      { dia: "2026-10-02", min: 0 },
      { dia: "2026-10-03", min: 90 },
    ]);
  });
});

describe("frases automáticas", () => {
  const base = { rotulo: "Aguardando", atual: aguardando, anterior: null, dias: 30, locais };
  it("sem período anterior (30 dias): total, concentração, pico e lugar", () => {
    expect(frases(base)).toEqual([
      "Aguardando somou 3h30 em 3 paradas.",
      "A placa EGC2985 sozinha soma 86% do tempo.",
      "O pico é das 14h às 16h.",
      "Onde mais acontece: ALTO FORNO 3, 3h30.",
    ]);
  });
  it("com período anterior: % a mais, a menos; anterior zerado não compara", () => {
    const ant = (min: number) => paradasDaFamilia(montar([p({ apont: ["Aguardando Área"], ini: 0, fim: min * 60 })]).paradas, "aguardando");
    expect(frases({ ...base, dias: 7, anterior: ant(140) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, 50% a mais que nos 7 dias anteriores.");
    expect(frases({ ...base, dias: 7, anterior: ant(420) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, 50% a menos que nos 7 dias anteriores.");
    expect(frases({ ...base, dias: 7, anterior: ant(210) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, igual aos 7 dias anteriores.");
    expect(frases({ ...base, dias: 7, anterior: [] })[0]).toBe("Aguardando somou 3h30 em 3 paradas.");
  });
  it("concentração de até 20% não vira frase; 1 parada no singular", () => {
    const cinco = paradasDaFamilia(montar(["P1", "P2", "P3", "P4", "P5"].map((placa) => p({ placa, apont: ["Aguardando Área"] }))).paradas, "aguardando");
    const f = frases({ ...base, atual: cinco });
    expect(f.some((x) => x.startsWith("A placa"))).toBe(false);
    expect(frases({ ...base, atual: aguardando.slice(0, 1) })[0]).toBe("Aguardando somou 2h00 em 1 parada.");
  });
  it("sem paradas: nenhuma frase", () => {
    expect(frases({ ...base, atual: [] })).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/familias.test.ts`
Expected: FAIL (`Failed to resolve import "./familias"`).

- [ ] **Step 4: Escrever `src/lib/dominio/familias.ts`**

```ts
import { diaMenos, minutos, porHora, type Local, type ParadaNoLocal } from "./analise";
import { fmtHoras } from "./formato";

/** Famílias de apontamento do tablet (subabas da Análise). "sem" = paradas sem nenhum apontamento. */
export const FAMILIAS = ["aguardando", "pausas", "logistica", "preparacao", "manutencao", "sem"] as const;
export type Familia = (typeof FAMILIAS)[number];
export const ROTULO_FAMILIA: Record<Familia, string> = {
  aguardando: "Aguardando",
  pausas: "Pausas e pessoas",
  logistica: "Logística",
  preparacao: "Preparação e bloqueio",
  manutencao: "Manutenção e clima",
  sem: "Sem apontamento",
};
/** Subabas da coluna da direita: a Visão geral (o painel de sempre) e uma por família. */
export const ABAS_FAMILIA = ["geral", ...FAMILIAS] as const;
export type AbaFamilia = (typeof ABAS_FAMILIA)[number];
/** A tabela analise_paradas guarda só os últimos 30 dias: o período anterior só existe em 7 e 15 dias. */
export const DIAS_GUARDADOS = 30;

// nomes como o tablet manda (13/10/2026); apontamento fora daqui cai em "manutencao" e a tela avisa
const TABELA: Record<Exclude<Familia, "sem">, string[]> = {
  aguardando: ["Aguardando Área", "Aguardando semáforo/cancela", "Aguardando Auto Vácuo descarregar", "Aguardando carreta bascular"],
  pausas: ["Refeição Motorista", "Pausas Diversas (água, banheiro)", "Inicio de turno", "DDS/Check-List - LM", "Abordagem de Segurança"],
  logistica: ["Abastecimento (Água) - LM", "Abastecimento (Combustível)", "Descarregando equipamento", "Troca de Equipamento"],
  preparacao: ["Documentação", "Preparação - LM", "Bloqueio - LM"],
  manutencao: ["Pequenas manutenções", "Condições Climáticas (chuva, etc)"],
};

/** Nome sem acento, minúsculo, com espaços simples e sem o " - LM" do fim (o tablet varia). */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim().replace(/ - lm$/, "");

const FAMILIA_DO_NOME = new Map<string, Familia>(
  (Object.entries(TABELA) as [Familia, string[]][]).flatMap(([f, nomes]) => nomes.map((n) => [normalizar(n), f] as const)),
);
export const familiaDe = (apont: string): Familia => FAMILIA_DO_NOME.get(normalizar(apont)) ?? "manutencao";

/** Paradas com algum apontamento da família (cada parada entra uma vez); "sem" = as sem apontamento. */
export function paradasDaFamilia(paradas: ParadaNoLocal[], f: Familia): ParadaNoLocal[] {
  return f === "sem" ? paradas.filter((p) => !p.apont.length) : paradas.filter((p) => p.apont.some((a) => familiaDe(a) === f));
}

/** Apontamentos que não estão na tabela (para o aviso "Apontamento novo sem família"). */
export function apontNovos(paradas: ParadaNoLocal[]): string[] {
  const novos = new Set<string>();
  for (const p of paradas) for (const a of p.apont) if (!FAMILIA_DO_NOME.has(normalizar(a))) novos.add(a);
  return [...novos].sort((a, b) => a.localeCompare(b));
}

export interface Soma {
  nome: string;
  n: number;
  /** minutos */
  min: number;
}
/** Horas de cada apontamento da família, do maior ao menor; variações do nome somam juntas (fica o primeiro nome visto). */
export function porApontamento(paradas: ParadaNoLocal[], f: Familia): Soma[] {
  const m = new Map<string, Soma>();
  for (const p of paradas) {
    const vistos = new Set<string>();
    for (const a of p.apont) {
      const k = normalizar(a);
      if (familiaDe(a) !== f || vistos.has(k)) continue;
      vistos.add(k);
      const s = m.get(k) ?? { nome: a, n: 0, min: 0 };
      s.n++;
      s.min += minutos(p);
      m.set(k, s);
    }
  }
  return [...m.values()].sort((a, b) => b.min - a.min);
}

export interface LinhaRanking {
  chave: string;
  nome: string;
  n: number;
  /** minutos */
  min: number;
  /** minutos por parada */
  media: number;
}
export const SEM_SUPERVISOR = "Sem supervisor";
function somarPor(paradas: ParadaNoLocal[], chave: (p: ParadaNoLocal) => string, n: number): LinhaRanking[] {
  const m = new Map<string, LinhaRanking>();
  for (const p of paradas) {
    const k = chave(p);
    const r = m.get(k) ?? { chave: k, nome: k, n: 0, min: 0, media: 0 };
    r.n++;
    r.min += minutos(p);
    m.set(k, r);
  }
  return [...m.values()]
    .map((r) => ({ ...r, media: r.min / r.n }))
    .sort((a, b) => b.min - a.min || a.nome.localeCompare(b.nome))
    .slice(0, n);
}
/** Placas com mais tempo parado (top n). */
export const rankingPlacas = (paradas: ParadaNoLocal[], n = 10) => somarPor(paradas, (p) => p.placa, n);
/** Supervisores com mais tempo parado (top n); equipamento sem supervisor soma em "Sem supervisor". */
export const rankingSupervisores = (paradas: ParadaNoLocal[], n = 10) => somarPor(paradas, (p) => p.equip.supervisor ?? SEM_SUPERVISOR, n);

/** Minutos parados em cada dia do período (os `periodo` dias até `hoje`); dia sem parada = 0. */
export function porDia(paradas: ParadaNoLocal[], hoje: string, periodo: number): { dia: string; min: number }[] {
  const dias = Array.from({ length: periodo }, (_, i) => diaMenos(hoje, periodo - 1 - i));
  const m = new Map(dias.map((d) => [d, 0]));
  for (const p of paradas) {
    const atual = m.get(p.dia);
    if (atual != null) m.set(p.dia, atual + minutos(p));
  }
  return dias.map((dia) => ({ dia, min: m.get(dia) ?? 0 }));
}

const CONCENTRACAO = 0.2;
const somaMin = (ps: ParadaNoLocal[]) => ps.reduce((s, p) => s + minutos(p), 0);

/** Conclusões curtas da família (só as que têm dado): total (e comparação), concentração numa placa, pico de 2 horas e lugar. */
export function frases({ rotulo, atual, anterior, dias, locais }: { rotulo: string; atual: ParadaNoLocal[]; anterior: ParadaNoLocal[] | null; dias: number; locais: Map<string, Local> }): string[] {
  if (!atual.length) return [];
  const total = somaMin(atual);
  let t = `${rotulo} somou ${fmtHoras(total)} em ${atual.length} ${atual.length === 1 ? "parada" : "paradas"}`;
  const antes = anterior ? somaMin(anterior) : 0;
  if (antes > 0) {
    const pct = Math.round(((total - antes) / antes) * 100);
    t += pct === 0 ? `, igual aos ${dias} dias anteriores` : `, ${Math.abs(pct)}% a ${pct > 0 ? "mais" : "menos"} que nos ${dias} dias anteriores`;
  }
  const out = [`${t}.`];
  if (total <= 0) return out;
  const [top] = rankingPlacas(atual, 1);
  if (top && top.min / total > CONCENTRACAO) out.push(`A placa ${top.nome} sozinha soma ${Math.round((top.min / total) * 100)}% do tempo.`);
  // janela de 2 horas com mais minutos; no empate, a que começa na hora mais cheia (parada só às 8h = "das 8h às 10h")
  const h = porHora(atual);
  const janela = (i: number) => h[i] + h[i + 1];
  let pico = 0;
  for (let i = 1; i < 23; i++) if (janela(i) > janela(pico) || (janela(i) === janela(pico) && h[i] > h[pico])) pico = i;
  out.push(`O pico é das ${pico}h às ${pico + 2}h.`);
  const lugar = new Map<string, number>();
  for (const p of atual) {
    const l = locais.get(p.local);
    const nome = !l ? p.local : l.naRegiao ? l.nome : "Longe da região";
    lugar.set(nome, (lugar.get(nome) ?? 0) + minutos(p));
  }
  const [onde, min] = [...lugar].sort((a, b) => b[1] - a[1])[0];
  out.push(`Onde mais acontece: ${onde}, ${fmtHoras(min)}.`);
  return out;
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/familias.test.ts`
Expected: PASS (todos). Se o nome do lugar sair diferente de "ALTO FORNO 3", conferir em `montarLocais` como o `Local.nome` da cerca é montado e ajustar só o teste se a regra de lá for a correta.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dominio/familias.ts src/lib/dominio/familias.test.ts src/lib/dominio/analise.ts
git commit -m "Análise: regras das famílias de apontamento (frases, por apontamento, quem mais para, por dia)"
```

### Task 2: Dimensão `placa` na seleção cruzada e aviso de histórico parado

**Files:**
- Modify: `src/lib/dominio/analise.ts` (`SelecaoCruzada`, `SELECAO_VAZIA`, `filtrarSelecao`, nova `ultimoDiaVelho`)
- Test: `src/lib/dominio/analise.test.ts`

**Interfaces:**
- Produces: `SelecaoCruzada` com `placa: string | null`; `DimensaoSelecao` passa a incluir `"placa"`; `ultimoDiaVelho(paradas: { dia: string }[], hoje: string): string | null`.

- [ ] **Step 1: Teste que falha** — em `analise.test.ts`, acrescentar `ultimoDiaVelho` ao import de `./analise` e, dentro do `describe("painel: seleção cruzada, serviços, horas e placar")`, depois do teste "seleção vazia não filtra...":

```ts
  it("placa: filtra pela placa; ignorar 'placa' devolve todas", () => {
    expect(filtrarSelecao(paradas, sel({ placa: "EGC2993" }), locais).map((x) => x.placa)).toEqual(["EGC2993"]);
    expect(filtrarSelecao(paradas, sel({ placa: "EGC2993" }), locais, "placa")).toHaveLength(3);
  });
```
E um `describe` novo no fim do arquivo:
```ts
describe("histórico parado", () => {
  it("último dia anterior a ontem: avisa; ontem, hoje ou sem dados: não", () => {
    expect(ultimoDiaVelho([{ dia: "2026-10-05" }, { dia: "2026-10-06" }], "2026-10-13")).toBe("2026-10-06");
    expect(ultimoDiaVelho([{ dia: "2026-10-12" }], "2026-10-13")).toBeNull();
    expect(ultimoDiaVelho([{ dia: "2026-10-13" }], "2026-10-13")).toBeNull();
    expect(ultimoDiaVelho([], "2026-10-13")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: FAIL (`ultimoDiaVelho` não existe; `placa` não filtra).

- [ ] **Step 3: Implementar em `analise.ts`**

```ts
/** Clique no painel: o lugar (bolha ou ranking), o serviço (apontamento), a hora de início e a placa escolhidos. */
export interface SelecaoCruzada {
  local: string | null;
  servico: string | null;
  hora: number | null;
  placa: string | null;
}
export type DimensaoSelecao = keyof SelecaoCruzada;
export const SELECAO_VAZIA: SelecaoCruzada = { local: null, servico: null, hora: null, placa: null };
```
Em `filtrarSelecao`, acrescentar a condição:
```ts
      (ignorar === "hora" || sel.hora == null || horaDe(p.ini) === sel.hora) &&
      (ignorar === "placa" || !sel.placa || p.placa === sel.placa),
```
E logo depois de `diaMenos`:
```ts
/** Último dia com paradas quando é anterior a ontem (o envio do histórico parou); null se está em dia ou sem dados. */
export function ultimoDiaVelho(paradas: { dia: string }[], hoje: string): string | null {
  if (!paradas.length) return null;
  const ultimo = paradas.reduce((m, p) => (p.dia > m ? p.dia : m), paradas[0].dia);
  return ultimo < diaMenos(hoje, 1) ? ultimo : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/analise.test.ts && npm run typecheck`
Expected: PASS e typecheck limpo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/analise.ts src/lib/dominio/analise.test.ts
git commit -m "Análise: placa na seleção cruzada e último dia com dados quando o histórico parou"
```

### Task 3: Tela — subabas, painel da família e tendência por dia

**Files:**
- Create: `src/app/analise/_componentes/familia/subabas-familia.tsx`
- Create: `src/app/analise/_componentes/familia/grafico-dias.tsx`
- Create: `src/app/analise/_componentes/familia/painel-familia.tsx`
- Modify: `src/app/analise/_componentes/analise.tsx`
- Test: `e2e/analise.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`familias.ts` inteiro), Task 2 (`placa`, `ultimoDiaVelho`), `GraficoBarras`/`ItemBarra` de `../grafico-barras`, `Aviso`/`cx` de `@/components/ui`, `fmtHoras`/`diaBR` de `@/lib/dominio/formato`.
- Produces: `SubabasFamilia({ valor, mudar })`, `GraficoDias({ dias, vazio })`, `PainelFamilia({...})`.

- [ ] **Step 1: Teste e2e que falha** — acrescentar em `e2e/analise.spec.ts` (depois do primeiro teste):

```ts
test("Análise: subabas por família com frases, apontamentos, quem mais para e tendência", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const familias = page.getByRole("tablist", { name: "Família" });
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  // Visão geral é a padrão: o painel de sempre
  await expect(familias.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Lugares" })).toBeVisible();
  // serviço escolhido na Visão geral sai ao trocar de família
  await page.getByRole("region", { name: "Por serviço" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await familias.getByRole("tab", { name: "Aguardando" }).click();
  await expect(filtrando).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Lugares" })).toHaveCount(0);
  // frases (30 dias: sem comparação); só o caminhão 10 na OFICINA às 8h
  const frases = page.getByRole("list", { name: "Frases automáticas" });
  await expect(frases).toContainText("Aguardando somou 1h00 em 1 parada.");
  await expect(frases).toContainText("A placa EGC2985 sozinha soma 100% do tempo.");
  await expect(frases).toContainText("O pico é das 8h às 10h.");
  await expect(frases).toContainText("Onde mais acontece: OFICINA, 1h00.");
  // por apontamento e placa viram etiquetas
  await page.getByRole("region", { name: "Por apontamento" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await page.getByRole("region", { name: "Placas" }).getByRole("button", { name: /^EGC2985/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: EGC2985" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(page.getByRole("region", { name: "Supervisores" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tendência por dia" }).getByRole("listitem")).toHaveCount(30);
  // família sem paradas: avisa em todas as seções, sem quebrar
  await familias.getByRole("tab", { name: "Pausas e pessoas" }).click();
  await expect(page.getByText("Nada neste filtro.").first()).toBeVisible();
  await expect(frases).toHaveCount(0);
  // sem apontamento: sem o gráfico "Por apontamento"
  await familias.getByRole("tab", { name: "Sem apontamento" }).click();
  await expect(page.getByRole("list", { name: "Frases automáticas" })).toContainText("Sem apontamento somou");
  await expect(page.getByRole("region", { name: "Por apontamento" })).toHaveCount(0);
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run build && npx playwright test e2e/analise.spec.ts`
Expected: FAIL (não acha o tablist "Família").

- [ ] **Step 3: `subabas-familia.tsx`**

```tsx
"use client";

import { cx } from "@/components/ui";
import { ABAS_FAMILIA, ROTULO_FAMILIA, type AbaFamilia } from "@/lib/dominio/familias";

/** Subabas acima dos gráficos: Visão geral e uma por família de apontamento (rolam na horizontal se não couberem). */
export function SubabasFamilia({ valor, mudar }: { valor: AbaFamilia; mudar: (f: AbaFamilia) => void }) {
  return (
    <div role="tablist" aria-label="Família" className="flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {ABAS_FAMILIA.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === valor}
          onClick={() => mudar(id)}
          className={cx("shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition", id === valor ? "bg-superficie text-texto shadow-sm" : "text-suave hover:text-texto")}
        >
          {id === "geral" ? "Visão geral" : ROTULO_FAMILIA[id]}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `grafico-dias.tsx`**

```tsx
"use client";

import { diaBR, fmtHoras } from "@/lib/dominio/formato";

/** Colunas com as horas paradas em cada dia do período (dia sem parada fica vazio, para não esconder buracos). */
export function GraficoDias({ dias, vazio }: { dias: { dia: string; min: number }[]; vazio: string }) {
  const max = Math.max(0, ...dias.map((d) => d.min));
  return (
    <section aria-label="Tendência por dia" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Tendência por dia <span className="font-normal normal-case tracking-normal">· horas paradas em cada dia</span>
      </h2>
      {max <= 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <ol aria-label="Dias" className="mt-2 flex h-24 items-end gap-[2px]">
            {dias.map((d) => (
              <li key={d.dia} aria-label={`${diaBR(d.dia)}, ${fmtHoras(d.min)}`} title={`${diaBR(d.dia)}: ${fmtHoras(d.min)}`} className="flex h-full flex-1 items-end">
                <span className="block w-full rounded-t-[4px] bg-primaria" style={{ height: `${d.min > 0 ? Math.max(3, (d.min / max) * 100) : 0}%` }} />
              </li>
            ))}
          </ol>
          <div aria-hidden className="mt-1 flex justify-between text-[10px] text-suave">
            <span>{diaBR(dias[0].dia).slice(0, 5)}</span>
            <span>{diaBR(dias[dias.length - 1].dia).slice(0, 5)}</span>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: `painel-familia.tsx`**

```tsx
"use client";

import { Aviso } from "@/components/ui";
import type { DimensaoSelecao, Local, ParadaNoLocal, SelecaoCruzada } from "@/lib/dominio/analise";
import { ROTULO_FAMILIA, SEM_SUPERVISOR, frases, porApontamento, porDia, rankingPlacas, rankingSupervisores, type Familia, type LinhaRanking } from "@/lib/dominio/familias";
import { fmtHoras } from "@/lib/dominio/formato";
import { GraficoBarras, type ItemBarra } from "../grafico-barras";
import { GraficoDias } from "./grafico-dias";

const paradasTxt = (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`;
const itemRanking = (r: LinhaRanking, clicavel = true): ItemBarra => ({
  chave: r.chave,
  rotulo: r.nome,
  valor: r.min,
  texto: `${fmtHoras(r.min)} · ${r.n}× · méd. ${fmtHoras(r.media)}`,
  dica: `${r.nome}, ${fmtHoras(r.min)} em ${paradasTxt(r.n)}, média de ${fmtHoras(r.media)} por parada`,
  clicavel,
});

/** Coluna da direita com uma família escolhida: frases, por apontamento, quem mais para (placas e supervisores) e tendência por dia. */
export function PainelFamilia({
  familia, recorte, anterior, dias, hoje, locais, novos, sel, alternar, supervisor, escolherSupervisor, vazio,
}: {
  familia: Familia;
  /** paradas da família com as escolhas feitas; `ignorar` pula uma dimensão (o gráfico dela mostra todas e marca a escolhida) */
  recorte: (ignorar?: DimensaoSelecao) => ParadaNoLocal[];
  /** mesmo recorte no período anterior; null = não existe (30 dias) */
  anterior: ParadaNoLocal[] | null;
  dias: number;
  hoje: string;
  locais: Map<string, Local>;
  novos: string[];
  sel: SelecaoCruzada;
  alternar: (d: "servico" | "placa", v: string) => void;
  supervisor: string | null;
  escolherSupervisor: (s: string) => void;
  vazio: string;
}) {
  const todas = recorte();
  const textos = frases({ rotulo: ROTULO_FAMILIA[familia], atual: todas, anterior, dias, locais });
  const apont: ItemBarra[] = porApontamento(recorte("servico"), familia).map((s) => ({
    chave: s.nome,
    rotulo: s.nome,
    valor: s.min,
    texto: fmtHoras(s.min),
    dica: `${s.nome}, ${fmtHoras(s.min)} em ${paradasTxt(s.n)}`,
  }));
  return (
    <div className="flex flex-col gap-2">
      {novos.length > 0 && <Aviso tipo="alerta">Apontamento novo sem família: {novos.join(", ")}</Aviso>}
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
      {familia !== "sem" && <GraficoBarras titulo="Por apontamento" sub="horas paradas" itens={apont} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />}
      <div className="grid gap-2 sm:grid-cols-2">
        <GraficoBarras titulo="Placas" sub="quem mais para" itens={rankingPlacas(recorte("placa")).map((r) => itemRanking(r))} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
        <GraficoBarras titulo="Supervisores" sub="quem mais para" itens={rankingSupervisores(todas).map((r) => itemRanking(r, r.chave !== SEM_SUPERVISOR))} selecionada={supervisor} escolher={escolherSupervisor} vazio={vazio} />
      </div>
      <GraficoDias dias={porDia(todas, hoje, dias)} vazio={vazio} />
    </div>
  );
}
```

- [ ] **Step 6: Ligar em `analise.tsx`**

Imports novos:
```ts
import { diaMenos, ultimoDiaVelho } from "@/lib/dominio/analise"; // juntar no import grande que já existe
import { ABAS_FAMILIA, DIAS_GUARDADOS, apontNovos, paradasDaFamilia, type AbaFamilia } from "@/lib/dominio/familias";
import { diaBR, diaLocal, fmtHoras } from "@/lib/dominio/formato"; // trocar o import atual de formato
import { useOpcao } from "@/lib/hooks";
import { PainelFamilia } from "./familia/painel-familia";
import { SubabasFamilia } from "./familia/subabas-familia";
```
Estado e contas (logo depois de `const [zoom, setZoom] = useState(0);` e trocando o `recorte` atual):
```ts
  const [familia, setFamilia] = useOpcao<AbaFamilia>("mon-analise-familia", ABAS_FAMILIA, "geral");
```
```ts
  const doFamilia = useMemo(() => (familia === "geral" ? doFiltro : paradasDaFamilia(doFiltro, familia)), [doFiltro, familia]);
  const recorte = useCallback((ignorar?: DimensaoSelecao) => filtrarSelecao(doFamilia, sel, base.locais, ignorar), [doFamilia, sel, base]);
  // mesmo recorte no período anterior de mesmo tamanho (só cabe nos 30 dias guardados: 7 e 15)
  const anterior = useMemo(() => {
    const n = Number(periodo);
    if (familia === "geral" || n * 2 > DIAS_GUARDADOS) return null;
    const ps = filtrar(base.paradas, { hoje: diaMenos(hoje, n), periodo: n, ...filtros, faixas: [], diasSemana: [] });
    return filtrarSelecao(paradasDaFamilia(ps, familia), sel, base.locais);
  }, [base, hoje, periodo, filtros, familia, sel]);
  const velho = useMemo(() => ultimoDiaVelho(paradas, hoje), [paradas, hoje]);
  const novos = useMemo(() => (familia === "manutencao" ? apontNovos(doFiltro) : []), [doFiltro, familia]);
```
Funções (perto de `alternar`):
```ts
  // o serviço escolhido é de uma família: trocar de subaba tira a etiqueta
  const trocarFamilia = (f: AbaFamilia) => {
    setFamilia(f);
    setSel((s) => ({ ...s, servico: null }));
  };
  const escolherSupervisor = (s: string) => setFiltros((f) => ({ ...f, supervisor: f.supervisor === s ? null : s }));
```
Etiqueta da placa (depois da etiqueta de hora):
```ts
  if (sel.placa) etiquetas.push({ dim: "placa", texto: sel.placa });
```
Coluna da direita (troca o `<div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">…</div>` inteiro):
```tsx
        <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <SubabasFamilia valor={familia} mudar={trocarFamilia} />
          {velho && (
            <p role="status" className="px-1 text-xs font-medium text-suave">
              Último dia com dados: {diaBR(velho)}
            </p>
          )}
          {familia === "geral" ? (
            <>
              <GraficoBarras titulo="Lugares" sub="mais tempo parado" itens={lugares} selecionada={sel.local} escolher={escolherLugar} vazio={vazio} />
              <GraficoBarras titulo="Por serviço" sub="paradas com o apontamento" itens={itensServico} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />
              <GraficoHoras minutos={horas} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
            </>
          ) : (
            <PainelFamilia
              familia={familia}
              recorte={recorte}
              anterior={anterior}
              dias={Number(periodo)}
              hoje={hoje}
              locais={base.locais}
              novos={novos}
              sel={sel}
              alternar={alternar}
              supervisor={filtros.supervisor}
              escolherSupervisor={escolherSupervisor}
              vazio={vazio}
            />
          )}
        </div>
```
Atualizar o comentário do topo do componente: "…mapa de bolhas à esquerda e, à direita, a Visão geral ou o painel da família escolhida (que também filtra as bolhas)…".

- [ ] **Step 7: Rodar e ver passar**

Run: `npm run lint && npm run typecheck && npm run build && npx playwright test e2e/analise.spec.ts`
Expected: PASS (os 4 testes da Análise, computador e celular).

- [ ] **Step 8: Commit**

```bash
git add src/app/analise e2e/analise.spec.ts
git commit -m "Análise: subabas por família de apontamento (frases, por apontamento, quem mais para, tendência por dia)"
```

### Task 4: CHANGELOG, README e verificação completa

**Files:**
- Modify: `CHANGELOG.md` (seção "Análise mais limpa · 13/10/2026")
- Modify: `README.md` (só se houver seção descrevendo a tela Análise; acrescentar uma linha sobre as subabas)

- [ ] **Step 1: CHANGELOG** — acrescentar na seção "Análise mais limpa · 13/10/2026 (não publicado)":

```md
- **Subabas por família de apontamento** ao lado do mapa: Visão geral (o painel de sempre), Aguardando, Pausas e pessoas, Logística, Preparação e bloqueio, Manutenção e clima e Sem apontamento. A família escolhida filtra também o mapa.
- Em cada família: **frases automáticas** (total e comparação com o período anterior em 7 e 15 dias, placa que concentra o tempo, pico de 2 horas, lugar), **por apontamento**, **quem mais para** (placas e supervisores, com média por parada) e **tendência por dia**. Clicar numa placa vira filtro; num supervisor, preenche o filtro do topo.
- Aviso "Último dia com dados" quando o envio do histórico parou. Apontamento novo do tablet cai em Manutenção e clima com aviso.
```

- [ ] **Step 2: Verificação completa**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`
Expected: tudo verde (vitest com os testes novos; e2e com o teste novo nos dois aparelhos).

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md README.md
git commit -m "Análise: CHANGELOG das subabas por família"
```

# Exceções do dia — plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba "Exceções do dia" na tela Alertas, com as 9 regras do dono (horários do Pátio por regime, ida ao Pátio, Servitec, Oficina Centro, vácuo na bica, restaurante > 1 h, ociosidade 30 min, motor desligado 1 h).

**Architecture:** Regras e limites num arquivo só (`regras-frota.ts`); cálculo puro e testado (`excecoes.ts`) sobre um eixo de 2 dias (véspera + dia) para o turno da noite; leitura só do Supabase (eventos de área, timeline de motor, tablet) em `dados/excecoes.ts`; a tela Alertas ganha abas.

**Tech Stack:** Next.js estático + TypeScript + Tailwind, Supabase, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-excecoes-do-dia-design.md`

## Global Constraints

- Nenhuma consulta nova ao GAUSS; nada novo no banco.
- Horários, cercas e limites só em `src/lib/dominio/regras-frota.ts`.
- Cor nunca sozinha (gravidade com rótulo). Texto em português simples.
- Sem commits (o dono faz commits por assunto ao publicar).

## Review Focus

1. Turno da noite atravessando a meia-noite (24 h: 19:15 → 06:23) — a chegada cedo aparece no dia em que acontece. (Tarefa 2.)
2. Dia de hoje pela metade — nada de "não saiu" antes do horário passar. (Tarefa 2.)
3. Fim de semana para ADM e 16 h — nenhuma exceção de horário. (Tarefa 2.)
4. Equipamento Em manutenção — sem exceções de horário e motor. (Tarefa 2.)
5. Nome de cerca com acento ou espaço diferente ("ABAST ÁGUA" x "ABAST AGUA") — reconhecido. (Tarefa 1.)

---

### Task 1: Regras da frota (`regras-frota.ts`)

**Files:** Create `src/lib/dominio/regras-frota.ts`; Test `src/lib/dominio/regras-frota.test.ts`

**Produces:** `type Regime`, `ROTULO_REGIME`, `EXPEDIENTES`, `TOLERANCIA_MIN`, `OCIOSO_MIN`, `DESLIGADO_MIN`, `RESTAURANTE_MIN`, `PATIO`, `SERVITEC`, `OFICINAS_FORA`, `BICAS`, `RESTAURANTES`, `normNome(s)`, `ehDaLista(area, lista)`, `regimeDoEquip(matriz, vaga)`.

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import { BICAS, ehDaLista, regimeDoEquip } from "./regras-frota";

describe("regime de cada equipamento", () => {
  it("vem da matriz quando preenchido", () => {
    expect(regimeDoEquip("ADM", "")).toEqual({ regime: "adm", presumido: false });
    expect(regimeDoEquip("16H - 5X2", "")).toEqual({ regime: "16h", presumido: false });
    expect(regimeDoEquip("4X4 - A", "")).toEqual({ regime: "24h", presumido: false });
  });
  it("matriz em branco: pelo nome da vaga do GAUSS; sem pista, ADM presumido", () => {
    expect(regimeDoEquip(null, "ALTA PRESSÃO - GPS - 08 - 24 HS")).toEqual({ regime: "24h", presumido: false });
    expect(regimeDoEquip("", "AUTO VÁCUO - GPS - 07 - 16 HS")).toEqual({ regime: "16h", presumido: false });
    expect(regimeDoEquip(null, "ALTA PRESSÃO - GPS - 03")).toEqual({ regime: "adm", presumido: true });
  });
});

describe("nomes de cerca", () => {
  it("reconhece sem depender de acento, maiúscula ou espaço", () => {
    expect(ehDaLista("abast agua", BICAS)).toBe(true);
    expect(ehDaLista("ABASTECIMENTO  ÁGUA RUA 29 ", BICAS)).toBe(true);
    expect(ehDaLista("ABAST COMBUSTÍVEL", BICAS)).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/dominio/regras-frota.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementação**

```ts
// Regras do rastreamento inteligente (questionário do dono, 08/10/2026): horários de cada regime, cercas e limites.
// Um só lugar para mudar. Desenho: docs/superpowers/specs/2026-10-08-excecoes-do-dia-design.md

export type Regime = "adm" | "16h" | "24h";
export const ROTULO_REGIME: Record<Regime, string> = { adm: "ADM", "16h": "16 horas", "24h": "24 horas" };

/**
 * Expedientes de cada regime: sai do Pátio até `saida` e volta a partir de `chegada` (chegada menor que a saída =
 * dia seguinte). Dias: 0 = domingo ... 6 = sábado. 24 horas vale também para as escalas 4X4 (A, B, C e D).
 */
export const EXPEDIENTES: Record<Regime, { dias: number[]; turnos: { saida: string; chegada: string }[] }> = {
  adm: { dias: [1, 2, 3, 4, 5], turnos: [{ saida: "07:45", chegada: "16:30" }] },
  "16h": { dias: [1, 2, 3, 4, 5], turnos: [{ saida: "07:15", chegada: "14:23" }, { saida: "15:15", chegada: "22:23" }] },
  "24h": { dias: [0, 1, 2, 3, 4, 5, 6], turnos: [{ saida: "07:15", chegada: "18:23" }, { saida: "19:15", chegada: "06:23" }] },
};

/** O coletor vê a posição a cada ~5 min: folga nos horários de saída e chegada. */
export const TOLERANCIA_MIN = 5;
/** Parado ligado sem produzir por este tempo seguido vira ociosidade. */
export const OCIOSO_MIN = 30;
/** Motor desligado por este tempo seguido no expediente vira alerta. */
export const DESLIGADO_MIN = 60;
/** Tempo no restaurante acima disto vira alerta. */
export const RESTAURANTE_MIN = 60;

export const PATIO = ["PÁTIO DO TRANSPORTE RODOVIÁRIO"];
export const SERVITEC = ["OFICINA GPS/SERVITEC"];
export const OFICINAS_FORA = ["OFICINA CENTRO"];
export const BICAS = ["ABAST ÁGUA", "ABASTECIMENTO ÁGUA RUA 29"];
export const RESTAURANTES = [
  "RESTAURANTE DA SINTER",
  "RESTAURANTE DA LUA",
  "RESTAURANTE DA SOL",
  "RESTAURANTE MECANIZADA",
  "RESTAURANTE DA LAGOA",
  "ESTACIONAMENTO RESTAURANTE CENTRAL",
  "ESTACIONAMENTO RESTAURANTE DA LAGOA",
  "ESTACIONAMENTO RESTAURANTE DA MATA",
];

/** Nome de cerca comparável: sem acento, maiúsculo, espaços simples. */
export const normNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
export const ehDaLista = (area: string, lista: string[]) => lista.some((n) => normNome(n) === normNome(area));

/** Regime: o da matriz; em branco, pelo nome da vaga ("24 HS", "16 HS"); sem pista, ADM presumido. */
export function regimeDoEquip(matriz: string | null | undefined, vaga: string): { regime: Regime; presumido: boolean } {
  const m = normNome(matriz ?? "");
  if (m.startsWith("ADM")) return { regime: "adm", presumido: false };
  if (/16\s*H/.test(m)) return { regime: "16h", presumido: false };
  if (/4X4|24\s*H|TURNO/.test(m)) return { regime: "24h", presumido: false };
  const v = normNome(vaga);
  if (/\b24\s*HS?\b/.test(v)) return { regime: "24h", presumido: false };
  if (/\b16\s*HS?\b/.test(v)) return { regime: "16h", presumido: false };
  return { regime: "adm", presumido: true };
}
```

- [ ] **Step 4:** mesmo comando → PASS.

---

### Task 2: Cálculo das exceções (`excecoes.ts`)

**Files:** Create `src/lib/dominio/excecoes.ts`; Test `src/lib/dominio/excecoes.test.ts`

**Consumes:** Tarefa 1; `diaMenos`, `diaDaSemana` (`./analise`); `montarStatusGauss`, `formasDaPlaca`, `LinhaTablet` (`./gauss-dia`); `LinhaMotorFrota` (`./dia-frota`); `statusProdutivo` (`./produtividade`); `fmtHora`, `fmtMin`, `segDe` (`./formato`); `DIA` (`./trilhas`).

**Produces:** `REGRAS`, `type RegraExcecao`, `ROTULO_REGRA`, `type Gravidade`, `interface Excecao`, `interface EntradaExcecoes`, `intervalosDeArea(eventos, base, fim)`, `excecoesDoDia(entrada)`.

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../tipos";
import type { LinhaMotorFrota } from "./dia-frota";
import { excecoesDoDia, intervalosDeArea, type EntradaExcecoes } from "./excecoes";

const D = "2026-10-07"; // quarta
const V = "2026-10-06"; // véspera
const H = 3600;
const PATIO = "PÁTIO DO TRANSPORTE RODOVIÁRIO";
const hs = (h: string) => { const [a, b] = h.split(":").map(Number); return a * H + b * 60; };
const ev = (id: string, tipo: string, dia: string, hora: string, area: string) => ({ id, tipo, t: `${dia}T${hora}:00-03:00`, area, placa: "", vaga: "" }) as unknown as Evento;
const m = (id: string, i: string, f: string, status: string): LinhaMotorFrota => ({ placa_ou_codigo: id, inicio: `${D} ${i}:00`, fim: `${D} ${f}:00`, status, status_label: null });
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", o: { regime?: string | null; vaga?: string; status?: "ATIVO" | "EM_MANUTENCAO" } = {}): Veiculo =>
  ({ id, placa, vaga: o.vaga ?? "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false,
     equip: { tipo, nome: placa, ordem: 1, regime: o.regime ?? null, status: o.status ?? "ATIVO" } }) as Veiculo;

// 1: Alta Pressão ADM. Sai tarde, passa na Servitec, fica ocioso, desliga, almoça demais, volta ao Pátio no meio,
//    vai à Oficina Centro e chega cedo.
const E1 = [
  ev("1", "abertura", V, "00:05", PATIO),
  ev("1", "saida", D, "08:10", PATIO),
  ev("1", "entrada", D, "08:30", "OFICINA GPS/SERVITEC"), ev("1", "saida", D, "08:50", "OFICINA GPS/SERVITEC"),
  ev("1", "entrada", D, "11:00", "RESTAURANTE DA LUA"), ev("1", "saida", D, "12:20", "RESTAURANTE DA LUA"),
  ev("1", "entrada", D, "13:00", PATIO), ev("1", "saida", D, "13:30", PATIO),
  ev("1", "entrada", D, "14:00", "OFICINA CENTRO"), ev("1", "saida", D, "14:20", "OFICINA CENTRO"),
  ev("1", "entrada", D, "16:00", PATIO),
];
const M1 = [m("1", "09:00", "09:45", "stopped"), m("1", "10:00", "11:10", "off"), m("1", "14:30", "15:40", "off")];
const T1 = [{ placa: "EGC2985", demora_cod: 9, inicio: `${D} 14:30:00`, fim: `${D} 15:30:00`, categoria_demora: "Refeição Motorista", motorista: null, concluido: "SIM" }];
// 2: Auto Vácuo 24 horas (pela vaga). Chega cedo do turno da noite, sai tarde de manhã, para na bica.
const E2 = [
  ev("2", "abertura", V, "00:05", "ALTO FORNO 3"),
  ev("2", "saida", V, "02:00", "ALTO FORNO 3"),
  ev("2", "entrada", D, "05:30", PATIO), ev("2", "saida", D, "07:40", PATIO),
  ev("2", "entrada", D, "09:00", "ABAST ÁGUA"), ev("2", "saida", D, "09:10", "ABAST ÁGUA"),
];
const M2 = [m("2", "10:00", "11:30", "stopped")];
// 3: Hiper Vácuo em manutenção, parado no Pátio e desligado o dia todo: nada.
const E3 = [ev("3", "abertura", V, "00:05", PATIO)];
const M3 = [m("3", "08:00", "17:00", "off")];
// 4: sem regime na matriz nem na vaga (ADM presumido), fica no Pátio o dia todo.
const E4 = [ev("4", "abertura", V, "00:05", PATIO)];

const FROTA = [
  v("1", "EGC2985", "ap", { regime: "ADM" }),
  v("2", "EGC2993", "av", { vaga: "AUTO VÁCUO - GPS - 01 - 24 HS" }),
  v("3", "EAM3257", "hv", { regime: "ADM", status: "EM_MANUTENCAO" }),
  v("4", "DSY6477", "ap", { vaga: "ALTA PRESSÃO - GPS - 03" }),
];
const entrada = (o: Partial<EntradaExcecoes> = {}): EntradaExcecoes => ({ dia: D, agoraSeg: null, veiculos: FROTA, eventos: [...E1, ...E2, ...E3, ...E4], motor: [...M1, ...M2, ...M3], tablet: T1, ...o });
const resumo = (xs: ReturnType<typeof excecoesDoDia>, id: string) => xs.filter((x) => x.veiculo === id).map((x) => [x.regra, x.ini]);

describe("intervalos por área", () => {
  it("abertura, entradas e saídas viram intervalos (eixo desde a véspera)", () => {
    const DIA = 24 * H;
    expect(intervalosDeArea(E2, V, 2 * DIA)).toEqual([
      { area: "ALTO FORNO 3", a: 0, b: hs("02:00") },
      { area: PATIO, a: DIA + hs("05:30"), b: DIA + hs("07:40") },
      { area: "ABAST ÁGUA", a: DIA + hs("09:00"), b: DIA + hs("09:10") },
    ]);
  });
});

describe("exceções do dia", () => {
  const xs = excecoesDoDia(entrada());
  it("ADM: saída tarde, Servitec, ociosidade, motor desligado, restaurante, ida ao Pátio, Oficina Centro e chegada cedo", () => {
    expect(resumo(xs, "1")).toEqual([
      ["saida_tarde", hs("08:10")],
      ["servitec", hs("08:30")],
      ["ocioso", hs("09:00")],
      ["desligado", hs("10:00")],
      ["restaurante", hs("11:00")],
      ["patio", hs("13:00")],
      ["oficina_fora", hs("14:00")],
      ["chegada_cedo", hs("16:00")],
    ]);
    expect(xs.find((x) => x.regra === "saida_tarde" && x.veiculo === "1")?.detalhe).toBe("saiu 08:10 · limite 07:45");
    expect(xs.find((x) => x.regra === "restaurante")?.detalhe).toBe("1h20");
  });
  it("motor desligado com refeição apontada no tablet não vira alerta", () => {
    expect(xs.some((x) => x.veiculo === "1" && x.regra === "desligado" && x.ini === hs("14:30"))).toBe(false);
  });
  it("24 horas: chegada cedo do turno da noite, saída tarde de manhã e vácuo na bica; parado ligado do Alto Vácuo é produtivo", () => {
    expect(resumo(xs, "2")).toEqual([
      ["chegada_cedo", hs("05:30")],
      ["saida_tarde", hs("07:40")],
      ["bica_vacuo", hs("09:00")],
    ]);
  });
  it("em manutenção: nenhuma exceção de horário nem de motor", () => {
    expect(resumo(xs, "3")).toEqual([]);
  });
  it("não saiu do Pátio", () => {
    expect(xs.filter((x) => x.veiculo === "4").map((x) => [x.regra, x.detalhe])).toEqual([["saida_tarde", "não saiu do Pátio · limite 07:45"]]);
  });
  it("hoje pela metade: antes do horário passar, nada de 'não saiu'", () => {
    expect(resumo(excecoesDoDia(entrada({ agoraSeg: hs("07:00") })), "4")).toEqual([]);
    expect(resumo(excecoesDoDia(entrada({ agoraSeg: hs("09:00") })), "4")).toEqual([["saida_tarde", hs("07:45")]]);
  });
  it("sábado: ADM não tem expediente", () => {
    const S = "2026-10-10";
    const sab = excecoesDoDia({ dia: S, agoraSeg: null, veiculos: FROTA, eventos: [ev("4", "abertura", "2026-10-09", "00:05", PATIO)], motor: [], tablet: [] });
    expect(sab).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/dominio/excecoes.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementação**

```ts
// Exceções do dia: só o que fugiu das regras da frota (gestão por exceção). Tudo puro; a tela só mostra.
// Eixo do tempo: segundos desde 00:00 da VÉSPERA (0 a 2 dias), porque o turno da noite atravessa a meia-noite.
// O dia pedido vai de DIA a 2*DIA no eixo; cada exceção sai com o horário dentro do dia pedido.
// Desenho: docs/superpowers/specs/2026-10-08-excecoes-do-dia-design.md
import type { Evento, Veiculo } from "../tipos";
import { diaDaSemana, diaMenos } from "./analise";
import type { LinhaMotorFrota } from "./dia-frota";
import { fmtHora, fmtMin, segDe } from "./formato";
import { formasDaPlaca, montarStatusGauss, type LinhaTablet } from "./gauss-dia";
import { statusProdutivo } from "./produtividade";
import {
  BICAS, DESLIGADO_MIN, EXPEDIENTES, OCIOSO_MIN, OFICINAS_FORA, PATIO, RESTAURANTES, RESTAURANTE_MIN, SERVITEC, TOLERANCIA_MIN, ehDaLista, regimeDoEquip, type Regime,
} from "./regras-frota";
import { DIA } from "./trilhas";

export const REGRAS = ["saida_tarde", "chegada_cedo", "patio", "servitec", "oficina_fora", "bica_vacuo", "restaurante", "ocioso", "desligado"] as const;
export type RegraExcecao = (typeof REGRAS)[number];
export const ROTULO_REGRA: Record<RegraExcecao, string> = {
  saida_tarde: "Saída tarde do Pátio",
  chegada_cedo: "Chegada cedo ao Pátio",
  patio: "Ida ao Pátio no expediente",
  servitec: "Oficina da Servitec",
  oficina_fora: "Oficina de fora",
  bica_vacuo: "Vácuo na bica",
  restaurante: "Restaurante acima de 1 h",
  ocioso: "Ociosidade",
  desligado: "Motor desligado 1 h",
};
/** alerta = fugiu da regra; atenção = só para saber (oficinas). */
export type Gravidade = "alerta" | "atencao";
const GRAVIDADE: Record<RegraExcecao, Gravidade> = {
  saida_tarde: "alerta", chegada_cedo: "alerta", patio: "alerta", servitec: "atencao", oficina_fora: "atencao", bica_vacuo: "alerta", restaurante: "alerta", ocioso: "alerta", desligado: "alerta",
};

export interface Excecao {
  regra: RegraExcecao;
  /** id do veículo no GAUSS */
  veiculo: string;
  /** segundos do dia pedido (início e fim; fim null = um instante, como a hora de saída) */
  ini: number;
  fim: number | null;
  local: string | null;
  /** texto curto: "saiu 08:10 · limite 07:45", "43 min" */
  detalhe: string;
  gravidade: Gravidade;
}
export interface EntradaExcecoes {
  dia: string;
  /** segundos do dia pedido agora (só hoje); null = dia fechado */
  agoraSeg: number | null;
  veiculos: Veiculo[];
  /** eventos de área da véspera e do dia */
  eventos: Evento[];
  /** timeline de motor da véspera e do dia */
  motor: LinhaMotorFrota[];
  /** apontamentos do tablet da véspera e do dia, com a placa */
  tablet: (LinhaTablet & { placa: string })[];
}
export interface IntervaloArea {
  area: string;
  a: number;
  b: number;
}

function agrupar<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}
// eventos guardam o instante (ISO); o eixo começa às 00:00 de Brasília (sem horário de verão desde 2019)
const segDoIso = (iso: string, base: string) => (Date.parse(iso) - Date.parse(`${base}T00:00:00-03:00`)) / 1000;
// o GAUSS grava "AAAA-MM-DD HH:MM:SS" no horário local
const segDoLocal = (ts: string, base: string) => Math.round((Date.parse(`${ts.slice(0, 10)}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 1000) + segDe(ts.slice(11, 19));
const hhmm = (t: number) => fmtHora(((t % DIA) + DIA) % DIA).slice(0, 5);
const dur = (seg: number) => fmtMin(seg / 60);

/** Onde o veículo esteve: intervalos por área a partir da abertura, entradas e saídas (eixo desde 00:00 de `base`, até `fim`). */
export function intervalosDeArea(eventos: Evento[], base: string, fim: number): IntervaloArea[] {
  const out: IntervaloArea[] = [];
  let area: string | null = null;
  let desde = 0;
  const mudar = (nova: string, t: number) => {
    const x = Math.min(Math.max(t, 0), fim);
    if (area && x > desde) out.push({ area, a: desde, b: x });
    area = nova;
    desde = x;
  };
  for (const e of [...eventos].sort((p, q) => p.t.localeCompare(q.t))) {
    const t = segDoIso(e.t, base);
    if (e.tipo === "abertura") {
      if (area === null) {
        area = e.area;
        desde = 0;
      } else if (e.area !== area) mudar(e.area, t);
    } else if (e.tipo === "entrada") mudar(e.area, t);
    else if (e.tipo === "saida") {
      if (area === null) area = e.area; // estava na área desde o começo do eixo
      if (area === e.area) mudar("", t);
    }
  }
  mudar("", fim);
  return out;
}

/** Expedientes do regime que começam na véspera e no dia pedido, no eixo. */
function expedientes(regime: Regime, base: string): { s: number; c: number }[] {
  const out: { s: number; c: number }[] = [];
  const cfg = EXPEDIENTES[regime];
  [base, diaMenos(base, -1)].forEach((dia, k) => {
    if (!cfg.dias.includes(diaDaSemana(dia))) return;
    for (const t of cfg.turnos) {
      const s = k * DIA + segDe(t.saida);
      let c = k * DIA + segDe(t.chegada);
      if (c <= s) c += DIA;
      out.push({ s, c });
    }
  });
  return out;
}

/** Timeline de motor da véspera e do dia num eixo só, juntando o mesmo status que atravessa a meia-noite. */
function motorNoEixo(linhas: LinhaMotorFrota[], base: string, dia: string): { a: number; b: number; cod: string }[] {
  const blocos = [...montarStatusGauss(linhas, base), ...montarStatusGauss(linhas, dia).map((x) => ({ ...x, a: x.a + DIA, b: x.b + DIA }))];
  const out: { a: number; b: number; cod: string }[] = [];
  for (const x of blocos) {
    const ult = out.at(-1);
    if (ult && ult.cod === x.cod && ult.b === x.a) ult.b = x.b;
    else out.push({ a: x.a, b: x.b, cod: x.cod });
  }
  return out;
}

/** O que fugiu das regras no dia pedido, do mais cedo para o mais tarde. */
export function excecoesDoDia(x: EntradaExcecoes): Excecao[] {
  const base = diaMenos(x.dia, 1);
  const fim = x.agoraSeg == null ? 2 * DIA : DIA + x.agoraSeg;
  const tol = TOLERANCIA_MIN * 60;
  const noDia = (t: number) => t >= DIA && t < 2 * DIA;
  const evPorId = agrupar(
    x.eventos.filter((e) => !e.motor2),
    (e) => e.id,
  );
  const motorPorId = agrupar(x.motor, (l) => l.placa_ou_codigo);
  const out: Excecao[] = [];

  for (const v of x.veiculos) {
    if (v.motor2_de || !v.equip) continue;
    const { regime } = regimeDoEquip(v.equip.regime, v.vaga);
    const manut = v.equip.status === "EM_MANUTENCAO";
    const areas = intervalosDeArea(evPorId.get(v.id) ?? [], base, fim);
    const em = (lista: string[]) => areas.filter((i) => ehDaLista(i.area, lista));
    const naLista = (lista: string[], t: number) => em(lista).some((i) => i.a <= t && t < i.b);
    const localEm = (t: number) => areas.find((i) => i.a <= t && t < i.b)?.area ?? null;
    const patio = em(PATIO);
    const exps = expedientes(regime, base);
    const noExp = (a: number, b: number) => Math.max(0, ...exps.map((e) => Math.min(b, e.c) - Math.max(a, e.s)));
    const add = (regra: RegraExcecao, ini: number, fimX: number | null, local: string | null, detalhe: string) =>
      out.push({ regra, veiculo: v.id, ini: ini - DIA, fim: fimX == null ? null : fimX - DIA, local, detalhe, gravidade: GRAVIDADE[regra] });

    if (!manut)
      for (const e of exps) {
        // 1. saída tarde: ainda no Pátio depois do horário (+ folga)
        if (noDia(e.s) && e.s + tol <= fim) {
          const p = patio.find((i) => i.a <= e.s + tol && e.s + tol < i.b);
          if (p && p.b < Math.min(e.c, fim)) add("saida_tarde", p.b, null, p.area, `saiu ${hhmm(p.b)} · limite ${hhmm(e.s)}`);
          else if (p) add("saida_tarde", e.s, null, p.area, `não saiu do Pátio · limite ${hhmm(e.s)}`);
        }
        // 2. chegada cedo: já de volta ao Pátio antes do horário (− folga), depois de ter saído no expediente
        if (noDia(e.c) && e.c <= fim) {
          const p = patio.find((i) => i.a < e.c - tol && e.c - tol < i.b);
          if (p && p.a > e.s + tol) add("chegada_cedo", p.a, null, p.area, `chegou ${hhmm(p.a)} · limite ${hhmm(e.c)}`);
        }
        // 3. ida ao Pátio no meio do expediente: entrou e saiu antes do horário de volta
        for (const p of patio) if (noDia(p.a) && p.a > e.s + tol && p.b < e.c - tol && p.b < fim) add("patio", p.a, p.b, p.area, dur(p.b - p.a));
      }
    // 4 e 5. oficinas (a da Servitec só no expediente; a de fora, sempre)
    for (const i of em(SERVITEC)) if (noDia(i.a) && noExp(i.a, i.b) > 0) add("servitec", i.a, i.b, i.area, dur(i.b - i.a));
    for (const i of em(OFICINAS_FORA)) if (noDia(i.a)) add("oficina_fora", i.a, i.b, i.area, dur(i.b - i.a));
    // 6. Auto Vácuo e Hiper Vácuo não enchem água: parar na bica é alerta
    if (v.equip.tipo === "av" || v.equip.tipo === "hv") for (const i of em(BICAS)) if (noDia(i.a)) add("bica_vacuo", i.a, i.b, i.area, dur(i.b - i.a));
    // 7. restaurante acima do limite, no expediente
    for (const i of em(RESTAURANTES)) if (noDia(i.a) && i.b - i.a > RESTAURANTE_MIN * 60 && noExp(i.a, i.b) > 0) add("restaurante", i.a, i.b, i.area, dur(i.b - i.a));

    if (manut) continue;
    const blocos = motorNoEixo(motorPorId.get(v.id) ?? [], base, x.dia);
    // 8. ociosidade: parado ligado seguido, quando parado ligado não é o produtivo do equipamento (fora do Pátio)
    if (statusProdutivo(v.equip.tipo, v.placa) !== "stopped")
      for (const b of blocos) if (b.cod === "stopped" && noDia(b.a) && noExp(b.a, b.b) >= OCIOSO_MIN * 60 && !naLista(PATIO, b.a)) add("ocioso", b.a, b.b, localEm(b.a), dur(b.b - b.a));
    // 9. motor desligado no expediente, fora do Pátio e das oficinas, sem refeição apontada no tablet
    const placas = new Set(formasDaPlaca(v.placa));
    const refeicoes = x.tablet
      .filter((t) => placas.has(t.placa) && /REFEI/i.test(t.categoria_demora))
      .map((t) => ({ a: segDoLocal(t.inicio, base), b: t.fim ? segDoLocal(t.fim, base) : fim }));
    for (const b of blocos) {
      if ((b.cod !== "off" && b.cod !== "main_switch_off") || !noDia(b.a) || noExp(b.a, b.b) < DESLIGADO_MIN * 60) continue;
      if (naLista([...PATIO, ...SERVITEC, ...OFICINAS_FORA], b.a) || refeicoes.some((r) => r.a < b.b && r.b > b.a)) continue;
      add("desligado", b.a, b.b, localEm(b.a), dur(b.b - b.a));
    }
  }
  return out.sort((p, q) => p.ini - q.ini || p.veiculo.localeCompare(q.veiculo));
}
```

- [ ] **Step 4:** mesmo comando → PASS. Se `fmtMin(80)` não der "1h20", ajustar só a expectativa do teste ao formato real do site (e registrar).

---

### Task 3: Leitura (tablet da frota + gancho)

**Files:** Modify `src/lib/dados/gauss-dia.ts` (função nova `lerTabletFrotaDia`); Create `src/lib/dados/excecoes.ts`; Test `src/lib/dados/excecoes.test.ts`

**Produces:** `lerTabletFrotaDia(dia, c?)`, `useExcecoesDados(dia, hoje)` → `{ dados: Omit<EntradaExcecoes, "dia" | "agoraSeg" | "veiculos"> | null; erro: string | null }`.

- [ ] **Step 1: Teste**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { lerTabletFrotaDia } from "./gauss-dia";

describe("lerTabletFrotaDia", () => {
  it("lê o tablet da frota inteira em páginas de 1000", async () => {
    const linhas = Array.from({ length: 1500 }, (_, i) => ({ placa: "EGC2985", demora_cod: i, inicio: "2026-10-07 08:00:00", fim: null, categoria_demora: "X", motorista: null, concluido: null }));
    const faixas: [number, number][] = [];
    const q = { select: () => q, lt: () => q, or: () => q, order: () => q, range: async (de: number, ate: number) => (faixas.push([de, ate]), { data: linhas.slice(de, ate + 1), error: null }) };
    const r = await lerTabletFrotaDia("2026-10-07", { from: () => q } as unknown as SupabaseClient);
    expect(r).toHaveLength(1500);
    expect(faixas).toEqual([[0, 999], [1000, 1999]]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/dados/excecoes.test.ts` → FAIL (`lerTabletFrotaDia` não existe).

- [ ] **Step 3:** Em `src/lib/dados/gauss-dia.ts`, depois de `lerMotorFrotaDia`:

```ts
/** Apontamentos do tablet de toda a frota num dia (Exceções do dia), em páginas. */
export async function lerTabletFrotaDia(dia: string, c: SupabaseClient = db()): Promise<(LinhaTablet & { placa: string })[]> {
  const ate = diaSeguinte(dia);
  const linhas: (LinhaTablet & { placa: string })[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(
      c
        .from("demoras_categorizadas")
        .select("placa, demora_cod, inicio, fim, categoria_demora, motorista, concluido")
        .lt("inicio", ate)
        .or(`fim.is.null,fim.gt.${dia}`)
        // demora_cod desempata: as páginas não repetem nem pulam linhas
        .order("inicio")
        .order("demora_cod")
        .range(de, de + PAGINA - 1),
    )) as (LinhaTablet & { placa: string })[];
    linhas.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return linhas;
}
```

E `src/lib/dados/excecoes.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { diaMenos } from "../dominio/analise";
import type { EntradaExcecoes } from "../dominio/excecoes";
import { lerMotorFrotaDia, lerTabletFrotaDia } from "./gauss-dia";
import { lerEventos } from "./leituras";

type Dados = Omit<EntradaExcecoes, "dia" | "agoraSeg" | "veiculos">;

/** Exceções do dia: eventos de área, motor e tablet da véspera e do dia (só o Supabase); hoje relê a cada 5 min. */
export function useExcecoesDados(dia: string, hoje: boolean): { dados: Dados | null; erro: string | null } {
  const [estado, setEstado] = useState<{ dia: string | null; dados: Dados | null; erro: string | null }>({ dia: null, dados: null, erro: null });
  useEffect(() => {
    let vivo = true;
    const vespera = diaMenos(dia, 1);
    const ler = () =>
      Promise.all([lerEventos(vespera), lerEventos(dia), lerMotorFrotaDia(vespera), lerMotorFrotaDia(dia), lerTabletFrotaDia(vespera), lerTabletFrotaDia(dia)]).then(
        ([ev1, ev2, m1, m2, t1, t2]) => vivo && setEstado({ dia, dados: { eventos: [...ev1, ...ev2], motor: [...m1.linhas, ...m2.linhas], tablet: [...t1, ...t2] }, erro: null }),
        (e: unknown) => vivo && setEstado((s) => ({ ...s, dia, erro: e instanceof Error ? e.message : String(e) })),
      );
    void ler();
    const t = hoje ? setInterval(ler, 5 * 60 * 1000) : undefined;
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [dia, hoje]);
  const doDia = estado.dia === dia;
  return { dados: doDia ? estado.dados : null, erro: doDia ? estado.erro : null };
}
```

- [ ] **Step 4:** teste → PASS; `npx tsc --noEmit`.

---

### Task 4: Tela (abas em Alertas + Exceções do dia) e e2e

**Files:** Create `src/app/alertas/_componentes/excecoes.tsx`, `src/app/alertas/_componentes/abas.tsx`; Modify `src/app/alertas/_componentes/alertas.tsx` (prop `topo`), `src/app/alertas/page.tsx`, `e2e/apoio.ts` (opção `eventos`), `e2e/alertas.spec.ts`; Test `e2e/excecoes.spec.ts`.

- [ ] **Step 1: e2e** — em `e2e/apoio.ts`, opção `eventos?: unknown[]` em `prepararDados` (`if (tabela === "loc_eventos") return json((opcoes.eventos ?? eventos()).map((dados) => ({ dados })));`). Em `e2e/alertas.spec.ts`, clicar na aba antes: `await page.getByRole("tab", { name: "Eventos" }).click();`. Novo `e2e/excecoes.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { eventos, prepararDados } from "./apoio";

const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString();

test("Exceções do dia: resumo por regra, lista por equipamento e por regra, link para a Timeline", async ({ page }) => {
  const extra = [
    { t: minutosAtras(50), id: "10", placa: "EGC2985", vaga: "", tipo: "entrada", area: "OFICINA CENTRO", lat: -19.48, lng: -42.53 },
    { t: minutosAtras(40), id: "10", placa: "EGC2985", vaga: "", tipo: "saida", area: "OFICINA CENTRO", desde: minutosAtras(50), permanencia_min: 10 },
  ];
  const gravacoes = await prepararDados(page, { eventos: [...eventos(), ...extra] });
  await page.goto("/alertas/");
  await expect(page.getByRole("tab", { name: "Exceções do dia" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Oficina de fora/ })).toContainText("1");
  const lista = page.getByRole("region", { name: "Exceções" });
  await expect(lista).toContainText("EGC-2985");
  await expect(lista).toContainText("OFICINA CENTRO");
  await page.getByRole("tab", { name: "Por regra" }).click();
  await expect(lista.getByRole("heading", { name: /Oficina de fora/ })).toBeVisible();
  await lista.getByRole("link", { name: /Timeline/ }).first().click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});
```

> Conferir o papel que o `Segmentado` usa (`radio` ou `button` com `aria-pressed`) e ajustar o seletor "Por regra" a ele, registrando.

- [ ] **Step 2:** build + `npx playwright test e2e/excecoes.spec.ts` → FAIL.

- [ ] **Step 3: `abas.tsx`**

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";
import { Alertas } from "./alertas";
import { Excecoes } from "./excecoes";

type Aba = "excecoes" | "eventos";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "excecoes", rotulo: "Exceções do dia" },
  { id: "eventos", rotulo: "Eventos" },
];

/** Alertas em duas abas: as exceções às regras da frota (padrão) e os eventos do dia (entradas, saídas, status). */
export function AbasAlertas() {
  const params = useSearchParams();
  // link do sino com ?placa= abre direto nos eventos daquele equipamento
  const [aba, setAba] = useState<Aba>(() => (params.get("placa") ? "eventos" : "excecoes"));
  const topo = (
    <div role="tablist" aria-label="Alertas" className="flex w-fit gap-1 rounded-xl border border-borda bg-superficie p-1 shadow-sm">
      {ABAS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === aba}
          onClick={() => setAba(a.id)}
          className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", a.id === aba ? "bg-primaria text-white" : "text-suave hover:bg-superficie-2 hover:text-texto")}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
  return aba === "excecoes" ? <Excecoes topo={topo} /> : <Alertas topo={topo} />;
}
```

Em `alertas.tsx`: `export function Alertas({ topo }: { topo?: ReactNode } = {})` e `{topo}` como primeiro filho do container. `page.tsx`: `<AbasAlertas />` no lugar de `<Alertas />`.

- [ ] **Step 4: `excecoes.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Aviso, Chip, Contador, Segmentado, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { useExcecoesDados } from "@/lib/dados/excecoes";
import { useRetrato } from "@/lib/dados/use-retrato";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { REGRAS, ROTULO_REGRA, excecoesDoDia, type Excecao, type RegraExcecao } from "@/lib/dominio/excecoes";
import { diaLocal, fmtHora, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { ROTULO_REGIME, regimeDoEquip } from "@/lib/dominio/regras-frota";
import { useAgora, useOpcao } from "@/lib/hooks";
import type { Veiculo } from "@/lib/tipos";

const hm = (s: number) => fmtHora(s).slice(0, 5);
const AGRUPAR = ["equipamento", "regra"] as const;

function Linha({ x, dia, nome }: { x: Excecao; dia: string; nome?: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-4 py-2.5 text-[13px] last:border-b-0">
      <Selo tom={x.gravidade === "alerta" ? "bad" : "warn"}>{x.gravidade === "alerta" ? "Alerta" : "Atenção"}</Selo>
      <span className="min-w-0 leading-snug">
        <b>{nome ?? ROTULO_REGRA[x.regra]}</b>
        <span className="block text-xs text-suave">
          {hm(x.ini)}
          {x.fim != null && `–${hm(x.fim)}`} · {x.detalhe}
          {x.local && ` · ${x.local}`}
        </span>
      </span>
      <Link href={`/timeline/?v=${encodeURIComponent(x.veiculo)}&dia=${dia}`} className="whitespace-nowrap text-xs font-semibold text-primaria">
        Timeline ›
      </Link>
    </li>
  );
}

/** Exceções do dia: só o que fugiu das regras da frota (regras em src/lib/dominio/regras-frota.ts). */
export function Excecoes({ topo }: { topo?: ReactNode }) {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [agrupar, setAgrupar] = useOpcao("mon-excecoes-agrupar", AGRUPAR, "equipamento");
  const [regra, setRegra] = useState<RegraExcecao | null>(null);
  const ehHoje = dia === hoje;
  const { dados, erro } = useExcecoesDados(dia, ehHoje);
  const veiculos = useMemo(() => (retrato?.veiculos ?? []).filter((v) => !v.motor2_de && v.equip), [retrato]);
  const agoraSeg = ehHoje && agora ? Math.floor((agora - Date.parse(`${dia}T00:00:00-03:00`)) / 1000) : null;
  // minuto a minuto basta: o coletor vê a frota a cada ~5 min
  const minuto = agoraSeg == null ? null : agoraSeg - (agoraSeg % 60);
  const todas = useMemo(() => (dados ? excecoesDoDia({ dia, agoraSeg: minuto, veiculos, ...dados }) : []), [dados, dia, minuto, veiculos]);
  const lista = regra ? todas.filter((x) => x.regra === regra) : todas;
  const porVeiculo = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const conta = (r: RegraExcecao) => todas.filter((x) => x.regra === r).length;
  const nEquip = new Set(todas.map((x) => x.veiculo)).size;
  const dias = useMemo(() => ultimosDias(30), []);

  const grupos: { chave: string; titulo: ReactNode; itens: Excecao[] }[] =
    agrupar === "regra"
      ? REGRAS.filter((r) => lista.some((x) => x.regra === r)).map((r) => ({ chave: r, titulo: ROTULO_REGRA[r], itens: lista.filter((x) => x.regra === r) }))
      : [...new Set(lista.map((x) => x.veiculo))].map((id) => ({ chave: id, titulo: <TituloEquip v={porVeiculo.get(id)} />, itens: lista.filter((x) => x.veiculo === id) }));

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      {topo}
      <section aria-label="Resumo das exceções" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36">
            {dias.map((d) => (
              <option key={d} value={d}>
                {rotuloDia(d, hoje)}
              </option>
            ))}
          </Selecao>
          <p className="text-sm">
            <b className="text-lg tabular-nums">{todas.length}</b> {todas.length === 1 ? "exceção" : "exceções"} em <b className="tabular-nums">{nEquip}</b> {nEquip === 1 ? "equipamento" : "equipamentos"}
            {ehHoje && <span className="text-suave"> · atualiza sozinho</span>}
          </p>
          <span className="md:ml-auto">
            <Segmentado rotulo="Agrupar" valor={agrupar} mudar={setAgrupar} opcoes={[{ id: "equipamento", rotulo: "Por equipamento" }, { id: "regra", rotulo: "Por regra" }]} />
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por regra">
          {REGRAS.map((r) => (
            <Chip key={r} ativo={regra === r} onClick={() => setRegra(regra === r ? null : r)}>
              {ROTULO_REGRA[r]} <Contador n={conta(r)} />
            </Chip>
          ))}
        </div>
      </section>
      {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
      <section aria-label="Exceções" className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
        {!dados && !erro ? (
          <Vazio titulo="Carregando as exceções…" />
        ) : !lista.length ? (
          <Vazio titulo="Nenhuma exceção neste dia">{regra ? "Tire o filtro da regra para ver as outras." : "Tudo dentro das regras."}</Vazio>
        ) : (
          grupos.map((g) => (
            <div key={g.chave}>
              <h3 className="flex items-center justify-between border-b border-borda bg-superficie-2 px-4 py-1.5 text-[12px] font-semibold">
                <span>{g.titulo}</span>
                <Contador n={g.itens.length} />
              </h3>
              <ul>
                {g.itens.map((x, i) => (
                  <Linha key={`${x.veiculo}-${x.regra}-${x.ini}-${i}`} x={x} dia={dia} nome={agrupar === "regra" ? (porVeiculo.get(x.veiculo)?.equip?.nome ?? x.veiculo) : undefined} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <p className="text-xs text-suave">Regras da frota: horários do Pátio por regime, oficinas, bica, restaurante, ociosidade (30 min) e motor desligado (1 h). Fins de semana e feriados seguem o regime.</p>
    </div>
  );
}

function TituloEquip({ v }: { v: Veiculo | undefined }) {
  if (!v?.equip) return <>Equipamento</>;
  const r = regimeDoEquip(v.equip.regime, v.vaga);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {v.equip.nome}
      <span className="font-normal text-suave">
        {TIPOS_EQUIP[v.equip.tipo].rotulo} · {ROTULO_REGIME[r.regime]}
      </span>
      {r.presumido && <Selo tom="neu">regime presumido</Selo>}
    </span>
  );
}
```

- [ ] **Step 5:** build + `npx playwright test e2e/excecoes.spec.ts e2e/alertas.spec.ts` → PASS (computador e celular). Depois `npm run lint && npm run typecheck && npm test`.

---

### Task 5: README e verificação final

- [ ] **Step 1:** README, item 13 nos Pontos de atenção: "**Exceções do dia** (aba padrão de Alertas, 08/10/2026): 9 regras do dono em `src/lib/dominio/regras-frota.ts` (horários do Pátio por regime ADM/16 h/24 h, ida ao Pátio no expediente, Servitec, Oficina Centro, vácuo na bica, restaurante > 1 h, ociosidade 30 min, motor desligado 1 h); cálculo em `excecoes.ts` sobre eventos de área, timeline de motor e tablet (só Supabase). Regime: matriz → nome da vaga → ADM presumido."
- [ ] **Step 2:** `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test` → tudo verde.

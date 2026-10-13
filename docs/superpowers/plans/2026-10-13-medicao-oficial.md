# Medição do GAUSS na Análise (Fase 1, boletim oficial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aba **Disponibilidade** na tela Análise com os números oficiais dos boletins de medição GPS já fechados (DF por vaga, indisponibilidade por motivo e por evento, DF por dia, motor secundário), alimentada por um passo novo do coletor que baixa cada boletim uma única vez.

**Architecture:** Funções puras em `src/lib/dominio/medicao.ts` convertem o boletim do GAUSS nas linhas de 4 tabelas `medicao_*` e fazem as contas da tela. O coletor (`coletor/medicao.ts`) lista os boletins 1 vez por dia e baixa no máximo 1 boletim novo por ciclo, com uma trava que só deixa passar as 2 chamadas de leitura. A página lê as tabelas com a chave pública (`src/lib/dados/medicao.ts`) e mostra a aba (`src/app/analise/_componentes/disponibilidade/`).

**Tech Stack:** Next 16 (export estático) + React + TypeScript + Tailwind, Supabase (supabase-js 2), zod, Vitest, Playwright; coletor em Node/TS no GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-10-medicao-oficial-design.md`. Rota dos dados: `automation/medicao/README.md` (fora deste repositório).

## Ajustes ao desenho (achados ao ler os dados reais, 13/10/2026)

1. **Horas por motivo vêm da soma dos eventos**, não dos campos `indisponibility_time_*`. No boletim real, `indisponibility_time_geofence` (área de manutenção) às vezes passa do total: AP 01 tem 47h57 nesse campo, contra 23h55 de indisponibilidade total. A soma dos eventos fica perto do total (23h46). Cada `type_indisp` vira um dos 8 motivos por padrão de texto, e tipo desconhecido vai para a coluna nova **`outros`** (nunca some). `horas_regime`, `horas_indisp` e `df` continuam vindo dos campos oficiais (`CHM`, `total_indisponibilidade`, `DF`).
2. **`medicao_boletim.completo`** (boolean, padrão false). As outras tabelas apontam para `medicao_boletim` por chave estrangeira, então o boletim precisa entrar **primeiro**. Ele entra como incompleto e só vira `completo = true` depois de gravadas vagas, eventos e dias. O coletor e a página só consideram boletins completos.
3. **`get_data` com tempo limite de 180 s e 1 tentativa só.** O boletim inteiro tem cerca de 16 MB (44 vagas), e o tempo limite padrão do cliente (30 s, até 3 tentativas) arriscaria baixar 3 vezes.
4. **Falha na lista do dia marca o dia como feito.** Assim o coletor não insiste no GAUSS a cada 5 min; tenta de novo no dia seguinte.

## Global Constraints

- NUNCA chamar `/data/measurement/contract-position-fixed-variable/usiminas/` (Medição Mensal) nem `reprocess`, `consolidate`, `delete-*`, `close_*`, `send_*`, `save*`. Só a lista do Dashboard e o `get_data`.
- Lista do Dashboard: `filtered=0`, `logistic_providers[]=13`, `start_day`/`end_day` (aaaa-mm-dd), `start_hour=00:00`, `end_hour=23:59`, **sem** `view-all-measurements`.
- Só boletins cuja `identification` começa com "GPS".
- Boletim fechado é baixado **uma vez** e fica guardado. Uma lista por dia, a partir das 07:00; no máximo 1 boletim por ciclo; até 3 tentativas por boletim por dia.
- Não guardar valores em R$ nem nomes de pessoas (o site é aberto).
- Falha da medição não derruba o ciclo do coletor (mesmo padrão de `motor`/`madrugada` no `run.ts`).
- O SQL (`supabase/medicao.sql`) só roda no Supabase depois de mostrado e aprovado pelo dono. Nunca ler `.env`.
- Textos da tela em português simples; horas no formato `fmtHoras` ("23h55"); DF com 2 casas e vírgula ("95,66%").
- Computador/TV primeiro; no celular, uma coluna (vagas, depois o detalhe).
- Não publicar (merge no `main`/push) neste plano: a publicação é decisão do dono.

## Review Focus

- Tipo de indisponibilidade novo ou com espaço sobrando (ex.: "Indisp. lançada manual ") → cai no motivo certo ou em "Outros", nunca some da soma (teste no Task 1).
- Linhas de total, sem tipo ou sem horário dentro do JSON do GAUSS → ignoradas sem quebrar (teste no Task 1).
- Tabelas ainda não criadas → o coletor não chama o GAUSS, e a tela mostra "rode supabase/medicao.sql" (testes no Task 2 e no Task 4).
- `get_data` falha ou volta sem vagas → o boletim não fica marcado como baixado e é tentado no máximo 3 vezes no dia (teste no Task 2).
- Trecho de motor secundário que cruza a meia-noite, o início ou o fim do ciclo → cortado e dividido por dia (teste no Task 1).

---

### Task 1: Domínio da medição (puro)

**Files:**
- Create: `src/lib/dominio/medicao.ts`
- Test: `src/lib/dominio/medicao.test.ts`

**Interfaces:**
- Consumes: `diaLocal`, `fmtHoras` de `src/lib/dominio/formato.ts`.
- Produces (usados nos Tasks 2–4):
  - `interface LinhaListaBoletim { cod: string; identification: string; initial_date: string; final_date: string; [campo: string]: unknown }`
  - `interface Boletim { cod: string; identificacao: string; inicio: string; fim: string }` (datas aaaa-mm-dd)
  - `MOTIVOS` (9 itens `{ chave, nome, padrao }`), `type Motivo`, `type HorasPorMotivo = Record<Motivo, number>`
  - `interface VagaBoletim extends HorasPorMotivo { boletim_cod: string; vaga_id: number; vaga: string; regime: string | null; horas_regime: number; horas_indisp: number; df: number }`
  - `interface EventoIndisp { boletim_cod: string; vaga_id: number; placa: string; inicio: string; fim: string; tipo: string; horas: number }`
  - `interface VagaDia { boletim_cod: string; vaga_id: number; dia: string; placas: string; horas_regime: number; horas_indisp: number }`
  - `interface BoletimLido { boletim: Boletim; vagas: VagaBoletim[]; eventos: EventoIndisp[]; dias: VagaDia[] }`
  - `interface TrechoMotor { inicio: string; fim: string; status: string }`
  - `horasDe(v: unknown): number`, `motivoDe(tipo: string): Motivo`, `lerBoletim(linha, vagasGauss): BoletimLido`, `dfDaFrota(vagas): number | null`, `ordenarVagas<T>(vagas: T[]): T[]`, `motivoPrincipal(v): { chave; nome; horas } | null`, `porMotivo(v): { chave; nome; horas }[]`, `conferencia(eventos, total): { soma; total; diferenca; confere }`, `motor2PorDia(trechos, inicio, fim): { total: number; dias: { dia: string; horas: number }[] }`, `dfDoDia(d): number | null`, `placasDoCiclo(dias): string[]`, `diaSeguinte(dia): string`, `fmtH(horas): string`, `fmtDf(df): string`, `dataBr(dia): string`, `horaEvento(iso): string`, `rotuloBoletim(b): string`

- [ ] **Step 1: Write the failing test** — `src/lib/dominio/medicao.test.ts`

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  conferencia, dataBr, dfDaFrota, dfDoDia, diaSeguinte, fmtDf, fmtH, horaEvento, horasDe, lerBoletim, motivoDe, motivoPrincipal, motor2PorDia,
  ordenarVagas, placasDoCiclo, porMotivo, rotuloBoletim, MOTIVOS, type HorasPorMotivo, type LinhaListaBoletim,
} from "./medicao";

const linha: LinhaListaBoletim = { cod: "B1", identification: "GPS  2026-10  (agrupado)", initial_date: "16/09/2026", final_date: "08/10/2026", status: "<i class='fa fa-lock'></i>" };
const vagaGauss = (o: Record<string, unknown> = {}) => ({
  vacancy_code: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", regime_name: "24h-12 GPS (Novo)", CHM: "551:37", total_indisponibilidade: "23:55:00", DF: "95,66",
  price_time: "R$ 10,00", total_expectative: "R$ 0,00", beneficiary_name: "FULANO DE TAL",
  json_data_indisponibility: JSON.stringify([
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 06:55", end_sql: "2026-09-16 07:00:00", type_indisp: "Ausência de operador#3", approved_time_: "0.083333333333333" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 07:25:26", end_sql: "2026-09-16 07:51:10", type_indisp: "Área de manutenção - PÁTIO DO TRANSPORTE RODOVIÁRIO#1", approved_time_: "0.43" },
    // repetido: entra uma vez
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 07:25:26", end_sql: "2026-09-16 07:51:10", type_indisp: "Área de manutenção - PÁTIO DO TRANSPORTE RODOVIÁRIO#1", approved_time_: "0.43" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-17 10:00", end_sql: "2026-09-17 11:00", type_indisp: "Indisp. lançada manual #9", approved_time_: "1" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-17 12:00", end_sql: "2026-09-17 12:30", type_indisp: "Tipo novo do GAUSS#4", approved_time_: "0.5" },
    // sem horário e sem tipo: fora
    { vehicle_name: "EAM-3253", start_sql: "", end_sql: "", type_indisp: "Fora da planta#2", approved_time_: "1" },
    { total: "23:55" },
  ]),
  availability_json_data: JSON.stringify([
    { day: "16/09/2026", vehicle_name: "EAM-3253", regime_util_: 6.3833333333333, indip_total_: "0", beneficiary_name: "FULANO DE TAL" },
    { day: "16/09/2026", vehicle_name: "S/ Apropriação", regime_util_: "17.6", indip_total_: "1.43" },
    { day: "17/09/2026", vehicle_name: "BDVE [Identificação: ]", regime_util_: "24", indip_total_: "1.5" },
    { day: "", regime_util_: "551" },
  ]),
  ...o,
});
const zeros = (): HorasPorMotivo => Object.fromEntries(MOTIVOS.map((m) => [m.chave, 0])) as HorasPorMotivo;

describe("horasDe", () => {
  it("aceita h:mm, h:mm:ss e número com vírgula ou ponto; vazio vira 0", () => {
    expect(horasDe("551:37")).toBeCloseTo(551.6167, 4);
    expect(horasDe("23:55:00")).toBeCloseTo(23.9167, 4);
    expect(horasDe("95,66")).toBe(95.66);
    expect(horasDe("0.25")).toBe(0.25);
    expect(horasDe(1.5)).toBe(1.5);
    for (const v of ["", null, undefined, "--"]) expect(horasDe(v)).toBe(0);
  });
});

describe("motivoDe", () => {
  it("cada tipo do GAUSS cai no seu motivo; tipo desconhecido vai para Outros", () => {
    expect(motivoDe("Ausência de operador")).toBe("ausencia_operador");
    expect(motivoDe("Área de manutenção - OFICINA CENTRO")).toBe("area_manutencao");
    expect(motivoDe("Fora da planta")).toBe("fora_planta");
    expect(motivoDe("Indisp. Movimentação")).toBe("trajeto");
    expect(motivoDe("Indisp. lançada manual")).toBe("lancada");
    expect(motivoDe("Cartão RFID")).toBe("cartao_rfid");
    expect(motivoDe("Motor desligado")).toBe("motor_desligado");
    expect(motivoDe("Parado ligado")).toBe("parado_ligado");
    expect(motivoDe("Tipo novo do GAUSS")).toBe("outros");
  });
});

describe("lerBoletim", () => {
  const lido = lerBoletim(linha, [vagaGauss()]);
  it("boletim com datas em aaaa-mm-dd e nome sem espaços duplos", () => {
    expect(lido.boletim).toEqual({ cod: "B1", identificacao: "GPS 2026-10 (agrupado)", inicio: "2026-09-16", fim: "2026-10-08" });
  });
  it("vaga: totais oficiais dos campos do GAUSS e motivos pela soma dos eventos", () => {
    const v = lido.vagas[0];
    expect(v).toMatchObject({ boletim_cod: "B1", vaga_id: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", regime: "24h-12 GPS (Novo)", df: 95.66, area_manutencao: 0.43, lancada: 1, outros: 0.5, fora_planta: 0 });
    expect(v.horas_regime).toBeCloseTo(551.6167, 4);
    expect(v.horas_indisp).toBeCloseTo(23.9167, 4);
    expect(v.ausencia_operador).toBeCloseTo(0.0833, 4);
  });
  it("eventos: só os com tipo e horário, sem repetidos, hora de Ipatinga (-03:00)", () => {
    expect(lido.eventos).toHaveLength(4);
    expect(lido.eventos[0]).toEqual({ boletim_cod: "B1", vaga_id: 530, placa: "EAM-3253", inicio: "2026-09-16T06:55:00-03:00", fim: "2026-09-16T07:00:00-03:00", tipo: "Ausência de operador", horas: 0.083333333333333 });
    expect(lido.eventos.map((e) => e.tipo)).toContain("Indisp. lançada manual");
  });
  it("dias: soma das janelas; placas sem 'S/…' e 'BDVE'; linha sem dia fica fora", () => {
    expect(lido.dias).toHaveLength(2);
    expect(lido.dias[0]).toMatchObject({ boletim_cod: "B1", vaga_id: 530, dia: "2026-09-16", placas: "EAM-3253", horas_indisp: 1.43 });
    expect(lido.dias[0].horas_regime).toBeCloseTo(23.9833, 4);
    expect(lido.dias[1]).toMatchObject({ dia: "2026-09-17", placas: "", horas_regime: 24, horas_indisp: 1.5 });
  });
  it("nada de R$ nem nome de pessoa na saída", () => {
    expect(JSON.stringify(lido)).not.toMatch(/R\$|FULANO|price|beneficiary|expectative/);
  });
  it("vaga sem código numérico fica fora; JSON quebrado não derruba (eventos vazios)", () => {
    expect(lerBoletim(linha, [vagaGauss({ vacancy_code: "abc" })]).vagas).toHaveLength(0);
    const r = lerBoletim(linha, [vagaGauss({ json_data_indisponibility: "{quebrado", availability_json_data: null })]);
    expect(r.eventos).toEqual([]);
    expect(r.dias).toEqual([]);
    expect(r.vagas[0].ausencia_operador).toBe(0);
  });
});

describe("contas da tela", () => {
  it("DF da frota pondera pelas horas do regime; sem horas, null", () => {
    expect(dfDaFrota([{ horas_regime: 100, horas_indisp: 10 }, { horas_regime: 100, horas_indisp: 0 }])).toBe(95);
    expect(dfDaFrota([])).toBeNull();
  });
  it("ordem: pior DF primeiro; empate, mais horas indisponíveis primeiro", () => {
    const v = (vaga: string, df: number, horas_indisp: number) => ({ vaga, df, horas_indisp });
    expect(ordenarVagas([v("A", 99, 1), v("B", 90, 5), v("C", 90, 9)]).map((x) => x.vaga)).toEqual(["C", "B", "A"]);
  });
  it("motivo principal e motivos com valor, do maior para o menor", () => {
    const m = { ...zeros(), ausencia_operador: 12.68, area_manutencao: 10.5, trajeto: 0.12 };
    expect(motivoPrincipal(m)).toEqual({ chave: "ausencia_operador", nome: "Ausência de operador", horas: 12.68 });
    expect(motivoPrincipal(zeros())).toBeNull();
    expect(porMotivo(m).map((x) => x.chave)).toEqual(["ausencia_operador", "area_manutencao", "trajeto"]);
  });
  it("conferência: até 1 min de diferença confere", () => {
    expect(conferencia([{ horas: 23.905 }], 23.9167).confere).toBe(true);
    const c = conferencia([{ horas: 20 }, { horas: 3.8333 }], 23.9167);
    expect(c.confere).toBe(false);
    expect(c.diferenca).toBeCloseTo(0.0834, 3);
    expect(fmtH(c.soma)).toBe("23h50");
  });
  it("motor 2º: só secondary_motor_on, cortado no ciclo e dividido por dia", () => {
    const t = (inicio: string, fim: string, status = "secondary_motor_on") => ({ inicio, fim, status });
    const r = motor2PorDia(
      [
        t("2026-09-15 23:00:00", "2026-09-16 01:00:00"), // começa antes do ciclo: só 1h conta
        t("2026-09-20 23:30:00", "2026-09-21 00:30:00"), // cruza a meia-noite
        t("2026-10-08 23:00:00", "2026-10-09 02:00:00"), // passa do fim do ciclo
        t("2026-09-18 10:00:00", "2026-09-18 11:00:00", "on"), // motor principal: fora
        t("2026-09-19T10:00:00-03:00", "2026-09-19T10:30:00-03:00"), // com fuso
      ],
      "2026-09-16",
      "2026-10-08",
    );
    expect(r.dias.map((d) => [d.dia, Math.round(d.horas * 60)])).toEqual([["2026-09-16", 60], ["2026-09-19", 30], ["2026-09-20", 30], ["2026-09-21", 30], ["2026-10-08", 60]]);
    expect(r.total).toBeCloseTo(3.5, 6);
  });
  it("DF do dia, placas do ciclo e datas", () => {
    expect(dfDoDia({ horas_regime: 24, horas_indisp: 2.4 })).toBeCloseTo(90, 6);
    expect(dfDoDia({ horas_regime: 0, horas_indisp: 0 })).toBeNull();
    expect(placasDoCiclo([{ placas: "A / B" }, { placas: "" }, { placas: "B" }])).toEqual(["A", "B"]);
    expect(diaSeguinte("2026-12-31")).toBe("2027-01-01");
    expect(dataBr("2026-09-16")).toBe("16/09");
    expect(horaEvento("2026-09-16T09:55:00+00:00")).toBe("16/09 06:55");
    expect(rotuloBoletim({ cod: "B1", identificacao: "GPS 2026-10", inicio: "2026-09-16", fim: "2026-10-08" })).toBe("GPS 2026-10 · 16/09 a 08/10");
    expect(fmtDf(95.664)).toBe("95,66%");
  });
});

// conferência com o boletim real (arquivo baixado pelo automation/medicao/baixar-boletim.js, fora do repositório)
const GABARITO = resolve(process.cwd(), "../../automation/data/medicao/202609161320261008-vaga530.json");
describe.skipIf(!existsSync(GABARITO))("gabarito AP 01 24h (16/09 a 08/10)", () => {
  it("bate com o boletim oficial", () => {
    const { boletim, vagas } = JSON.parse(readFileSync(GABARITO, "utf-8")) as { boletim: LinhaListaBoletim; vagas: Record<string, unknown>[] };
    const ap = lerBoletim(boletim, vagas).vagas.find((v) => v.vaga_id === 530)!;
    expect(fmtH(ap.horas_regime)).toBe("551h37");
    expect(fmtH(ap.horas_indisp)).toBe("23h55");
    expect(ap.df).toBe(95.66);
    expect(fmtH(ap.ausencia_operador)).toBe("12h41");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dominio/medicao.test.ts`
Expected: FAIL ("Failed to resolve import ./medicao" ou equivalente).

- [ ] **Step 3: Write the implementation** — `src/lib/dominio/medicao.ts`

```ts
// Medição do GAUSS, Fase 1 (boletim oficial): converte o boletim nas linhas das tabelas medicao_* e faz as contas da
// aba Disponibilidade. Puro (sem rede): roda no coletor e na página.
// Desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md · plano: docs/superpowers/plans/2026-10-13-medicao-oficial.md
import { diaLocal, fmtHoras } from "./formato";

/** Uma linha da lista do Dashboard Medição (o GAUSS manda mais campos; só estes são usados). */
export interface LinhaListaBoletim {
  cod: string;
  identification: string;
  initial_date: string;
  final_date: string;
  [campo: string]: unknown;
}
export interface Boletim {
  cod: string;
  identificacao: string;
  inicio: string;
  fim: string;
}

/** Os motivos de indisponibilidade, na ordem em que o tipo do evento é conferido (o último pega o que sobrar). */
export const MOTIVOS = [
  { chave: "ausencia_operador", nome: "Ausência de operador", padrao: /aus[eê]ncia/i },
  { chave: "area_manutencao", nome: "Área de manutenção", padrao: /manuten/i },
  { chave: "fora_planta", nome: "Fora da planta / chave geral", padrao: /fora da planta|chave geral/i },
  { chave: "trajeto", nome: "Trajeto / movimentação", padrao: /moviment|trajeto/i },
  { chave: "cartao_rfid", nome: "Cartão RFID", padrao: /rfid|cart[aã]o/i },
  { chave: "lancada", nome: "Indisponibilidade lançada", padrao: /lan[cç]ad/i },
  { chave: "motor_desligado", nome: "Motor desligado", padrao: /desligad/i },
  { chave: "parado_ligado", nome: "Parado ligado", padrao: /parado ligado/i },
  { chave: "outros", nome: "Outros", padrao: /[\s\S]*/ },
] as const;
export type Motivo = (typeof MOTIVOS)[number]["chave"];
export type HorasPorMotivo = Record<Motivo, number>;

export interface VagaBoletim extends HorasPorMotivo {
  boletim_cod: string;
  vaga_id: number;
  vaga: string;
  regime: string | null;
  horas_regime: number;
  horas_indisp: number;
  df: number;
}
export interface EventoIndisp {
  boletim_cod: string;
  vaga_id: number;
  placa: string;
  inicio: string;
  fim: string;
  tipo: string;
  horas: number;
}
export interface VagaDia {
  boletim_cod: string;
  vaga_id: number;
  dia: string;
  placas: string;
  horas_regime: number;
  horas_indisp: number;
}
export interface BoletimLido {
  boletim: Boletim;
  vagas: VagaBoletim[];
  eventos: EventoIndisp[];
  dias: VagaDia[];
}
/** Trecho da timeline de motor (timeline_motor_vaga). */
export interface TrechoMotor {
  inicio: string;
  fim: string;
  status: string;
}

/** "551:37", "23:55:00", "95,66", "0.25" ou número -> horas (número). Vazio ou ilegível = 0. */
export function horasDe(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [h, m = 0, seg = 0] = s.split(":").map(Number);
    const r = h + m / 60 + seg / 3600;
    return Number.isFinite(r) ? r : 0;
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export const motivoDe = (tipo: string): Motivo => MOTIVOS.find((m) => m.padrao.test(tipo))!.chave;

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
/** "16/09/2026" -> "2026-09-16" */
function diaIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(br.trim());
  if (!m) throw new Error(`data fora do formato dd/mm/aaaa: ${br}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// o GAUSS fala na hora de Ipatinga (sem horário de verão desde 2019)
const FUSO = "-03:00";
/** "2026-09-16 06:55" ou "2026-09-16 07:00:00" -> "2026-09-16T06:55:00-03:00"; ilegível -> null */
function isoLocal(s: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/.exec(s);
  return m ? `${m[1]}T${m[2]}${m[3] ?? ":00"}${FUSO}` : null;
}
/** Os JSONs de detalhe chegam como texto; quebrado ou vazio vira lista vazia. */
function lista(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const r: unknown = JSON.parse(v);
    return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}
// "S/ Apropriação" e "BDVE [...]" não são placas
const NAO_PLACA = /^S\/|BDVE/i;
const zerado = (): HorasPorMotivo => Object.fromEntries(MOTIVOS.map((m) => [m.chave, 0])) as HorasPorMotivo;

/** Linha da lista + vagas do get_data -> linhas das 4 tabelas. Só os campos usados: nada de R$ nem nomes de pessoas. */
export function lerBoletim(linha: LinhaListaBoletim, vagasGauss: Record<string, unknown>[]): BoletimLido {
  const boletim: Boletim = { cod: linha.cod, identificacao: linha.identification.replace(/\s+/g, " ").trim(), inicio: diaIso(linha.initial_date), fim: diaIso(linha.final_date) };
  const vagas: VagaBoletim[] = [];
  const eventos: EventoIndisp[] = [];
  const dias: VagaDia[] = [];
  const vistos = new Set<string>();
  for (const g of vagasGauss) {
    const vaga_id = Number(g.vacancy_code);
    if (!Number.isInteger(vaga_id)) continue;
    const motivos = zerado();
    for (const e of lista(g.json_data_indisponibility)) {
      const tipo = texto(e.type_indisp).split("#")[0].trim();
      const inicio = isoLocal(texto(e.start_sql));
      const fim = isoLocal(texto(e.end_sql));
      if (!tipo || !inicio || !fim) continue;
      const placa = texto(e.vehicle_name) || "sem placa";
      const chave = `${vaga_id}|${placa}|${inicio}|${tipo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const horas = horasDe(e.approved_time_);
      motivos[motivoDe(tipo)] += horas;
      eventos.push({ boletim_cod: boletim.cod, vaga_id, placa, inicio, fim, tipo, horas });
    }
    vagas.push({
      boletim_cod: boletim.cod,
      vaga_id,
      vaga: texto(g.vaga),
      regime: texto(g.regime_name) || null,
      horas_regime: horasDe(g.CHM),
      horas_indisp: horasDe(g.total_indisponibilidade),
      df: horasDe(g.DF),
      ...motivos,
    });
    const porDia = new Map<string, { regime: number; indisp: number; placas: Set<string> }>();
    for (const j of lista(g.availability_json_data)) {
      const d = texto(j.day);
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(d)) continue;
      const dia = diaIso(d);
      const x = porDia.get(dia) ?? { regime: 0, indisp: 0, placas: new Set<string>() };
      x.regime += horasDe(j.regime_util_);
      x.indisp += horasDe(j.indip_total_);
      const placa = texto(j.vehicle_name);
      if (placa && !NAO_PLACA.test(placa)) x.placas.add(placa);
      porDia.set(dia, x);
    }
    for (const [dia, x] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
      dias.push({ boletim_cod: boletim.cod, vaga_id, dia, placas: [...x.placas].join(" / "), horas_regime: x.regime, horas_indisp: x.indisp });
    }
  }
  return { boletim, vagas, eventos, dias };
}

/** DF da frota no ciclo = (Σ horas do regime − Σ horas indisponíveis) ÷ Σ horas do regime, em %. */
export function dfDaFrota(vagas: Pick<VagaBoletim, "horas_regime" | "horas_indisp">[]): number | null {
  const regime = vagas.reduce((s, v) => s + v.horas_regime, 0);
  const indisp = vagas.reduce((s, v) => s + v.horas_indisp, 0);
  return regime > 0 ? ((regime - indisp) / regime) * 100 : null;
}

/** Da pior DF para a melhor; empate: mais horas indisponíveis primeiro. */
export const ordenarVagas = <T extends Pick<VagaBoletim, "df" | "horas_indisp" | "vaga">>(vagas: T[]): T[] =>
  [...vagas].sort((a, b) => a.df - b.df || b.horas_indisp - a.horas_indisp || a.vaga.localeCompare(b.vaga, "pt-BR"));

/** Motivos com valor, do maior para o menor. */
export const porMotivo = (v: HorasPorMotivo) =>
  MOTIVOS.filter((m) => v[m.chave] > 0)
    .map((m) => ({ chave: m.chave as Motivo, nome: m.nome as string, horas: v[m.chave] }))
    .sort((a, b) => b.horas - a.horas);

/** O motivo que mais pesou (null se não houve indisponibilidade). */
export const motivoPrincipal = (v: HorasPorMotivo) => porMotivo(v)[0] ?? null;

// até 1 min de diferença é arredondamento do GAUSS
const TOLERANCIA_H = 1 / 60 + 1e-9;
/** Soma das horas dos eventos × total oficial da vaga. */
export function conferencia(eventos: { horas: number }[], total: number) {
  const soma = eventos.reduce((s, e) => s + e.horas, 0);
  const diferenca = total - soma;
  return { soma, total, diferenca, confere: Math.abs(diferenca) <= TOLERANCIA_H };
}

export function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return diaLocal(d);
}

const MOTOR2 = "secondary_motor_on";
// "2026-10-07 09:26:39" (hora local) ou ISO com fuso
const dataDe = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T"));

/** Horas de motor secundário ligado por dia, só dentro do ciclo [inicio 00:00, fim 24:00). */
export function motor2PorDia(trechos: TrechoMotor[], inicio: string, fim: string): { total: number; dias: { dia: string; horas: number }[] } {
  const ini = new Date(`${inicio}T00:00:00`).getTime();
  const lim = new Date(`${diaSeguinte(fim)}T00:00:00`).getTime();
  const porDia = new Map<string, number>();
  for (const t of trechos) {
    if (t.status !== MOTOR2) continue;
    let a = Math.max(dataDe(t.inicio).getTime(), ini);
    const b = Math.min(dataDe(t.fim).getTime(), lim);
    // data ilegível vira NaN e o laço não roda
    while (a < b) {
      const dia = diaLocal(new Date(a));
      const corte = Math.min(b, new Date(`${diaSeguinte(dia)}T00:00:00`).getTime());
      porDia.set(dia, (porDia.get(dia) ?? 0) + (corte - a) / 3_600_000);
      a = corte;
    }
  }
  const dias = [...porDia].sort(([x], [y]) => x.localeCompare(y)).map(([dia, horas]) => ({ dia, horas }));
  return { total: dias.reduce((s, d) => s + d.horas, 0), dias };
}

export const dfDoDia = (d: Pick<VagaDia, "horas_regime" | "horas_indisp">): number | null =>
  d.horas_regime > 0 ? ((d.horas_regime - d.horas_indisp) / d.horas_regime) * 100 : null;

/** Placas que passaram pela vaga no ciclo, sem repetir. */
export const placasDoCiclo = (dias: Pick<VagaDia, "placas">[]): string[] =>
  [...new Set(dias.flatMap((d) => d.placas.split(" / ").map((p) => p.trim()).filter(Boolean)))];

export const fmtH = (horas: number) => fmtHoras(horas * 60);
export const fmtDf = (df: number) => `${df.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
/** "2026-09-16" -> "16/09" */
export const dataBr = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const FMT_EVENTO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Instante do evento -> "16/09 06:55" na hora de Ipatinga. */
export function horaEvento(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(FMT_EVENTO.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}
export const rotuloBoletim = (b: Boletim) => `${b.identificacao} · ${dataBr(b.inicio)} a ${dataBr(b.fim)}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dominio/medicao.test.ts`
Expected: PASS (o bloco "gabarito" roda se o arquivo local existir; senão aparece como pulado).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/medicao.ts src/lib/dominio/medicao.test.ts
git commit -m "Medição: domínio do boletim oficial (leitura do GAUSS, DF, motivos, conferência, motor 2º)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Coletor da medição + SQL

**Files:**
- Create: `coletor/medicao.ts`, `coletor/medicao.test.ts`, `supabase/medicao.sql`
- Modify: `coletor/gauss.ts` (opções de tempo limite/tentativas no `post`), `coletor/run.ts` (chamada no ciclo e comentário do topo)

**Interfaces:**
- Consumes (Task 1): `lerBoletim`, `type BoletimLido`, `type LinhaListaBoletim`; `diaLocal` de `src/lib/dominio/formato.ts`; `db`, `kvGet`, `kvSet`, `ok` de `coletor/supabase.ts`; `GaussFleetClient`, `type Campo` de `coletor/gauss.ts`.
- Produces: `LISTA`, `DETALHE`, `HORA_INICIO`, `MAX_TENTATIVAS`, `conferirChamada(path, campos): void`, `camposLista(de, ate): Campo[]`, `camposGetData(linha): Campo[]`, `interface ControleMedicao`, `interface DepsMedicao`, `coletarMedicao(deps, agora): Promise<string | null>`, `depsReais(client): DepsMedicao`; em `gauss.ts`, `export interface OpcoesPost { timeoutMs?: number; tentativas?: number }` e `post<T>(path, campos, opcoes?: OpcoesPost)`. Tabelas `medicao_boletim` (com `completo`), `medicao_boletim_vaga` (com `outros`), `medicao_indisp_evento`, `medicao_vaga_dia`.

- [ ] **Step 1: Write the failing test** — `coletor/medicao.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { LinhaListaBoletim } from "../src/lib/dominio/medicao";
import { DETALHE, LISTA, camposGetData, camposLista, coletarMedicao, conferirChamada, type ControleMedicao, type DepsMedicao } from "./medicao";

const linha = (cod: string, identification: string): LinhaListaBoletim => ({ cod, identification, initial_date: "16/09/2026", final_date: "08/10/2026", status: "<i class='fa fa-lock' title='Bloqueada'></i>" });
const VAGA = { vacancy_code: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", CHM: "24:00", total_indisponibilidade: "1:00", DF: "95,83", json_data_indisponibility: "[]", availability_json_data: "[]" };

describe("trava das chamadas da medição", () => {
  it("aceita a lista do Dashboard e o get_data", () => {
    expect(() => conferirChamada(LISTA, camposLista("2026-07-15", "2026-10-13"))).not.toThrow();
    expect(() => conferirChamada(DETALHE, camposGetData(linha("B1", "GPS 2026-10")))).not.toThrow();
  });
  it("recusa a Medição Mensal (grava no GAUSS)", () => {
    expect(() => conferirChamada("/data/measurement/contract-position-fixed-variable/usiminas/", [["action", "list"]])).toThrow(/proibido/);
  });
  it("recusa as ações que gravam (e qualquer ação que não seja get_data) no endereço do Dashboard", () => {
    for (const acao of ["reprocess", "consolidate", "delete-sap-lines", "close_measurement_boletim", "send_edit_name_measurement", "save-grid", "dashboard"]) {
      expect(() => conferirChamada(DETALHE, [["action", acao], ["cod", "B1"]])).toThrow();
    }
    expect(() => conferirChamada(DETALHE, [["action", "get_data"], ["action", "reprocess"]])).toThrow();
  });
  it("recusa campo fora do filtro na lista (ex.: 'só consolidadas' ou action)", () => {
    expect(() => conferirChamada(LISTA, [...camposLista("2026-07-15", "2026-10-13"), ["view-all-measurements", 1]])).toThrow();
    expect(() => conferirChamada(LISTA, [["action", "list"]])).toThrow();
  });
  it("recusa qualquer outro endereço", () => {
    expect(() => conferirChamada("/data/hard-vehicle/vehicles/location-online/", [])).toThrow();
  });
  it("o texto da linha do boletim (rowData) não trava: 'Consolidado' é só o nome", () => {
    expect(() => conferirChamada(DETALHE, camposGetData(linha("B1", "SERVITEC 2026-10 (Consolidado)")))).not.toThrow();
  });
});

function fake(o: { controle?: ControleMedicao | null; feitos?: string[]; lista?: LinhaListaBoletim[]; falhaLista?: boolean; falhaGetData?: boolean; semTabela?: boolean; vagas?: unknown[] } = {}) {
  const chamadas: string[] = [];
  const gravados: string[] = [];
  let controle = o.controle ?? null;
  const deps: DepsMedicao = {
    lerControle: async () => controle,
    gravarControle: async (c) => {
      controle = c;
    },
    completos: async () => {
      if (o.semTabela) throw new Error("Could not find the table 'public.medicao_boletim' in the schema cache");
      return new Set(o.feitos ?? []);
    },
    listar: async () => {
      chamadas.push("lista");
      if (o.falhaLista) throw new Error("HTTP 500");
      return o.lista ?? [];
    },
    getData: async (l) => {
      chamadas.push(`get_data ${l.cod}`);
      if (o.falhaGetData) throw new Error("timeout");
      return (o.vagas ?? [VAGA]) as Record<string, unknown>[];
    },
    gravar: async (lido) => {
      gravados.push(lido.boletim.cod);
    },
  };
  return { deps, chamadas, gravados, controle: () => controle };
}
const AS_8 = new Date("2026-10-13T08:00:00");

describe("coletarMedicao", () => {
  it("antes das 07:00 não faz nada", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")] });
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T06:30:00"))).toBeNull();
    expect(f.chamadas).toEqual([]);
  });
  it("sem as tabelas (SQL não rodado): erro sem chamar o GAUSS", async () => {
    const f = fake({ semTabela: true, lista: [linha("B2", "GPS 2026-10")] });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/medicao_boletim/);
    expect(f.chamadas).toEqual([]);
  });
  it("lista 1 vez por dia, só GPS ainda não baixado, 1 boletim por ciclo", async () => {
    const f = fake({ feitos: ["B1"], lista: [linha("B1", "GPS 2026-09"), linha("B2", "GPS  2026-10 (agrupado)"), linha("B3", "SERVITEC 2026-10"), linha("B4", "GPS 2026-08")] });
    expect(await coletarMedicao(f.deps, AS_8)).toMatch(/GPS 2026-10 \(agrupado\): 1 vagas/);
    expect(f.chamadas).toEqual(["lista", "get_data B2"]);
    expect(f.controle()?.pendentes.map((p) => p.cod)).toEqual(["B4"]);
    await coletarMedicao(f.deps, new Date("2026-10-13T08:05:00"));
    expect(f.chamadas).toEqual(["lista", "get_data B2", "get_data B4"]);
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T08:10:00"))).toBeNull();
    expect(f.gravados).toEqual(["B2", "B4"]);
  });
  it("get_data com falha: até 3 tentativas no dia; no dia seguinte lista de novo", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")], falhaGetData: true });
    for (let i = 0; i < 3; i++) await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/timeout/);
    expect(await coletarMedicao(f.deps, AS_8)).toBeNull();
    expect(f.chamadas.filter((c) => c.startsWith("get_data"))).toHaveLength(3);
    expect(f.gravados).toEqual([]);
    await expect(coletarMedicao(f.deps, new Date("2026-10-14T08:00:00"))).rejects.toThrow(/timeout/);
    expect(f.chamadas.filter((c) => c === "lista")).toHaveLength(2);
  });
  it("boletim que volta sem vagas conta como falha e não é gravado", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")], vagas: [] });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/sem vagas/);
    expect(f.gravados).toEqual([]);
    expect(f.controle()?.tentativas).toEqual({ B2: 1 });
  });
  it("falha na lista: não insiste no mesmo dia", async () => {
    const f = fake({ falhaLista: true });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/HTTP 500/);
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T09:00:00"))).toBeNull();
    expect(f.chamadas).toEqual(["lista"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run coletor/medicao.test.ts`
Expected: FAIL ("Failed to resolve import ./medicao").

- [ ] **Step 3: Add the timeout/tries option to the GAUSS client** — `coletor/gauss.ts`

Troque a assinatura de `fetchComBackoff` e use as opções no lugar das constantes:

```ts
/** Tempo limite e tentativas de uma requisição (padrão: 30 s e 3). Resposta grande (ex.: boletim da medição) pede mais tempo e 1 tentativa. */
export interface OpcoesPost {
  timeoutMs?: number;
  tentativas?: number;
}

async function fetchComBackoff(url: string, opcoes: RequestInit, { timeoutMs = REQUEST_TIMEOUT_MS, tentativas = TENTATIVAS }: OpcoesPost = {}): Promise<Response> {
  for (let tentativa = 1; ; tentativa++) {
    estatisticas.requisicoes++;
    let res: Response;
    try {
      res = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      if (tentativa >= tentativas) throw registrarFalha(err instanceof Error ? err : new Error(String(err)));
      await espera(BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      if (tentativa >= tentativas) throw registrarFalha(new Error(`HTTP ${res.status} (servidor pediu para desacelerar)`));
      const retryAfter = Number(res.headers.get("retry-after"));
      await espera(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    falhasSeguidas = 0;
    return res;
  }
}
```

E passe as opções de `post` até `enviar`:

```ts
  async post<T = unknown>(path: string, campos: Campo[], opcoes: OpcoesPost = {}): Promise<T> {
    if (!this.#cookie) await this.login();
    const body = new URLSearchParams();
    for (const [chave, valor] of campos) body.append(chave, String(valor));

    let { status, texto } = await enviar(path, body, this.#cookie, opcoes);
    // sessão expirada: o GAUSS responde a página de login (HTML) em vez de JSON. Reloga UMA vez e repete;
    // se continuar, é erro de verdade.
    let json = tentarJSON(texto);
    if ((json === undefined && status < 400) || status === 401 || status === 403) {
      await this.login({ forcar: true });
      ({ status, texto } = await enviar(path, body, this.#cookie, opcoes));
      json = tentarJSON(texto);
    }
```

```ts
function enviar(path: string, body: URLSearchParams, cookie: string, opcoes: OpcoesPost = {}): Promise<{ status: number; texto: string }> {
  return enfileirar(async () => {
    const res = await fetchComBackoff(
      `${BASE_URL}${path}`,
      { method: "POST", headers: { ...COMMON_HEADERS, "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie }, body },
      opcoes,
    );
    return { status: res.status, texto: await res.text() };
  });
}
```

- [ ] **Step 4: Write the collector step** — `coletor/medicao.ts`

```ts
// Medição oficial do GAUSS, Fase 1 (desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md).
// Uma vez por dia, a partir das 07:00: lista os boletins GPS dos últimos 90 dias no Dashboard Medição e baixa
// (get_data) os que ainda não estão no banco, no máximo 1 por ciclo e até 3 tentativas por boletim no dia.
// Boletim fechado não muda: baixado uma vez, fica guardado.
//
// CUIDADO: a tela Medição Mensal (/data/measurement/...) GRAVA registro no GAUSS só de listar (incidente
// SAVED192881, 08/10/2026). Toda chamada daqui passa por conferirChamada, que só deixa passar a lista do
// Dashboard e o get_data. Rota completa: automation/medicao/README.md (fora deste repositório).
import { lerBoletim, type BoletimLido, type LinhaListaBoletim } from "../src/lib/dominio/medicao";
import { diaLocal } from "../src/lib/dominio/formato";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const LISTA = "/data/hard-vehicle/measurements-usiminas/dashboard/";
export const DETALHE = "/operations/measurement-usiminas/dashboard/";
const PRESTADOR_GPS = 13;
export const HORA_INICIO = 7;
export const MAX_TENTATIVAS = 3;
const DIAS_LISTA = 90;
// o get_data devolve todas as vagas de uma vez (~16 MB): mais tempo e uma tentativa só
const OPCOES_GET_DATA = { timeoutMs: 180_000, tentativas: 1 };
const LOTE = 500;

const CAMPOS_LISTA = new Set(["filtered", "logistic_providers[]", "start_day", "start_hour", "end_day", "end_hour"]);
const PROIBIDO = /reprocess|consolidate|delete|close_|send_|save/i;

/** Só a lista do Dashboard (campos do filtro) e o get_data passam; o resto lança erro antes de sair para o GAUSS. */
export function conferirChamada(path: string, campos: Campo[]): void {
  if (path.includes("/data/measurement/")) throw new Error(`medição: endereço proibido (${path}): grava registro no GAUSS`);
  for (const [chave, valor] of campos) {
    if (PROIBIDO.test(chave)) throw new Error(`medição: campo proibido (${chave})`);
    // rowData é a linha do boletim devolvida de volta (nome, datas, ícone): texto livre do próprio GAUSS
    if (!chave.startsWith("rowData[") && PROIBIDO.test(String(valor))) throw new Error(`medição: valor proibido em ${chave}`);
  }
  const chaves = campos.map(([k]) => k);
  if (path === LISTA) {
    if (chaves.every((k) => CAMPOS_LISTA.has(k))) return;
    throw new Error("medição: a lista do Dashboard só aceita os campos do filtro");
  }
  if (path === DETALHE) {
    const acoes = campos.filter(([k]) => k === "action").map(([, v]) => String(v));
    const camposOk = chaves.every((k) => k === "action" || k === "cod" || k === "contract_code" || /^rowData\[[^\]]+\]$/.test(k));
    if (acoes.length === 1 && acoes[0] === "get_data" && camposOk) return;
    throw new Error("medição: no Dashboard só o get_data é permitido");
  }
  throw new Error(`medição: endereço não permitido (${path})`);
}

/** Filtro da lista do Dashboard (sem "view-all-measurements": esse campo quer dizer "só consolidadas"). */
export const camposLista = (de: string, ate: string): Campo[] => [
  ["filtered", 0],
  ["logistic_providers[]", PRESTADOR_GPS],
  ["start_day", de],
  ["start_hour", "00:00"],
  ["end_day", ate],
  ["end_hour", "23:59"],
];

/** O mesmo que o duplo clique na linha do boletim: a linha inteira vai de volta em rowData[...]. */
export function camposGetData(linha: LinhaListaBoletim): Campo[] {
  const campos: Campo[] = [["action", "get_data"], ["cod", linha.cod], ["contract_code", ""]];
  for (const [k, v] of Object.entries(linha)) campos.push([`rowData[${k}]`, v == null ? "" : typeof v === "object" ? JSON.stringify(v) : (v as string | number)]);
  return campos;
}

/** Guardado em loc_kv "medicao": o dia da última lista, os boletins que faltam baixar e as tentativas do dia. */
export interface ControleMedicao {
  dia: string;
  pendentes: LinhaListaBoletim[];
  tentativas: Record<string, number>;
}
export interface DepsMedicao {
  lerControle(): Promise<ControleMedicao | null>;
  gravarControle(c: ControleMedicao): Promise<void>;
  /** Códigos dos boletins já gravados por inteiro (completo = true). */
  completos(): Promise<Set<string>>;
  listar(de: string, ate: string): Promise<LinhaListaBoletim[]>;
  getData(linha: LinhaListaBoletim): Promise<Record<string, unknown>[]>;
  gravar(lido: BoletimLido): Promise<void>;
}

const ehGps = (l: LinhaListaBoletim) => /^GPS\b/i.test(String(l.identification ?? "").trim());

/** Um passo do ciclo. Devolve o que fez (para o log) ou null se não havia nada a fazer. */
export async function coletarMedicao(deps: DepsMedicao, agora: Date): Promise<string | null> {
  if (agora.getHours() < HORA_INICIO) return null;
  const hoje = diaLocal(agora);
  let c = await deps.lerControle();
  let listou: string | null = null;
  if (c?.dia !== hoje) {
    // o banco antes do GAUSS: sem as tabelas (SQL não rodado), nem chama o GAUSS
    const feitos = await deps.completos();
    const de = diaLocal(new Date(agora.getTime() - DIAS_LISTA * 86_400_000));
    let linhas: LinhaListaBoletim[];
    try {
      linhas = await deps.listar(de, hoje);
    } catch (e) {
      // não insiste a cada 5 min: tenta de novo amanhã
      await deps.gravarControle({ dia: hoje, pendentes: [], tentativas: {} });
      throw e;
    }
    c = { dia: hoje, pendentes: linhas.filter((l) => ehGps(l) && !feitos.has(l.cod)), tentativas: {} };
    await deps.gravarControle(c);
    listou = `lista: ${c.pendentes.length} boletim(ns) novo(s)`;
  }
  const atual = c;
  const alvo = atual.pendentes.find((p) => (atual.tentativas[p.cod] ?? 0) < MAX_TENTATIVAS);
  if (!alvo) return listou;
  try {
    const lido = lerBoletim(alvo, await deps.getData(alvo));
    if (!lido.vagas.length) throw new Error(`boletim ${alvo.cod} sem vagas`);
    await deps.gravar(lido);
    await deps.gravarControle({ ...atual, pendentes: atual.pendentes.filter((p) => p.cod !== alvo.cod) });
    return `boletim ${lido.boletim.identificacao}: ${lido.vagas.length} vagas, ${lido.eventos.length} indisponibilidades`;
  } catch (e) {
    await deps.gravarControle({ ...atual, tentativas: { ...atual.tentativas, [alvo.cod]: (atual.tentativas[alvo.cod] ?? 0) + 1 } });
    throw e;
  }
}

async function emLotes<T>(linhas: T[], gravar: (lote: T[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += LOTE) await ok(gravar(linhas.slice(i, i + LOTE)));
}

/** O boletim entra primeiro (as outras tabelas apontam para ele) como incompleto; só no fim vira completo. */
async function gravarBoletim({ boletim, vagas, eventos, dias }: BoletimLido): Promise<void> {
  await ok(db().from("medicao_boletim").upsert({ ...boletim, completo: false, baixado_em: new Date().toISOString() }));
  await emLotes(vagas, (l) => db().from("medicao_boletim_vaga").upsert(l, { onConflict: "boletim_cod,vaga_id" }));
  await emLotes(eventos, (l) => db().from("medicao_indisp_evento").upsert(l, { onConflict: "boletim_cod,vaga_id,placa,inicio,tipo", ignoreDuplicates: true }));
  await emLotes(dias, (l) => db().from("medicao_vaga_dia").upsert(l, { onConflict: "boletim_cod,vaga_id,dia" }));
  await ok(db().from("medicao_boletim").update({ completo: true }).eq("cod", boletim.cod));
}

export function depsReais(client: GaussFleetClient): DepsMedicao {
  const chamar = <T>(path: string, campos: Campo[], opcoes?: { timeoutMs?: number; tentativas?: number }) => {
    conferirChamada(path, campos);
    return client.post<T>(path, campos, opcoes);
  };
  return {
    lerControle: () => kvGet<ControleMedicao>("medicao"),
    gravarControle: async (c) => {
      await kvSet("medicao", c);
    },
    completos: async () => new Set(((await ok(db().from("medicao_boletim").select("cod").eq("completo", true))) as { cod: string }[]).map((r) => r.cod)),
    listar: async (de, ate) => {
      // sem boletins no período o GAUSS responde error=true e msg=null
      const r = await chamar<{ msg?: unknown }>(LISTA, camposLista(de, ate));
      return Array.isArray(r.msg) ? (r.msg as LinhaListaBoletim[]) : [];
    },
    getData: async (linha) => {
      const r = await chamar<{ error?: boolean; msg?: unknown }>(DETALHE, camposGetData(linha), OPCOES_GET_DATA);
      if (r.error || !Array.isArray(r.msg)) throw new Error(`get_data do boletim ${linha.cod} não devolveu as vagas`);
      return r.msg as Record<string, unknown>[];
    },
    gravar: gravarBoletim,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run coletor/medicao.test.ts`
Expected: PASS.

- [ ] **Step 6: Wire into the cycle** — `coletor/run.ts`

No comentário do topo, depois do item 5, acrescente:

```ts
//   6. medição oficial (medicao.ts): 1 lista de boletins por dia (a partir das 07:00) e no máximo 1 boletim novo
//      por ciclo, só com as 2 chamadas de leitura do Dashboard Medição
```

No import, junto dos outros do coletor:

```ts
import { coletarMedicao, depsReais } from "./medicao";
```

Logo depois do bloco `try { const r = await rotinaNoturna(...) } catch ...`:

```ts
    // medição oficial: falha aqui (ex.: SQL ainda não rodado) não derruba o ciclo
    try {
      const m = await coletarMedicao(depsReais(client), agora);
      if (m) console.log(`✅ medição: ${m}`);
    } catch (e) {
      console.warn(`⚠ medição: ${e instanceof Error ? e.message : String(e)}`);
    }
```

- [ ] **Step 7: Write the SQL** — `supabase/medicao.sql` (só roda no Supabase depois do OK do dono)

```sql
-- Medição do GAUSS (Fase 1): boletins FECHADOS, só GPS. Grava só o coletor (chave secreta); o site só lê.
-- Sem valores em R$ e sem nomes de pessoas (o site é aberto). Pode rodar de novo.
-- Desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md (ajustes no plano 2026-10-13-medicao-oficial.md)
create table if not exists public.medicao_boletim (
  cod text primary key,
  identificacao text not null,
  inicio date not null,
  fim date not null,
  -- o boletim entra primeiro (as outras tabelas apontam para ele) e só vira completo depois de gravado por inteiro
  completo boolean not null default false,
  baixado_em timestamptz not null default now()
);
alter table public.medicao_boletim add column if not exists completo boolean not null default false;

-- horas_regime, horas_indisp e df: campos oficiais do boletim. Motivos: soma dos eventos da vaga
-- (o campo de área de manutenção do GAUSS às vezes passa do total). Tipo desconhecido vai para "outros".
create table if not exists public.medicao_boletim_vaga (
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  vaga text not null,
  regime text,
  horas_regime numeric not null,
  horas_indisp numeric not null,
  df numeric not null,
  ausencia_operador numeric not null default 0,
  area_manutencao numeric not null default 0,
  fora_planta numeric not null default 0,
  trajeto numeric not null default 0,
  cartao_rfid numeric not null default 0,
  lancada numeric not null default 0,
  motor_desligado numeric not null default 0,
  parado_ligado numeric not null default 0,
  outros numeric not null default 0,
  primary key (boletim_cod, vaga_id)
);
alter table public.medicao_boletim_vaga add column if not exists outros numeric not null default 0;

create table if not exists public.medicao_indisp_evento (
  id bigint generated always as identity primary key,
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  placa text not null,
  inicio timestamptz not null,
  fim timestamptz not null,
  tipo text not null,
  horas numeric not null,
  unique (boletim_cod, vaga_id, placa, inicio, tipo)
);
create index if not exists medicao_indisp_evento_vaga on public.medicao_indisp_evento (boletim_cod, vaga_id);

create table if not exists public.medicao_vaga_dia (
  boletim_cod text not null references public.medicao_boletim(cod) on delete cascade,
  vaga_id integer not null,
  dia date not null,
  placas text,
  horas_regime numeric not null,
  horas_indisp numeric not null,
  primary key (boletim_cod, vaga_id, dia)
);

-- leitura pública (decisão do dono, 10/10/2026); fechar com o login da Central na Fase 3 do portal
do $$
declare t text;
begin
  foreach t in array array['medicao_boletim', 'medicao_boletim_vaga', 'medicao_indisp_evento', 'medicao_vaga_dia'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('drop policy if exists "%s: leitura pública" on public.%I', t, t);
    execute format('create policy "%s: leitura pública" on public.%I for select to anon, authenticated using (true)', t, t);
  end loop;
end $$;

-- conferência
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename like 'medicao_%' order by 1;
```

- [ ] **Step 8: Run the collector tests and the typecheck**

Run: `npx vitest run coletor && npm run typecheck`
Expected: PASS em todos (os testes antigos do coletor continuam passando; sem erro de tipo).

- [ ] **Step 9: Commit**

```bash
git add coletor/medicao.ts coletor/medicao.test.ts coletor/gauss.ts coletor/run.ts supabase/medicao.sql
git commit -m "Medição: coletor baixa os boletins GPS fechados (trava nas 2 chamadas de leitura) e SQL das tabelas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Leituras da página

**Files:**
- Modify: `src/lib/dados/esquemas.ts` (validações da medição)
- Create: `src/lib/dados/medicao.ts`
- Test: `src/lib/dados/medicao.test.ts`

**Interfaces:**
- Consumes (Task 1): `type Boletim`, `type VagaBoletim`, `type EventoIndisp`, `type VagaDia`, `type TrechoMotor`, `diaSeguinte`; `db`, `ok` de `src/lib/supabase/cliente.ts`.
- Produces: `validarBoletins`, `validarVagasBoletim`, `validarEventosIndisp`, `validarVagaDias`, `validarTrechosMotor` (em `esquemas.ts`); `lerBoletins(c?)`, `lerVagasBoletim(cod, c?)`, `lerDetalheVaga(boletim, vagaId, c?)`, `interface DetalheVaga { eventos: EventoIndisp[]; dias: VagaDia[]; motor: TrechoMotor[] | null }`, `interface Carga<T> { dados: T | null; carregando: boolean; erro: string | null }`, `useBoletins(): Carga<Boletim[]>`, `useVagasBoletim(cod: string | null): Carga<VagaBoletim[]>`, `useDetalheVaga(boletim: Boletim | null, vagaId: number | null): Carga<DetalheVaga>`.

- [ ] **Step 1: Write the failing test** — `src/lib/dados/medicao.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { FormatoInesperado, validarBoletins, validarEventosIndisp, validarVagaDias, validarVagasBoletim } from "./esquemas";

describe("validações da medição", () => {
  it("números do Postgres (numeric) podem chegar como texto: viram número", () => {
    const [v] = validarVagasBoletim([{ boletim_cod: "B1", vaga_id: 530, vaga: "AP 01", regime: null, horas_regime: "551.6167", horas_indisp: 23.9167, df: "95.66", ausencia_operador: 12.68, area_manutencao: 0, fora_planta: 0, trajeto: 0, cartao_rfid: 0, lancada: 0, motor_desligado: 0, parado_ligado: 0, outros: 0 }]);
    expect(v.horas_regime).toBeCloseTo(551.6167, 4);
    expect(v.df).toBe(95.66);
  });
  it("dia sem placas (null) vira texto vazio", () => {
    expect(validarVagaDias([{ boletim_cod: "B1", vaga_id: 530, dia: "2026-09-16", placas: null, horas_regime: 24, horas_indisp: 1 }])[0].placas).toBe("");
  });
  it("formato errado avisa em vez de quebrar em silêncio", () => {
    expect(() => validarBoletins([{ cod: 1 }])).toThrow(FormatoInesperado);
    expect(() => validarEventosIndisp([{ placa: "X" }])).toThrow(FormatoInesperado);
  });
  it("lista vazia é válida", () => {
    expect(validarBoletins([])).toEqual([]);
    expect(validarBoletins(null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dados/medicao.test.ts`
Expected: FAIL ("validarBoletins is not a function" / import não encontrado).

- [ ] **Step 3: Add the validations** — fim de `src/lib/dados/esquemas.ts`

Acrescente ao import do topo: `import type { Boletim, EventoIndisp, TrechoMotor, VagaBoletim, VagaDia } from "../dominio/medicao";`

```ts
// medição (tabelas medicao_*): numeric do Postgres pode chegar como texto
const horas = z.coerce.number();
const boletimMedicao = z.looseObject({ cod: z.string(), identificacao: z.string(), inicio: z.string(), fim: z.string() });
const vagaBoletim = z.looseObject({
  boletim_cod: z.string(), vaga_id: z.number(), vaga: z.string(), regime: z.string().nullable(),
  horas_regime: horas, horas_indisp: horas, df: horas,
  ausencia_operador: horas, area_manutencao: horas, fora_planta: horas, trajeto: horas, cartao_rfid: horas, lancada: horas, motor_desligado: horas, parado_ligado: horas, outros: horas,
});
const eventoIndisp = z.looseObject({ boletim_cod: z.string(), vaga_id: z.number(), placa: z.string(), inicio: z.string(), fim: z.string(), tipo: z.string(), horas });
const vagaDia = z.looseObject({ boletim_cod: z.string(), vaga_id: z.number(), dia: z.string(), placas: z.string().nullable().transform((p) => p ?? ""), horas_regime: horas, horas_indisp: horas });
const trechoMotor = z.looseObject({ inicio: z.string(), fim: z.string(), status: z.string() });

export const validarBoletins = (v: unknown): Boletim[] => validar<Boletim[]>(z.array(boletimMedicao), v ?? [], "Boletins da medição");
export const validarVagasBoletim = (v: unknown): VagaBoletim[] => validar<VagaBoletim[]>(z.array(vagaBoletim), v ?? [], "Vagas do boletim");
export const validarEventosIndisp = (v: unknown): EventoIndisp[] => validar<EventoIndisp[]>(z.array(eventoIndisp), v ?? [], "Indisponibilidades da vaga");
export const validarVagaDias = (v: unknown): VagaDia[] => validar<VagaDia[]>(z.array(vagaDia), v ?? [], "DF por dia da vaga");
export const validarTrechosMotor = (v: unknown): TrechoMotor[] => validar<TrechoMotor[]>(z.array(trechoMotor), v ?? [], "Motor secundário da vaga");
```

- [ ] **Step 4: Write the readers and hooks** — `src/lib/dados/medicao.ts`

```ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { diaSeguinte, type Boletim, type EventoIndisp, type TrechoMotor, type VagaBoletim, type VagaDia } from "../dominio/medicao";
import { db, ok } from "../supabase/cliente";
import { validarBoletins, validarEventosIndisp, validarTrechosMotor, validarVagaDias, validarVagasBoletim } from "./esquemas";

// o Supabase entrega no máximo 1000 linhas por consulta
const PAGINA = 1000;
const MAX = 20000;

async function paginado(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    const pag = ((await ok(consulta(de, de + PAGINA - 1))) as unknown[] | null) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

/** Boletins gravados por inteiro, do mais novo ao mais antigo. */
export const lerBoletins = async (c: SupabaseClient = db()): Promise<Boletim[]> =>
  validarBoletins(await ok(c.from("medicao_boletim").select("cod, identificacao, inicio, fim").eq("completo", true).order("inicio", { ascending: false })));

export const lerVagasBoletim = async (cod: string, c: SupabaseClient = db()): Promise<VagaBoletim[]> =>
  validarVagasBoletim(await ok(c.from("medicao_boletim_vaga").select("*").eq("boletim_cod", cod)));

export interface DetalheVaga {
  eventos: EventoIndisp[];
  dias: VagaDia[];
  /** null: não foi possível ler a timeline de motor (a tela diz "sem dado do motor"). */
  motor: TrechoMotor[] | null;
}

export async function lerDetalheVaga(b: Boletim, vagaId: number, c: SupabaseClient = db()): Promise<DetalheVaga> {
  const [eventos, dias, motor] = await Promise.all([
    paginado((de, a) => c.from("medicao_indisp_evento").select("boletim_cod, vaga_id, placa, inicio, fim, tipo, horas").eq("boletim_cod", b.cod).eq("vaga_id", vagaId).order("inicio").order("id").range(de, a)),
    ok(c.from("medicao_vaga_dia").select("boletim_cod, vaga_id, dia, placas, horas_regime, horas_indisp").eq("boletim_cod", b.cod).eq("vaga_id", vagaId).order("dia")),
    // motor 2º da vaga nos dias do ciclo (o campo do boletim vem zerado e não é usado)
    paginado((de, a) =>
      c.from("timeline_motor_vaga").select("inicio, fim, status").eq("vaga_id", vagaId).eq("status", "secondary_motor_on").lt("inicio", diaSeguinte(b.fim)).gt("fim", b.inicio).order("id").range(de, a),
    ).catch(() => null),
  ]);
  return { eventos: validarEventosIndisp(eventos), dias: validarVagaDias(dias), motor: motor == null ? null : validarTrechosMotor(motor) };
}

export interface Carga<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
}

/** Lê uma vez por chave (null = nada a ler). `ler` precisa ser estável (função do módulo). */
function useLeitura<T>(chave: string | null, ler: (chave: string) => Promise<T>): Carga<T> {
  const [r, setR] = useState<{ chave: string | null; dados: T | null; erro: string | null }>({ chave: null, dados: null, erro: null });
  useEffect(() => {
    if (chave == null) return;
    let vivo = true;
    ler(chave).then(
      (dados) => vivo && setR({ chave, dados, erro: null }),
      (e: unknown) => vivo && setR({ chave, dados: null, erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [chave, ler]);
  const atual = chave != null && r.chave === chave;
  return { dados: atual ? r.dados : null, erro: atual ? r.erro : null, carregando: chave != null && !atual };
}

const lerTodos = () => lerBoletins();
const lerVagasPorCod = (cod: string) => lerVagasBoletim(cod);
const lerDetalhePorChave = (chave: string) => {
  const [cod, inicio, fim, vagaId] = JSON.parse(chave) as [string, string, string, number];
  return lerDetalheVaga({ cod, identificacao: "", inicio, fim }, vagaId);
};

export const useBoletins = () => useLeitura("boletins", lerTodos);
export const useVagasBoletim = (cod: string | null) => useLeitura(cod, lerVagasPorCod);
export const useDetalheVaga = (b: Boletim | null, vagaId: number | null) =>
  useLeitura(b && vagaId != null ? JSON.stringify([b.cod, b.inicio, b.fim, vagaId]) : null, lerDetalhePorChave);
```

- [ ] **Step 5: Run tests, typecheck and lint**

Run: `npx vitest run src/lib/dados && npm run typecheck && npm run lint`
Expected: PASS, sem erro de tipo nem de lint.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dados/esquemas.ts src/lib/dados/medicao.ts src/lib/dados/medicao.test.ts
git commit -m "Medição: leituras da página (boletins, vagas, detalhe da vaga e motor 2º) com validação" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Aba Disponibilidade na Análise

**Files:**
- Create: `src/app/analise/_componentes/abas-analise.tsx`, `src/app/analise/_componentes/disponibilidade/disponibilidade.tsx`, `.../disponibilidade/placar-disponibilidade.tsx`, `.../disponibilidade/lista-vagas.tsx`, `.../disponibilidade/detalhe-vaga.tsx`, `e2e/disponibilidade.spec.ts`
- Modify: `src/app/analise/page.tsx`, `src/app/analise/_componentes/analise.tsx:139` (classe da raiz), `e2e/apoio.ts` (dados falsos da medição)

**Interfaces:**
- Consumes (Tasks 1 e 3): `dfDaFrota`, `ordenarVagas`, `motivoPrincipal`, `porMotivo`, `conferencia`, `motor2PorDia`, `dfDoDia`, `placasDoCiclo`, `fmtH`, `fmtDf`, `dataBr`, `horaEvento`, `rotuloBoletim`, tipos; `useBoletins`, `useVagasBoletim`, `useDetalheVaga`, `type Carga`, `type DetalheVaga`; `Aviso`, `Selecao`, `Segmentado`, `Selo`, `Vazio`, `cx` de `@/components/ui`; `useOpcao` de `@/lib/hooks`.
- Produces: `AbasAnalise` (página), `Disponibilidade`.

- [ ] **Step 1: Add the fake data to the e2e helper** — `e2e/apoio.ts`

Depois de `paradasAnalise`, acrescente:

```ts
const diaAtras = (n: number) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const vagaMedicao = (o: Record<string, unknown>) => ({
  boletim_cod: "B1", regime: "24h-12 GPS (Novo)", horas_regime: 72, horas_indisp: 0, df: 100,
  ausencia_operador: 0, area_manutencao: 0, fora_planta: 0, trajeto: 0, cartao_rfid: 0, lancada: 0, motor_desligado: 0, parado_ligado: 0, outros: 0, ...o,
});
/** Medição oficial (tabelas medicao_*): um boletim cujo ciclo termina hoje (o motor 2º de motorGauss cai dentro), 2 vagas. */
export const medicao = () => ({
  boletins: [{ cod: "B1", identificacao: "GPS 2026-10", inicio: diaAtras(2), fim: hoje() }],
  vagas: [
    vagaMedicao({ vaga_id: 545, vaga: "ALTA PRESSÃO - GPS - 08 - 24 HS", horas_indisp: 0.72, df: 99, fora_planta: 0.72 }),
    vagaMedicao({ vaga_id: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", horas_indisp: 7.2, df: 90, ausencia_operador: 5, area_manutencao: 2 }),
  ],
  eventos: [
    { boletim_cod: "B1", vaga_id: 530, placa: "EGC2985", inicio: `${hoje()}T06:00:00-03:00`, fim: `${hoje()}T11:00:00-03:00`, tipo: "Ausência de operador", horas: 5 },
    { boletim_cod: "B1", vaga_id: 530, placa: "EGC2985", inicio: `${hoje()}T13:00:00-03:00`, fim: `${hoje()}T15:00:00-03:00`, tipo: "Área de manutenção - OFICINA GPS/SERVITEC", horas: 2 },
  ],
  dias: [2, 1, 0].map((n) => ({ boletim_cod: "B1", vaga_id: 530, dia: diaAtras(n), placas: "EGC2985", horas_regime: 24, horas_indisp: 2.4 })),
});
```

Na assinatura de `prepararDados`, acrescente às opções: `medicao?: ReturnType<typeof medicao>; medicaoSemTabela?: boolean;`

Dentro da rota, antes do `return json([]);` final:

```ts
    if (tabela?.startsWith("medicao_")) {
      // como o Supabase responde quando o SQL da medição ainda não foi rodado
      if (opcoes.medicaoSemTabela) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST205", message: `Could not find the table 'public.${tabela}' in the schema cache` }) });
      const m = opcoes.medicao ?? medicao();
      if (tabela === "medicao_boletim") return json(m.boletins);
      if (tabela === "medicao_boletim_vaga") return json(m.vagas);
      if (tabela === "medicao_indisp_evento") return json(m.eventos);
      if (tabela === "medicao_vaga_dia") return json(m.dias);
    }
```

- [ ] **Step 2: Write the failing e2e test** — `e2e/disponibilidade.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { medicao, prepararDados } from "./apoio";

test("Análise › Disponibilidade: ranking pela pior DF e detalhe da vaga com o oficial", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(page.getByText("Oficial", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ciclo da medição" })).toContainText("GPS 2026-10");
  // placar: (144 − 7,92) ÷ 144 = 94,50%; 7,92 h = 7h55; pior vaga = AP 01
  const placar = page.getByRole("region", { name: "Placar da disponibilidade" });
  await expect(placar).toContainText("94,50%");
  await expect(placar).toContainText("7h55");
  await expect(placar).toContainText("ALTA PRESSÃO - GPS - 01 - 24 HS");
  // vagas da pior para a melhor, com o motivo que mais pesou
  const vagas = page.getByRole("region", { name: "Vagas" });
  await expect(vagas.getByRole("button").first()).toHaveAccessibleName(/^ALTA PRESSÃO - GPS - 01 - 24 HS, DF 90,00%, 7h12 indisponível, mais: Ausência de operador/);
  await vagas.getByRole("button").first().click();
  const detalhe = page.getByRole("region", { name: "Detalhe: ALTA PRESSÃO - GPS - 01 - 24 HS" });
  await expect(detalhe.getByRole("region", { name: "DF por dia" }).getByRole("listitem")).toHaveCount(3);
  await expect(detalhe.getByRole("region", { name: "Por motivo" })).toContainText("Ausência de operador");
  await expect(detalhe.getByRole("region", { name: "Eventos" })).toContainText("EGC2985");
  await expect(detalhe.getByRole("region", { name: "Eventos" })).toContainText("Área de manutenção - OFICINA GPS/SERVITEC");
  // motor 2º: 08:10–08:20 de hoje na timeline de motor
  await expect(detalhe.getByRole("region", { name: "Motor secundário ligado" })).toContainText("0h10");
  // eventos somam 7h00; o boletim diz 7h12
  await expect(detalhe.getByRole("region", { name: "Conferência" })).toContainText("diferença 0h12");
  expect(gravacoes).toEqual([]);
});

test("Análise › Disponibilidade: avisa quando o SQL não foi rodado", async ({ page }) => {
  await prepararDados(page, { medicaoSemTabela: true });
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(page.getByRole("alert")).toContainText("rode supabase/medicao.sql");
});

test("Análise › Disponibilidade: nenhum boletim baixado ainda", async ({ page }) => {
  await prepararDados(page, { medicao: { ...medicao(), boletins: [] } });
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(page.getByText("Nenhum boletim baixado ainda")).toBeVisible();
});
```

- [ ] **Step 3: Write the components**

`src/app/analise/_componentes/abas-analise.tsx`:

```tsx
"use client";

import { Segmentado } from "@/components/ui";
import { useOpcao } from "@/lib/hooks";
import { Analise } from "./analise";
import { Disponibilidade } from "./disponibilidade/disponibilidade";

const ABAS = ["paradas", "disponibilidade"] as const;
type Aba = (typeof ABAS)[number];

/** Duas abas no topo da Análise: Paradas (o painel) e Disponibilidade (medição oficial). A escolha fica neste navegador. */
export function AbasAnalise() {
  const [aba, setAba] = useOpcao<Aba>("mon-analise-aba", ABAS, "paradas");
  return (
    <div className="altura-tela flex flex-col">
      <div className="px-2 pt-2">
        <div className="max-w-xs">
          <Segmentado rotulo="Análise" valor={aba} mudar={setAba} opcoes={[{ id: "paradas", rotulo: "Paradas" }, { id: "disponibilidade", rotulo: "Disponibilidade" }]} />
        </div>
      </div>
      {aba === "paradas" ? <Analise /> : <Disponibilidade />}
    </div>
  );
}
```

`src/app/analise/page.tsx`:

```tsx
import { AbasAnalise } from "./_componentes/abas-analise";

export default function Pagina() {
  return <AbasAnalise />;
}
```

Em `src/app/analise/_componentes/analise.tsx`, a raiz deixa de ocupar a tela sozinha (a altura vem das abas). Troque:

```tsx
    <div className="altura-tela flex flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
```

por:

```tsx
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
```

`src/app/analise/_componentes/disponibilidade/placar-disponibilidade.tsx`:

```tsx
import { fmtDf, fmtH, type VagaBoletim } from "@/lib/dominio/medicao";

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-suave">{rotulo}</dt>
      <dd className="truncate text-2xl font-bold tabular-nums text-texto">{valor}</dd>
      {nota && <p className="truncate text-[11px] text-suave">{nota}</p>}
    </div>
  );
}

/** DF da frota no ciclo, horas indisponíveis e a pior vaga. */
export function PlacarDisponibilidade({ df, horasIndisp, pior }: { df: number | null; horasIndisp: number; pior: VagaBoletim | null }) {
  return (
    <section aria-label="Placar da disponibilidade">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Numero rotulo="DF da frota" valor={df == null ? "—" : fmtDf(df)} nota="disponibilidade física no ciclo" />
        <Numero rotulo="Horas indisponíveis" valor={fmtH(horasIndisp)} />
        <Numero rotulo="Pior vaga" valor={pior ? fmtDf(pior.df) : "—"} nota={pior?.vaga} />
      </dl>
    </section>
  );
}
```

`src/app/analise/_componentes/disponibilidade/lista-vagas.tsx`:

```tsx
"use client";

import { cx } from "@/components/ui";
import { fmtDf, fmtH, motivoPrincipal, type VagaBoletim } from "@/lib/dominio/medicao";

/** Vagas da pior DF para a melhor; clicar abre o detalhe (clicar de novo fecha). */
export function ListaVagas({ vagas, selecionada, escolher, carregando }: { vagas: VagaBoletim[]; selecionada: number | null; escolher: (id: number) => void; carregando: boolean }) {
  return (
    <section aria-label="Vagas" className="flex min-h-0 flex-col rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Vagas <span className="font-normal normal-case tracking-normal">· da pior DF para a melhor</span>
      </h2>
      {carregando ? (
        <p className="mt-2 text-xs text-suave">Carregando as vagas…</p>
      ) : (
        <ul className="mt-2 grid gap-1 lg:min-h-0 lg:overflow-y-auto">
          {vagas.map((v) => {
            const motivo = motivoPrincipal(v);
            const dica = `${v.vaga}, DF ${fmtDf(v.df)}, ${fmtH(v.horas_indisp)} indisponível${motivo ? `, mais: ${motivo.nome}` : ""}`;
            return (
              <li key={v.vaga_id}>
                <button
                  type="button"
                  aria-pressed={selecionada === v.vaga_id}
                  aria-label={dica}
                  title={dica}
                  onClick={() => escolher(v.vaga_id)}
                  className={cx(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2",
                    selecionada === v.vaga_id && "bg-primaria-suave",
                  )}
                >
                  <span className="truncate">{v.vaga}</span>
                  <b className="tabular-nums text-texto">{fmtDf(v.df)}</b>
                  <span className="col-span-2 truncate text-[11px] text-suave">
                    {fmtH(v.horas_indisp)} indisponível{motivo ? ` · ${motivo.nome}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

`src/app/analise/_componentes/disponibilidade/detalhe-vaga.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { Aviso, Vazio } from "@/components/ui";
import type { Carga, DetalheVaga as Detalhe } from "@/lib/dados/medicao";
import { conferencia, dataBr, dfDoDia, fmtDf, fmtH, horaEvento, motor2PorDia, placasDoCiclo, porMotivo, type Boletim, type VagaBoletim } from "@/lib/dominio/medicao";

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-lg border border-borda p-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-suave">{titulo}</h3>
      <div className="mt-1.5 text-[13px]">{children}</div>
    </section>
  );
}

/** Detalhe da vaga escolhida: DF por dia, por motivo, motor 2º, placas, conferência e os eventos. */
export function DetalheVaga({ vaga, boletim, detalhe }: { vaga: VagaBoletim | null; boletim: Boletim; detalhe: Carga<Detalhe> }) {
  if (!vaga) {
    return (
      <div className="rounded-xl border border-borda bg-superficie">
        <Vazio titulo="Escolha uma vaga">Clique numa vaga para ver os dias, os motivos e cada indisponibilidade.</Vazio>
      </div>
    );
  }
  const d = detalhe.dados;
  const dias = (d?.dias ?? []).map((x) => ({ ...x, df: dfDoDia(x) })).filter((x): x is typeof x & { df: number } => x.df != null);
  const menor = Math.min(100, ...dias.map((x) => x.df));
  // escala de base% a 100%: com DF perto de 100 todo dia, a barra cheia não mostraria diferença
  const base = Math.max(0, Math.min(80, Math.floor(menor / 10) * 10));
  const motor = d?.motor ? motor2PorDia(d.motor, boletim.inicio, boletim.fim) : null;
  const conf = d ? conferencia(d.eventos, vaga.horas_indisp) : null;
  const motivos = porMotivo(vaga);
  const maxMotivo = Math.max(0, ...motivos.map((m) => m.horas));

  return (
    <section aria-label={`Detalhe: ${vaga.vaga}`} className="flex flex-col gap-2 rounded-xl border border-borda bg-superficie p-3 lg:min-h-0 lg:overflow-y-auto">
      <h2 className="text-sm font-semibold">
        {vaga.vaga} <span className="font-normal text-suave">· DF {fmtDf(vaga.df)} · {fmtH(vaga.horas_indisp)} indisponível de {fmtH(vaga.horas_regime)}</span>
      </h2>
      {detalhe.erro && <Aviso tipo="erro">Não foi possível carregar o detalhe: {detalhe.erro}</Aviso>}
      {detalhe.carregando && <p className="text-xs text-suave">Carregando o detalhe…</p>}
      {d && (
        <>
          <Bloco titulo="DF por dia">
            {dias.length === 0 ? (
              <p className="text-suave">Sem dias neste boletim.</p>
            ) : (
              <>
                <ul className="flex h-24 items-end gap-0.5">
                  {dias.map((x) => (
                    <li key={x.dia} aria-label={`${dataBr(x.dia)}: ${fmtDf(x.df)}`} title={`${dataBr(x.dia)}: ${fmtDf(x.df)}`} className="flex h-full min-w-1 flex-1 items-end">
                      <span className="block w-full rounded-t bg-primaria" style={{ height: `${Math.max(3, ((x.df - base) / (100 - base)) * 100)}%` }} />
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-suave">
                  {dataBr(dias[0].dia)} a {dataBr(dias.at(-1)!.dia)} · escala de {base}% a 100%
                </p>
              </>
            )}
          </Bloco>
          <Bloco titulo="Por motivo">
            {motivos.length === 0 ? (
              <p className="text-suave">Sem indisponibilidade.</p>
            ) : (
              <ul className="grid gap-1">
                {motivos.map((m) => (
                  <li key={m.chave} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
                    <span className="truncate">{m.nome}</span>
                    <b className="tabular-nums">{fmtH(m.horas)}</b>
                    <span aria-hidden className="col-span-2 h-1.5 rounded-full bg-superficie-2">
                      <span className="block h-full rounded-full bg-primaria" style={{ width: `${maxMotivo > 0 ? Math.max(2, (m.horas / maxMotivo) * 100) : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          <Bloco titulo="Motor secundário ligado">
            {!motor || motor.total === 0 ? (
              <p className="text-suave">Sem dado do motor nestes dias.</p>
            ) : (
              <>
                <p>
                  <b className="tabular-nums">{fmtH(motor.total)}</b> no ciclo
                </p>
                <p className="mt-0.5 text-[11px] text-suave">{motor.dias.map((x) => `${dataBr(x.dia)} ${fmtH(x.horas)}`).join(" · ")}</p>
              </>
            )}
          </Bloco>
          <Bloco titulo="Placas">
            <p>{placasDoCiclo(d.dias).join(", ") || "—"}</p>
          </Bloco>
          {conf && (
            <Bloco titulo="Conferência">
              <p>
                {conf.confere
                  ? `Eventos somam ${fmtH(conf.soma)}, igual ao boletim.`
                  : `Eventos somam ${fmtH(conf.soma)}, boletim diz ${fmtH(conf.total)}: diferença ${fmtH(Math.abs(conf.diferenca))}.`}
              </p>
            </Bloco>
          )}
          <Bloco titulo="Eventos">
            {d.eventos.length === 0 ? (
              <p className="text-suave">Nenhuma indisponibilidade.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-superficie text-suave">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Placa</th>
                      <th className="py-1 pr-2 font-medium">Início</th>
                      <th className="py-1 pr-2 font-medium">Fim</th>
                      <th className="py-1 pr-2 font-medium">Motivo</th>
                      <th className="py-1 text-right font-medium">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.eventos.map((e) => (
                      <tr key={`${e.placa}|${e.inicio}|${e.tipo}`} className="border-t border-borda">
                        <td className="py-1 pr-2">{e.placa}</td>
                        <td className="py-1 pr-2 tabular-nums">{horaEvento(e.inicio)}</td>
                        <td className="py-1 pr-2 tabular-nums">{horaEvento(e.fim)}</td>
                        <td className="py-1 pr-2">{e.tipo}</td>
                        <td className="py-1 text-right tabular-nums">{fmtH(e.horas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>
        </>
      )}
    </section>
  );
}
```

`src/app/analise/_componentes/disponibilidade/disponibilidade.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Aviso, Selecao, Selo, Vazio } from "@/components/ui";
import { useBoletins, useDetalheVaga, useVagasBoletim } from "@/lib/dados/medicao";
import { dfDaFrota, ordenarVagas, rotuloBoletim } from "@/lib/dominio/medicao";
import { DetalheVaga } from "./detalhe-vaga";
import { ListaVagas } from "./lista-vagas";
import { PlacarDisponibilidade } from "./placar-disponibilidade";

// tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
const SEM_TABELA = /could not find the table|does not exist|PGRST205|42P01/i;
const mensagem = (erro: string) => (SEM_TABELA.test(erro) ? "As tabelas da medição ainda não foram criadas: rode supabase/medicao.sql no Supabase." : `Não foi possível carregar: ${erro}`);

/**
 * Aba Disponibilidade (desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md): os números OFICIAIS
 * dos boletins de medição GPS já fechados. Vagas da pior DF para a melhor; clicar abre o detalhe.
 */
export function Disponibilidade() {
  const boletins = useBoletins();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [vagaSel, setVagaSel] = useState<number | null>(null);
  const lista = boletins.dados ?? [];
  const boletim = lista.find((b) => b.cod === escolhido) ?? lista[0] ?? null;
  const vagas = useVagasBoletim(boletim?.cod ?? null);
  const ordenadas = useMemo(() => ordenarVagas(vagas.dados ?? []), [vagas.dados]);
  const vaga = ordenadas.find((v) => v.vaga_id === vagaSel) ?? null;
  const detalhe = useDetalheVaga(vaga ? boletim : null, vaga?.vaga_id ?? null);
  const horasIndisp = ordenadas.reduce((s, v) => s + v.horas_indisp, 0);

  if (boletins.erro) {
    return (
      <div className="p-2">
        <Aviso tipo="erro">{mensagem(boletins.erro)}</Aviso>
      </div>
    );
  }
  if (boletins.carregando) return <p className="p-4 text-sm text-suave">Carregando os boletins…</p>;
  if (!boletim) {
    return (
      <Vazio titulo="Nenhum boletim baixado ainda">O coletor baixa o boletim quando ele fecha no GAUSS (uma vez por dia, a partir das 07:00).</Vazio>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Selecao
          aria-label="Ciclo da medição"
          value={boletim.cod}
          onChange={(e) => {
            setEscolhido(e.target.value);
            setVagaSel(null);
          }}
        >
          {lista.map((b) => (
            <option key={b.cod} value={b.cod}>
              {rotuloBoletim(b)}
            </option>
          ))}
        </Selecao>
        <Selo tom="ok">Oficial</Selo>
      </div>
      {vagas.erro ? (
        <Aviso tipo="erro">{mensagem(vagas.erro)}</Aviso>
      ) : (
        <>
          <PlacarDisponibilidade df={dfDaFrota(ordenadas)} horasIndisp={horasIndisp} pior={ordenadas[0] ?? null} />
          <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]">
            <ListaVagas vagas={ordenadas} selecionada={vaga?.vaga_id ?? null} escolher={(id) => setVagaSel((s) => (s === id ? null : id))} carregando={vagas.carregando} />
            <DetalheVaga vaga={vaga} boletim={boletim} detalhe={detalhe} />
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: sem erros.

- [ ] **Step 5: Build and run the e2e (new and the existing Análise one)**

Run: `npm run build && npx playwright test e2e/disponibilidade.spec.ts e2e/analise.spec.ts`
Expected: PASS nos 3 testes novos e no da Análise (a aba Paradas continua como padrão).

- [ ] **Step 6: Commit**

```bash
git add src/app/analise e2e/apoio.ts e2e/disponibilidade.spec.ts
git commit -m "Análise: aba Disponibilidade com a medição oficial (placar, vagas pela pior DF, detalhe com eventos, DF por dia e motor 2º)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Documentação e verificação final

**Files:**
- Modify: `README.md` (Pontos de atenção do dono), `CHANGELOG.md`, `docs/superpowers/specs/2026-10-10-medicao-oficial-design.md` (seção de ajustes)

- [ ] **Step 1: Spec** — no fim de `docs/superpowers/specs/2026-10-10-medicao-oficial-design.md`, acrescente:

```markdown
## Ajustes na construção (13/10/2026)
Vistos nos dados reais e aplicados no plano `docs/superpowers/plans/2026-10-13-medicao-oficial.md`:
- Horas por motivo = soma dos eventos da vaga (o campo de área de manutenção do GAUSS às vezes passa do total: AP 01 tem 47h57 nele, contra 23h55 de total). Tipo desconhecido vai para a coluna nova `outros`. `horas_regime`, `horas_indisp` e `df` seguem os campos oficiais.
- `medicao_boletim.completo`: o boletim entra primeiro (chave estrangeira) e só vira completo depois de gravado por inteiro.
- `get_data`: tempo limite de 180 s e 1 tentativa (o boletim tem ~16 MB).
- Falha na lista do dia: tenta de novo só no dia seguinte.
```

- [ ] **Step 2: README** — em "Pontos de atenção do dono", acrescente:

```markdown
- **Medição oficial (aba Disponibilidade da Análise):** antes de publicar, rode `supabase/medicao.sql` no Supabase PRODUTIVIDADE. O coletor lista os boletins 1 vez por dia (a partir das 07:00) e baixa cada boletim GPS fechado **uma vez**, só com as 2 chamadas de leitura do Dashboard Medição. **Nunca** usar a tela Medição Mensal do GAUSS: ela grava registro (`coletor/medicao.ts` tem a trava). Rota completa: `automation/medicao/README.md`.
```

- [ ] **Step 3: CHANGELOG** — no topo de `CHANGELOG.md`, logo depois do título:

```markdown
## Medição oficial na Análise · 13/10/2026 (não publicado)
- **Aba Disponibilidade** na Análise (a aba Paradas continua sendo a padrão): os números **oficiais** dos boletins de medição GPS já fechados. Escolha do ciclo, selo Oficial, placar (DF da frota, horas indisponíveis, pior vaga), vagas da pior DF para a melhor com o motivo que mais pesou e, ao clicar, o detalhe: DF por dia, horas por motivo, motor secundário ligado (timeline de motor), placas, conferência eventos × boletim e cada indisponibilidade (placa, início, fim, motivo).
- **Coletor:** baixa cada boletim novo uma única vez (1 lista por dia, 1 boletim por ciclo), com uma trava que só deixa passar as 2 chamadas de leitura do Dashboard Medição.
- **Banco:** `supabase/medicao.sql` (4 tabelas `medicao_*`, leitura pública, grava só o coletor). Precisa rodar antes de publicar.
- Período em aberto, "agora" e o selo Parcial ficam para a Fase 2.
```

- [ ] **Step 4: Full verification**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`
Expected: tudo passa (testes antigos + novos; e2e completo).

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md docs/superpowers/specs/2026-10-10-medicao-oficial-design.md docs/superpowers/plans/2026-10-13-medicao-oficial.md
git commit -m "Medição: README, CHANGELOG e ajustes do desenho" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

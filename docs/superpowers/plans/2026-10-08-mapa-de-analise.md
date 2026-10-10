# Mapa de análise — plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela "Análise" no site: mapa da Usiminas com cada área pintada pela medida escolhida (produtivo, parado ligado sem produzir, tempo parado, visitas, tipo de local, apontamento), filtros, ranking e painel "quem atende", alimentada pela tabela `analise_paradas` (30 dias).

**Architecture:** O Supabase guarda só fatos (uma linha por parada). As regras ficam em `src/lib/dominio/analise.ts` (puro, testado), reaproveitando `produtividade.ts`. A tela lê tudo uma vez (≈11 mil linhas no máximo), filtra no navegador e desenha no Leaflet que o site já usa. O PC envia uma vez os 15 dias já baixados (`automation/historico/enviar.js`), sem consultar o GAUSS.

**Tech Stack:** Next.js (export estático) + TypeScript + Tailwind, Leaflet, Supabase (zod na leitura), Vitest, Playwright; Node ESM no PC.

**Spec:** `docs/superpowers/specs/2026-10-08-mapa-de-analise-design.md`

## Global Constraints

- Zero consulta nova ao GAUSS.
- Guardar no máximo 30 dias (`analise_paradas` limpa sozinha; o envio do PC só manda os últimos 30 dias).
- A página é pública e só lê; só a chave secreta grava. Nunca ler nem copiar `.env`, senhas ou tokens.
- Regras de produtividade só de `src/lib/dominio/produtividade.ts` (`statusProdutivo`, `ehBase`).
- Visual SST/Campo; cor nunca sozinha (sempre com rótulo ou número).
- Texto da tela em português simples.
- Não publicar nem fazer commit: os commits por assunto são feitos só quando o dono pedir para publicar. Cada tarefa termina com as verificações, não com commit.
- O SQL é rodado pelo dono no SQL Editor.

## Review Focus

1. Tabela ainda não criada ou vazia (SQL não rodado, envio não feito) → aviso claro "o histórico ainda não foi enviado", sem quebrar a tela. (Tarefa 4: e2e com tabela vazia.)
2. Período sem dados (ex.: 7 dias quando o envio parou em 06/10) → mapa sem cor, ranking diz "nenhuma área com paradas neste filtro". (Tarefa 2: teste do corte do período; Tarefa 4: texto do ranking vazio.)
3. Parada sem timeline de motor (`motor` vazio) → conta no tempo parado e nas visitas, nunca vira "produtivo" nem decide a categoria. (Tarefa 2.)
4. Veículo fora da matriz, desmobilizado ou motor 2º → não entra em nada. (Tarefa 2.)
5. Cerca que sumiu ou mudou de nome (parada com `area` sem polígono) → a área ainda aparece no ranking e no painel, posicionada na parada. (Tarefa 2.)

---

### Task 1: Tabela `analise_paradas` (SQL)

**Files:**
- Create: `supabase/analise.sql`

**Interfaces:**
- Produces: tabela `public.analise_paradas(id, dia, veiculo_id, placa, ini, fim, lat, lng, area, motor, apont, gravado_em)`, única em `(dia, veiculo_id, ini)`; leitura pública; job `analise-limpeza`.

- [ ] **Step 1: Escrever o SQL**

```sql
-- Mapa de análise: uma linha por parada dos últimos 30 dias (só fatos; as regras ficam no site, src/lib/dominio/).
-- Grava: o PC (automation/historico/enviar.js) e, depois, o coletor - sempre com a chave secreta. A página só lê.
-- Rodar no SQL Editor do PRODUTIVIDADE. Pode rodar de novo.

create table if not exists public.analise_paradas (
  id bigint generated always as identity primary key,
  dia date not null,                      -- dia local (America/Sao_Paulo)
  veiculo_id text not null,               -- id do veículo no GAUSS
  placa text not null,
  ini integer not null check (ini between 0 and 86400),  -- segundos do dia
  fim integer not null check (fim between 0 and 86400),
  lat double precision not null,
  lng double precision not null,
  area text,                              -- cerca do GAUSS (a menor); null = fora das cercas
  motor jsonb not null default '{}'::jsonb,  -- minutos de cada status do motor do GAUSS na parada
  apont text[] not null default '{}',     -- categorias do tablet que cobrem a parada
  gravado_em timestamptz not null default now(),
  unique (dia, veiculo_id, ini)
);
create index if not exists analise_paradas_dia on public.analise_paradas (dia);

alter table public.analise_paradas enable row level security;
revoke all on public.analise_paradas from anon, authenticated;
grant select on public.analise_paradas to anon, authenticated;
drop policy if exists "analise_paradas: leitura pública" on public.analise_paradas;
create policy "analise_paradas: leitura pública" on public.analise_paradas
  for select to anon, authenticated using (true);

-- guarda no máximo 30 dias (decisão do dono, 08/10/2026): limpa todo dia às 00:15 de Brasília
create extension if not exists pg_cron;
select cron.unschedule(jobid) from cron.job where jobname = 'analise-limpeza';
select cron.schedule('analise-limpeza', '15 3 * * *',
  $$delete from public.analise_paradas where dia < (now() at time zone 'America/Sao_Paulo')::date - 30$$);

-- conferência
select jobname, schedule, active from cron.job where jobname = 'analise-limpeza';
```

- [ ] **Step 2: Conferir** — ler o arquivo de novo e checar que nenhuma permissão de escrita foi dada a `anon`/`authenticated`. (O dono roda no SQL Editor; não há teste automático.)

---

### Task 2: Regras da análise (`analise.ts`)

**Files:**
- Create: `src/lib/dominio/analise.ts`
- Test: `src/lib/dominio/analise.test.ts`

**Interfaces:**
- Consumes: `statusProdutivo(tipo, placa)`, `ehBase(area)` de `./produtividade`; `distanciaM(a, b)` de `./geo`; tipos `LatLng`, `TipoEquip`, `Veiculo` de `../tipos`.
- Produces (usados pelas Tarefas 3 e 4):
  - `interface ParadaAnalise { dia; veiculo_id; placa; ini; fim; lat; lng; area: string | null; motor: Record<string, number>; apont: string[] }`
  - `CATEGORIAS_LOCAL`, `type CategoriaLocal`, `MEDIDAS`, `type Medida`, `type MedidaNumerica`, `FAIXAS`, `type Faixa`, `PERIODOS`, `type Periodo`
  - `interface EquipAnalise`, `interface Local`, `interface ParadaNoLocal`, `interface FiltroAnalise`, `interface EquipNoLocal`, `interface ResumoLocal`
  - `equipDaFrota(veiculos): Map<string, EquipAnalise>`
  - `faixaDe(ini): Faixa`, `diaDaSemana(dia): number`, `diaMenos(dia, n): string`, `categoriaPeloNome(nome): CategoriaLocal | null`
  - `montarLocais(paradas, areas, equip): { locais: Map<string, Local>; paradas: ParadaNoLocal[] }`
  - `valoresDaParada(p, naBase): { produtivo: number | null; base: number; semProduzir: number | null }`
  - `filtrar(paradas, f): ParadaNoLocal[]`, `resumir(paradas, locais): ResumoLocal[]`
  - `valorDe(r, m): number`, `faixaDeCor(v, max): number`, `ranking(rs, m, n?): ResumoLocal[]`

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import {
  categoriaPeloNome, diaDaSemana, diaMenos, equipDaFrota, faixaDe, faixaDeCor, filtrar, montarLocais, ranking, resumir, valoresDaParada,
  type FiltroAnalise, type ParadaAnalise,
} from "./analise";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [
  { name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) },
  { name: "PÁTIO DO TRANSPORTE RODOVIÁRIO", polygon: quad(-19.49, -42.55) },
];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", o: Partial<Veiculo> = {}): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor: "OZIAS", regime: "ADM" }, ...o }) as Veiculo;
const FROTA = [v("1", "EGC2985", "ap"), v("2", "EGC2993", "av", { equip: { tipo: "av", nome: "EGC2993", ordem: 2, supervisor: "ISRAEL", regime: "4X4 - A" } }), v("3", "EAM3257", "hv"), v("4", "EGC29852", "ap", { motor2_de: "1" }), v("9", "EOF5208", "ap", { equip: undefined })];
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });
const F: FiltroAnalise = { hoje: "2026-10-08", periodo: 30, tipo: null, supervisor: null, regime: null, faixas: [], diasSemana: [] };

describe("datas e faixas", () => {
  it("faixa pela hora de início", () => {
    expect([faixaDe(0), faixaDe(6 * H), faixaDe(12 * H - 1), faixaDe(18 * H)]).toEqual(["madrugada", "manha", "manha", "noite"]);
  });
  it("dia da semana (0 = domingo) e dia − n", () => {
    expect(diaDaSemana("2026-10-04")).toBe(0);
    expect(diaMenos("2026-10-08", 30)).toBe("2026-09-08");
  });
  it("categoria pelo nome (a Baia de Resíduos é Descarte)", () => {
    expect(categoriaPeloNome("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toBe("Base");
    expect(categoriaPeloNome("BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO")).toBe("Descarte");
    expect(categoriaPeloNome("POSTO DE COMBUSTÍVEL")).toBe("Abastecimento");
    expect(categoriaPeloNome("ALTO FORNO 3")).toBeNull();
  });
});

describe("equipamentos da análise", () => {
  it("só a frota da matriz, sem motor 2º, com a regra de produtividade", () => {
    const e = equipDaFrota(FROTA);
    expect([...e.keys()]).toEqual(["1", "2", "3"]);
    expect([e.get("1")?.produtivo, e.get("2")?.produtivo, e.get("3")?.produtivo]).toEqual(["secondary_motor_on", "stopped", null]);
  });
});

describe("locais", () => {
  const equip = equipDaFrota(FROTA);
  it("paradas de veículo fora da frota ou motor 2º não entram", () => {
    const { paradas } = montarLocais([p({}), p({ veiculo_id: "4" }), p({ veiculo_id: "9" })], AREAS, equip);
    expect(paradas.map((x) => x.veiculo_id)).toEqual(["1"]);
  });
  it("fora das cercas: 3 paradas a menos de 120 m viram um ponto; menos que isso fica de fora", () => {
    const fora = (lat: number, lng: number) => p({ area: null, lat, lng });
    const { locais, paradas } = montarLocais([fora(-19.4, -42.4), fora(-19.4003, -42.4), fora(-19.4, -42.4004), fora(-19.3, -42.3)], AREAS, equip);
    expect([...locais.values()].map((l) => [l.chave, l.cerca])).toEqual([["ponto:1", false]]);
    expect(locais.get("ponto:1")?.nome).toMatch(/^Ponto 1 · perto de /);
    expect(paradas).toHaveLength(3);
  });
  it("categoria: produz 15%+ do tempo com motor = Serviço; base pelo nome; parada sem motor não decide", () => {
    const { locais } = montarLocais(
      [
        p({ motor: { secondary_motor_on: 20, stopped: 40 } }),
        p({ area: "PÁTIO DO TRANSPORTE RODOVIÁRIO", lat: -19.489, lng: -42.549, motor: { secondary_motor_on: 60 } }),
        p({ area: "CERCA SEM MOTOR", motor: {}, ini: 0, fim: 3 * H }),
      ],
      AREAS,
      equip,
    );
    expect(locais.get("ALTO FORNO 3")).toMatchObject({ categoria: "Serviço", naBase: false });
    expect(locais.get("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toMatchObject({ categoria: "Base", naBase: true });
    // sem motor: não é Serviço; parada média de 3 h = Base/pernoite
    expect(locais.get("CERCA SEM MOTOR")).toMatchObject({ categoria: "Base/pernoite", naBase: true });
  });
  it("cerca sem polígono (sumiu ou mudou de nome) fica na posição da parada", () => {
    const { locais } = montarLocais([p({ area: "CERCA ANTIGA", lat: -19.1, lng: -42.1 })], AREAS, equip);
    expect(locais.get("CERCA ANTIGA")).toMatchObject({ cerca: true, lat: -19.1, lng: -42.1 });
  });
});

describe("valores de uma parada", () => {
  const equip = equipDaFrota(FROTA);
  const local = (o: Partial<ParadaAnalise>) => montarLocais([p(o)], AREAS, equip).paradas[0];
  it("fora da base: produtivo conta e o resto do ligado é sem produzir", () => {
    expect(valoresDaParada(local({ motor: { secondary_motor_on: 20, stopped: 30, off: 10 } }), false)).toEqual({ produtivo: 20, base: 0, semProduzir: 30 });
  });
  it("na base: produtivo vira motor ligado na base e todo o ligado é sem produzir", () => {
    expect(valoresDaParada(local({ motor: { secondary_motor_on: 20, stopped: 30 } }), true)).toEqual({ produtivo: 0, base: 20, semProduzir: 50 });
  });
  it("tipo sem regra (Hiper Vácuo): sem produtivo nem sem produzir", () => {
    expect(valoresDaParada(local({ veiculo_id: "3", motor: { stopped: 30 } }), false)).toEqual({ produtivo: null, base: 0, semProduzir: null });
  });
  it("sem timeline de motor: zero produtivo", () => {
    expect(valoresDaParada(local({ motor: {} }), false)).toEqual({ produtivo: 0, base: 0, semProduzir: 0 });
  });
});

describe("filtros e resumo por local", () => {
  const equip = equipDaFrota(FROTA);
  const { locais, paradas } = montarLocais(
    [
      p({ motor: { secondary_motor_on: 30, stopped: 10 }, apont: ["Aguardando Área"] }),
      p({ dia: "2026-10-04", ini: 20 * H, fim: 21 * H, veiculo_id: "2", placa: "EGC2993", motor: { stopped: 50 }, apont: ["Aguardando Área", "Refeição Motorista"] }),
      p({ dia: "2026-09-01", motor: { secondary_motor_on: 60 } }),
      p({ veiculo_id: "3", placa: "EAM3257", motor: { stopped: 60 } }),
    ],
    AREAS,
    equip,
  );
  it("período: só os últimos N dias até hoje", () => {
    expect(filtrar(paradas, F)).toHaveLength(3);
    expect(filtrar(paradas, { ...F, periodo: 7 })).toHaveLength(3);
    expect(filtrar(paradas, { ...F, hoje: "2026-10-20", periodo: 7 })).toHaveLength(0);
  });
  it("tipo, supervisor, regime, faixa e dia da semana", () => {
    expect(filtrar(paradas, { ...F, tipo: "av" }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, supervisor: "ISRAEL" }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, regime: "ADM" }).map((x) => x.veiculo_id)).toEqual(["1", "3"]);
    expect(filtrar(paradas, { ...F, faixas: ["noite"] }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, diasSemana: [0] }).map((x) => x.dia)).toEqual(["2026-10-04"]);
  });
  it("resumo: totais, quem atende, horário e apontamentos", () => {
    const [r] = resumir(filtrar(paradas, F), locais);
    expect(r).toMatchObject({ visitas: 3, parado: 180, produtivo: 80, semProduzir: 10, paradoComRegra: 120, base: 0 });
    expect(r.porEquip.map((e) => [e.nome, e.visitas, e.min, e.ultimoDia])).toEqual([["EGC2985", 1, 60, "2026-10-01"], ["EGC2993", 1, 60, "2026-10-04"], ["EAM3257", 1, 60, "2026-10-01"]]);
    expect(r.porHora[8]).toBe(120);
    expect(r.porHora[20]).toBe(60);
    expect(r.apont).toEqual([{ nome: "Aguardando Área", n: 2 }, { nome: "Refeição Motorista", n: 1 }]);
  });
  it("faixa de cor e ranking", () => {
    expect([faixaDeCor(0, 10), faixaDeCor(1, 10), faixaDeCor(10, 10), faixaDeCor(5, 0)]).toEqual([0, 1, 5, 0]);
    expect(ranking(resumir(filtrar(paradas, F), locais), "produtivo").map((x) => x.local.nome)).toEqual(["ALTO FORNO 3"]);
    expect(ranking([], "produtivo")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: FAIL ("Failed to resolve import ./analise").

- [ ] **Step 3: Implementar**

```ts
// Mapa de análise (desenho: docs/superpowers/specs/2026-10-08-mapa-de-analise-design.md): as paradas dos últimos 30 dias
// (tabela analise_paradas, só fatos) viram números por local com as regras de produtividade.ts. Tudo puro; a tela só desenha.
import type { LatLng, TipoEquip, Veiculo } from "../tipos";
import { distanciaM } from "./geo";
import { ehBase, statusProdutivo } from "./produtividade";

/** Uma linha de analise_paradas. */
export interface ParadaAnalise {
  dia: string;
  veiculo_id: string;
  placa: string;
  /** segundos do dia */
  ini: number;
  fim: number;
  lat: number;
  lng: number;
  /** cerca do GAUSS (a menor); null = fora das cercas */
  area: string | null;
  /** minutos de cada status do motor do GAUSS durante a parada */
  motor: Record<string, number>;
  /** categorias do tablet que cobrem a parada */
  apont: string[];
}

export const CATEGORIAS_LOCAL = ["Serviço", "Espera/passagem", "Base", "Base/pernoite", "Oficina/apoio", "Descarte", "Abastecimento"] as const;
export type CategoriaLocal = (typeof CATEGORIAS_LOCAL)[number];
export const MEDIDAS = ["produtivo", "sem_produzir", "parado", "visitas", "categoria", "apontamento"] as const;
export type Medida = (typeof MEDIDAS)[number];
/** Medidas com número (as outras pintam por categoria ou apontamento). */
export type MedidaNumerica = Exclude<Medida, "categoria" | "apontamento">;
export const FAIXAS = ["madrugada", "manha", "tarde", "noite"] as const;
export type Faixa = (typeof FAIXAS)[number];
export const PERIODOS = ["7", "15", "30"] as const;
export type Periodo = (typeof PERIODOS)[number];

export interface EquipAnalise {
  id: string;
  nome: string;
  tipo: TipoEquip;
  supervisor: string | null;
  regime: string | null;
  /** status produtivo (statusProdutivo); null = o tipo não tem regra */
  produtivo: string | null;
}
export interface Local {
  /** nome da cerca, ou "ponto:N" fora das cercas */
  chave: string;
  nome: string;
  cerca: boolean;
  lat: number;
  lng: number;
  categoria: CategoriaLocal;
  /** produtivo aqui não conta (vira "motor ligado na base") */
  naBase: boolean;
}
export interface ParadaNoLocal extends ParadaAnalise {
  local: string;
  equip: EquipAnalise;
}
export interface FiltroAnalise {
  hoje: string;
  periodo: number;
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
  /** vazio = todas */
  faixas: Faixa[];
  /** 0 = domingo ... 6 = sábado; vazio = todos */
  diasSemana: number[];
}
export interface EquipNoLocal {
  id: string;
  nome: string;
  visitas: number;
  min: number;
  ultimoDia: string;
}
export interface ResumoLocal {
  local: Local;
  visitas: number;
  /** minutos */
  parado: number;
  produtivo: number;
  base: number;
  semProduzir: number;
  /** tempo parado dos equipamentos com regra (base do % produtivo) */
  paradoComRegra: number;
  porEquip: EquipNoLocal[];
  /** minutos parados pela hora de início (0–23) */
  porHora: number[];
  apont: { nome: string; n: number }[];
}

const RAIO_PONTO_M = 120;
const MIN_VISITAS_PONTO = 3;
const LIGADO = ["on", "stopped", "secondary_motor_on"];
const H = 3600;

function agruparPor<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}
const centro = (poly: LatLng[]): LatLng => [poly.reduce((n, p) => n + p[0], 0) / poly.length, poly.reduce((n, p) => n + p[1], 0) / poly.length];
const minutos = (p: ParadaAnalise) => (p.fim - p.ini) / 60;

/** Equipamentos da frota (matriz) que entram na análise, sem o motor 2º. */
export function equipDaFrota(veiculos: Veiculo[]): Map<string, EquipAnalise> {
  const m = new Map<string, EquipAnalise>();
  for (const v of veiculos) {
    if (v.motor2_de || !v.equip) continue;
    m.set(v.id, { id: v.id, nome: v.equip.nome, tipo: v.equip.tipo, supervisor: v.equip.supervisor ?? null, regime: v.equip.regime ?? null, produtivo: statusProdutivo(v.equip.tipo, v.placa) });
  }
  return m;
}

/** Faixa do dia pela hora de início da parada. */
export const faixaDe = (ini: number): Faixa => (ini < 6 * H ? "madrugada" : ini < 12 * H ? "manha" : ini < 18 * H ? "tarde" : "noite");
/** 0 = domingo ... 6 = sábado */
export const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
/** "AAAA-MM-DD" menos n dias */
export function diaMenos(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Categoria que o nome já diz (a mesma regra do classificar.js). */
export function categoriaPeloNome(nome: string): CategoriaLocal | null {
  const n = nome.toUpperCase();
  if (/P[ÁA]TIO DO TRANSPORTE|GARAGEM/.test(n)) return "Base";
  if (/ABAST|POSTO|COMBUST/.test(n)) return "Abastecimento";
  if (/BAIA DE RES|ATERRO|DESCARTE/.test(n)) return "Descarte";
  if (/OFICINA|ALMOXARIFADO|LAVADOR|LAVAGEM/.test(n)) return "Oficina/apoio";
  return null;
}

/**
 * Local de cada parada: a cerca do GAUSS ou, fora das cercas, um "ponto" (paradas a menos de 120 m vistas 3 ou mais vezes;
 * as outras ficam de fora). Só entram os equipamentos da frota. Pontos e categorias olham os 30 dias inteiros (sem filtros),
 * para não mudarem ao filtrar.
 */
export function montarLocais(paradas: ParadaAnalise[], areas: { name: string; polygon: LatLng[] }[], equip: Map<string, EquipAnalise>): { locais: Map<string, Local>; paradas: ParadaNoLocal[] } {
  const centroDe = new Map(areas.filter((a) => a.polygon.length >= 3).map((a) => [a.name, centro(a.polygon)] as const));
  const comEquip: ParadaNoLocal[] = paradas.flatMap((p) => {
    const e = equip.get(p.veiculo_id);
    return e ? [{ ...p, equip: e, local: p.area ?? "" }] : [];
  });

  // fora das cercas: grade de ~110 m, cada parada comparada só com os grupos das 9 casas vizinhas
  type Grupo = { lat: number; lng: number; soma: [number, number]; itens: ParadaNoLocal[] };
  const grupos: Grupo[] = [];
  const grade = new Map<string, Grupo[]>();
  for (const p of comEquip) {
    if (p.area) continue;
    const ci = Math.floor(p.lat / 0.001);
    const cj = Math.floor(p.lng / 0.001);
    let g: Grupo | null = null;
    for (let di = -1; di <= 1 && !g; di++) for (let dj = -1; dj <= 1 && !g; dj++) g = (grade.get(`${ci + di},${cj + dj}`) ?? []).find((x) => distanciaM(x, p) <= RAIO_PONTO_M) ?? null;
    if (g) {
      g.itens.push(p);
      g.soma[0] += p.lat;
      g.soma[1] += p.lng;
      g.lat = g.soma[0] / g.itens.length;
      g.lng = g.soma[1] / g.itens.length;
    } else {
      g = { lat: p.lat, lng: p.lng, soma: [p.lat, p.lng], itens: [p] };
      grupos.push(g);
      const k = `${ci},${cj}`;
      grade.set(k, [...(grade.get(k) ?? []), g]);
    }
  }
  const locais = new Map<string, Local>();
  let n = 0;
  for (const g of grupos.sort((a, b) => b.itens.length - a.itens.length)) {
    if (g.itens.length < MIN_VISITAS_PONTO) continue; // avulso: fica de fora (local "")
    const perto = [...centroDe].map(([nome, c]) => [nome, distanciaM(g, { lat: c[0], lng: c[1] })] as const).sort((a, b) => a[1] - b[1])[0];
    const chave = `ponto:${++n}`;
    locais.set(chave, { chave, nome: `Ponto ${n}${perto ? ` · perto de ${perto[0]} (${Math.round(perto[1])} m)` : ""}`, cerca: false, lat: g.lat, lng: g.lng, categoria: "Espera/passagem", naBase: false });
    for (const p of g.itens) p.local = chave;
  }
  const noLocal = comEquip.filter((p) => p.local);
  for (const p of noLocal) {
    if (!p.area || locais.has(p.area)) continue;
    const c = centroDe.get(p.area) ?? [p.lat, p.lng];
    locais.set(p.area, { chave: p.area, nome: p.area, cerca: true, lat: c[0], lng: c[1], categoria: "Espera/passagem", naBase: false });
  }

  // categoria: pelo nome; senão produz em 15%+ do tempo parado com motor = Serviço; parada média de 2 h+ = Base/pernoite
  for (const [chave, ps] of agruparPor(noLocal, (p) => p.local)) {
    const l = locais.get(chave)!;
    const comMotor = ps.filter((p) => p.equip.produtivo && Object.keys(p.motor).length);
    const minComMotor = comMotor.reduce((s, p) => s + minutos(p), 0);
    const prod = comMotor.reduce((s, p) => s + (p.motor[p.equip.produtivo!] ?? 0), 0);
    const media = ps.reduce((s, p) => s + minutos(p), 0) / ps.length;
    l.categoria = (l.cerca ? categoriaPeloNome(l.nome) : null) ?? (minComMotor && prod / minComMotor >= 0.15 ? "Serviço" : media >= 120 ? "Base/pernoite" : "Espera/passagem");
    l.naBase = l.categoria === "Base/pernoite" || (l.cerca && ehBase(l.nome));
  }
  return { locais, paradas: noLocal };
}

/** Minutos da parada: produtivo que conta, motor ligado na base e ligado sem produzir. null = o tipo não tem regra. */
export function valoresDaParada(p: ParadaNoLocal, naBase: boolean): { produtivo: number | null; base: number; semProduzir: number | null } {
  const cod = p.equip.produtivo;
  if (!cod) return { produtivo: null, base: 0, semProduzir: null };
  const ligado = LIGADO.reduce((n, c) => n + (p.motor[c] ?? 0), 0);
  const prod = p.motor[cod] ?? 0;
  return naBase ? { produtivo: 0, base: prod, semProduzir: ligado } : { produtivo: prod, base: 0, semProduzir: Math.max(0, ligado - prod) };
}

/** Paradas do período (últimos N dias até hoje) e dos filtros escolhidos. */
export function filtrar(paradas: ParadaNoLocal[], f: FiltroAnalise): ParadaNoLocal[] {
  const desde = diaMenos(f.hoje, f.periodo);
  return paradas.filter(
    (p) =>
      p.dia > desde &&
      p.dia <= f.hoje &&
      (!f.tipo || p.equip.tipo === f.tipo) &&
      (!f.supervisor || p.equip.supervisor === f.supervisor) &&
      (!f.regime || p.equip.regime === f.regime) &&
      (!f.faixas.length || f.faixas.includes(faixaDe(p.ini))) &&
      (!f.diasSemana.length || f.diasSemana.includes(diaDaSemana(p.dia))),
  );
}

/** Números de cada local com paradas (quem atende, horário, apontamentos). */
export function resumir(paradas: ParadaNoLocal[], locais: Map<string, Local>): ResumoLocal[] {
  const out: ResumoLocal[] = [];
  for (const [chave, ps] of agruparPor(paradas, (p) => p.local)) {
    const local = locais.get(chave);
    if (!local) continue;
    const r: ResumoLocal = { local, visitas: ps.length, parado: 0, produtivo: 0, base: 0, semProduzir: 0, paradoComRegra: 0, porEquip: [], porHora: Array<number>(24).fill(0), apont: [] };
    const eq = new Map<string, EquipNoLocal>();
    const ap = new Map<string, number>();
    for (const p of ps) {
      const min = minutos(p);
      const v = valoresDaParada(p, local.naBase);
      r.parado += min;
      r.base += v.base;
      if (v.produtivo != null) {
        r.produtivo += v.produtivo;
        r.semProduzir += v.semProduzir ?? 0;
        r.paradoComRegra += min;
      }
      r.porHora[Math.min(23, Math.floor(p.ini / H))] += min;
      const e = eq.get(p.equip.id) ?? { id: p.equip.id, nome: p.equip.nome, visitas: 0, min: 0, ultimoDia: p.dia };
      e.visitas++;
      e.min += min;
      if (p.dia > e.ultimoDia) e.ultimoDia = p.dia;
      eq.set(e.id, e);
      for (const a of p.apont) ap.set(a, (ap.get(a) ?? 0) + 1);
    }
    r.porEquip = [...eq.values()].sort((a, b) => b.min - a.min);
    r.apont = [...ap].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);
    out.push(r);
  }
  return out;
}

/** Número da medida (tipo de local e apontamento ordenam o ranking pelas visitas). */
export function valorDe(r: ResumoLocal, m: Medida): number {
  return m === "produtivo" ? r.produtivo : m === "sem_produzir" ? r.semProduzir : m === "parado" ? r.parado : r.visitas;
}
/** Faixa de cor 1–5 proporcional ao maior valor (0 = sem valor). */
export const faixaDeCor = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
/** Os n locais com mais da medida (só os que têm valor). */
export const ranking = (rs: ResumoLocal[], m: Medida, n = 10) =>
  rs
    .filter((r) => valorDe(r, m) > 0)
    .sort((a, b) => valorDe(b, m) - valorDe(a, m))
    .slice(0, n);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/analise.test.ts`
Expected: PASS (todos). Se a soma dos minutos do resumo divergir, corrigir o código, não o teste (os números do teste vêm do desenho).

- [ ] **Step 5: Verificar** — `npm run lint && npm run typecheck`.

---

### Task 3: Leitura das paradas (Supabase)

**Files:**
- Create: `src/lib/dados/analise.ts`
- Modify: `src/lib/dados/esquemas.ts` (validador novo no fim)
- Test: `src/lib/dados/analise.test.ts`

**Interfaces:**
- Consumes: `ParadaAnalise` (Tarefa 2); `db`, `ok` de `../supabase/cliente`; `validar` interno de `esquemas.ts`.
- Produces: `validarParadasAnalise(v: unknown): ParadaAnalise[]`; `lerParadasAnalise(c?): Promise<ParadaAnalise[]>`; `useParadasAnalise(): { paradas: ParadaAnalise[]; carregando: boolean; erro: string | null }`.

- [ ] **Step 1: Escrever os testes**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { lerParadasAnalise } from "./analise";

const linha = (i: number) => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: i, fim: i + 600, lat: -19.4, lng: -42.5, area: null, motor: { stopped: 10 }, apont: [] });
function falso(linhas: unknown[]) {
  const faixas: [number, number][] = [];
  const q = {
    select: () => q,
    order: () => q,
    range: async (de: number, ate: number) => {
      faixas.push([de, ate]);
      return { data: linhas.slice(de, ate + 1), error: null };
    },
  };
  return { c: { from: () => q } as unknown as SupabaseClient, faixas };
}

describe("lerParadasAnalise", () => {
  it("lê em páginas de 1000 até acabar", async () => {
    const f = falso(Array.from({ length: 2300 }, (_, i) => linha(i)));
    expect(await lerParadasAnalise(f.c)).toHaveLength(2300);
    expect(f.faixas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("tabela vazia = lista vazia", async () => {
    expect(await lerParadasAnalise(falso([]).c)).toEqual([]);
  });
  it("formato inesperado avisa em vez de quebrar em silêncio", async () => {
    await expect(lerParadasAnalise(falso([{ dia: "2026-10-01" }]).c)).rejects.toThrow(/formato inesperado/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dados/analise.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Validador em `esquemas.ts`** (acrescentar no fim do arquivo; o `import type` vai junto dos outros imports no topo)

```ts
import type { ParadaAnalise } from "../dominio/analise";

const paradaAnalise = z.looseObject({
  dia: z.string(), veiculo_id: z.string(), placa: z.string(), ini: z.number(), fim: z.number(), lat: z.number(), lng: z.number(),
  area: z.string().nullable(), motor: z.record(z.string(), z.number()), apont: z.array(z.string()),
});
export const validarParadasAnalise = (v: unknown): ParadaAnalise[] => validar<ParadaAnalise[]>(z.array(paradaAnalise), v ?? [], "Paradas da análise");
```

- [ ] **Step 4: `src/lib/dados/analise.ts`**

```ts
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { ParadaAnalise } from "../dominio/analise";
import { db, ok } from "../supabase/cliente";
import { validarParadasAnalise } from "./esquemas";

// 30 dias ≈ 11 mil paradas; o Supabase entrega no máximo 1000 linhas por consulta
const PAGINA = 1000;
const MAX = 30000;

/** Todas as paradas guardadas (a tabela só tem os últimos 30 dias), em páginas. */
export async function lerParadasAnalise(c: SupabaseClient = db()): Promise<ParadaAnalise[]> {
  const out: ParadaAnalise[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    // id desempata: as páginas não repetem nem pulam linhas
    const pag = (await ok(c.from("analise_paradas").select("dia, veiculo_id, placa, ini, fim, lat, lng, area, motor, apont").order("id").range(de, de + PAGINA - 1))) as unknown[];
    out.push(...validarParadasAnalise(pag));
    if (pag.length < PAGINA) break;
  }
  return out;
}

let cache: Promise<ParadaAnalise[]> | null = null;
/** Uma leitura por aba (os dados mudam uma vez por dia). Falha não fica guardada. */
function emCache(): Promise<ParadaAnalise[]> {
  cache ??= lerParadasAnalise().catch((e: unknown) => {
    cache = null;
    throw e;
  });
  return cache;
}

export function useParadasAnalise(): { paradas: ParadaAnalise[]; carregando: boolean; erro: string | null } {
  const [estado, setEstado] = useState<{ paradas: ParadaAnalise[]; carregando: boolean; erro: string | null }>({ paradas: [], carregando: true, erro: null });
  useEffect(() => {
    let vivo = true;
    emCache().then(
      (paradas) => vivo && setEstado({ paradas, carregando: false, erro: null }),
      (e: unknown) => vivo && setEstado({ paradas: [], carregando: false, erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}
```

- [ ] **Step 5: Rodar e ver passar** — `npx vitest run src/lib/dados/analise.test.ts` → PASS; depois `npm run lint && npm run typecheck`.

---

### Task 4: Tela "Análise" (mapa, filtros, ranking, painel) + menu + e2e

**Files:**
- Create: `src/app/analise/page.tsx`, `src/app/analise/_componentes/analise.tsx`, `src/app/analise/_componentes/camada-analise.ts`, `src/app/analise/_componentes/cores-analise.ts`, `src/app/analise/_componentes/filtros.tsx`, `src/app/analise/_componentes/ranking.tsx`, `src/app/analise/_componentes/painel-local.tsx`
- Modify: `src/lib/menu.ts` (item novo), `src/components/icones.tsx` (ícone `analise`), `e2e/apoio.ts` (dados sintéticos e opção `analise`)
- Test: `e2e/analise.spec.ts`

**Interfaces:**
- Consumes: tudo da Tarefa 2; `useParadasAnalise` (Tarefa 3); `useMapa` (`@/components/mapa/use-mapa`), `Legenda` (`@/components/mapa/legenda`, props `itens: { rotulo; cor; tracejado? }[]`), `Gaveta` (`@/components/gaveta`, um `<dialog>`), `Campos`, `Chip`, `Segmentado`, `Selecao`, `Aviso`, `Vazio`, `cx` (`@/components/ui`), `lerCercas`, `useRetrato`, `useOpcao`, `useCelular`, `diaLocal`, `fmtHoras` (minutos → "1h20"), `esc` (`@/lib/mapa/marcador`), `TIPOS_EQUIP`, `ORDEM_TIPOS`.
- Produces: rota `/analise/`.

- [ ] **Step 1: Dados sintéticos no `e2e/apoio.ts`**

Acrescentar depois de `tablet()`:

```ts
/** Paradas da análise (analise_paradas): ontem, no PATIO e na OFICINA, do caminhão 10 (Alta Pressão) e do aspirador 40. */
export const paradasAnalise = () => {
  const d = new Date(Date.now() - 86400000);
  const ontem = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const p = (veiculo_id: string, placa: string, ini: number, area: string, lat: number, lng: number, motor: Record<string, number>, apont: string[] = []) =>
    ({ dia: ontem, veiculo_id, placa, ini, fim: ini + 3600, lat, lng, area, motor, apont });
  return [
    p("10", "EGC2985", 8 * 3600, "OFICINA", -19.475, -42.525, { secondary_motor_on: 40, stopped: 20 }, ["Aguardando Área"]),
    p("10", "EGC2985", 14 * 3600, "PATIO", -19.48, -42.53, { stopped: 60 }),
    p("40", "ASP12", 9 * 3600, "PATIO", -19.4805, -42.5305, { stopped: 60 }),
    // fora da frota: não pode aparecer
    p("90", "EOF5208", 9 * 3600, "PATIO", -19.479, -42.529, { secondary_motor_on: 60 }),
  ];
};
```

Em `prepararDados`, aceitar `analise` nas opções e responder a tabela (antes do `return json([])` final):

```ts
export async function prepararDados(page: Page, opcoes: { matriz?: ReturnType<typeof matrizBanco>; analise?: unknown[] } = {}): Promise<string[]> {
  ...
    if (tabela === "analise_paradas") return json(opcoes.analise ?? paradasAnalise());
```

- [ ] **Step 2: Escrever o e2e `e2e/analise.spec.ts`**

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

/** No celular os filtros e o ranking ficam atrás do botão "Filtros". */
async function abrirFiltros(page: import("@playwright/test").Page) {
  const botao = page.getByRole("button", { name: "Filtros" });
  if (await botao.isVisible()) await botao.click();
}

test("Análise: ranking pela medida, filtro por tipo e quem atende a área", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await abrirFiltros(page);
  const ranking = page.getByRole("list", { name: "Ranking" });
  // produtivo (padrão): só a OFICINA tem motor 2º do caminhão de Alta Pressão
  await expect(ranking).toContainText("OFICINA");
  await expect(ranking).not.toContainText("PATIO");
  // tempo parado: o PATIO (2 paradas da frota) passa na frente; a placa de fora da frota não conta
  await page.getByLabel("Medida").selectOption("parado");
  await expect(ranking.getByRole("button").first()).toContainText("PATIO");
  await page.getByLabel("Tipo").selectOption("as");
  await expect(ranking).not.toContainText("OFICINA");
  await page.getByLabel("Tipo").selectOption("");
  await ranking.getByRole("button", { name: /PATIO/ }).click();
  const painel = page.getByRole("dialog", { name: /PATIO/ });
  await expect(painel.getByRole("list", { name: "Quem atende" })).toContainText("EGC-2985");
  await expect(painel).not.toContainText("EOF5208");
  await painel.getByRole("link", { name: /EGC-2985/ }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});

test("Análise: sem histórico enviado, avisa em vez de quebrar", async ({ page }) => {
  await prepararDados(page, { analise: [] });
  await page.goto("/analise/");
  await expect(page.getByText("O histórico ainda não foi enviado")).toBeVisible();
});
```

> O nome do equipamento vem da matriz de exemplo (`matrizExemplo`): o caminhão 10 é "EGC-2985". O teste não depende do nome do aspirador.

- [ ] **Step 3: Rodar e ver falhar** — `npx playwright test e2e/analise.spec.ts` → FAIL (404 em /analise/).

- [ ] **Step 4: Menu e ícone**

`src/components/icones.tsx`: incluir `"analise"` em `IconeNome` e o caminho (barras):

```ts
  analise: "M4 20V11M10 20V5M16 20v-6M2 20h20",
```

`src/lib/menu.ts`, depois de "Dia da frota":

```ts
  { href: "/analise", rotulo: "Análise", curto: "Análise", icone: "analise" },
```

- [ ] **Step 5: Cores (`cores-analise.ts`)**

```ts
import { fmtHoras } from "@/lib/dominio/formato";
import type { CategoriaLocal, Medida, MedidaNumerica, ResumoLocal } from "@/lib/dominio/analise";

/** Nome de cada medida no filtro e na legenda. */
export const ROTULO_MEDIDA: Record<Medida, string> = {
  produtivo: "Produtivo",
  sem_produzir: "Parado ligado sem produzir",
  parado: "Tempo parado",
  visitas: "Visitas",
  categoria: "Tipo de local",
  apontamento: "Apontamento do tablet",
};
/** 5 faixas do claro ao escuro por medida (a cor nunca vem sozinha: balão, ranking e legenda dão o número). */
export const ESCALAS: Record<MedidaNumerica, string[]> = {
  produtivo: ["#d9f2e3", "#a3dcb9", "#5fbf8a", "#2a9a62", "#0f6b40"],
  sem_produzir: ["#fde5cc", "#fbbd84", "#f48d45", "#d9621c", "#9a3f0c"],
  parado: ["#dbe9f8", "#a9c9ee", "#6ea3df", "#3a78c4", "#1d4f8f"],
  visitas: ["#ece2f7", "#cdb4ec", "#a685d8", "#7b57bb", "#523388"],
};
export const COR_CATEGORIA: Record<CategoriaLocal, string> = {
  "Serviço": "#16a34a",
  "Espera/passagem": "#f59e0b",
  Base: "#475569",
  "Base/pernoite": "#94a3b8",
  "Oficina/apoio": "#8b5cf6",
  Descarte: "#a16207",
  Abastecimento: "#0ea5e9",
};
const PALETA_APONT = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];
/** Cor fixa por apontamento (o mesmo nome sempre na mesma cor). */
export function corDoApontamento(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA_APONT[h % PALETA_APONT.length];
}
export const numerica = (m: Medida): m is MedidaNumerica => m !== "categoria" && m !== "apontamento";
/** Valor da medida em texto ("12h 30 produtivo", "8 visitas", "Serviço"). */
export function rotuloValor(r: ResumoLocal, m: Medida): string {
  if (m === "produtivo") return `${fmtHoras(r.produtivo)} produtivo`;
  if (m === "sem_produzir") return `${fmtHoras(r.semProduzir)} parado ligado sem produzir`;
  if (m === "parado") return `${fmtHoras(r.parado)} parado`;
  if (m === "visitas") return `${r.visitas} ${r.visitas === 1 ? "visita" : "visitas"}`;
  if (m === "categoria") return r.local.categoria;
  return r.apont[0] ? `${r.apont[0].nome} (${r.apont[0].n})` : "sem apontamento";
}
```

- [ ] **Step 6: Desenho no mapa (`camada-analise.ts`)**

```ts
import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { faixaDeCor, valorDe, type Medida, type ResumoLocal } from "@/lib/dominio/analise";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import { COR_CATEGORIA, ESCALAS, corDoApontamento, numerica, rotuloValor } from "./cores-analise";

const SEM_DADO = "#94a3b8";

/**
 * Cercas pintadas pela medida (5 faixas do claro ao escuro) e pontos sem cerca como círculos. Passar o mouse = nome e
 * valor; clicar = abre o painel. Cerca sem parada no filtro fica só com o contorno.
 */
export function desenharAnalise(
  L: L,
  camada: Leaflet.LayerGroup,
  o: { areas: { name: string; polygon: LatLng[] }[]; resumos: ResumoLocal[]; medida: Medida; sel: string | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  const porChave = new Map(o.resumos.map((r) => [r.local.chave, r]));
  const max = Math.max(0, ...o.resumos.map((r) => valorDe(r, o.medida)));
  const cor = (r: ResumoLocal | undefined): string | null => {
    if (!r) return null;
    if (o.medida === "categoria") return COR_CATEGORIA[r.local.categoria];
    if (o.medida === "apontamento") return r.apont[0] ? corDoApontamento(r.apont[0].nome) : null;
    const f = numerica(o.medida) ? faixaDeCor(valorDe(r, o.medida), max) : 0;
    return f && numerica(o.medida) ? ESCALAS[o.medida][f - 1] : null;
  };
  const dica = (nome: string, r: ResumoLocal | undefined) => `<b>${esc(nome)}</b><br>${r ? esc(rotuloValor(r, o.medida)) : "sem paradas neste filtro"}`;

  for (const a of o.areas) {
    if (a.polygon.length < 3) continue;
    const r = porChave.get(a.name);
    const c = cor(r);
    const sel = a.name === o.sel;
    L.polygon(a.polygon, { color: sel ? "#ffffff" : (c ?? SEM_DADO), weight: sel ? 3 : 1, fillColor: c ?? SEM_DADO, fillOpacity: c ? 0.65 : 0.04 })
      .bindTooltip(dica(a.name, r), { sticky: true, className: "rotulo-cerca" })
      .on("click", () => r && o.aoClicar(a.name))
      .addTo(camada);
  }
  // pontos sem cerca e cercas que não existem mais (sem polígono): círculo na posição
  const comPoligono = new Set(o.areas.filter((a) => a.polygon.length >= 3).map((a) => a.name));
  for (const r of o.resumos) {
    if (r.local.cerca && comPoligono.has(r.local.chave)) continue;
    const sel = r.local.chave === o.sel;
    L.circleMarker([r.local.lat, r.local.lng], { radius: 8, color: sel ? "#ffffff" : "#1f2937", weight: sel ? 3 : 1, fillColor: cor(r) ?? SEM_DADO, fillOpacity: 0.9 })
      .bindTooltip(dica(r.local.nome, r), { sticky: true, className: "rotulo-cerca" })
      .on("click", () => o.aoClicar(r.local.chave))
      .addTo(camada);
  }
}
```

- [ ] **Step 7: Filtros (`filtros.tsx`)**

```tsx
"use client";

import { Chip, Segmentado, Selecao } from "@/components/ui";
import { FAIXAS, MEDIDAS, PERIODOS, type EquipAnalise, type Faixa, type Medida, type Periodo } from "@/lib/dominio/analise";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import type { TipoEquip } from "@/lib/tipos";
import { ROTULO_MEDIDA } from "./cores-analise";

const ROTULO_FAIXA: Record<Faixa, string> = { madrugada: "Madrugada", manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOME_DIA = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const alternar = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
const distintos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

export interface EstadoFiltros {
  medida: Medida;
  periodo: Periodo;
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
  faixas: Faixa[];
  diasSemana: number[];
}

/** Funil da Análise: medida, período, tipo, supervisor, regime, faixa do dia e dia da semana. */
export function Filtros({ f, mudar, equip }: { f: EstadoFiltros; mudar: (p: Partial<EstadoFiltros>) => void; equip: EquipAnalise[] }) {
  return (
    <div className="space-y-2.5">
      <Selecao aria-label="Medida" value={f.medida} onChange={(e) => mudar({ medida: e.target.value as Medida })} className="w-full">
        {MEDIDAS.map((m) => (
          <option key={m} value={m}>
            {ROTULO_MEDIDA[m]}
          </option>
        ))}
      </Selecao>
      <Segmentado rotulo="Período" valor={f.periodo} mudar={(p) => mudar({ periodo: p })} opcoes={PERIODOS.map((p) => ({ id: p, rotulo: `${p} dias` }))} />
      <div className="grid grid-cols-3 gap-2">
        <Selecao aria-label="Tipo" value={f.tipo ?? ""} onChange={(e) => mudar({ tipo: (e.target.value || null) as TipoEquip | null })}>
          <option value="">Todos os tipos</option>
          {ORDEM_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPOS_EQUIP[t].rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Supervisor" value={f.supervisor ?? ""} onChange={(e) => mudar({ supervisor: e.target.value || null })}>
          <option value="">Supervisor</option>
          {distintos(equip.map((e) => e.supervisor)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
        <Selecao aria-label="Regime" value={f.regime ?? ""} onChange={(e) => mudar({ regime: e.target.value || null })}>
          <option value="">Regime</option>
          {distintos(equip.map((e) => e.regime)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
      </div>
      <div role="group" aria-label="Hora do dia" className="flex flex-wrap gap-1.5">
        {FAIXAS.map((x) => (
          <Chip key={x} ativo={f.faixas.includes(x)} onClick={() => mudar({ faixas: alternar(f.faixas, x) })}>
            {ROTULO_FAIXA[x]}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label="Dia da semana" className="flex flex-wrap gap-1.5">
        {DIAS.map((d, i) => (
          <span key={i} title={NOME_DIA[i]}>
            <Chip ativo={f.diasSemana.includes(i)} onClick={() => mudar({ diasSemana: alternar(f.diasSemana, i) })}>
              {d}
            </Chip>
          </span>
        ))}
      </div>
      <p className="text-[11px] text-suave">Hora e dia: nenhum marcado = todos. A hora é a do início da parada.</p>
    </div>
  );
}
```

- [ ] **Step 8: Ranking (`ranking.tsx`)**

```tsx
"use client";

import { ranking, valorDe, type Medida, type ResumoLocal } from "@/lib/dominio/analise";
import { rotuloValor } from "./cores-analise";

/** As 10 áreas com mais da medida; clicar centraliza o mapa e abre o painel. */
export function Ranking({ resumos, medida, abrir }: { resumos: ResumoLocal[]; medida: Medida; abrir: (r: ResumoLocal) => void }) {
  const top = ranking(resumos, medida);
  const max = top[0] ? valorDe(top[0], medida) : 0;
  if (!top.length) return <p className="text-xs text-suave">Nenhuma área com paradas neste filtro.</p>;
  return (
    <ol aria-label="Ranking" className="space-y-1">
      {top.map((r, i) => (
        <li key={r.local.chave}>
          <button type="button" onClick={() => abrir(r)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-superficie-2">
            <span className="flex items-baseline gap-2 text-[13px]">
              <b className="w-4 shrink-0 text-suave">{i + 1}</b>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.local.nome}</span>
            </span>
            <span className="ml-6 block text-xs text-suave">{rotuloValor(r, medida)}</span>
            <span className="ml-6 mt-0.5 block h-1 overflow-hidden rounded bg-superficie-2">
              <span className="block h-full bg-primaria" style={{ width: `${max ? (valorDe(r, medida) / max) * 100 : 0}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
```

> Usa `<ol aria-label="Ranking">`: o e2e procura `getByRole("list", { name: "Ranking" })`.

- [ ] **Step 9: Painel da área (`painel-local.tsx`)**

```tsx
"use client";

import Link from "next/link";
import { Gaveta } from "@/components/gaveta";
import { Campos } from "@/components/ui";
import { fmtHoras } from "@/lib/dominio/formato";
import type { ResumoLocal } from "@/lib/dominio/analise";

/** Detalhe da área: totais, quem atende (cada um abre a Timeline do último dia lá), horário e apontamentos. */
export function PainelLocal({ r, fechar }: { r: ResumoLocal; fechar: () => void }) {
  const pct = r.paradoComRegra ? Math.round((r.produtivo / r.paradoComRegra) * 100) : null;
  const maxHora = Math.max(1, ...r.porHora);
  return (
    <Gaveta titulo={r.local.nome} sub={`${r.local.categoria}${r.local.cerca ? "" : " · ponto sem cerca"}`} fechar={fechar} modal={false} rotulo={r.local.nome}>
      <div className="space-y-4 p-4">
        <Campos
          itens={[
            ["Produtivo", fmtHoras(r.produtivo)],
            ["Parado ligado sem produzir", fmtHoras(r.semProduzir)],
            ...(r.base >= 1 ? ([["Motor ligado na base", fmtHoras(r.base)]] as [string, string][]) : []),
            ["Tempo parado", fmtHoras(r.parado)],
            ["Visitas", String(r.visitas)],
            ["% produtivo", pct == null ? "—" : `${pct}%`],
          ]}
        />
        <p className="text-[11px] text-suave">Hiper Vácuo, Brook e Aspiradores não têm regra de produtividade: entram só no tempo parado e nas visitas.</p>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-suave">Quem atende</h3>
          <ul aria-label="Quem atende" className="divide-y divide-borda rounded-lg border border-borda">
            {r.porEquip.map((e) => (
              <li key={e.id}>
                <Link href={`/timeline/?v=${encodeURIComponent(e.id)}&dia=${e.ultimoDia}`} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:bg-superficie-2 hover:no-underline">
                  <b className="text-texto">{e.nome}</b>
                  <span className="text-xs text-suave">
                    {e.visitas} {e.visitas === 1 ? "visita" : "visitas"} · {fmtHoras(e.min)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-suave">Horário (início das paradas)</h3>
          <div role="img" aria-label="Tempo parado por hora do dia" className="flex h-16 items-end gap-px">
            {r.porHora.map((m, h) => (
              <span key={h} title={`${h}h: ${fmtHoras(m)}`} className="flex-1 rounded-t bg-primaria/70" style={{ height: `${(m / maxHora) * 100}%` }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-suave">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>24h</span>
          </div>
        </section>
        {r.apont.length > 0 && (
          <section>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-suave">Apontamentos do tablet</h3>
            <ul className="space-y-0.5 text-[13px]">
              {r.apont.slice(0, 6).map((a) => (
                <li key={a.nome} className="flex justify-between gap-2">
                  <span>{a.nome}</span>
                  <span className="text-suave">{a.n}×</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Gaveta>
  );
}
```

> A `Gaveta` é um `<dialog aria-label={rotulo}>`: o e2e acha o painel com `getByRole("dialog", { name: /PATIO/ })`.

- [ ] **Step 10: Tela (`analise.tsx`) e página**

`src/app/analise/page.tsx`:

```tsx
import { Analise } from "./_componentes/analise";

export default function Pagina() {
  return <Analise />;
}
```

`src/app/analise/_componentes/analise.tsx`:

```tsx
"use client";

import type * as Leaflet from "leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaixaLeitura } from "@/components/indicador-vivo";
import { Legenda } from "@/components/mapa/legenda";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Vazio, cx } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import { CATEGORIAS_LOCAL, MEDIDAS, PERIODOS, equipDaFrota, filtrar, montarLocais, resumir, valorDe, type Medida, type Periodo, type ResumoLocal } from "@/lib/dominio/analise";
import { diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { useCelular, useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { desenharAnalise } from "./camada-analise";
import { COR_CATEGORIA, ESCALAS, ROTULO_MEDIDA, corDoApontamento, numerica } from "./cores-analise";
import { Filtros, type EstadoFiltros } from "./filtros";
import { PainelLocal } from "./painel-local";
import { Ranking } from "./ranking";

/** Mapa de análise: as áreas pintadas pela medida escolhida, com filtros, ranking e o painel "quem atende". */
export function Analise() {
  const { retrato } = useRetrato();
  const { paradas, carregando, erro } = useParadasAnalise();
  const celular = useCelular();
  const { ref, pronto } = useMapa(14);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [hoje] = useState(() => diaLocal());
  const [medida, setMedida] = useOpcao<Medida>("mon-analise-medida", MEDIDAS, "produtivo");
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  const [resto, setResto] = useState<Omit<EstadoFiltros, "medida" | "periodo">>({ tipo: null, supervisor: null, regime: null, faixas: [], diasSemana: [] });
  const [sel, setSel] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const areas = useMemo(() => cercas.filter((c) => c.tipo === "area"), [cercas]);
  const equip = useMemo(() => equipDaFrota(retrato?.veiculos ?? []), [retrato]);
  const base = useMemo(() => montarLocais(paradas, areas, equip), [paradas, areas, equip]);
  const resumos = useMemo(() => resumir(filtrar(base.paradas, { hoje, periodo: Number(periodo), ...resto }), base.locais), [base, hoje, periodo, resto]);
  const rSel = sel ? (resumos.find((r) => r.local.chave === sel) ?? null) : null;
  const f: EstadoFiltros = { medida, periodo, ...resto };
  const mudar = (p: Partial<EstadoFiltros>) => {
    const { medida: m, periodo: per, ...outros } = p;
    if (m) setMedida(m);
    if (per) setPeriodo(per);
    if (Object.keys(outros).length) setResto((r) => ({ ...r, ...outros }));
  };

  useEffect(() => {
    if (!pronto) return;
    const g = pronto.L.layerGroup().addTo(pronto.mapa);
    camada.current = g;
    return () => void g.remove();
  }, [pronto]);
  useEffect(() => {
    if (pronto && camada.current) desenharAnalise(pronto.L, camada.current, { areas, resumos, medida, sel, aoClicar: setSel });
  }, [pronto, areas, resumos, medida, sel]);

  const abrir = (r: ResumoLocal) => {
    setSel(r.local.chave);
    if (celular) setAberto(false);
    pronto?.mapa.flyTo([r.local.lat, r.local.lng], Math.max(pronto.mapa.getZoom(), 16), { duration: 0.6 });
  };

  const legenda = useMemo(() => {
    if (medida === "categoria") return CATEGORIAS_LOCAL.map((c) => ({ rotulo: c, cor: COR_CATEGORIA[c] }));
    if (medida === "apontamento") {
      const nomes = [...new Set(resumos.map((r) => r.apont[0]?.nome).filter((x): x is string => !!x))].slice(0, 8);
      return nomes.map((n) => ({ rotulo: n, cor: corDoApontamento(n) }));
    }
    if (!numerica(medida)) return [];
    const max = Math.max(0, ...resumos.map((r) => valorDe(r, medida)));
    const fmt = (v: number) => (medida === "visitas" ? String(Math.round(v)) : fmtHoras(v));
    return ESCALAS[medida].map((cor, i) => ({ rotulo: `até ${fmt((max * (i + 1)) / 5)}`, cor }));
  }, [medida, resumos]);

  const vazio = !carregando && !erro && !paradas.length;
  const painelFiltros = (
    <div className="space-y-3">
      <Filtros f={f} mudar={mudar} equip={[...equip.values()]} />
      <div>
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-suave">Ranking · {ROTULO_MEDIDA[medida]}</h2>
        <Ranking resumos={resumos} medida={medida} abrir={abrir} />
      </div>
    </div>
  );

  return (
    <div className="altura-tela flex flex-col">
      <FaixaLeitura />
      <div className="relative min-h-0 flex-1 md:p-3">
        <div className="relative h-full overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md">
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={legenda} />
          {celular ? (
            <button type="button" onClick={() => setAberto((a) => !a)} className="absolute left-3 top-3 z-[600] rounded-lg border border-borda bg-superficie px-3 py-2 text-sm font-semibold shadow-md">
              Filtros
            </button>
          ) : null}
          {(!celular || aberto) && (
            <div role="region" aria-label="Filtros da análise" className={cx("absolute z-[600] overflow-y-auto rounded-xl border border-borda bg-superficie p-3 shadow-xl", celular ? "inset-x-3 top-14 max-h-[70%]" : "left-3 top-3 max-h-[calc(100%-24px)] w-[340px]")}>
              {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
              {carregando && <p className="text-xs text-suave">Carregando o histórico…</p>}
              {!vazio && painelFiltros}
            </div>
          )}
          {vazio && (
            <div className="absolute inset-x-3 top-1/3 z-[600] mx-auto max-w-md rounded-xl border border-borda bg-superficie p-4 shadow-xl">
              <Vazio titulo="O histórico ainda não foi enviado">Rode o “Enviar Historico ao Site.bat” no PC.</Vazio>
            </div>
          )}
        </div>
      </div>
      {rSel && <PainelLocal key={rSel.local.chave} r={rSel} fechar={() => setSel(null)} />}
    </div>
  );
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `npx playwright test e2e/analise.spec.ts`
Expected: PASS em computador e celular. Depois o e2e inteiro (`npm run e2e`) para conferir que o menu novo não quebrou as outras telas.

- [ ] **Step 12: Verificar** — `npm run lint && npm run typecheck && npm test`.

---

### Task 5: Envio único do histórico do PC

**Files:**
- Modify: `automation/historico/classificar.js` (extrair `paradasDoHistorico()` e só rodar `main()` quando chamado direto)
- Create: `automation/historico/enviar.js`, `automation/Enviar Historico ao Site.bat`

**Interfaces:**
- Consumes: `supabase` de `automation/supabase-client.js` (lê o `.env` sozinho; nunca abrir o `.env`).
- Produces: `paradasDoHistorico(): { frota, areas, todas, kmPorEquip, diasPorEquip }` — `todas` com `area` = cerca ou `null` (antes de agrupar os pontos).

- [ ] **Step 1: Extrair a leitura no `classificar.js`**

Mover o trecho de `main()` desde `if (!existsSync(join(PASTA, 'frota.json')))` até o fim do laço `for (const dia of dias) {...}` para:

```js
/** Paradas de todos os dias baixados (area = cerca do GAUSS ou null), antes de agrupar os pontos sem cerca. */
export function paradasDoHistorico() {
  if (!existsSync(join(PASTA, 'frota.json'))) throw new Error('nada baixado ainda: rode antes o "Baixar Historico.bat"');
  const frota = JSON.parse(readFileSync(join(PASTA, 'frota.json'), 'utf-8'));
  const areas = JSON.parse(readFileSync(join(PASTA, 'cercas.json'), 'utf-8')).filter((c) => c.tipo === 'area' && c.polygon?.length > 2);
  const dias = readdirSync(PASTA).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  console.log(`${dias.length} dia(s), ${frota.length} equipamentos, ${areas.length} áreas`);
  const todas = [];
  const kmPorEquip = new Map();
  const diasPorEquip = new Map();
  for (const dia of dias) {
    // ... (o laço atual, sem mudanças)
  }
  return { frota, areas, todas, kmPorEquip, diasPorEquip };
}

function main() {
  mkdirSync(SAIDA, { recursive: true });
  const { frota, areas, todas, kmPorEquip, diasPorEquip } = paradasDoHistorico();
  // ... (o resto do main atual, sem mudanças)
}
```

E trocar a chamada final `main();` por:

```js
import { pathToFileURL } from 'url';
// só roda sozinho quando chamado direto (o enviar.js importa paradasDoHistorico)
if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
```

(o `import` vai junto dos outros no topo).

- [ ] **Step 2: Conferir que nada mudou nas planilhas**

Run (em `automation/`): copiar `data/historico/saida/locais.csv` para o scratchpad, rodar `node historico/classificar.js`, comparar com `cmp`.
Expected: mesma contagem ("5466 paradas, 122 locais") e arquivos iguais.

- [ ] **Step 3: `enviar.js`**

```js
// Envia ao site (Supabase, tabela analise_paradas) as paradas do histórico baixado: só os últimos 30 dias e só fatos
// (onde, quando, minutos de cada status do motor, apontamentos do tablet). As regras ficam no site.
// Nenhuma consulta ao GAUSS. Reenviar o mesmo dia substitui (chave dia + veículo + início).
//
// Uso: node --env-file=.env historico/enviar.js          (ou "Enviar Historico ao Site.bat")
//      node historico/enviar.js --teste                  (só conta e mostra um exemplo; não envia nada)
import { paradasDoHistorico } from './classificar.js';

const DIAS = 30;
const LOTE = 500;
const hoje = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const d = new Date(`${hoje}T12:00:00Z`);
d.setUTCDate(d.getUTCDate() - DIAS);
const desde = d.toISOString().slice(0, 10);
const um = (x) => Math.round(x * 10) / 10;

const { todas } = paradasDoHistorico();
const linhas = todas
  .filter((p) => p.dia > desde)
  .map((p) => ({
    dia: p.dia,
    veiculo_id: String(p.v.id),
    placa: p.v.placa,
    ini: Math.round(p.ini),
    fim: Math.round(p.fim),
    lat: p.pos[0],
    lng: p.pos[1],
    area: p.area,
    motor: Object.fromEntries(Object.entries(p.st).map(([k, m]) => [k, um(m)])),
    apont: p.apont,
  }));
const diasEnviados = [...new Set(linhas.map((l) => l.dia))].sort();
console.log(`${linhas.length} paradas de ${diasEnviados.length} dia(s) (${diasEnviados[0] ?? '-'} a ${diasEnviados.at(-1) ?? '-'}); só depois de ${desde}`);

if (process.argv.includes('--teste')) {
  console.log('modo teste: nada enviado. Exemplo:', JSON.stringify(linhas[0]));
} else {
  const { supabase } = await import('../supabase-client.js');
  for (let i = 0; i < linhas.length; i += LOTE) {
    const { error } = await supabase.from('analise_paradas').upsert(linhas.slice(i, i + LOTE), { onConflict: 'dia,veiculo_id,ini' });
    if (error) throw new Error(`Supabase (analise_paradas): ${error.message}`);
    console.log(`  ${Math.min(i + LOTE, linhas.length)}/${linhas.length}`);
  }
  console.log('✅ enviado. Abra a tela Análise do site.');
}
```

- [ ] **Step 4: `.bat`**

```bat
@echo off
cd /d "%~dp0"
title Enviando historico ao site - GAUSS FLEET
echo Envia ao site (Supabase) as paradas dos ultimos 30 dias do historico baixado. Nao consulta o GAUSS.
echo.
node --env-file=.env historico\enviar.js
echo.
pause
```

- [ ] **Step 5: Testar sem enviar**

Run (em `automation/`): `node historico/enviar.js --teste`
Expected: "N paradas de 15 dia(s) (2026-09-22 a 2026-10-06)..." (ou a partir de 2026-09-09 se houver) e um exemplo com `area` texto ou `null`, `motor` com números e `apont` lista. **Não** rodar sem `--teste`: o envio de verdade é do dono, depois de rodar o SQL.

---

### Task 6: Documentação e verificação final

**Files:**
- Modify: `README.md` (item 12 nos Pontos de atenção; linha da tabela de Arquitetura), `../../LEIA-ME.md` (tela Análise e o `.bat` novo)

- [ ] **Step 1: README — item 12**

```md
12. **Mapa de análise** (`/analise`, decisão do dono, 08/10/2026): o mapa da Usiminas com cada área pintada pela medida (produtivo, parado ligado sem produzir, tempo parado, visitas, tipo de local, apontamento), filtros (período, tipo, supervisor, regime, hora, dia da semana), ranking e "quem atende". Lê a tabela `analise_paradas` (`supabase/analise.sql`): **só fatos** (uma linha por parada), **no máximo 30 dias** (limpeza diária pelo pg_cron); as regras ficam em `src/lib/dominio/analise.ts`. Hoje é alimentada pelo PC (`automation/Enviar Historico ao Site.bat`, sem consultar o GAUSS). **Próximo passo:** o coletor baixar toda madrugada as rotas de ontem e guardar as cruas no R2 (bucket novo), gravando o resumo na mesma tabela.
```

Na tabela de Arquitetura, depois de `src/app/frota/`:

```md
| `src/app/analise/` | Mapa de análise: áreas pintadas pela medida, filtros, ranking e painel "quem atende" (`analise_paradas`, 30 dias) |
```

- [ ] **Step 2: LEIA-ME** — na lista do sistema 1, acrescentar "**Análise (desde 08/10/2026):** mapa das áreas com produtivo, parado ligado sem produzir, quem atende..." e no mapa de pastas a linha `Enviar Historico ao Site.bat  manda as paradas dos últimos 30 dias para a tela Análise`.

- [ ] **Step 3: Verificação completa**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`
Expected: tudo verde (os 3 e2e pulados de propósito continuam pulados).

- [ ] **Step 4: Ver a tela de verdade** — `npm run dev`, abrir http://localhost:3000/analise/ (sem dados no banco ainda: deve aparecer "O histórico ainda não foi enviado"). Conferir no celular (DevTools) o botão "Filtros".

# Puxador em tempo real — plano de construção

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** paradas de hoje em tempo real (posições de cada ciclo, sem consulta a mais ao GAUSS) e, de madrugada, paradas exatas + excessos de velocidade + rota crua no R2 (opcional).

**Architecture:** regras puras em `src/lib/dominio/paradas.ts` (sem pacotes externos: o coletor instala só supabase-js e tsx); integração no coletor em `coletor/tempo-real.ts`, `coletor/noturno.ts` e `coletor/r2.ts`; SQL novo em `supabase/tempo-real.sql`; site lê `analise_excessos` (regra 10 da Exceções) e relê a Análise a cada 10 min.

**Spec:** `docs/superpowers/specs/2026-10-08-puxador-tempo-real-design.md`

## Global Constraints

- Nenhuma requisição a mais ao GAUSS de dia; de madrugada, uma por vez, até 6 equipamentos por ciclo.
- Coletor nunca roda no PC; só testes de unidade aqui.
- Módulos de `src/lib/dominio` usados pelo coletor não importam pacotes externos.
- Falha nas partes novas nunca derruba o ciclo do coletor.
- Sem commits.

## Review Focus

1. Rota vazia de madrugada (GAUSS sem dados) — não apaga as paradas ao vivo. (Tarefa 4.)
2. Tabela `analise_excessos` ainda não criada — a Exceções continua funcionando. (Tarefa 5.)
3. Dia de hoje sem posições ainda — nenhuma parada, sem erro. (Tarefa 1.)
4. Excesso fora da usina (estrada para o Poço Redondo) — não conta. (Tarefa 1.)
5. Madrugada fora da janela ou com tudo feito — não consulta o GAUSS. (Tarefa 2.)

---

### Task 1: Regras das paradas e da velocidade

**Files:** Modify `src/lib/dominio/regras-frota.ts` (constante `VELOCIDADE_MAX_USINA = 30`); Create `src/lib/dominio/paradas.ts`; Test `src/lib/dominio/paradas.test.ts`

- [ ] **Step 1: Teste**

```ts
import { describe, expect, it } from "vitest";
import type { Cerca, PontoRota } from "../tipos";
import { enriquecerParadas, excessosDaRota, paradasDaRota, paradasDasPosicoes } from "./paradas";

const D = "2026-10-07";
const H = 3600;
const hs = (h: string) => { const [a, b, c] = h.split(":").map(Number); return a * H + b * 60 + (c || 0); };
const pt = (hora: string, vel: number, lat = -19.48, lng = -42.53): PontoRota => ({ t: `${D} ${hora}`, lat, lng, vel, rpm: 0 });
const quad = (lat: number, lng: number, lado: number): [number, number][] => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

describe("paradas da rota completa (madrugada)", () => {
  it("abaixo de 5 km/h por 3 min ou mais; buraco de mais de 10 min corta", () => {
    const pontos = [pt("08:00:00", 30), pt("08:01:00", 2), pt("08:03:00", 0), pt("08:05:00", 1), pt("08:06:00", 40), pt("09:00:00", 0), pt("09:01:00", 0), pt("09:20:00", 0), pt("09:25:00", 0)];
    expect(paradasDaRota(pontos).map((p) => [p.ini, p.fim])).toEqual([
      [hs("08:01:00"), hs("08:05:00")],
      [hs("09:20:00"), hs("09:25:00")],
    ]);
  });
});

describe("paradas das posições de cada ciclo (tempo real)", () => {
  it("leituras seguidas a menos de 80 m viram uma parada; precisa de 2 leituras", () => {
    const pos = [
      { t: hs("08:00"), lat: -19.48, lng: -42.53 },
      { t: hs("08:05"), lat: -19.4802, lng: -42.5301 },
      { t: hs("08:10"), lat: -19.4801, lng: -42.53 },
      { t: hs("08:15"), lat: -19.47, lng: -42.52 },
      { t: hs("08:20"), lat: -19.46, lng: -42.51 },
      { t: hs("08:25"), lat: -19.4601, lng: -42.51 },
    ];
    expect(paradasDasPosicoes(pos).map((p) => [p.ini, p.fim])).toEqual([
      [hs("08:00"), hs("08:10")],
      [hs("08:20"), hs("08:25")],
    ]);
    expect(paradasDasPosicoes([])).toEqual([]);
  });
});

describe("enriquecer", () => {
  const areas = [
    { name: "PÁTIO GRANDE", color: "", tipo: "area", polygon: quad(-19.49, -42.54, 0.02) },
    { name: "BAIA PEQUENA", color: "", tipo: "area", polygon: quad(-19.481, -42.531, 0.002) },
  ] as Cerca[];
  it("cerca menor, minutos de cada status do motor e apontamentos", () => {
    const [p] = enriquecerParadas([{ ini: hs("08:00"), fim: hs("09:00"), lat: -19.48, lng: -42.53 }], { id: "10", placa: "EGC2985" }, {
      dia: D,
      areas,
      motor: [
        { inicio: `${D} 07:30:00`, fim: `${D} 08:20:00`, status: "secondary_motor_on", status_label: null },
        { inicio: `${D} 08:20:00`, fim: `${D} 10:00:00`, status: "off", status_label: null },
      ],
      tablet: [{ inicio: `${D} 08:30:00`, fim: `${D} 08:40:00`, categoria_demora: " Refeição Motorista " }],
      fimDia: 24 * H,
    });
    expect(p).toEqual({ dia: D, veiculo_id: "10", placa: "EGC2985", ini: hs("08:00"), fim: hs("09:00"), lat: -19.48, lng: -42.53, area: "BAIA PEQUENA", motor: { secondary_motor_on: 20, off: 40 }, apont: ["Refeição Motorista"] });
  });
});

describe("excessos de velocidade", () => {
  const usina = quad(-19.5, -42.56, 0.05);
  it("pontos seguidos acima de 30 km/h dentro da usina viram um excesso, com o pico", () => {
    const pontos = [pt("10:00:00", 25), pt("10:00:30", 35), pt("10:01:00", 48, -19.47, -42.52), pt("10:01:30", 33), pt("10:02:00", 20), pt("11:00:00", 60, -19.3, -42.3)];
    expect(excessosDaRota(pontos, usina)).toEqual([{ ini: hs("10:00:30"), fim: hs("10:01:30"), vel_max: 48, lat: -19.47, lng: -42.52 }]);
  });
  it("sem o contorno da usina, nada", () => {
    expect(excessosDaRota([pt("10:00:00", 90)], null)).toEqual([]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/dominio/paradas.test.ts` → FAIL.

- [ ] **Step 3: Implementação**

```ts
// Paradas para a Análise (tabela analise_paradas), feitas pelo coletor: em tempo real a partir das posições de cada
// ciclo e, de madrugada, exatas a partir da rota completa; e os excessos de velocidade dentro da usina.
// Puro e sem pacotes externos (o coletor importa daqui). Desenho: docs/superpowers/specs/2026-10-08-puxador-tempo-real-design.md
import type { Cerca, LatLng, PontoRota } from "../tipos";
import type { ParadaAnalise } from "./analise";
import { segDe } from "./formato";
import { montarStatusGauss, segNoDia, type LinhaMotorGauss } from "./gauss-dia";
import { cercasNoPonto, dentroDoPoligono, distanciaM } from "./geo";
import { VELOCIDADE_MAX_USINA } from "./regras-frota";

/** Parada antes de saber onde e com qual motor: segundos do dia e posição. */
export interface ParadaBruta {
  ini: number;
  fim: number;
  lat: number;
  lng: number;
}
export interface Excesso {
  ini: number;
  fim: number;
  vel_max: number;
  lat: number;
  lng: number;
}

const VEL_PARADO = 5; // km/h: abaixo disso é parado (o GPS oscila 1-4 km/h parado)
const MIN_PARADA_S = 3 * 60;
const BURACO_S = 10 * 60; // sem ponto por mais que isso: corta a parada
const RAIO_POSICAO_M = 80; // tempo real: posições a menos disso da 1ª leitura são o mesmo lugar
const MIN_LEITURAS = 2;

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/** Paradas da rota completa: abaixo de 5 km/h por 3 min ou mais (a mesma regra do classificar.js). */
export function paradasDaRota(pontos: PontoRota[]): ParadaBruta[] {
  const out: ParadaBruta[] = [];
  let atual: { ini: number; fim: number; lats: number[]; lngs: number[] } | null = null;
  const fechar = () => {
    if (atual && atual.fim - atual.ini >= MIN_PARADA_S) out.push({ ini: atual.ini, fim: atual.fim, lat: mediana(atual.lats), lng: mediana(atual.lngs) });
    atual = null;
  };
  for (const p of pontos) {
    if (!p.lat || !p.lng) continue;
    const s = segDe(p.t.slice(11, 19));
    if (p.vel < VEL_PARADO) {
      if (atual && s - atual.fim > BURACO_S) fechar();
      atual ??= { ini: s, fim: s, lats: [], lngs: [] };
      atual.fim = s;
      atual.lats.push(p.lat);
      atual.lngs.push(p.lng);
    } else fechar();
  }
  fechar();
  return out;
}

/** Paradas das posições de cada ciclo (~5 min): leituras seguidas a menos de 80 m da 1ª leitura do lugar, 2 ou mais. */
export function paradasDasPosicoes(posicoes: { t: number; lat: number; lng: number }[]): ParadaBruta[] {
  const out: ParadaBruta[] = [];
  let grupo: { t: number; lat: number; lng: number }[] = [];
  const fechar = () => {
    if (grupo.length >= MIN_LEITURAS) out.push({ ini: grupo[0].t, fim: grupo[grupo.length - 1].t, lat: mediana(grupo.map((g) => g.lat)), lng: mediana(grupo.map((g) => g.lng)) });
    grupo = [];
  };
  for (const p of [...posicoes].sort((a, b) => a.t - b.t)) {
    if (grupo.length && distanciaM(grupo[0], p) > RAIO_POSICAO_M) fechar();
    grupo.push(p);
  }
  fechar();
  return out;
}

/** O que a parada precisa para virar linha de analise_paradas. */
export interface ContextoDia {
  dia: string;
  /** cercas do tipo área */
  areas: Cerca[];
  /** timeline de motor do GAUSS do veículo no dia */
  motor: LinhaMotorGauss[];
  /** apontamentos do tablet do veículo no dia */
  tablet: { inicio: string; fim: string | null; categoria_demora: string }[];
  /** onde termina um apontamento ainda aberto (agora, ou o fim do dia) */
  fimDia: number;
}

/** Uma linha de analise_paradas por parada: a menor cerca, minutos de cada status do motor e os apontamentos. */
export function enriquecerParadas(paradas: ParadaBruta[], veiculo: { id: string; placa: string }, ctx: ContextoDia): ParadaAnalise[] {
  const blocos = montarStatusGauss(ctx.motor, ctx.dia);
  const ap = ctx.tablet.map((t) => ({ a: segNoDia(t.inicio, ctx.dia), b: t.fim ? segNoDia(t.fim, ctx.dia) : ctx.fimDia, c: t.categoria_demora.trim() }));
  return paradas.map((p) => {
    const seg: Record<string, number> = {};
    for (const b of blocos) {
      const x = Math.min(b.b, p.fim) - Math.max(b.a, p.ini);
      if (x > 0) seg[b.cod] = (seg[b.cod] ?? 0) + x;
    }
    const motor = Object.fromEntries(Object.entries(seg).map(([k, s]) => [k, Math.round((s / 60) * 10) / 10]));
    return {
      dia: ctx.dia,
      veiculo_id: veiculo.id,
      placa: veiculo.placa,
      ini: Math.round(p.ini),
      fim: Math.round(p.fim),
      lat: p.lat,
      lng: p.lng,
      area: cercasNoPonto(p.lat, p.lng, ctx.areas)[0]?.name ?? null,
      motor,
      apont: [...new Set(ap.filter((x) => x.a < p.fim && x.b > p.ini).map((x) => x.c))],
    };
  });
}

/** Excessos de velocidade dentro da usina: pontos seguidos acima do limite viram um excesso (posição = o pico). */
export function excessosDaRota(pontos: PontoRota[], usina: LatLng[] | null, limite = VELOCIDADE_MAX_USINA): Excesso[] {
  if (!usina) return [];
  const out: Excesso[] = [];
  let atual: Excesso | null = null;
  for (const p of pontos) {
    const s = segDe(p.t.slice(11, 19));
    if (p.vel > limite && dentroDoPoligono(p.lat, p.lng, usina)) {
      if (!atual) atual = { ini: s, fim: s, vel_max: p.vel, lat: p.lat, lng: p.lng };
      else {
        atual.fim = s;
        if (p.vel > atual.vel_max) Object.assign(atual, { vel_max: p.vel, lat: p.lat, lng: p.lng });
      }
    } else if (atual) {
      out.push(atual);
      atual = null;
    }
  }
  if (atual) out.push(atual);
  return out;
}
```

E em `regras-frota.ts`, depois de `RESTAURANTE_MIN`:

```ts
/** Velocidade máxima dentro da usina (km/h). Acima disso, excesso (regra 10). */
export const VELOCIDADE_MAX_USINA = 30;
```

- [ ] **Step 4:** teste → PASS.

---

### Task 2: Escolha da madrugada (`coletor/noturno.ts`)

- [ ] **Step 1: Teste** `coletor/noturno.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { escolherNoturno } from "./noturno";

const em = (h: string) => new Date(`2026-10-08T${h}:00`);
const IDS = ["1", "2", "3", "4", "5", "6", "7", "8"];

describe("escolherNoturno", () => {
  it("fora de 02:30–06:00 não faz nada", () => {
    expect(escolherNoturno(null, IDS, em("02:00"))).toBeNull();
    expect(escolherNoturno(null, IDS, em("06:00"))).toBeNull();
  });
  it("na janela: até 6 equipamentos de ontem que faltam", () => {
    expect(escolherNoturno(null, IDS, em("02:30"))).toEqual({ dia: "2026-10-07", ids: ["1", "2", "3", "4", "5", "6"] });
    expect(escolherNoturno({ dia: "2026-10-07", feitos: ["1", "2", "3", "4", "5", "6"] }, IDS, em("02:40"))).toEqual({ dia: "2026-10-07", ids: ["7", "8"] });
  });
  it("tudo feito: nada; progresso de outro dia não vale", () => {
    expect(escolherNoturno({ dia: "2026-10-07", feitos: IDS }, IDS, em("03:00"))).toBeNull();
    expect(escolherNoturno({ dia: "2026-10-06", feitos: IDS }, IDS, em("03:00"))?.ids).toHaveLength(6);
  });
});
```

- [ ] **Step 2:** `npx vitest run coletor/noturno.test.ts` → FAIL.

- [ ] **Step 3:**

```ts
// Rotina da madrugada: quais equipamentos ainda faltam ter a rota completa de ontem processada.
import { diaMenos } from "../src/lib/dominio/analise";
import { diaLocal } from "../src/lib/dominio/formato";

/** Progresso guardado em loc_kv ("noturno"). */
export interface ControleNoturno {
  dia: string;
  feitos: string[];
}
// depois que o dia fecha (o rastreador descarrega atrasado até ~2 h depois) e antes do turno da manhã
const INICIO_MIN = 2 * 60 + 30;
const FIM_MIN = 6 * 60;
export const POR_CICLO = 6;

/** Equipamentos a processar neste ciclo (null = fora da janela ou tudo feito: nenhuma consulta ao GAUSS). */
export function escolherNoturno(controle: ControleNoturno | null, ids: string[], agora: Date, porCiclo = POR_CICLO): { dia: string; ids: string[] } | null {
  const min = agora.getHours() * 60 + agora.getMinutes();
  if (min < INICIO_MIN || min >= FIM_MIN) return null;
  const dia = diaMenos(diaLocal(agora), 1);
  const feitos = controle?.dia === dia ? controle.feitos : [];
  const faltam = ids.filter((id) => !feitos.includes(id));
  return faltam.length ? { dia, ids: faltam.slice(0, porCiclo) } : null;
}
```

- [ ] **Step 4:** teste → PASS.

---

### Task 3: R2 (`coletor/r2.ts`)

- [ ] **Step 1: Teste** `coletor/r2.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { guardarRota, r2Configurado } from "./r2";

describe("R2", () => {
  it("sem os segredos fica desligado e não tenta enviar", async () => {
    expect(r2Configurado({})).toBe(false);
    expect(r2Configurado({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })).toBe(true);
    expect(await guardarRota("2026-10-07", "10", [], {})).toBe(false);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3:** `cd coletor && npm install aws4fetch@1.0.20 --save-exact` e:

```ts
// Rota crua do dia no R2 da Cloudflare (bucket próprio do Monitoramento; a regra de apagar após 30 dias é do bucket).
// Só liga com os 4 segredos R2_*; sem eles, a rotina da madrugada pula esta parte.
import { gzipSync } from "node:zlib";
import type { PontoRota } from "../src/lib/tipos";

type Env = Record<string, string | undefined>;
export const r2Configurado = (env: Env = process.env) => !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);

/** Grava rotas/AAAA-MM-DD/<veiculo>.json.gz. false = R2 não configurado. */
export async function guardarRota(dia: string, id: string, pontos: PontoRota[], env: Env = process.env): Promise<boolean> {
  if (!r2Configurado(env)) return false;
  const { AwsClient } = await import("aws4fetch");
  const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/rotas/${dia}/${encodeURIComponent(id)}.json.gz`;
  const r = await aws.fetch(url, { method: "PUT", body: gzipSync(JSON.stringify(pontos)), headers: { "content-type": "application/json", "content-encoding": "gzip" } });
  if (!r.ok) throw new Error(`R2 respondeu ${r.status}`);
  return true;
}
```

- [ ] **Step 4:** PASS.

---

### Task 4: Banco e coletor

- [ ] **Step 1: `supabase/tempo-real.sql`**

```sql
-- Puxador em tempo real (08/10/2026): posições de cada ciclo, origem das paradas e excessos de velocidade.
-- Rodar no SQL Editor do PRODUTIVIDADE DEPOIS do supabase/analise.sql. Pode rodar de novo.

-- paradas: "ao_vivo" (posições de 5 em 5 min, hoje) ou "rota" (rota completa, de madrugada)
alter table public.analise_paradas add column if not exists fonte text not null default 'rota';
alter table public.analise_paradas drop constraint if exists analise_paradas_fonte;
alter table public.analise_paradas add constraint analise_paradas_fonte check (fonte in ('ao_vivo', 'rota'));

-- posição de cada equipamento da frota a cada ciclo do coletor (só hoje e ontem; só o coletor lê)
create table if not exists public.loc_posicoes (
  veiculo_id text not null,
  t timestamptz not null,
  dia date not null,
  lat double precision not null,
  lng double precision not null,
  primary key (veiculo_id, t)
);
create index if not exists loc_posicoes_dia on public.loc_posicoes (dia);
alter table public.loc_posicoes enable row level security;
revoke all on public.loc_posicoes from anon, authenticated;

-- excessos de velocidade dentro da usina (rota completa, de madrugada)
create table if not exists public.analise_excessos (
  id bigint generated always as identity primary key,
  dia date not null,
  veiculo_id text not null,
  ini integer not null,
  fim integer not null,
  vel_max real not null,
  lat double precision not null,
  lng double precision not null,
  unique (dia, veiculo_id, ini)
);
create index if not exists analise_excessos_dia on public.analise_excessos (dia);
alter table public.analise_excessos enable row level security;
revoke all on public.analise_excessos from anon, authenticated;
grant select on public.analise_excessos to anon, authenticated;
drop policy if exists "analise_excessos: leitura pública" on public.analise_excessos;
create policy "analise_excessos: leitura pública" on public.analise_excessos for select to anon, authenticated using (true);

-- limpeza diária: 30 dias de paradas e excessos, 2 dias de posições
select cron.unschedule(jobid) from cron.job where jobname = 'analise-limpeza';
select cron.schedule('analise-limpeza', '15 3 * * *', $$
  delete from public.analise_paradas where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  delete from public.analise_excessos where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  delete from public.loc_posicoes where dia < (now() at time zone 'America/Sao_Paulo')::date - 2;
$$);
select jobname, schedule, active from cron.job where jobname = 'analise-limpeza';
```

- [ ] **Step 2: `coletor/tempo-real.ts`**

```ts
// Puxador em tempo real (desenho: docs/superpowers/specs/2026-10-08-puxador-tempo-real-design.md):
//   - cada ciclo: posição de cada equipamento da frota em loc_posicoes (a leitura que o coletor já faz; nada a mais no GAUSS)
//   - a cada 10 min: paradas de hoje (fonte "ao_vivo") em analise_paradas
//   - madrugada: rota completa de ontem → paradas exatas (fonte "rota"), excessos de velocidade e R2
// Falha aqui nunca derruba o ciclo: o run.ts chama cada parte num try/catch.
import { contornoDaUsina } from "../src/lib/dominio/analise";
import { diaLocal } from "../src/lib/dominio/formato";
import { formasDaPlaca, type LinhaMotorGauss } from "../src/lib/dominio/gauss-dia";
import { enriquecerParadas, excessosDaRota, paradasDaRota, paradasDasPosicoes, type ContextoDia } from "../src/lib/dominio/paradas";
import type { Cerca, Veiculo } from "../src/lib/tipos";
import type { GaussFleetClient } from "./gauss";
import { baixarRota } from "./historico";
import { escolherNoturno, type ControleNoturno } from "./noturno";
import { guardarRota } from "./r2";
import { db, kvGet, kvSet, ok } from "./supabase";

const PAGINA = 1000;
const MAX_LINHAS = 30000;
const LOTE = 500;
const AO_VIVO_MS = 10 * 60 * 1000;
const DIA = 86400;

const daFrota = (frota: Veiculo[]) => frota.filter((v) => !v.motor2_de && v.equip);
const diaSeguinte = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** segundos do dia (Brasília, sem horário de verão desde 2019) */
const segDoDia = (iso: string, dia: string) => (Date.parse(iso) - Date.parse(`${dia}T00:00:00-03:00`)) / 1000;

async function paginado<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(consulta(de, de + PAGINA - 1))) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

async function emLotes<T>(linhas: T[], gravar: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += LOTE) await ok(gravar(linhas.slice(i, i + LOTE)) as PromiseLike<{ data: unknown; error: { message: string } | null }>);
}

/** Cada ciclo: a posição de cada equipamento da frota (o motor 2º não entra). */
export async function gravarPosicoes(frota: Veiculo[], agora: Date): Promise<number> {
  const t = agora.toISOString();
  const dia = diaLocal(agora);
  const linhas = daFrota(frota)
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({ veiculo_id: v.id, t, dia, lat: v.lat as number, lng: v.lng as number }));
  if (linhas.length) await ok(db().from("loc_posicoes").upsert(linhas, { onConflict: "veiculo_id,t", ignoreDuplicates: true }));
  return linhas.length;
}

/** Motor (por id do veículo) e tablet (pelas formas da placa) de um dia, só do Supabase. */
async function lerContexto(dia: string) {
  const ate = diaSeguinte(dia);
  const motor = await paginado<LinhaMotorGauss & { placa_ou_codigo: string }>((de, a) =>
    db().from("timeline_motor_vaga").select("placa_ou_codigo, inicio, fim, status, status_label, gravado:updated_at").lt("inicio", ate).gt("fim", dia).order("id").range(de, a),
  );
  const tablet = await paginado<{ placa: string; inicio: string; fim: string | null; categoria_demora: string }>((de, a) =>
    db().from("demoras_categorizadas").select("placa, inicio, fim, categoria_demora").lt("inicio", ate).or(`fim.is.null,fim.gt.${dia}`).order("inicio").order("demora_cod").range(de, a),
  );
  return {
    motorDe: (id: string) => motor.filter((l) => l.placa_ou_codigo === id),
    tabletDe: (placa: string) => {
      const formas = new Set(formasDaPlaca(placa));
      return tablet.filter((t) => formas.has(t.placa));
    },
  };
}

/** A cada 10 min: as paradas de hoje de toda a frota, pelas posições de cada ciclo (fonte "ao_vivo"). */
export async function paradasAoVivo(frota: Veiculo[], cercas: Cerca[], agora: Date): Promise<number | null> {
  const controle = await kvGet<{ em: string }>("paradas_ao_vivo");
  if (controle && agora.getTime() - Date.parse(controle.em) < AO_VIVO_MS) return null;
  const dia = diaLocal(agora);
  const posicoes = await paginado<{ veiculo_id: string; t: string; lat: number; lng: number }>((de, a) =>
    db().from("loc_posicoes").select("veiculo_id, t, lat, lng").eq("dia", dia).order("veiculo_id").order("t").range(de, a),
  );
  const ctx = await lerContexto(dia);
  const areas = cercas.filter((c) => c.tipo === "area");
  const fimDia = Math.min(DIA, segDoDia(agora.toISOString(), dia));
  const linhas = daFrota(frota).flatMap((v) => {
    const minhas = posicoes.filter((p) => p.veiculo_id === v.id).map((p) => ({ t: segDoDia(p.t, dia), lat: p.lat, lng: p.lng }));
    const base: Omit<ContextoDia, "areas"> = { dia, motor: ctx.motorDe(v.id), tablet: ctx.tabletDe(v.placa), fimDia };
    return enriquecerParadas(paradasDasPosicoes(minhas), v, { ...base, areas }).map((p) => ({ ...p, fonte: "ao_vivo" }));
  });
  await ok(db().from("analise_paradas").delete().eq("dia", dia).eq("fonte", "ao_vivo"));
  await emLotes(linhas, (lote) => db().from("analise_paradas").insert(lote));
  await kvSet("paradas_ao_vivo", { em: agora.toISOString() });
  return linhas.length;
}

/** Madrugada: rota completa de ontem de até 6 equipamentos por ciclo → paradas exatas, excessos e R2. */
export async function rotinaNoturna(client: GaussFleetClient, frota: Veiculo[], cercas: Cerca[], agora: Date): Promise<string | null> {
  const controle = await kvGet<ControleNoturno>("noturno");
  const equip = daFrota(frota);
  const vez = escolherNoturno(controle, equip.map((v) => v.id), agora);
  if (!vez) return null;
  const { dia } = vez;
  const feitos = controle?.dia === dia ? [...controle.feitos] : [];
  const ctx = await lerContexto(dia);
  const areas = cercas.filter((c) => c.tipo === "area");
  const usina = contornoDaUsina(cercas);
  let paradas = 0;
  let excessos = 0;
  let r2 = 0;
  for (const id of vez.ids) {
    const v = equip.find((x) => x.id === id)!;
    try {
      const pontos = await baixarRota(client, id, dia, "00:00");
      // sem pontos (desligado o dia todo ou o GAUSS sem dados): mantém as paradas ao vivo
      if (pontos.length) {
        const linhas = enriquecerParadas(paradasDaRota(pontos), v, { dia, areas, motor: ctx.motorDe(id), tablet: ctx.tabletDe(v.placa), fimDia: DIA }).map((p) => ({ ...p, fonte: "rota" }));
        await ok(db().from("analise_paradas").delete().eq("dia", dia).eq("veiculo_id", id));
        await emLotes(linhas, (lote) => db().from("analise_paradas").insert(lote));
        const ex = excessosDaRota(pontos, usina).map((e) => ({ ...e, dia, veiculo_id: id }));
        await ok(db().from("analise_excessos").delete().eq("dia", dia).eq("veiculo_id", id));
        if (ex.length) await ok(db().from("analise_excessos").insert(ex));
        paradas += linhas.length;
        excessos += ex.length;
        try {
          if (await guardarRota(dia, id, pontos)) r2++;
        } catch (e) {
          console.warn(`⚠ R2 ${v.placa}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      feitos.push(id);
      await kvSet("noturno", { dia, feitos });
    } catch (e) {
      console.warn(`⚠ madrugada ${v.placa}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return `${dia}: ${feitos.length}/${equip.length} equipamentos, ${paradas} paradas, ${excessos} excessos${r2 ? `, ${r2} rotas no R2` : ""}`;
}
```

- [ ] **Step 3: `coletor/run.ts`** — importar `{ gravarPosicoes, paradasAoVivo, rotinaNoturna } from "./tempo-real"`; logo depois de gravar os eventos (antes dos pedidos de histórico):

```ts
    // tempo real: posição de cada equipamento da frota (a leitura já feita; nada a mais no GAUSS)
    try {
      await gravarPosicoes(frota.veiculos, agora);
    } catch (e) {
      console.warn(`⚠ posições: ${e instanceof Error ? e.message : String(e)}`);
    }
```

e depois do bloco do motor:

```ts
    // paradas de hoje a cada 10 min e, de madrugada, a rota completa de ontem
    try {
      const n = await paradasAoVivo(frota.veiculos, cercas, agora);
      if (n != null) console.log(`✅ paradas ao vivo: ${n}`);
    } catch (e) {
      console.warn(`⚠ paradas ao vivo: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const r = await rotinaNoturna(client, frota.veiculos, cercas, agora);
      if (r) console.log(`✅ madrugada: ${r}`);
    } catch (e) {
      console.warn(`⚠ madrugada: ${e instanceof Error ? e.message : String(e)}`);
    }
```

e o cabeçalho do arquivo ganha o item "5. tempo real (tempo-real.ts)". No workflow `coletor.yml`, em `env`, os 4 segredos opcionais `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

- [ ] **Step 4:** `npx tsc --noEmit -p coletor` (ou o typecheck da raiz, que inclui o coletor) e `npx vitest run coletor`.

---

### Task 5: Regra 10 na Exceções do dia

- [ ] **Step 1: Teste** (acrescentar em `src/lib/dominio/excecoes.test.ts`):

```ts
describe("velocidade (regra 10)", () => {
  it("excessos do dia viram exceção com a velocidade máxima; de outro dia, não", () => {
    const xs = excecoesDoDia({
      dia: D, agoraSeg: null, veiculos: [v("1", "EGC2985", "ap", { regime: "ADM" })], eventos: [], motor: [], tablet: [],
      excessos: [
        { dia: D, veiculo_id: "1", ini: hs("10:00"), fim: hs("10:01"), vel_max: 47.6, lat: 0, lng: 0 },
        { dia: V, veiculo_id: "1", ini: hs("10:00"), fim: hs("10:01"), vel_max: 60, lat: 0, lng: 0 },
      ],
    });
    expect(xs.map((x) => [x.regra, x.ini, x.detalhe])).toEqual([["velocidade", hs("10:00"), "48 km/h · limite 30 km/h"]]);
  });
});
```

- [ ] **Step 2:** FAIL. **Step 3:** em `excecoes.ts`: `"velocidade"` no fim de `REGRAS`; `ROTULO_REGRA.velocidade = "Velocidade acima de 30 km/h"`; `GRAVIDADE.velocidade = "alerta"`; `EntradaExcecoes.excessos?: { dia: string; veiculo_id: string; ini: number; fim: number; vel_max: number; lat: number; lng: number }[]`; importar `VELOCIDADE_MAX_USINA`; dentro do laço de cada veículo, antes do `if (manut) continue;`:

```ts
    // 10. velocidade acima do limite dentro da usina (rota completa: só a partir do dia seguinte)
    for (const e of x.excessos ?? []) if (e.veiculo_id === v.id && e.dia === x.dia) add("velocidade", DIA + e.ini, DIA + e.fim, localEm(DIA + e.ini), `${Math.round(e.vel_max)} km/h · limite ${VELOCIDADE_MAX_USINA} km/h`);
```

Em `src/lib/dados/excecoes.ts`: ler `analise_excessos` do dia (`.select("dia, veiculo_id, ini, fim, vel_max, lat, lng").eq("dia", dia)`), **com falha virando lista vazia** (tabela ainda não criada não derruba a tela), e passar `excessos` nos dados. No e2e: `apoio.ts` responde `analise_excessos` com `opcoes.excessos ?? []`; `excecoes.spec.ts` ganha um excesso do veículo 10 hoje e confere o chip "Velocidade acima de 30 km/h" com 1.

- [ ] **Step 4:** PASS (unidade e e2e).

---

### Task 6: Análise relê a cada 10 min; README; verificação

- [ ] `useParadasAnalise`: além da 1ª leitura, relê a cada 10 min (esquece o cache e lê de novo), sem piscar a tela (mantém as paradas antigas até chegar a nova leitura).
- [ ] README: item 14 nos Pontos de atenção (tempo real, madrugada, R2 opcional, `supabase/tempo-real.sql`); seção Configuração ganha o SQL novo e os segredos R2 opcionais.
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test`.

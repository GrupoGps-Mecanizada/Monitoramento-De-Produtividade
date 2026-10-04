# História do dia, Dia da frota e frota própria — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar só a frota da Mecanizada organizada em 6 tipos, recolher o painel da Localização, contar o dia do equipamento em capítulos na Timeline e criar a tela "Dia da frota", sem nenhuma requisição nova ao GAUSS.

**Architecture:**
- Três regras novas, puras e testadas, em `src/lib/dominio/`:
  - `equipamentos.ts` com `frota-propria.ts`: qual veículo é nosso e de que tipo.
  - `capitulos.ts`: trechos do dia viram capítulos.
  - `dia-frota.ts`: eventos do dia viram faixas por equipamento.
- O coletor aplica o filtro da frota e grava a "abertura do dia".
- O site aplica a mesma regra ao ler, e as telas só desenham o que essas funções devolvem.

**Tech Stack:** Next.js 16.3.6 (export estático), React 19.2.8, TypeScript estrito, Tailwind v4, Leaflet com leaflet.markercluster (já instalados), zod 4.6.5, Supabase JS 2.117.1, vitest 4.1.11, Playwright 1.63.0, tsx 4.23.15.

**Spec:** `docs/superpowers/specs/2026-10-04-historia-e-frota-design.md`

## Global Constraints

- Repositório: `C:\Users\Meu Computador\Desktop\automatização GAUSS FLEET\deploy\Monitoramento-De-Produtividade`, branch `historia-e-frota` (já criada, com a spec). Todos os caminhos são relativos a essa pasta. Shell: Git Bash.
- Next 16 tem mudanças em relação ao que você conhece: em dúvida, leia `node_modules/next/dist/docs/`.
- Textos de tela, comentários, nomes de funções e mensagens de commit em **português**, no estilo do código atual (linhas longas, sem Prettier no arquivo inteiro).
- ESLint ativo com `react-hooks/set-state-in-effect`, `react-hooks/refs`, `react-hooks/purity` e `react-hooks/immutability` como **erro**:
  - Nada de `setState` síncrono no corpo de `useEffect` (só em callbacks, `.then` ou eventos).
  - Nada de ler ou escrever `ref.current` durante a renderização.
  - Nada de `Date.now()` ou `Math.random()` na renderização.
- **Cautela com o GAUSS:** nenhuma tarefa consulta o GAUSS e nenhuma requisição nova é criada.
  - O coletor só roda no GitHub Actions a partir da `main`. **Nunca** rode `coletor/run.ts` no computador.
  - Testar a Timeline com um dia que não está no banco cria um pedido real em `loc_pedidos`. Ao conferir no navegador, use dados sintéticos (Playwright) ou intercepte gravações.
- Frota: **42 equipamentos** (14 AP, 11 AV, 3 HV, 1 UV, 3 PG e 10 aspiradores). Lista exata na Tarefa 1.
- `MIN_CAPITULO = 15` minutos. A precisão do Dia da frota é de ~5 min (intervalo do coletor).
- Nada pode afirmar "trabalhou" ou "ocioso": a regra foi adiada pelo dono. A classificação fica só em `classeTempo()` (Tarefa 4).
- **Teste de cada tarefa:** `npx vitest run && npm run typecheck && npm run lint`.
  - `npm run e2e` só passa de novo na Tarefa 10: as telas mudam nas Tarefas 6–9 e os testes de navegador são reescritos no fim.
- Não fazer merge nem push, nem mudar configurações do GitHub. Publicar só quando o dono pedir.
- Commits pequenos, um por tarefa, terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Retrato gravado antes do coletor novo** (sem `equip`, com veículos de fora) → o site mostra só a frota, identificada pela placa ou pela vaga. Teste: `frota-propria.test.ts` "retrato antigo" (Tarefa 2).
2. **Dia sem nenhum capítulo** (só paradas curtas ou só deslocamento) → lista vazia com aviso, faixas desenhadas, destaques vazios. Teste: `capitulos.test.ts` "dia sem capítulo" (Tarefa 4).
3. **Equipamento sem nenhum evento num dia passado** → faixa "sem registro"; o estado nunca é inventado. Teste: `dia-frota.test.ts` "sem evento em dia passado" (Tarefa 5).
4. **Evento `abertura` fora dos Alertas, das contagens e da busca.** Testes: `eventos.test.ts` "abertura não é alerta" (Tarefa 3) e o e2e de Alertas com Total = 2 (Tarefa 10).
5. **Placa Mercosul ↔ antiga** (DYB7C10 = DYB-7210) na identificação e na busca. Testes: `equipamentos.test.ts` (Tarefa 1) e `busca.test.ts` (Tarefa 9).

---

### Task 1: Tipos de equipamento e a lista da frota

**Files:**
- Create: `src/lib/dominio/equipamentos.ts`, `src/lib/dominio/equipamentos.test.ts`
- Modify: `src/lib/tipos.ts` (tipos novos; `Veiculo.equip`, `Retrato.fora_da_lista`)

**Interfaces:**
- Produces:
  - `type TipoEquip = "ap" | "av" | "hv" | "uv" | "pg" | "as"`
  - `interface Equip { tipo: TipoEquip; nome: string; ordem: number }` (em `tipos.ts`)
  - `Veiculo.equip?: Equip`, `Retrato.fora_da_lista?: string[]`
  - De `equipamentos.ts`:
    - `ORDEM_TIPOS: TipoEquip[]`
    - `TIPOS_EQUIP: Record<TipoEquip, { sigla: string; rotulo: string }>`
    - `formasPlaca(placa: string): string[]`
    - `identificarEquip(v: { placa: string; vaga: string }): Equip | null`
    - `nomeEquip(v: { placa: string; equip?: Equip }): string`
    - `compararEquip(a, b): number`
    - `TOTAL_FROTA: number`

- [ ] **Step 1: Tipos**

Em `src/lib/tipos.ts`, logo depois da linha `export type TipoCerca = "planta" | "via" | "area";`, acrescente:

```ts
/** Tipo de equipamento da frota (planilha "LOCAÇÃO - GPS"; src/lib/dominio/equipamentos.ts). Não confundir com
 * CategoriaVeiculo (ligado/desligado...). */
export type TipoEquip = "ap" | "av" | "hv" | "uv" | "pg" | "as";
export interface Equip {
  tipo: TipoEquip;
  /** como a planilha escreve: "EGC-2985", "Aspirador 05" */
  nome: string;
  /** posição na planilha dentro do tipo (aspirador: o número) */
  ordem: number;
}
```

Na interface `Veiculo`, acrescente o campo:

```ts
export interface Veiculo extends EstadoVeiculo {
  motor2?: Motor2Resumo;
  motor2_de?: string;
  /** equipamento da frota (o motor 2º recebe o do caminhão); ausente em retrato gravado antes do filtro */
  equip?: Equip;
}
```

Na interface `Retrato`, depois de `veiculos: Veiculo[];`, acrescente:

```ts
  /** placas de grupos da frota (Alta Pressão, Vácuo, Brook...) que NÃO estão na lista: equipamento novo? */
  fora_da_lista?: string[];
```

- [ ] **Step 2: Teste que falha**

`src/lib/dominio/equipamentos.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { TOTAL_FROTA, compararEquip, formasPlaca, identificarEquip, nomeEquip } from "./equipamentos";

const sem = (placa: string, vaga = "") => identificarEquip({ placa, vaga });

describe("frota da Mecanizada", () => {
  it("tem 42 equipamentos (41 da planilha e o Ultravac)", () => {
    expect(TOTAL_FROTA).toBe(42);
  });
  it("acha a placa com ou sem hífen e em minúsculas", () => {
    expect(sem("egc-2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(sem("EGC2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(sem("EGC-2984")?.tipo).toBe("pg");
    expect(sem("DSY6471")?.tipo).toBe("hv");
  });
  it("placa Mercosul e antiga são a mesma (5º caractere 0-9 <-> A-J)", () => {
    expect(formasPlaca("DYB7C10")).toEqual(["DYB7C10", "DYB7210"]);
    expect(formasPlaca("dyb-7210")).toEqual(["DYB7210", "DYB7C10"]);
    expect(formasPlaca("PUB2F80")).toEqual(["PUB2F80", "PUB2580"]);
    expect(formasPlaca("EGC29852")).toEqual(["EGC29852"]);
    expect(sem("DYB7C10")).toEqual({ tipo: "av", nome: "DYB-7210", ordem: 6 });
  });
  it("aspirador é achado pelo número da vaga (as placas no GAUSS não são confiáveis)", () => {
    expect(sem("ASP12-RESERVA", "ASPIRADOR INDUSTRIAL - GPS - 05")).toEqual({ tipo: "as", nome: "Aspirador 05", ordem: 5 });
    expect(sem("ASPII", "ASPIRADOR INDUSTRIAL - GPS - 01")).toEqual({ tipo: "as", nome: "Aspirador 01", ordem: 1 });
    expect(sem("ASP99", "ASPIRADOR INDUSTRIAL - GPS - 11")).toBeNull();
  });
  it("Ultravac é tipo próprio", () => {
    expect(sem("OWU1596")).toEqual({ tipo: "uv", nome: "OWU-1596", ordem: 1 });
  });
  it("veículo de fora e motor secundário sozinho não são equipamentos", () => {
    expect(sem("EOF5208")).toBeNull();
    expect(sem("DTW5E38")).toBeNull();
    expect(sem("EGC29852")).toBeNull();
  });
  it("nome e ordem da planilha", () => {
    const a = { placa: "ASP12", equip: { tipo: "as" as const, nome: "Aspirador 03", ordem: 3 } };
    const b = { placa: "EGC2985", equip: { tipo: "ap" as const, nome: "EGC-2985", ordem: 11 } };
    const c = { placa: "CZC0453", equip: { tipo: "ap" as const, nome: "CZC-0453", ordem: 1 } };
    expect(nomeEquip(a)).toBe("Aspirador 03");
    expect(nomeEquip({ placa: "XYZ1234" })).toBe("XYZ1234");
    expect([a, b, c].sort(compararEquip).map((x) => x.placa)).toEqual(["CZC0453", "EGC2985", "ASP12"]);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/equipamentos.test.ts`
Expected: FAIL (`Failed to resolve import "./equipamentos"`).

- [ ] **Step 4: Implementação**

`src/lib/dominio/equipamentos.ts`:

```ts
// A frota da Mecanizada (planilha "LOCAÇÃO - GPS", 03/10/2026). O GAUSS tem outros veículos da empresa: só estes
// (e o motor secundário deles) aparecem no sistema. Entrou ou saiu um equipamento: muda a lista aqui e publica.
import type { Equip, TipoEquip, Veiculo } from "../tipos";
import { pad } from "./formato";
import { normPlaca } from "./frota";

export const ORDEM_TIPOS: TipoEquip[] = ["ap", "av", "hv", "uv", "pg", "as"];
export const TIPOS_EQUIP: Record<TipoEquip, { sigla: string; rotulo: string }> = {
  ap: { sigla: "AP", rotulo: "Alta Pressão" },
  av: { sigla: "AV", rotulo: "Alto Vácuo" },
  hv: { sigla: "HV", rotulo: "Hiper Vácuo" },
  uv: { sigla: "UV", rotulo: "Ultravac" },
  pg: { sigla: "PG", rotulo: "Poliguindaste (Brook)" },
  as: { sigla: "AS", rotulo: "Aspiradores" },
};

const PLACAS: Record<Exclude<TipoEquip, "as">, string[]> = {
  ap: ["CZC-0453", "DSY-6472", "DSY-6474", "DSY-6475", "EAM-3253", "EAM-3255", "EAM-3256", "EAM-3262", "EGC-2978", "EGC-2983", "EGC-2985", "EGC-2989", "EZS-8764", "PUB-2F80"],
  av: ["ALY-5322", "ANF-2676", "CUB-0763", "DSY-6473", "DSY-6577", "DYB-7210", "EAM-3251", "EAM-3257", "EGC-2993", "FSA-3D71", "HJS-1097"],
  hv: ["DSY-6471", "EGC-1875", "FHD-9264"],
  // no GAUSS está no grupo "CAMINHÃO HIPER VÁCUO"
  uv: ["OWU-1596"],
  pg: ["DSY-6477", "EGC-2984", "EPN-2463"],
};
// aspiradores: pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"); as placas no GAUSS (ASPII, ASP12-RESERVA) não servem
const ASPIRADORES = 10;
const VAGA_ASPIRADOR = /ASPIRADOR.*GPS\s*-\s*(\d{1,2})(?!\d)/i;

export const TOTAL_FROTA = Object.values(PLACAS).reduce((n, l) => n + l.length, 0) + ASPIRADORES;

/** Placa antiga (AAA9999) e Mercosul (AAA9A99) são a mesma: o 5º caractere troca 0-9 <-> A-J. */
export function formasPlaca(placa: string): string[] {
  const n = normPlaca(placa);
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(n)) return [n];
  const c = n[4];
  const troca = /\d/.test(c) ? String.fromCharCode(65 + Number(c)) : c <= "J" ? String(c.charCodeAt(0) - 65) : null;
  return troca ? [n, `${n.slice(0, 4)}${troca}${n.slice(5)}`] : [n];
}

const POR_PLACA = new Map<string, Equip>();
for (const tipo of Object.keys(PLACAS) as (keyof typeof PLACAS)[]) {
  PLACAS[tipo].forEach((nome, i) => {
    for (const f of formasPlaca(nome)) POR_PLACA.set(f, { tipo, nome, ordem: i + 1 });
  });
}

/** Equipamento da frota que este veículo do GAUSS é, ou null (veículo de fora ou motor secundário). */
export function identificarEquip(v: Pick<Veiculo, "placa" | "vaga">): Equip | null {
  const asp = VAGA_ASPIRADOR.exec(v.vaga ?? "");
  if (asp) {
    const n = Number(asp[1]);
    if (n >= 1 && n <= ASPIRADORES) return { tipo: "as", nome: `Aspirador ${pad(n)}`, ordem: n };
  }
  for (const f of formasPlaca(v.placa)) {
    const e = POR_PLACA.get(f);
    if (e) return e;
  }
  return null;
}

/** Nome para a tela: o da planilha ("EGC-2985", "Aspirador 05"); sem equipamento, a placa do GAUSS. */
export const nomeEquip = (v: Pick<Veiculo, "placa" | "equip">) => v.equip?.nome ?? v.placa;

/** Ordem da planilha: tipo e posição na lista; sem equipamento vai para o fim. */
export function compararEquip(a: Pick<Veiculo, "placa" | "equip">, b: Pick<Veiculo, "placa" | "equip">): number {
  const ta = a.equip ? ORDEM_TIPOS.indexOf(a.equip.tipo) : ORDEM_TIPOS.length;
  const tb = b.equip ? ORDEM_TIPOS.indexOf(b.equip.tipo) : ORDEM_TIPOS.length;
  return ta - tb || (a.equip?.ordem ?? 0) - (b.equip?.ordem ?? 0) || a.placa.localeCompare(b.placa);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/equipamentos.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 6: Conferência e commit**

```bash
npx vitest run && npm run typecheck && npm run lint
git add src/lib/tipos.ts src/lib/dominio/equipamentos.ts src/lib/dominio/equipamentos.test.ts
git commit -m "Lista da frota da Mecanizada por tipo de equipamento (placa Mercosul e aspirador pela vaga)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Só a frota no retrato e nos eventos, e a abertura do dia (coletor)

**Files:**
- Create: `src/lib/dominio/frota-propria.ts`, `src/lib/dominio/frota-propria.test.ts`
- Modify: `src/lib/tipos.ts` (evento `abertura`), `src/lib/dados/esquemas.ts` (enum), `src/lib/dados/esquemas.test.ts`, `src/lib/dominio/eventos.ts` (texto e rótulo da abertura), `coletor/run.ts`

**Interfaces:**
- Consumes: `identificarEquip` (Tarefa 1).
- Produces:
  - `Evento` com a variante `{ tipo: "abertura"; status: string; area: string; sem_sinal: boolean }` e `TipoEvento` incluindo `"abertura"`.
  - De `frota-propria.ts`:
    - `aplicarFrota(r: Retrato): Retrato`
    - `idsDaFrota(r: Retrato): Set<string>`
    - `eventosDaFrota(es: Evento[], ids: ReadonlySet<string>): Evento[]`
    - `eventosAbertura(r: Retrato, agoraISO: string): Evento[]`
    - `precisaAbertura(ultima: { dia: string } | null, hoje: string): boolean`

- [ ] **Step 1: Tipo do evento novo**

Em `src/lib/tipos.ts`:

```ts
export type TipoEvento = "entrada" | "saida" | "status" | "sinal_perdido" | "sinal_retomado" | "abertura";
```

e, no fim da união `Evento`, depois da linha do `sinal_retomado`, acrescente:

```ts
    /** 1º ciclo do coletor no dia: status e área de cada equipamento (o Dia da frota parte daqui; não é alerta) */
    | { tipo: "abertura"; status: string; area: string; sem_sinal: boolean }
```

Em `src/lib/dados/esquemas.ts`, troque o enum do evento:

```ts
const evento = z.looseObject({ t: z.string(), tipo: z.enum(["entrada", "saida", "status", "sinal_perdido", "sinal_retomado", "abertura"]), id: z.string(), placa: z.string() });
```

Em `src/lib/dominio/eventos.ts`, a união nova obriga a tratar a abertura:

```ts
export const ROTULO_TIPO: Record<Evento["tipo"], string> = { entrada: "Entrada", saida: "Saída", status: "Status", sinal_perdido: "Sem sinal", sinal_retomado: "Sinal voltou", abertura: "Início do dia" };

export const grupoDoEvento = (e: Pick<Evento, "tipo">): GrupoEvento => (e.tipo === "sinal_perdido" || e.tipo === "sinal_retomado" ? "sinal" : e.tipo === "abertura" ? "status" : e.tipo);
```

e, em `textoEvento`, um caso novo antes do fecho do `switch`:

```ts
    case "abertura":
      return { ...base, acao: "início do dia:", alvo: e.status, extra: e.area ? ` · ${e.area}` : "" };
```

- [ ] **Step 2: Testes que falham**

`src/lib/dominio/frota-propria.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Evento, Retrato, Veiculo } from "../tipos";
import { aplicarFrota, eventosAbertura, eventosDaFrota, idsDaFrota, precisaAbertura } from "./frota-propria";

const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "1", placa: "AAA0001", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: null, area: "PATIO", area_desde: null, via: "", sem_sinal: false, ...o,
});
const retrato = (veiculos: Veiculo[]): Retrato => ({ lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos });

// como o coletor grava hoje (antes do filtro): todos os veículos, sem "equip"
const ANTIGO = retrato([
  v({ id: "10", placa: "EGC2985", grupo: "CAMINHÃO ALTA PRESSÃO", motor2: { id: "11", placa: "EGC29852", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
  v({ id: "11", placa: "EGC29852", grupo: "CAMINHÃO ALTA PRESSÃO", motor2_de: "10" }),
  v({ id: "40", placa: "ASP12", vaga: "ASPIRADOR INDUSTRIAL - GPS - 03", grupo: "ASPIRADOR" }),
  v({ id: "90", placa: "EOF5208", grupo: "CAMINHÃO ALTA PRESSÃO" }),
  v({ id: "91", placa: "EOF52082", grupo: "CAMINHÃO ALTA PRESSÃO", motor2_de: "90" }),
  v({ id: "92", placa: "QQQ1A23", grupo: "VEÍCULO LEVE" }),
]);

describe("só a frota da Mecanizada", () => {
  it("retrato antigo (sem equip): fica a frota e o motor 2º dela, identificados pela placa/vaga", () => {
    const r = aplicarFrota(ANTIGO);
    expect(r.veiculos.map((x) => x.id)).toEqual(["10", "11", "40"]);
    expect(r.veiculos.map((x) => x.equip?.nome)).toEqual(["EGC-2985", "EGC-2985", "Aspirador 03"]);
  });
  it("fora_da_lista: só placas de grupos da frota que não estão na planilha", () => {
    expect(aplicarFrota(ANTIGO).fora_da_lista).toEqual(["EOF5208"]);
  });
  it("respeita o equip já gravado pelo coletor", () => {
    const r = aplicarFrota(retrato([v({ id: "5", placa: "SEMPLACA", equip: { tipo: "uv", nome: "OWU-1596", ordem: 1 } })]));
    expect(r.veiculos.map((x) => x.equip?.tipo)).toEqual(["uv"]);
  });
  it("retrato vazio continua vazio", () => {
    expect(aplicarFrota(retrato([])).veiculos).toEqual([]);
  });
  it("eventos: ficam os da frota (inclusive os do motor 2º), saem os de fora", () => {
    const ids = idsDaFrota(aplicarFrota(ANTIGO));
    const base = { t: "2026-10-03T12:00:00.000Z", vaga: "", tipo: "entrada" as const, area: "P", lat: 0, lng: 0 };
    const es: Evento[] = [
      { ...base, id: "10", placa: "EGC2985" },
      { ...base, id: "11", placa: "EGC29852", motor2: true, principal_id: "10" },
      { ...base, id: "90", placa: "EOF5208" },
    ];
    expect(eventosDaFrota(es, ids).map((e) => e.id)).toEqual(["10", "11"]);
  });
  it("abertura do dia: um evento por equipamento (sem o motor 2º), com status, área e sinal", () => {
    const ab = eventosAbertura(aplicarFrota(ANTIGO), "2026-10-03T03:02:00.000Z");
    expect(ab.map((e) => e.id)).toEqual(["10", "40"]);
    expect(ab[0]).toEqual({ t: "2026-10-03T03:02:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "abertura", status: "Ligado", area: "PATIO", sem_sinal: false });
  });
  it("abertura só no 1º ciclo de cada dia", () => {
    expect(precisaAbertura(null, "2026-10-03")).toBe(true);
    expect(precisaAbertura({ dia: "2026-10-02" }, "2026-10-03")).toBe(true);
    expect(precisaAbertura({ dia: "2026-10-03" }, "2026-10-03")).toBe(false);
  });
});
```

Em `src/lib/dados/esquemas.test.ts`, acrescente ao arquivo (ajuste o `import` existente para incluir `validarEvento`, se ainda não estiver):

```ts
describe("evento de abertura do dia", () => {
  it("é aceito", () => {
    const e = { t: "2026-10-03T03:02:00.000Z", tipo: "abertura", id: "10", placa: "EGC2985", vaga: "", status: "Ligado", area: "PATIO", sem_sinal: false };
    expect(validarEvento(e)).toEqual(e);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/frota-propria.test.ts src/lib/dados/esquemas.test.ts`
Expected: FAIL (`Failed to resolve import "./frota-propria"`). O teste do esquema já passa por causa do Step 1.

- [ ] **Step 4: Implementação**

`src/lib/dominio/frota-propria.ts`:

```ts
// O sistema mostra só a frota da Mecanizada (equipamentos.ts). O coletor filtra o retrato e os eventos antes de
// gravar; o site aplica a mesma regra ao ler (retrato e eventos gravados antes do filtro). O estado do coletor
// (loc_kv.estado) continua com todos os veículos: o pareamento do motor 2º precisa deles.
import type { Equip, Evento, Retrato } from "../tipos";
import { identificarEquip } from "./equipamentos";

// grupos do GAUSS onde a frota está: veículo desses grupos fora da planilha vai para fora_da_lista (equipamento novo?)
const GRUPO_DA_FROTA = /ALTA PRESS|V[AÁ]CUO|BROOK|ASPIRADOR|ULTRAVAC/i;

/** Retrato só com a frota: cada veículo ganha `equip`; o motor 2º fica se o caminhão dele é da frota. */
export function aplicarFrota(r: Retrato): Retrato {
  const equipDe = new Map<string, Equip>();
  for (const v of r.veiculos) {
    if (v.motor2_de) continue;
    const e = v.equip ?? identificarEquip(v);
    if (e) equipDe.set(v.id, e);
  }
  const veiculos = r.veiculos.flatMap((v) => {
    const e = equipDe.get(v.motor2_de ?? v.id);
    return e ? [{ ...v, equip: e }] : [];
  });
  const fora = r.veiculos
    .filter((v) => !v.motor2_de && !equipDe.has(v.id) && GRUPO_DA_FROTA.test(v.grupo ?? ""))
    .map((v) => v.placa)
    .sort();
  return { ...r, veiculos, fora_da_lista: fora };
}

/** ids que ficam no sistema (equipamentos e seus motores 2º) de um retrato já passado por aplicarFrota. */
export const idsDaFrota = (r: Retrato) => new Set(r.veiculos.map((v) => v.id));

export const eventosDaFrota = (es: Evento[], ids: ReadonlySet<string>) => es.filter((e) => ids.has(e.id) || (!!e.principal_id && ids.has(e.principal_id)));

/** "Abertura do dia": status e área de cada equipamento no 1º ciclo do dia (nenhuma consulta a mais ao GAUSS). */
export function eventosAbertura(r: Retrato, agoraISO: string): Evento[] {
  return r.veiculos
    .filter((v) => !v.motor2_de)
    .map((v) => ({ t: agoraISO, id: v.id, placa: v.placa, vaga: v.vaga, tipo: "abertura" as const, status: v.status, area: v.area, sem_sinal: v.sem_sinal }));
}

export const precisaAbertura = (ultima: { dia: string } | null, hoje: string) => ultima?.dia !== hoje;
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/frota-propria.test.ts src/lib/dados/esquemas.test.ts`
Expected: PASS.

- [ ] **Step 6: Coletor**

Em `coletor/run.ts`, acrescente o import:

```ts
import { aplicarFrota, eventosAbertura, eventosDaFrota, idsDaFrota, precisaAbertura } from "../src/lib/dominio/frota-propria";
```

Dentro do `try` de `main()`, troque o bloco que vai de `const r = processarLeitura(...)` até o `console.log(`✅ ${posicoes.length} veículos...`)` por:

```ts
    const r = processarLeitura(estado, posicoes, cercas, agora);
    estado = r.estado;
    await kvSet("estado", estado);
    // só a frota da Mecanizada vai para o banco (o estado guarda todos: o pareamento do motor 2º precisa)
    const frota = aplicarFrota(montarSnapshot(estado, { lido_em: agora.toISOString(), erro: null, intervalo_s: INTERVALO_S }));
    const eventos = eventosDaFrota(r.eventos, idsDaFrota(frota));
    const abrirDia = precisaAbertura(await kvGet<{ dia: string }>("abertura"), hoje);
    if (abrirDia) eventos.push(...eventosAbertura(frota, agora.toISOString()));
    if (eventos.length) {
      await ok(db().from("loc_eventos").insert(eventos.map((e) => ({ dia: diaLocal(new Date(e.t)), t: e.t, tipo: e.tipo, veiculo_id: e.id, dados: e }))));
    }
    // marca a abertura só depois de gravada: se o insert falhar, o próximo ciclo tenta de novo
    if (abrirDia) await kvSet("abertura", { dia: hoje });
    console.log(`✅ ${posicoes.length} veículos (${frota.veiculos.filter((v) => !v.motor2_de).length} da frota), ${eventos.length} eventos${abrirDia ? " (com abertura do dia)" : ""}`);
```

No `finally`, envolva o retrato gravado com `aplicarFrota`:

```ts
    await kvSet(
      "snapshot",
      aplicarFrota(
        montarSnapshot(estado, {
          lido_em: erro ? (anterior.lido_em ?? null) : agora.toISOString(),
          erro,
          intervalo_s: INTERVALO_S,
          gauss: { desde: new Date(`${hoje}T00:00:00`).toISOString(), ...carga, pausadoAte: estatisticas.pausadoAte },
        }),
      ),
    );
```

Atualize o comentário do topo de `run.ts`, no item 2:

```ts
//   2. estado + eventos -> Supabase; retrato (snapshot) para a página — só a frota da Mecanizada (frota-propria.ts),
//      e no 1º ciclo do dia a "abertura" (status e área de cada equipamento, para o Dia da frota)
```

**Não rode o coletor.** A conferência é o typecheck: o `tsconfig` do site inclui `coletor/` (se `npm run typecheck` não cobrir `coletor/run.ts`, rode também `npx tsc --noEmit -p coletor` caso exista `coletor/tsconfig.json`).

- [ ] **Step 7: Conferência e commit**

Run: `npx vitest run && npm run typecheck && npm run lint`
Expected: tudo passa. `coletor/paridade.test.ts` continua igual, porque o filtro vem depois de `processarLeitura`/`montarSnapshot`.

```bash
git add src/lib/tipos.ts src/lib/dados/esquemas.ts src/lib/dados/esquemas.test.ts src/lib/dominio/eventos.ts src/lib/dominio/frota-propria.ts src/lib/dominio/frota-propria.test.ts coletor/run.ts
git commit -m "Coletor grava só a frota da Mecanizada e a abertura do dia (status e área de cada equipamento)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: O site lê só a frota; a abertura não é alerta

**Files:**
- Modify: `src/lib/dados/leituras.ts`, `src/lib/dados/leituras.test.ts`, `src/lib/dados/use-eventos.ts`, `src/lib/dominio/eventos.ts`, `src/lib/dominio/eventos.test.ts`, `src/lib/busca.ts`, `src/app/alertas/_componentes/alertas.tsx`, `src/app/_localizacao/localizacao.tsx`

**Interfaces:**
- Consumes: `aplicarFrota`, `idsDaFrota`, `eventosDaFrota` (Tarefa 2).
- Produces:
  - `lerRetrato()` devolve o retrato já filtrado, com `equip` em cada veículo.
  - `useEventos(dia)` devolve só os eventos da frota (abertura incluída). `carregando` fica `true` até chegar o retrato.
  - `ehAlerta(e: Evento): boolean`.
  - `filtrarEventos` e `contarPorGrupo` ignoram a abertura.

- [ ] **Step 1: Testes que falham**

Em `src/lib/dominio/eventos.test.ts` (ajuste o `import` para incluir `contarPorGrupo`, `ehAlerta`, `filtrarEventos` e `TODOS_GRUPOS`, se ainda não estiverem):

```ts
describe("abertura do dia", () => {
  const abertura = { t: "2026-10-03T03:02:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "abertura" as const, status: "Ligado", area: "PATIO", sem_sinal: false };
  const entrada = { t: "2026-10-03T12:00:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "entrada" as const, area: "PATIO", lat: 0, lng: 0 };
  it("abertura não é alerta: fora da lista e das contagens", () => {
    expect(ehAlerta(abertura)).toBe(false);
    expect(ehAlerta(entrada)).toBe(true);
    expect(filtrarEventos([abertura, entrada], new Set(TODOS_GRUPOS), "")).toEqual([entrada]);
    expect(contarPorGrupo([abertura, entrada])).toEqual({ entrada: 1, saida: 0, status: 0, sinal: 0 });
  });
});
```

Em `src/lib/dados/leituras.test.ts`, acrescente (ajuste o `import` para `import { lerEventos, lerRetrato } from "./leituras";`):

```ts
describe("lerRetrato", () => {
  it("devolve só a frota, com o equipamento de cada veículo", async () => {
    const veiculo = (id: string, placa: string, grupo: string) => ({ id, placa, vaga: "", grupo, status: "Ligado", status_cod: 1, lat: 1, lng: 1, posicao_em: null, area: "", via: "", sem_sinal: false });
    const valor = { lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [veiculo("10", "EGC2985", "CAMINHÃO ALTA PRESSÃO"), veiculo("90", "EOF5208", "CAMINHÃO ALTA PRESSÃO")] };
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { valor }, error: null }) };
    const r = await lerRetrato({ from: () => q } as unknown as SupabaseClient);
    expect(r.veiculos.map((v) => [v.id, v.equip?.nome])).toEqual([["10", "EGC-2985"]]);
    expect(r.fora_da_lista).toEqual(["EOF5208"]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/eventos.test.ts src/lib/dados/leituras.test.ts`
Expected: FAIL (`ehAlerta` não existe; `lerRetrato` devolve também o EOF5208).

- [ ] **Step 3: Implementação**

Em `src/lib/dominio/eventos.ts`, acrescente depois de `chaveEvento`:

```ts
/** A abertura do dia (coletor) é dado para o Dia da frota, não alerta. */
export const ehAlerta = (e: Pick<Evento, "tipo">) => e.tipo !== "abertura";
```

e troque `filtrarEventos` e `contarPorGrupo`:

```ts
export function filtrarEventos(es: Evento[], grupos: ReadonlySet<GrupoEvento>, busca: string): Evento[] {
  const q = busca.trim().toUpperCase();
  return es
    .filter((e) => ehAlerta(e) && grupos.has(grupoDoEvento(e)) && (!q || `${e.placa} ${e.principal ?? ""} ${e.area}`.toUpperCase().includes(q)))
    .sort((a, b) => b.t.localeCompare(a.t));
}

export function contarPorGrupo(es: Evento[]): Record<GrupoEvento, number> {
  const c: Record<GrupoEvento, number> = { entrada: 0, saida: 0, status: 0, sinal: 0 };
  for (const e of es) if (ehAlerta(e)) c[grupoDoEvento(e)]++;
  return c;
}
```

Em `src/lib/dados/leituras.ts`:

```ts
import { aplicarFrota } from "../dominio/frota-propria";
```

```ts
/** Retrato da frota (loc_kv.snapshot), só com os equipamentos da Mecanizada. Antes da 1ª leitura do coletor: retrato vazio. */
export async function lerRetrato(c: SupabaseClient = db()): Promise<Retrato> {
  const r = (await ok(c.from("loc_kv").select("valor").eq("chave", "snapshot").maybeSingle())) as { valor: unknown } | null;
  return aplicarFrota(validarRetrato(r?.valor));
}
```

Em `src/lib/dados/use-eventos.ts`, troque os imports e o fim do hook:

```ts
import { useEffect, useMemo, useState } from "react";
import { diaLocal } from "../dominio/formato";
import { eventosDaFrota, idsDaFrota } from "../dominio/frota-propria";
import type { Evento } from "../tipos";
import { db } from "../supabase/cliente";
import { validarEvento } from "./esquemas";
import { lerEventos } from "./leituras";
import { useRetrato } from "./use-retrato";
```

```ts
/** Eventos do dia, só da frota da Mecanizada; no dia de hoje, os novos chegam ao vivo (Realtime). */
export function useEventos(dia: string): { eventos: Evento[]; carregando: boolean; erro: string | null } {
  const [carga, setCarga] = useState<Carga | null>(null);
  const { retrato } = useRetrato();
  // (o useEffect que lê e assina continua igual)
  ...
  const atual = carga?.dia === dia ? carga : null;
  // eventos gravados antes do filtro do coletor: a frota vem do retrato atual
  const ids = useMemo(() => (retrato ? idsDaFrota(retrato) : null), [retrato]);
  const eventos = useMemo(() => (atual && ids ? eventosDaFrota(atual.eventos, ids) : []), [atual, ids]);
  return { eventos, carregando: !atual || !ids, erro: atual?.erro ?? null };
}
```

(Mantenha o `useEffect` existente entre `useRetrato()` e `const atual`, sem mudar nada nele.)

Em `src/lib/busca.ts`, a busca de eventos ignora a abertura:

```ts
import { ehAlerta, textoEvento, textoPlano } from "./dominio/eventos";
```

```ts
  const eventos = d.eventos.filter((e) => ehAlerta(e) && norm(`${textoPlano(textoEvento(e))} ${e.area}`).includes(qn)).sort((a, b) => b.t.localeCompare(a.t));
```

Em `src/app/alertas/_componentes/alertas.tsx`, o total e o detalhe usam só alertas:

```ts
import { GRUPOS, ROTULO_TIPO, TODOS_GRUPOS, agruparPorHora, chaveEvento, contarPorGrupo, ehAlerta, filtrarEventos, grupoDoEvento, veiculoDoEvento, type GrupoEvento } from "@/lib/dominio/eventos";
```

```ts
  const { eventos: doDia, carregando, erro } = useEventos(dia);
  // a abertura do dia (coletor) não é alerta
  const eventos = useMemo(() => doDia.filter(ehAlerta), [doDia]);
```

Em `src/app/_localizacao/localizacao.tsx`, o mesmo para a aba de eventos:

```ts
import { ehAlerta } from "@/lib/dominio/eventos";
```

```ts
  const { eventos: doDia } = useEventos(diaEventos);
  const eventos = useMemo(() => doDia.filter(ehAlerta), [doDia]);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/eventos.test.ts src/lib/dados/leituras.test.ts`
Expected: PASS.

- [ ] **Step 5: Conferência e commit**

```bash
npx vitest run && npm run typecheck && npm run lint
git add src/lib/dados src/lib/dominio/eventos.ts src/lib/dominio/eventos.test.ts src/lib/busca.ts src/app/alertas/_componentes/alertas.tsx src/app/_localizacao/localizacao.tsx
git commit -m "Site lê só a frota da Mecanizada; a abertura do dia fica fora dos alertas e da busca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Capítulos do dia (regra pura)

**Files:**
- Create: `src/lib/dominio/capitulos.ts`, `src/lib/dominio/capitulos.test.ts`

**Interfaces:**
- Consumes: `tipoCerca` (`src/lib/dominio/cercas.ts`), `segDe` (`formato.ts`), tipos `Trecho`, `TrechoParado`, `TrechoMovimento` e `EstadoTrecho`.
- Produces:
  - Constante: `MIN_CAPITULO = 15`.
  - Tipos: `TipoLugar`, `ClasseTempo`, `Capitulo`, `Deslocamento`, `FaixaLugar`, `FaixaMotor`, `Destaques`, `HistoriaDia` (definidos abaixo).
  - Funções:
    - `tipoLugar(nome: string): TipoLugar`
    - `classeTempo(e: EstadoTrecho): ClasseTempo | null`
    - `montarHistoria(trechos: Trecho[]): HistoriaDia`
    - `segCap(t: string): number` (segundos do dia de "AAAA-MM-DD HH:MM:SS")
    - `capituloEm(caps: Capitulo[], s: number): number | null`
    - `proximoCapitulo(caps: Capitulo[], s: number): Capitulo | null`

- [ ] **Step 1: Teste que falha**

`src/lib/dominio/capitulos.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EstadoTrecho, Trecho } from "../tipos";
import { MIN_CAPITULO, capituloEm, classeTempo, montarHistoria, proximoCapitulo, tipoLugar } from "./capitulos";

const D = "2026-10-01";
const P = (ini: string, fim: string, estado: Exclude<EstadoTrecho, "movimento">, local: string, min: number): Trecho => ({ estado, inicio: `${D} ${ini}:00`, fim: `${D} ${fim}:00`, duracao_min: min, local, lat: -19.48, lng: -42.53 });
const M = (ini: string, fim: string, km: number, min: number): Trecho => ({ estado: "movimento", inicio: `${D} ${ini}:00`, fim: `${D} ${fim}:00`, duracao_min: min, de: "", para: "", percurso: [], km, vel_max: 30 });

describe("tipo de lugar e classe de tempo", () => {
  it("pátio/estacionamento/oficina é base; rua, avenida e fora de cerca são vias; o resto é área de serviço", () => {
    expect(tipoLugar("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toBe("base");
    expect(tipoLugar("ESTACIONAMENTO RESTAURANTE CENTRAL")).toBe("base");
    expect(tipoLugar("OFICINA")).toBe("base");
    expect(tipoLugar("PRECIPITADOR PE 5")).toBe("servico");
    expect(tipoLugar("AV CINCO COM RUA DEZESSETE")).toBe("via");
    expect(tipoLugar("RUA VINTE E UM")).toBe("via");
    expect(tipoLugar("Fora de cerca")).toBe("via");
    expect(tipoLugar("")).toBe("via");
  });
  it("classe de tempo (único ponto da futura regra de 'trabalhando')", () => {
    expect(classeTempo("parado_ligado")).toBe("ligado");
    expect(classeTempo("desligado")).toBe("desligado");
    expect(classeTempo("parado")).toBe("desligado");
    expect(classeTempo("sem_sinal")).toBe("outro");
    expect(classeTempo("movimento")).toBeNull();
  });
});

describe("capítulos", () => {
  it("motor ligando e desligando no mesmo lugar é um capítulo só", () => {
    const h = montarHistoria([P("06:00", "06:30", "desligado", "PÁTIO 80", 30), P("06:30", "06:50", "parado_ligado", "PÁTIO 80", 20)]);
    expect(h.capitulos).toHaveLength(1);
    expect(h.capitulos[0]).toMatchObject({ n: 1, lugar: "PÁTIO 80", tipoLugar: "base", duracao_min: 50, ligado_min: 20, desligado_min: 30, inicio: `${D} 06:00:00`, fim: `${D} 06:50:00`, ate: null });
  });
  it(`parada de ${MIN_CAPITULO} min vira capítulo; de 14 min vira "passou por" no deslocamento`, () => {
    const h = montarHistoria([
      P("08:00", "08:20", "desligado", "PÁTIO 80", 20),
      M("08:20", "08:25", 1.2, 5),
      P("08:25", "08:39", "parado_ligado", "ALMOXARIFADO CENTRAL", 14),
      M("08:39", "08:44", 0.8, 5),
      P("08:44", "08:59", "parado_ligado", "ACIARIA 02", 15),
    ]);
    expect(h.capitulos.map((c) => [c.n, c.lugar])).toEqual([[1, "PÁTIO 80"], [2, "ACIARIA 02"]]);
    expect(h.capitulos[0].ate).toEqual({ km: 2, min: 24, destino: "ACIARIA 02", passou: ["ALMOXARIFADO CENTRAL"] });
    expect(h.capitulos[1].ate).toBeNull();
  });
  it("parada curta em rua não entra em 'passou por'", () => {
    const h = montarHistoria([P("08:00", "08:20", "desligado", "PÁTIO 80", 20), M("08:20", "08:25", 1, 5), P("08:25", "08:35", "parado_ligado", "AV CINCO COM RUA DEZESSETE", 10), M("08:35", "08:40", 1, 5), P("08:40", "09:00", "desligado", "ACIARIA 02", 20)]);
    expect(h.capitulos[0].ate?.passou).toEqual([]);
  });
  it("dia sem capítulo (só paradas curtas e deslocamento): lista vazia, faixas desenhadas, destaques vazios", () => {
    const h = montarHistoria([M("08:00", "08:10", 2, 10), P("08:10", "08:15", "parado_ligado", "PRECIPITADOR PE 5", 5), M("08:15", "08:20", 1, 5)]);
    expect(h.capitulos).toEqual([]);
    expect(h.faixaMotor.map((f) => f.estado)).toEqual(["movimento", "parado_ligado", "movimento"]);
    expect(h.faixaLugar.map((f) => f.tipoLugar)).toEqual(["via", "servico", "via"]);
    expect(h.destaques).toEqual({ primeiraSaidaBase: null, ultimaVoltaBase: null, areasServico: 0, maiorParadoLigado: null });
  });
  it("dia vazio", () => {
    expect(montarHistoria([])).toEqual({ capitulos: [], faixaLugar: [], faixaMotor: [], destaques: { primeiraSaidaBase: null, ultimaVoltaBase: null, areasServico: 0, maiorParadoLigado: null } });
  });
  it("faixa de lugar junta deslocamento e parada em rua numa faixa só de vias", () => {
    const h = montarHistoria([M("08:00", "08:10", 2, 10), P("08:10", "08:12", "parado_ligado", "RUA 16", 2), M("08:12", "08:20", 1, 8), P("08:20", "09:00", "desligado", "PÁTIO 80", 40)]);
    expect(h.faixaLugar).toEqual([
      { inicio: `${D} 08:00:00`, fim: `${D} 08:20:00`, tipoLugar: "via", lugar: "" },
      { inicio: `${D} 08:20:00`, fim: `${D} 09:00:00`, tipoLugar: "base", lugar: "PÁTIO 80" },
    ]);
  });
  it("destaques: primeira saída e última volta ao pátio, áreas de serviço e maior parado ligado", () => {
    const h = montarHistoria([
      P("00:00", "00:46", "parado_ligado", "PLANTA CARBOQUÍMICA", 46),
      M("00:46", "06:21", 3, 335),
      P("06:21", "08:32", "desligado", "PÁTIO DO TRANSPORTE RODOVIÁRIO", 131),
      M("08:32", "08:42", 2.8, 10),
      P("08:42", "09:52", "parado_ligado", "ALMOXARIFADO CENTRAL", 70),
      M("09:52", "18:21", 9, 509),
      P("18:21", "19:37", "desligado", "PÁTIO DO TRANSPORTE RODOVIÁRIO", 76),
    ]);
    expect(h.destaques).toEqual({
      primeiraSaidaBase: `${D} 08:32:00`,
      ultimaVoltaBase: `${D} 18:21:00`,
      areasServico: 2,
      maiorParadoLigado: { lugar: "ALMOXARIFADO CENTRAL", min: 70 },
    });
  });
  it("capítulo em que o player está e o próximo", () => {
    const h = montarHistoria([P("08:00", "08:20", "desligado", "PÁTIO 80", 20), M("08:20", "08:30", 1, 10), P("08:30", "09:00", "desligado", "ACIARIA 02", 30)]);
    const s = (hm: string) => Number(hm.slice(0, 2)) * 3600 + Number(hm.slice(3)) * 60;
    expect(capituloEm(h.capitulos, s("08:10"))).toBe(1);
    expect(capituloEm(h.capitulos, s("08:25"))).toBeNull();
    expect(proximoCapitulo(h.capitulos, s("08:10"))?.n).toBe(2);
    expect(proximoCapitulo(h.capitulos, s("08:40"))).toBeNull();
  });
});

// dias reais das amostras do coletor antigo (fora do git; sem elas o bloco é pulado)
const PASTA = new URL("../../../coletor/__amostras__/", import.meta.url);
const amostras = existsSync(PASTA) ? readdirSync(PASTA).filter((n) => n.startsWith("apontamento-")) : [];
describe.skipIf(!amostras.length)("capítulos em dias reais", () => {
  for (const nome of amostras) {
    it(`${nome}: poucos capítulos, numerados, todos de ${MIN_CAPITULO} min ou mais`, () => {
      const trechos: Trecho[] = JSON.parse(readFileSync(new URL(nome, PASTA), "utf-8")).saida.trechos;
      const h = montarHistoria(trechos);
      expect(h.capitulos.map((c) => c.n)).toEqual(h.capitulos.map((_, i) => i + 1));
      for (const c of h.capitulos) expect(c.duracao_min).toBeGreaterThanOrEqual(MIN_CAPITULO);
      if (trechos.length >= 20) expect(h.capitulos.length).toBeLessThan(trechos.length / 2);
    });
  }
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/capitulos.test.ts`
Expected: FAIL (`Failed to resolve import "./capitulos"`).

- [ ] **Step 3: Implementação**

`src/lib/dominio/capitulos.ts`:

```ts
// A história do dia na Timeline: os trechos do apontamento (dezenas por dia) viram poucos "capítulos" — paradas
// longas no mesmo lugar — ligados por deslocamentos ("→ 2,8 km até …", "passou por …"). Inspirado na Linha do tempo
// do Google Maps, no Arc Timeline e no Trips History da Geotab (spec 2026-10-04-historia-e-frota-design.md).
import type { EstadoTrecho, Trecho, TrechoMovimento, TrechoParado } from "../tipos";
import { tipoCerca } from "./cercas";
import { segDe } from "./formato";

/** Parada no mesmo lugar com pelo menos isto vira capítulo; menor vira "passou por". */
export const MIN_CAPITULO = 15;

export type TipoLugar = "base" | "servico" | "via";
export type ClasseTempo = "ligado" | "desligado" | "outro";

export interface Deslocamento {
  km: number;
  min: number;
  destino: string;
  passou: string[];
}
export interface Capitulo {
  n: number;
  lugar: string;
  tipoLugar: TipoLugar;
  inicio: string;
  fim: string;
  duracao_min: number;
  ligado_min: number;
  desligado_min: number;
  outro_min: number;
  lat: number | null;
  lng: number | null;
  /** caminho até o capítulo seguinte (null no último) */
  ate: Deslocamento | null;
}
export interface FaixaLugar {
  inicio: string;
  fim: string;
  tipoLugar: TipoLugar;
  lugar: string;
}
export interface FaixaMotor {
  inicio: string;
  fim: string;
  estado: EstadoTrecho;
}
export interface Destaques {
  primeiraSaidaBase: string | null;
  ultimaVoltaBase: string | null;
  areasServico: number;
  maiorParadoLigado: { lugar: string; min: number } | null;
}
export interface HistoriaDia {
  capitulos: Capitulo[];
  faixaLugar: FaixaLugar[];
  faixaMotor: FaixaMotor[];
  destaques: Destaques;
}

const BASE = /P[ÁA]TIO|ESTACIONAMENTO|OFICINA|GARAGEM/i;

export function tipoLugar(nome: string): TipoLugar {
  const n = nome.trim();
  if (!n || /^FORA DE CERCA$/i.test(n) || tipoCerca({ layer: 1, name: n }) === "via") return "via";
  return BASE.test(n) ? "base" : "servico";
}

/**
 * Como o tempo parado conta na barrinha e nos destaques. ÚNICO ponto da regra de "trabalhando": o dono vai definir
 * (03/10/2026) — até lá nada na tela afirma "trabalhou", só ligado/desligado.
 */
export function classeTempo(e: EstadoTrecho): ClasseTempo | null {
  if (e === "parado_ligado") return "ligado";
  if (e === "desligado" || e === "parado") return "desligado";
  if (e === "sem_sinal") return "outro";
  return null;
}

type Item = { tipo: "bloco"; lugar: string; trechos: TrechoParado[] } | { tipo: "mov"; trecho: TrechoMovimento };
type Bloco = Extract<Item, { tipo: "bloco" }>;

const soma = (ts: { duracao_min: number }[]) => ts.reduce((n, t) => n + t.duracao_min, 0);

/** Paradas seguidas no mesmo lugar formam um bloco (o motor pode ligar e desligar no meio). */
function itens(trechos: Trecho[]): Item[] {
  const r: Item[] = [];
  for (const t of trechos) {
    if (t.estado === "movimento") {
      r.push({ tipo: "mov", trecho: t });
      continue;
    }
    const lugar = (t.local ?? "").trim();
    const ult = r.at(-1);
    if (ult?.tipo === "bloco" && ult.lugar === lugar) ult.trechos.push(t);
    else r.push({ tipo: "bloco", lugar, trechos: [t] });
  }
  return r;
}

function capituloDe(b: Bloco, n: number): Capitulo {
  const min = (c: ClasseTempo) => soma(b.trechos.filter((t) => classeTempo(t.estado) === c));
  const comPos = b.trechos.find((t) => t.lat != null && t.lng != null);
  return {
    n,
    lugar: b.lugar || "Fora de área",
    tipoLugar: tipoLugar(b.lugar),
    inicio: b.trechos[0].inicio,
    fim: b.trechos[b.trechos.length - 1].fim,
    duracao_min: soma(b.trechos),
    ligado_min: min("ligado"),
    desligado_min: min("desligado"),
    outro_min: min("outro"),
    lat: comPos?.lat ?? null,
    lng: comPos?.lng ?? null,
    ate: null,
  };
}

function deslocamento(entre: Item[], destino: string): Deslocamento {
  let km = 0;
  let min = 0;
  const passou: string[] = [];
  for (const it of entre) {
    if (it.tipo === "mov") {
      km += it.trecho.km;
      min += it.trecho.duracao_min;
      continue;
    }
    min += soma(it.trechos);
    if (tipoLugar(it.lugar) !== "via" && !passou.includes(it.lugar)) passou.push(it.lugar);
  }
  return { km: Math.round(km * 10) / 10, min: Math.round(min), destino, passou };
}

function faixaLugar(trechos: Trecho[]): FaixaLugar[] {
  const r: FaixaLugar[] = [];
  for (const t of trechos) {
    const nome = t.estado === "movimento" ? "" : (t.local ?? "").trim();
    const tl = t.estado === "movimento" ? "via" : tipoLugar(nome);
    const lugar = tl === "via" ? "" : nome;
    const ult = r.at(-1);
    if (ult && ult.tipoLugar === tl && ult.lugar === lugar) ult.fim = t.fim;
    else r.push({ inicio: t.inicio, fim: t.fim, tipoLugar: tl, lugar });
  }
  return r;
}

function faixaMotor(trechos: Trecho[]): FaixaMotor[] {
  const r: FaixaMotor[] = [];
  for (const t of trechos) {
    const ult = r.at(-1);
    if (ult && ult.estado === t.estado) ult.fim = t.fim;
    else r.push({ inicio: t.inicio, fim: t.fim, estado: t.estado });
  }
  return r;
}

function destaques(cs: Capitulo[]): Destaques {
  const saida = cs.find((c, i) => c.tipoLugar === "base" && i < cs.length - 1 && cs[i + 1].lugar !== c.lugar);
  let volta: Capitulo | null = null;
  for (let i = cs.length - 1; i > 0; i--) {
    if (cs[i].tipoLugar === "base" && cs[i - 1].lugar !== cs[i].lugar) {
      volta = cs[i];
      break;
    }
  }
  const maior = cs.reduce<Capitulo | null>((m, c) => (c.ligado_min > (m?.ligado_min ?? 0) ? c : m), null);
  return {
    primeiraSaidaBase: saida?.fim ?? null,
    ultimaVoltaBase: volta?.inicio ?? null,
    areasServico: new Set(cs.filter((c) => c.tipoLugar === "servico").map((c) => c.lugar)).size,
    maiorParadoLigado: maior && maior.ligado_min >= MIN_CAPITULO ? { lugar: maior.lugar, min: maior.ligado_min } : null,
  };
}

/** Trechos do dia -> capítulos, as duas faixas (onde estava / motor) e os destaques. */
export function montarHistoria(trechos: Trecho[]): HistoriaDia {
  const capitulos: Capitulo[] = [];
  let entre: Item[] = [];
  for (const it of itens(trechos)) {
    if (it.tipo === "bloco" && soma(it.trechos) >= MIN_CAPITULO) {
      const c = capituloDe(it, capitulos.length + 1);
      const ant = capitulos.at(-1);
      if (ant) ant.ate = deslocamento(entre, c.lugar);
      capitulos.push(c);
      entre = [];
    } else entre.push(it);
  }
  return { capitulos, faixaLugar: faixaLugar(trechos), faixaMotor: faixaMotor(trechos), destaques: destaques(capitulos) };
}

/** Segundos do dia de "AAAA-MM-DD HH:MM:SS" (horário local, como os trechos). */
export const segCap = (t: string) => segDe(t.slice(11, 19));

/** Número do capítulo em que o instante s (segundos do dia) cai, ou null (em deslocamento). */
export function capituloEm(caps: Capitulo[], s: number): number | null {
  return caps.find((c) => segCap(c.inicio) <= s && s <= segCap(c.fim))?.n ?? null;
}

/** Primeiro capítulo que começa depois de s (botão "próximo capítulo"). */
export function proximoCapitulo(caps: Capitulo[], s: number): Capitulo | null {
  return caps.find((c) => segCap(c.inicio) > s + 1) ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/capitulos.test.ts`
Expected: PASS. O bloco "dias reais" também passa quando `coletor/__amostras__/` existe.

- [ ] **Step 5: Conferência e commit**

```bash
npx vitest run && npm run typecheck && npm run lint
git add src/lib/dominio/capitulos.ts src/lib/dominio/capitulos.test.ts
git commit -m "Capítulos do dia: paradas longas no mesmo lugar, deslocamentos entre elas, faixas e destaques

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Dia da frota (regra pura)

**Files:**
- Create: `src/lib/dominio/dia-frota.ts`, `src/lib/dominio/dia-frota.test.ts`
- Modify: `src/lib/dominio/formato.ts`, `src/lib/dominio/formato.test.ts` (`fmtHoras`, `hmDoMinuto`)

**Interfaces:**
- Consumes: `compararEquip`, `nomeEquip`, `ORDEM_TIPOS` (Tarefa 1); `Evento` com abertura (Tarefa 2).
- Produces:
  - Tipos: `EstadoFaixa`, `FaixaFrota`, `LinhaFrota`, `GrupoFrota`, `OrdemFrota` (definidos abaixo).
  - Funções:
    - `estadoDoStatus(status: string): EstadoFaixa`
    - `minutoDoDia(iso: string, dia: string): number`
    - `montarDiaFrota(eventos: Evento[], veiculos: Veiculo[], dia: string, agora: number, hoje: boolean): LinhaFrota[]`
    - `agruparFrota(linhas: LinhaFrota[], ordem: OrdemFrota): GrupoFrota[]`
  - Em `formato.ts`:
    - `fmtHoras(min: number): string` ("101h05", sem virar dias)
    - `hmDoMinuto(m: number): string` ("08:05")

- [ ] **Step 1: Testes que falham**

Em `src/lib/dominio/formato.test.ts` (ajuste o `import` para incluir `fmtHoras` e `hmDoMinuto`):

```ts
describe("horas do Dia da frota", () => {
  it("fmtHoras não vira dias (soma de horas ligado de um tipo inteiro)", () => {
    expect(fmtHoras(45)).toBe("0h45");
    expect(fmtHoras(6065)).toBe("101h05");
  });
  it("hmDoMinuto", () => {
    expect(hmDoMinuto(485)).toBe("08:05");
    expect(hmDoMinuto(1440)).toBe("24:00");
  });
});
```

`src/lib/dominio/dia-frota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../tipos";
import { agruparFrota, estadoDoStatus, montarDiaFrota } from "./dia-frota";

const DIA = "2026-10-01";
const iso = (hm: string) => new Date(`${DIA}T${hm}:00`).toISOString();
const min = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "10", placa: "EGC2985", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Desligado", status_cod: 2,
  status_desde: null, lat: 1, lng: 1, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false,
  equip: { tipo: "ap", nome: "EGC-2985", ordem: 11 }, ...o,
});
const base = { id: "10", placa: "EGC2985", vaga: "" };
const abertura = (hm: string, status: string, area = "PATIO", sem_sinal = false): Evento => ({ ...base, t: iso(hm), tipo: "abertura", status, area, sem_sinal });
const status = (hm: string, de: string, para: string): Evento => ({ ...base, t: iso(hm), tipo: "status", de, para, area: "PATIO", duracao_min: null });
const linha = (es: Evento[], o: { hoje?: boolean; agora?: string; veiculo?: Partial<Veiculo> } = {}) =>
  montarDiaFrota(es, [v(o.veiculo ?? {})], DIA, o.agora ? new Date(iso(o.agora)).getTime() : 0, !!o.hoje)[0];
const resumo = (l: ReturnType<typeof linha>) => l.faixas.map((f) => [f.de, f.ate, f.estado]);

describe("estado pelo texto do status do GAUSS", () => {
  it("mapeia", () => {
    expect(["Ligado", "Parado ligado", "Desligado", "Chave geral desligada", "Em manutenção", "Aguardando manutenção", "Sem comunicação +6h", "Disponível"].map(estadoDoStatus)).toEqual(
      ["ligado", "ligado", "desligado", "desligado", "manut", "manut", "sem_sinal", "desligado"],
    );
  });
});

describe("faixa de um equipamento no dia", () => {
  it("com abertura do dia", () => {
    const l = linha([abertura("00:02", "Desligado"), status("08:00", "Desligado", "Ligado"), status("10:00", "Ligado", "Desligado")]);
    expect(resumo(l)).toEqual([[0, min("08:00"), "desligado"], [min("08:00"), min("10:00"), "ligado"], [min("10:00"), 1440, "desligado"]]);
    expect(l.ligado_min).toBe(120);
    expect(l.agora).toBeNull();
  });
  it("sem abertura: o estado da meia-noite vem do 'de' do primeiro status", () => {
    expect(resumo(linha([status("08:00", "Ligado", "Desligado")]))).toEqual([[0, min("08:00"), "ligado"], [min("08:00"), 1440, "desligado"]]);
  });
  it("sem evento em dia passado: sem registro (nunca inventa)", () => {
    const l = linha([]);
    expect(resumo(l)).toEqual([[0, 1440, "sem_registro"]]);
    expect(l.ligado_min).toBe(0);
  });
  it("sem evento hoje: o status atual vale desde a meia-noite, até agora", () => {
    const l = linha([], { hoje: true, agora: "10:00", veiculo: { status: "Ligado", status_cod: 1 } });
    expect(resumo(l)).toEqual([[0, min("10:00"), "ligado"]]);
    expect(l.agora).toBe("ligado");
  });
  it("sinal perdido no meio fica 'sem sinal' por cima do status", () => {
    const es: Evento[] = [abertura("00:01", "Ligado"), { ...base, t: iso("09:00"), tipo: "sinal_perdido", ultima_posicao: null, area: "PATIO" }, { ...base, t: iso("11:00"), tipo: "sinal_retomado", area: "PATIO", sem_sinal_min: 120 }];
    expect(resumo(linha(es))).toEqual([[0, min("09:00"), "ligado"], [min("09:00"), min("11:00"), "sem_sinal"], [min("11:00"), 1440, "ligado"]]);
  });
  it("manutenção", () => {
    expect(resumo(linha([abertura("00:01", "Desligado"), status("07:00", "Desligado", "Em manutenção")]))).toEqual([[0, min("07:00"), "desligado"], [min("07:00"), 1440, "manut"]]);
  });
  it("área de cada pedaço pelas entradas e saídas", () => {
    const es: Evento[] = [abertura("00:01", "Desligado", ""), { ...base, t: iso("08:00"), tipo: "entrada", area: "PATIO 80", lat: 0, lng: 0 }, { ...base, t: iso("09:00"), tipo: "saida", area: "PATIO 80", desde: null, permanencia_min: 60 }];
    expect(linha(es).faixas.map((f) => [f.de, f.area])).toEqual([[0, ""], [min("08:00"), "PATIO 80"], [min("09:00"), ""]]);
  });
  it("ignora eventos do motor 2º e veículos sem equipamento; ordem da planilha", () => {
    const es: Evento[] = [{ ...status("08:00", "Desligado", "Ligado"), id: "11", motor2: true, principal_id: "10" }];
    const vs = [v({}), v({ id: "40", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } }), v({ id: "11", motor2_de: "10" }), v({ id: "90", equip: undefined }), v({ id: "5", equip: { tipo: "ap", nome: "CZC-0453", ordem: 1 } })];
    const ls = montarDiaFrota(es, vs, DIA, 0, false);
    expect(ls.map((l) => l.id)).toEqual(["5", "10", "40"]);
    expect(ls[1].faixas.map((f) => f.estado)).toEqual(["sem_registro"]);
  });
});

describe("agrupar por tipo", () => {
  it("cabeçalho com contagem de agora e ordem por tempo ligado", () => {
    const ls = montarDiaFrota(
      [abertura("00:01", "Ligado"), { ...abertura("00:01", "Desligado"), id: "5" }],
      [v({}), v({ id: "5", equip: { tipo: "ap", nome: "CZC-0453", ordem: 1 } }), v({ id: "40", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } })],
      DIA, new Date(iso("06:00")).getTime(), true,
    );
    const g = agruparFrota(ls, "mais");
    expect(g.map((x) => x.tipo)).toEqual(["ap", "as"]);
    expect(g[0].linhas.map((l) => l.id)).toEqual(["10", "5"]);
    expect([g[0].agoraLigados, g[0].agoraDesligados, g[0].ligado_min]).toEqual([1, 1, 360]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/dia-frota.test.ts src/lib/dominio/formato.test.ts`
Expected: FAIL (`Failed to resolve import "./dia-frota"`; `fmtHoras` não existe).

- [ ] **Step 3: Implementação**

Em `src/lib/dominio/formato.ts`, acrescente depois de `fmtMin`:

```ts
/** Horas sem virar dias (soma de horas de vários equipamentos): 0h45 · 101h05 */
export function fmtHoras(min: number): string {
  const m = Math.round(min);
  return `${Math.floor(m / 60)}h${pad(m % 60)}`;
}
/** Minuto do dia -> "HH:MM" */
export const hmDoMinuto = (m: number) => `${pad(Math.floor(m / 60))}:${pad(Math.floor(m % 60))}`;
```

`src/lib/dominio/dia-frota.ts`:

```ts
// "Dia da frota": uma faixa por equipamento ao longo do dia, montada só com os eventos que o coletor já grava
// (abertura do dia, status, entrada/saída de área, sinal) — nenhuma consulta ao GAUSS. Precisão = intervalo do
// coletor (~5 min). "Ligado" aqui é o status do GAUSS (inclui andando).
import type { Evento, TipoEquip, Veiculo } from "../tipos";
import { ORDEM_TIPOS, compararEquip, nomeEquip } from "./equipamentos";

export type EstadoFaixa = "ligado" | "desligado" | "manut" | "sem_sinal" | "sem_registro";
/** de/ate em minutos do dia (0–1440, horário local) */
export interface FaixaFrota {
  de: number;
  ate: number;
  estado: EstadoFaixa;
  status: string;
  area: string;
}
export interface LinhaFrota {
  id: string;
  nome: string;
  tipo: TipoEquip;
  vaga: string;
  faixas: FaixaFrota[];
  ligado_min: number;
  /** estado no fim da faixa quando o dia é hoje */
  agora: EstadoFaixa | null;
}
export interface GrupoFrota {
  tipo: TipoEquip;
  linhas: LinhaFrota[];
  ligado_min: number;
  agoraLigados: number;
  agoraDesligados: number;
  agoraSemSinal: number;
}
export type OrdemFrota = "tipo" | "mais" | "menos";

export function estadoDoStatus(status: string): EstadoFaixa {
  if (/^(ligado|parado ligado)$/i.test(status.trim())) return "ligado";
  if (/manuten/i.test(status)) return "manut";
  if (/sem comunica/i.test(status)) return "sem_sinal";
  return "desligado";
}

export const minutoDoDia = (iso: string, dia: string) => Math.min(1440, Math.max(0, (new Date(iso).getTime() - new Date(`${dia}T00:00:00`).getTime()) / 60000));

interface Situacao {
  status: string | null;
  semSinal: boolean;
  area: string;
}

/** Situação à meia-noite: abertura do dia, senão o "de" do 1º status, senão (hoje) o retrato; senão sem registro. */
function inicial(evs: Evento[], v: Veiculo, hoje: boolean): Situacao {
  const primeiro = evs.find((e) => e.tipo === "abertura" || e.tipo === "status");
  if (evs[0]?.tipo === "abertura") return { status: evs[0].status, semSinal: evs[0].sem_sinal, area: evs[0].area };
  const status = primeiro?.tipo === "abertura" ? primeiro.status : primeiro?.tipo === "status" ? primeiro.de : hoje ? v.status : null;
  const sinal = evs.find((e) => e.tipo === "sinal_perdido" || e.tipo === "sinal_retomado");
  const areaEv = evs.find((e) => e.tipo === "entrada" || e.tipo === "saida");
  const area = areaEv?.tipo === "saida" ? areaEv.area : areaEv?.tipo === "entrada" ? "" : primeiro?.tipo === "status" ? primeiro.area : hoje ? v.area : "";
  return { status, semSinal: sinal ? sinal.tipo === "sinal_retomado" : hoje && !evs.length ? v.sem_sinal : false, area };
}

function aplicar(s: Situacao, e: Evento): Situacao {
  switch (e.tipo) {
    case "abertura":
      return { status: e.status, semSinal: e.sem_sinal, area: e.area };
    case "status":
      return { ...s, status: e.para };
    case "entrada":
      return { ...s, area: e.area };
    case "saida":
      return { ...s, area: s.area === e.area ? "" : s.area };
    case "sinal_perdido":
      return { ...s, semSinal: true };
    case "sinal_retomado":
      return { ...s, semSinal: false };
  }
}

const estadoDe = (s: Situacao): EstadoFaixa => (s.status == null ? "sem_registro" : s.semSinal ? "sem_sinal" : estadoDoStatus(s.status));

function linhaFrota(v: Veiculo, evs: Evento[], dia: string, agora: number, hoje: boolean): LinhaFrota {
  const fim = hoje ? minutoDoDia(new Date(agora).toISOString(), dia) : 1440;
  let s = inicial(evs, v, hoje);
  let de = 0;
  const faixas: FaixaFrota[] = [];
  const fechar = (ate: number) => {
    const a = Math.min(ate, fim);
    if (a <= de) return;
    const estado = estadoDe(s);
    const ult = faixas.at(-1);
    if (ult && ult.estado === estado && ult.area === s.area && ult.status === (s.status ?? "")) ult.ate = a;
    else faixas.push({ de, ate: a, estado, status: s.status ?? "", area: s.area });
    de = a;
  };
  for (const e of evs) {
    fechar(minutoDoDia(e.t, dia));
    s = aplicar(s, e);
  }
  fechar(fim);
  const ligado_min = Math.round(faixas.filter((f) => f.estado === "ligado").reduce((n, f) => n + f.ate - f.de, 0));
  return { id: v.id, nome: nomeEquip(v), tipo: v.equip?.tipo ?? "ap", vaga: v.vaga, faixas, ligado_min, agora: hoje ? (faixas.at(-1)?.estado ?? estadoDe(s)) : null };
}

/** Uma linha por equipamento da frota (sem o motor 2º), na ordem da planilha. */
export function montarDiaFrota(eventos: Evento[], veiculos: Veiculo[], dia: string, agora: number, hoje: boolean): LinhaFrota[] {
  const porId = new Map<string, Evento[]>();
  for (const e of [...eventos].sort((a, b) => a.t.localeCompare(b.t))) {
    if (e.motor2) continue;
    const l = porId.get(e.id);
    if (l) l.push(e);
    else porId.set(e.id, [e]);
  }
  return veiculos
    .filter((v) => !v.motor2_de && v.equip)
    .sort(compararEquip)
    .map((v) => linhaFrota(v, porId.get(v.id) ?? [], dia, agora, hoje));
}

/** Grupos por tipo (só os que têm equipamento), com a contagem de agora e a ordem escolhida. */
export function agruparFrota(linhas: LinhaFrota[], ordem: OrdemFrota): GrupoFrota[] {
  return ORDEM_TIPOS.map((tipo) => {
    const ls = linhas.filter((l) => l.tipo === tipo);
    if (ordem !== "tipo") ls.sort((a, b) => (ordem === "mais" ? b.ligado_min - a.ligado_min : a.ligado_min - b.ligado_min));
    const agora = (e: EstadoFaixa) => ls.filter((l) => l.agora === e).length;
    return { tipo, linhas: ls, ligado_min: ls.reduce((n, l) => n + l.ligado_min, 0), agoraLigados: agora("ligado"), agoraDesligados: agora("desligado"), agoraSemSinal: agora("sem_sinal") };
  }).filter((g) => g.linhas.length);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/dia-frota.test.ts src/lib/dominio/formato.test.ts`
Expected: PASS.

- [ ] **Step 5: Conferência e commit**

```bash
npx vitest run && npm run typecheck && npm run lint
git add src/lib/dominio/dia-frota.ts src/lib/dominio/dia-frota.test.ts src/lib/dominio/formato.ts src/lib/dominio/formato.test.ts
git commit -m "Dia da frota: faixa de cada equipamento montada com os eventos já gravados (sem consulta ao GAUSS)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Localização — painel retrátil, aba Tipos, detalhe direto e marcador com sigla

**Files:**
- Create: `src/app/_localizacao/barra-tipos.tsx`
- Modify:
  - Regras e mapa: `src/lib/dominio/veiculo.ts`, `src/lib/dominio/veiculo.test.ts`, `src/lib/mapa/marcador.ts`, `src/lib/mapa/marcador.test.ts`, `src/lib/hooks.ts`, `src/app/globals.css`
  - Telas: `src/app/_localizacao/mapa-frota.ts`, `src/app/_localizacao/painel.tsx`, `src/app/_localizacao/detalhe.tsx`, `src/app/_localizacao/localizacao.tsx`, `src/app/_localizacao/resumo-celular.tsx`

**Interfaces:**
- Consumes: `ORDEM_TIPOS`, `TIPOS_EQUIP`, `nomeEquip`, `compararEquip` (Tarefa 1); `ehAlerta` (Tarefa 3).
- Produces:
  - `FiltroVeiculos.tipo: TipoEquip | null`
  - `RESUMO_TOPO: Indicador[]`
  - `partesEstado(v, semSinalMin, agora): { estado: string; lugar: string; semSinal: boolean }`
  - `fraseEstado(v, semSinalMin, agora): string`
  - `vagaCurta(vaga: string): string`
  - `usePreferencia(chave: string): [boolean, (v: boolean) => void]`
  - Telas e mapa:
    - `sincronizarMarcadores(L, c, veiculos, visiveis, sel, semSinalMin, agora, aoClicar)` (sem o parâmetro `comHistorico`)
    - `Camadas` sem `hist`
    - `Detalhe` com as props `{ v, agora, semSinalMin, voltar, centralizar }`

- [ ] **Step 1: Testes que falham (regras)**

Em `src/lib/dominio/veiculo.test.ts`:
- Ajuste o `import` para incluir `fraseEstado` e `vagaCurta`.
- Troque os três `filtrarVeiculos(lista, { indicador: null, busca: …, area: … }, …)` por objetos com `tipo: null` (ex.: `{ indicador: null, busca: "aaa00012", area: null, tipo: null }`).
- Acrescente:

```ts
describe("frase do estado e vaga curta", () => {
  it("ligado com hora do status e lugar", () => {
    const x = v({ status: "Ligado", status_desde: "2026-10-01T11:09:00Z", area: "BAIA DE RESÍDUOS" });
    expect(fraseEstado(x, 30, AGORA)).toBe(`Ligado há ${fmtMin(51)} · BAIA DE RESÍDUOS`);
  });
  it("sem saber desde quando, sem 'há'; fora de área usa a via", () => {
    expect(fraseEstado(v({ status: "Desligado", status_desde: null, area: "", via: "RUA 20" }), 30, AGORA)).toBe("Desligado · RUA 20");
  });
  it("sem sinal diz há quanto tempo e o último lugar", () => {
    expect(fraseEstado(v({ posicao_em: "2026-10-01T06:00:00Z", area: "PÁTIO 80" }), 30, AGORA)).toBe("Sem sinal há 6h · último lugar: PÁTIO 80");
  });
  it("filtra por tipo de equipamento", () => {
    const lista = [v({ id: "1", equip: { tipo: "ap", nome: "A", ordem: 1 } }), v({ id: "2", equip: { tipo: "as", nome: "Aspirador 01", ordem: 1 } })];
    expect(filtrarVeiculos(lista, { indicador: null, busca: "", area: null, tipo: "as" }, 30, AGORA).map((x) => x.id)).toEqual(["2"]);
  });
  it("vaga curta", () => {
    expect(vagaCurta("ALTA PRESSÃO - GPS - 08 - 24 HS")).toBe("vaga 08 · 24h");
    expect(vagaCurta("AUTO VÁCUO - GPS - 05")).toBe("vaga 05");
    expect(vagaCurta("[S/ VAGA]")).toBe("");
    expect(vagaCurta("TROCA 01 - ALTA PRESSÃO / AUTO VÁCUO - GPS")).toBe("TROCA 01 - ALTA PRESSÃO / AUTO VÁCUO - GPS");
  });
});
```

(Inclua `import { fmtMin } from "./formato";` no topo do teste.)

Em `src/lib/mapa/marcador.test.ts`, acrescente:

```ts
  it("mostra a sigla do tipo e o nome da planilha", () => {
    const h = htmlMarcador(v({ placa: "ASP12", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } }), false, 30, AGORA);
    expect(h).toContain('<b class="sg">AS</b>');
    expect(h).toContain("Aspirador 03");
    expect(h).not.toContain("ASP12");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/veiculo.test.ts src/lib/mapa/marcador.test.ts`
Expected: FAIL (`fraseEstado`/`vagaCurta` não existem; o marcador não tem sigla).

- [ ] **Step 3: Regras**

Em `src/lib/dominio/veiculo.ts`:
- Ajuste o import de tipos para `import type { CategoriaVeiculo, EstadoTrecho, Frescor, LatLng, TipoEquip, Tom, Veiculo } from "../tipos";`.
- Ajuste o import de formato para `import { fmtMin, idadeCurta, minutosDesde } from "./formato";`.
- Acrescente:

```ts
/** Os 4 números do topo do painel (também filtram a lista e o mapa). */
export const RESUMO_TOPO: Indicador[] = ["ligado", "desligado", "semsinal", "manut"];

/** "Ligado há 51 min" + "Baia de Resíduos"; sem sinal: "Sem sinal há 6h" + "último lugar: Pátio 80". */
export function partesEstado(v: Veiculo, semSinalMin: number, agora = Date.now()): { estado: string; lugar: string; semSinal: boolean } {
  const lugar = v.area || v.via || "fora de área";
  if (frescor(v, semSinalMin, agora) === "semsinal") return { estado: `Sem sinal há ${idadeCurta(v.posicao_em, agora)}`, lugar: `último lugar: ${lugar}`, semSinal: true };
  return { estado: `${v.status}${v.status_desde ? ` há ${fmtMin(minutosDesde(v.status_desde, agora))}` : ""}`, lugar, semSinal: false };
}
export function fraseEstado(v: Veiculo, semSinalMin: number, agora = Date.now()): string {
  const p = partesEstado(v, semSinalMin, agora);
  return `${p.estado} · ${p.lugar}`;
}

/** "ALTA PRESSÃO - GPS - 08 - 24 HS" -> "vaga 08 · 24h"; "[S/ VAGA]" -> "". */
export function vagaCurta(vaga: string): string {
  if (!vaga || /S\/\s*VAGA/i.test(vaga)) return "";
  const m = /GPS\s*-\s*(\d{1,2})(?!\d)/i.exec(vaga);
  if (!m) return vaga;
  return `vaga ${m[1]}${/24\s*HS/i.test(vaga) ? " · 24h" : ""}`;
}
```

Troque `FiltroVeiculos` e `filtrarVeiculos`:

```ts
export interface FiltroVeiculos {
  indicador: Indicador | null;
  busca: string;
  area: string | null;
  tipo: TipoEquip | null;
}
export function filtrarVeiculos(vs: Veiculo[], f: FiltroVeiculos, semSinalMin: number, agora = Date.now()): Veiculo[] {
  const q = f.busca.trim().toUpperCase();
  return vs.filter(
    (v) =>
      (!f.indicador || noIndicador(f.indicador, v, semSinalMin, agora)) &&
      (!f.area || (f.area === FORA_DE_AREA ? !v.area : v.area === f.area)) &&
      (!f.tipo || v.equip?.tipo === f.tipo) &&
      (!q || [v.placa, v.equip?.nome, v.motor2?.placa, v.vaga, v.grupo, v.area, v.via, v.motorista].join(" ").toUpperCase().includes(q)),
  );
}
```

Em `src/lib/mapa/marcador.ts`:
- Acrescente `import { TIPOS_EQUIP, nomeEquip } from "../dominio/equipamentos";`.
- Em `htmlMarcador`, troque o `return` por:

```ts
  const sigla = v.equip ? `<b class="sg">${TIPOS_EQUIP[v.equip.tipo].sigla}</b>` : "";
  return `<div class="${classe}" style="--c:${corDoTom(CATEGORIAS[cat].tom)}" title="${esc(titulo)}">${seta}${sigla}${esc(nomeEquip(v))}${m2} <small>${idadeCurta(v.posicao_em, agora)}</small></div>`;
```

e a linha do título por:

```ts
  const titulo = `${nomeEquip(v)}${v.equip ? ` (${TIPOS_EQUIP[v.equip.tipo].rotulo})` : ""} · ${v.status}${v.motor2 ? ` · motor 2º ${v.motor2.status}` : ""} · ${FRESCOR[fr].rotulo}`;
```

Em `src/app/globals.css`, depois da linha `.mk .m2 { ... }`, acrescente:

```css
.mk .sg { font-size: 9px; font-weight: 800; background: rgba(0, 0, 0, .28); border-radius: 999px; padding: 0 5px; letter-spacing: .02em; }
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/veiculo.test.ts src/lib/mapa/marcador.test.ts`
Expected: PASS.

- [ ] **Step 5: Preferência guardada no navegador**

Em `src/lib/hooks.ts`, ajuste o import para `import { useCallback, useSyncExternalStore } from "react";` e acrescente no fim:

```ts
// preferências da tela (ex.: painel recolhido). Sem armazenamento no navegador (aba anônima, bloqueado),
// vale só nesta visita: a memória abaixo responde no lugar do localStorage.
const memoriaPref = new Map<string, boolean>();
const ouvintesPref = new Set<() => void>();
function lerPref(chave: string): boolean {
  if (memoriaPref.has(chave)) return memoriaPref.get(chave)!;
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}
/** Liga/desliga lembrado no navegador (falso na geração estática e até o navegador responder). */
export function usePreferencia(chave: string): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (f) => {
      ouvintesPref.add(f);
      return () => ouvintesPref.delete(f);
    },
    () => lerPref(chave),
    () => false,
  );
  const mudar = useCallback(
    (v: boolean) => {
      memoriaPref.set(chave, v);
      try {
        localStorage.setItem(chave, v ? "1" : "0");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      ouvintesPref.forEach((f) => f());
    },
    [chave],
  );
  return [valor, mudar];
}
```

- [ ] **Step 6: Mapa sem a camada de histórico, agrupamento até o zoom 19**

Em `src/app/_localizacao/mapa-frota.ts`:

```ts
export interface Camadas {
  cercas: Leaflet.LayerGroup;
  cluster: Leaflet.MarkerClusterGroup;
  marcadores: Map<string, { m: Leaflet.Marker; chave: string }>;
}

/** Cercas e veículos (agrupados até o zoom 19: o pátio cheio vira um círculo com o número), com o seletor de camadas. */
export function criarCamadas({ L, mapa, camadasBase }: MapaPronto): Camadas {
  const cercas = L.layerGroup().addTo(mapa);
  const cluster = L.markerClusterGroup({
    disableClusteringAtZoom: 19,
    maxClusterRadius: 45,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => L.divIcon({ html: `<div class="cl">${c.getChildCount()}</div>`, className: "", iconSize: [38, 38] }),
  }).addTo(mapa);
  L.control.layers(camadasBase, { Cercas: cercas, "Veículos": cluster }).addTo(mapa);
  return { cercas, cluster, marcadores: new Map() };
}
```

Em `sincronizarMarcadores`, remova o parâmetro `comHistorico: boolean` da assinatura e troque a linha do `mostrar` por:

```ts
    // o selecionado aparece mesmo que o filtro o esconda
    const mostrar = visiveis.has(v.id) || v.id === sel;
```

- [ ] **Step 7: Barra fina com os tipos**

`src/app/_localizacao/barra-tipos.tsx`:

```tsx
"use client";

import { cx } from "@/components/ui";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { noIndicador } from "@/lib/dominio/veiculo";
import type { TipoEquip, Veiculo } from "@/lib/tipos";

interface Props {
  veiculos: Veiculo[];
  tipo: TipoEquip | null;
  escolher: (t: TipoEquip | null) => void;
  abrir: () => void;
  semSinalMin: number;
  agora: number;
}

/** Painel recolhido: o mapa ganha a tela; fica a sigla de cada tipo com ligados/total (clicar filtra o mapa). */
export function BarraTipos({ veiculos, tipo, escolher, abrir, semSinalMin, agora }: Props) {
  return (
    <nav aria-label="Tipos de equipamento" className="flex w-[60px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-xl border border-borda bg-superficie py-2 shadow-md">
      <button type="button" onClick={abrir} aria-label="Abrir painel" title="Abrir painel" className="grid h-9 w-11 place-items-center rounded-lg text-lg text-suave hover:bg-superficie-2 hover:text-texto">
        ▸
      </button>
      {ORDEM_TIPOS.map((t) => {
        const vs = veiculos.filter((v) => v.equip?.tipo === t);
        if (!vs.length) return null;
        const lig = vs.filter((v) => noIndicador("ligado", v, semSinalMin, agora)).length;
        const ativo = tipo === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ativo}
            title={`${TIPOS_EQUIP[t].rotulo}: ${lig} ligados de ${vs.length}`}
            onClick={() => escolher(ativo ? null : t)}
            className={cx("w-11 rounded-lg py-1 text-center text-[10px] tabular-nums", ativo ? "bg-primaria text-white" : "bg-superficie-2 text-suave hover:text-texto")}
          >
            <b className="block text-[13px]">{TIPOS_EQUIP[t].sigla}</b>
            {lig}/{vs.length}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 8: Painel (aba Tipos, 4 números, recolher)**

Substitua `src/app/_localizacao/painel.tsx` inteiro por:

```tsx
"use client";

import { useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Chip, Contador, Entrada, Ponto, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { ORDEM_TIPOS, TIPOS_EQUIP, compararEquip, nomeEquip } from "@/lib/dominio/equipamentos";
import { GRUPOS, TODOS_GRUPOS, contarPorGrupo, filtrarEventos, grupoDoEvento, veiculoDoEvento, chaveEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { hora, idadeCurta, rotuloDia } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, INDICADORES, RESUMO_TOPO, categoria, fraseEstado, frescor, motor2Ligado, noIndicador, nomeArea, resumoAreas, vagaCurta, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";

export type Aba = "tipos" | "areas" | "alertas";

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
  recolher: () => void;
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
        <div className="grid grid-cols-4 gap-1.5">
          {RESUMO_TOPO.map((id) => {
            const i = INDICADORES.find((x) => x.id === id)!;
            const n = p.veiculos.filter((v) => noIndicador(id, v, p.semSinalMin, p.agora)).length;
            const ativo = p.filtro.indicador === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativo}
                onClick={() => p.setFiltro({ ...p.filtro, indicador: ativo ? null : id })}
                className={cx("rounded-lg border px-1 py-1.5 text-center text-[11px] text-suave", ativo ? "border-primaria bg-primaria-suave" : "border-borda hover:bg-superficie-2")}
              >
                <b className="block text-base tabular-nums" style={{ color: corDoTom(i.tom) }}>
                  {n}
                </b>
                {i.curto}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Segmentado
              rotulo="O que listar"
              valor={p.aba}
              mudar={p.setAba}
              opcoes={[
                { id: "tipos", rotulo: <>Tipos <Contador n={p.visiveis.length} /></> },
                { id: "areas", rotulo: <>Áreas <Contador n={nAreas} /></> },
                { id: "alertas", rotulo: <>Alertas <Contador n={p.eventos.length} /></> },
              ]}
            />
          </div>
          <button type="button" onClick={p.recolher} aria-label="Recolher painel" title="Recolher painel" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-borda text-lg text-suave hover:text-texto">
            ◂
          </button>
        </div>
        {p.aba === "tipos" && (
          <>
            <Entrada type="search" value={p.filtro.busca} onChange={(e) => p.setFiltro({ ...p.filtro, busca: e.target.value })} placeholder="Buscar placa, vaga, área, motorista…" aria-label="Buscar veículo" autoComplete="off" className="w-full" />
            {(p.filtro.indicador || p.filtro.area || p.filtro.tipo) && (
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
                {p.filtro.tipo && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, tipo: null })}>
                    {TIPOS_EQUIP[p.filtro.tipo].rotulo} ✕
                  </Chip>
                )}
              </div>
            )}
          </>
        )}
        {p.aba === "alertas" && (
          <>
            <div className="flex gap-2">
              <Selecao value={p.diaEventos} onChange={(e) => p.setDiaEventos(e.target.value)} aria-label="Dia dos alertas" className="w-36">
                {dias.map((d) => (
                  <option key={d} value={d}>
                    {rotuloDia(d)}
                  </option>
                ))}
              </Selecao>
              <Entrada type="search" value={buscaEv} onChange={(e) => setBuscaEv(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar alerta" autoComplete="off" className="flex-1" />
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
        {p.aba === "tipos" && <ListaTipos lista={p.visiveis} semSinalMin={p.semSinalMin} agora={p.agora} abrir={p.abrir} />}
        {p.aba === "areas" && <ListaAreas veiculos={p.veiculos} escolher={p.escolherArea} />}
        {p.aba === "alertas" && <ListaEventos eventos={filtrarEventos(p.eventos, grupos, buscaEv)} abrir={p.abrir} />}
      </div>
    </div>
  );
}

function ListaTipos({ lista, semSinalMin, agora, abrir }: { lista: Veiculo[]; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const [fechados, setFechados] = useState<Set<TipoEquip>>(() => new Set());
  if (!lista.length) return <Vazio titulo="Nenhum equipamento">Ajuste a busca ou os filtros.</Vazio>;
  const alternar = (t: TipoEquip) =>
    setFechados((f) => {
      const n = new Set(f);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  return (
    <>
      {ORDEM_TIPOS.map((tipo) => {
        const vs = lista.filter((v) => v.equip?.tipo === tipo).sort(compararEquip);
        if (!vs.length) return null;
        const aberto = !fechados.has(tipo);
        const n = (id: "ligado" | "desligado" | "semsinal") => vs.filter((v) => noIndicador(id, v, semSinalMin, agora)).length;
        return (
          <section key={tipo}>
            <h3 className="sticky top-0 z-10 border-b border-borda bg-superficie-2">
              <button type="button" aria-expanded={aberto} onClick={() => alternar(tipo)} className="flex w-full items-center gap-2 px-3.5 py-1.5 text-left text-xs font-semibold">
                <span aria-hidden>{aberto ? "▾" : "▸"}</span>
                <span className="min-w-0 flex-1 truncate">{TIPOS_EQUIP[tipo].rotulo}</span>
                <span className="font-normal tabular-nums text-suave">
                  {n("ligado")} lig. · {n("desligado")} desl.{n("semsinal") ? ` · ${n("semsinal")} sem sinal` : ""} · {vs.length}
                </span>
              </button>
            </h3>
            {aberto && vs.map((v) => <ItemVeiculo key={v.id} v={v} semSinalMin={semSinalMin} agora={agora} abrir={abrir} />)}
          </section>
        );
      })}
    </>
  );
}

function ItemVeiculo({ v, semSinalMin, agora, abrir }: { v: Veiculo; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const fr = frescor(v, semSinalMin, agora);
  const vaga = v.equip?.tipo === "as" ? "" : vagaCurta(v.vaga);
  return (
    <button type="button" onClick={() => abrir(v.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-borda px-3.5 py-2 text-left hover:bg-superficie-2">
      <Ponto tom={CATEGORIAS[categoria(v)].tom} className="h-2.5 w-2.5" />
      <span className="truncate font-semibold">
        {nomeEquip(v)}
        {vaga && <span className="ml-1.5 text-xs font-normal text-suave">{vaga}</span>}
      </span>
      <span className="flex items-center gap-1.5 text-xs tabular-nums text-suave" title={FRESCOR[fr].rotulo}>
        <Ponto tom={FRESCOR[fr].tom} className="h-1.5 w-1.5" />
        {idadeCurta(v.posicao_em, agora)}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {fraseEstado(v, semSinalMin, agora)}
        {v.motor2 && <span className={cx("ml-1.5", motor2Ligado(v) && "font-semibold text-motor2")}>⚙ bomba {motor2Ligado(v) ? "ligada" : "desligada"}</span>}
      </span>
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
    return <Vazio titulo="Nenhum alerta">Alertas são gerados a partir de quando o monitoramento está rodando. Para o dia completo de um equipamento, abra-o e use “Ver o dia”.</Vazio>;
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

- [ ] **Step 9: Detalhe direto**

Substitua `src/app/_localizacao/detalhe.tsx` inteiro por:

```tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icone } from "@/components/icones";
import { Botao, Campos, Ponto, Selo } from "@/components/ui";
import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";
import { diaLocal, hora, horaSeg, idadeCurta } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, categoria, frescor, partesEstado } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

interface Props {
  v: Veiculo;
  agora: number;
  semSinalMin: number;
  voltar: () => void;
  centralizar: () => void;
}

/** Detalhe do equipamento: uma frase que diz o que importa, 4 dados e o caminho para o dia (Timeline). */
export function Detalhe({ v, agora, semSinalMin, voltar, centralizar }: Props) {
  const fr = frescor(v, semSinalMin, agora);
  const p = partesEstado(v, semSinalMin, agora);
  const campos: [string, ReactNode][] = [
    ["Vaga", v.vaga || "Sem vaga"],
    ["Posição", `${horaSeg(v.posicao_em)} (há ${idadeCurta(v.posicao_em, agora)})`],
    ["Motorista", v.motorista || "Não identificado"],
    ...(v.motor2 ? ([["Bomba (motor 2º)", `${v.motor2.status}${v.motor2.status_desde ? ` desde ${hora(v.motor2.status_desde)}` : ""}`]] as [string, ReactNode][]) : []),
  ];
  const mais: [string, ReactNode][] = [
    ["Endereço", v.endereco || "—"],
    ["Via", v.via || "—"],
    ["Demora", v.demora || "—"],
    ["Coordenadas", v.lat != null && v.lng != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}` : "—"],
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-borda p-3">
        <Botao variante="secundaria" tamanho="mini" onClick={voltar}>
          <Icone nome="voltar" className="h-4 w-4" />
          Voltar
        </Botao>
        <Botao variante="secundaria" tamanho="mini" onClick={centralizar}>
          <Icone nome="alvo" className="h-4 w-4" />
          Centralizar
        </Botao>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{nomeEquip(v)}</span>
          {v.equip && <Selo tom="reg">{TIPOS_EQUIP[v.equip.tipo].rotulo}</Selo>}
          <Selo tom={FRESCOR[fr].tom}>{FRESCOR[fr].rotulo}</Selo>
        </div>
        <p className="mt-3 flex items-start gap-2 text-base leading-snug">
          <Ponto tom={p.semSinal ? "neu" : CATEGORIAS[categoria(v)].tom} className="mt-1.5 h-3 w-3" />
          <span>
            <b>{p.estado}</b> · {p.lugar}
          </span>
        </p>
        <div className="mt-4">
          <Campos itens={campos} />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-suave">Mais (endereço, coordenadas)</summary>
          <div className="mt-2">
            <Campos itens={mais} />
          </div>
        </details>
        <Link href={`/timeline/?v=${encodeURIComponent(v.id)}&dia=${diaLocal()}`} className="btn-pri mt-5 flex h-10 w-full items-center justify-center text-sm hover:no-underline">
          Ver o dia ▸
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Tela da Localização**

Em `src/app/_localizacao/localizacao.tsx`:

1. Imports. Remova `desenharRota`, `pontosDoTrecho`, `Historico` e `useCallback`/`useRef` só se ficarem sem uso. Acrescente:

```ts
import { useRouter } from "next/navigation";
import { usePreferencia } from "@/lib/hooks";
import { BarraTipos } from "./barra-tipos";
```

e troque `import { useAgora, useCelular } from "@/lib/hooks";` por `import { useAgora, useCelular, usePreferencia } from "@/lib/hooks";` (uma linha só).

2. Estado. Remova `hist`, `diaHist` e `trechoSel` e os seus `useState`. Troque `aba` e `filtro` e acrescente o painel recolhido:

```ts
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("tipos");
  const [filtro, setFiltro] = useState<FiltroVeiculos>({ indicador: null, busca: "", area: null, tipo: null });
  const [recolhido, setRecolhido] = usePreferencia("mon-painel-recolhido");
```

3. Troque `fechar` e `abrir` por:

```ts
  const fechar = useCallback(() => setSel(null), []);
  const abrir = useCallback(
    (id: string) => {
      setSel(id);
      // escolher um equipamento no mapa com o painel recolhido: o detalhe precisa do painel
      if (!celular) setRecolhido(false);
      const v = veiculos.find((x) => x.id === id);
      const m = pronto?.mapa;
      if (!m || v?.lat == null || v.lng == null) return;
      if (celular) {
        // zoom 19: acima do limite de agrupamento; centro deslocado para o caminhão ficar acima do cartão
        setFolha("fechada");
        const z = Math.max(m.getZoom(), 19);
        m.flyTo(m.unproject(m.project([v.lat, v.lng], z).add([0, 70]), z), z, { duration: 0.8 });
      } else m.flyTo([v.lat, v.lng], Math.max(m.getZoom(), 17));
    },
    [veiculos, pronto, celular, setRecolhido],
  );
```

4. Em `focarCerca` e `escolherArea`, troque `setAba("veiculos")` por `setAba("tipos")`. Apague `focarTrecho` e os dois `useEffect` do "histórico do dia no mapa" (o do `hist` e o do `trechoSel`).

5. A chamada de `sincronizarMarcadores` perde o `!!hist`:

```ts
    sincronizarMarcadores(pronto.L, camadas.current, veiculos, new Set(visiveis.map((v) => v.id)), sel, semSinalMin, agora || Date.now(), (id) => abrirRef.current(id));
  }, [pronto, veiculos, visiveis, sel, semSinalMin, agora]);
```

6. No `useEffect` do zoom inicial, o link antigo `#v=<id>&hist=AAAA-MM-DD` agora vai para a Timeline:

```ts
    const h = new URLSearchParams(window.location.hash.slice(1));
    const v = h.get("v");
    const cerca = h.get("cerca");
    const diaHist = h.get("hist");
    // link antigo com histórico (#v=&hist=): o histórico agora fica só na Timeline
    if (v && diaHist) router.push(`/timeline/?v=${encodeURIComponent(v)}&dia=${diaHist}`);
    else if (v && veiculos.some((x) => x.id === v)) abrirRef.current(v);
    else if (cerca) setTimeout(() => focarCercaRef.current(cerca), 400);
  }, [pronto, veiculos, cercas, poligonos, semSinalMin, router]);
```

7. O `conteudo`:

```tsx
  const conteudo = vSel ? (
    <Detalhe key={vSel.id} v={vSel} agora={agora} semSinalMin={semSinalMin} voltar={fechar} centralizar={centralizar} />
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
      recolher={() => setRecolhido(true)}
    />
  );
```

8. No JSX, a linha do `aside` vira:

```tsx
        {!celular &&
          (recolhido ? (
            <BarraTipos veiculos={veiculos} tipo={filtro.tipo} escolher={(t) => setFiltro((f) => ({ ...f, tipo: t }))} abrir={() => setRecolhido(false)} semSinalMin={semSinalMin} agora={agora} />
          ) : (
            <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-md">{conteudo}</aside>
          ))}
```

O mapa se reajusta sozinho: `useMapa` já observa o tamanho do div (`ResizeObserver` → `invalidateSize`).

- [ ] **Step 11: Gaveta do celular com os tipos**

Em `src/app/_localizacao/resumo-celular.tsx`:
- Acrescente `import { ORDEM_TIPOS, TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";`.
- No cartão do selecionado, troque `<b className="block text-base">{vSel.placa}</b>` por `<b className="block text-base">{nomeEquip(vSel)}</b>`.
- Troque `aria-label={`Timeline de ${vSel.placa}`}` por `aria-label={`Timeline de ${nomeEquip(vSel)}`}`.
- Na lista de chips, depois do `{numeros.map(...)}`, acrescente:

```tsx
      {ORDEM_TIPOS.map((t) => {
        const n = veiculos.filter((v) => v.equip?.tipo === t).length;
        if (!n) return null;
        return (
          <Chip key={t} ativo={filtro.tipo === t} onClick={() => mudarFiltro({ ...filtro, tipo: filtro.tipo === t ? null : t })}>
            {TIPOS_EQUIP[t].sigla} <b>{n}</b>
          </Chip>
        );
      })}
```

- [ ] **Step 12: Conferência e commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: tudo passa. O build confirma que o Leaflet não roda na geração estática. Se `agruparPorArea` ficar sem uso em telas, ele continua exportado e testado; não apague.

Confira no navegador com dados sintéticos (sem gravar nada) usando os testes de navegador antigos como roteiro visual. Ou deixe para a Tarefa 10, que reescreve os testes.

```bash
git add src/lib/dominio/veiculo.ts src/lib/dominio/veiculo.test.ts src/lib/mapa/marcador.ts src/lib/mapa/marcador.test.ts src/lib/hooks.ts src/app/globals.css src/app/_localizacao
git commit -m "Localização: painel retrátil com barra de tipos, lista por tipo, detalhe direto e marcador com sigla

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Timeline — faixa do dia, capítulos e mapa limpo

**Files:**
- Create: `src/components/historico/faixa-dia.tsx`, `src/components/historico/capitulos.tsx`
- Modify:
  - Mapa: `src/components/mapa/rota.ts`, `src/lib/mapa/rota.ts`, `src/lib/mapa/rota.test.ts`
  - Histórico: `src/components/historico/barra-tempo.tsx` (remove `BarraTempo`, que fica sem uso)
  - Telas e estilo: `src/app/timeline/_componentes/conteudo.tsx`, `src/app/timeline/_componentes/timeline.tsx`, `src/app/timeline/_componentes/seletor-veiculo.tsx`, `src/app/globals.css`

**Interfaces:**
- Consumes: `montarHistoria`, `capituloEm`, `proximoCapitulo`, `segCap`, `MIN_CAPITULO`, `Capitulo`, `HistoriaDia`, `Destaques`, `TipoLugar` (Tarefa 4); `Player` (`use-player.ts`); `nomeEquip`, `compararEquip`, `TIPOS_EQUIP` (Tarefa 1).
- Produces:
  - `desenharRota(L, camada, h, foco: [number, number] | null): void` (desenha no painel "rota")
  - `desenharCapitulos(L, camada, caps, aoClicar: (c: Capitulo) => void): void`
  - `FaixaDia`, `ListaCapitulos`, `Destaques` (componentes)

- [ ] **Step 1: Teste da rota (o que sai)**

Em `src/lib/mapa/rota.test.ts`:
- Remova `paradasRelevantes` do `import`.
- Apague o `it(...)` que usa `paradasRelevantes`, porque os pinos agora são os capítulos.

Em `src/lib/mapa/rota.ts`, apague a função `paradasRelevantes` (e `TrechoParado` do import de tipos, se ficar sem uso).

Run: `npx vitest run src/lib/mapa/rota.test.ts`
Expected: PASS (os testes de `sequenciasPorEstado` e `pontosDoTrecho` continuam).

- [ ] **Step 2: Rota e capítulos no mapa**

Substitua `src/components/mapa/rota.ts` inteiro por:

```ts
import type * as Leaflet from "leaflet";
import { corResolvida } from "@/lib/cores";
import type { Capitulo } from "@/lib/dominio/capitulos";
import { fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { esc } from "@/lib/mapa/marcador";
import { sequenciasPorEstado } from "@/lib/mapa/rota";
import type { Historico, PontoMapa } from "@/lib/tipos";
import { iconeHtml, type L } from "./leaflet";

/** Painel do Leaflet abaixo do padrão (400): o rastro do player fica por cima da rota redesenhada. */
export const PAINEL_ROTA = "rota";

function linhas(L: L, camada: Leaflet.LayerGroup, pontos: PontoMapa[], opacidade: number) {
  const seqs = sequenciasPorEstado(pontos);
  for (const s of seqs) L.polyline(s.pts, { pane: PAINEL_ROTA, color: "#0b1220", weight: 11, opacity: 0.75 * opacidade, lineJoin: "round", interactive: false }).addTo(camada);
  for (const s of seqs) L.polyline(s.pts, { pane: PAINEL_ROTA, color: corResolvida(ESTADOS_TRECHO[s.estado].tom), weight: 7, opacity: opacidade, lineJoin: "round", lineCap: "round", interactive: false }).addTo(camada);
}

/**
 * Rota do dia (cor por estado, contorno escuro para destacar no satélite). Com foco (segundos do dia), o resto do
 * dia fica apagado e só o pedaço do foco aparece forte. O painel PAINEL_ROTA precisa existir no mapa.
 */
export function desenharRota(L: L, camada: Leaflet.LayerGroup, h: Historico, foco: [number, number] | null): void {
  camada.clearLayers();
  if (!h.pontos.length) return;
  linhas(L, camada, h.pontos, foco ? 0.3 : 1);
  if (foco) {
    const dentro = h.pontos.filter((p) => {
      const s = segDe(p[2]);
      return s >= foco[0] && s <= foco[1];
    });
    if (dentro.length > 1) linhas(L, camada, dentro, 1);
  }
}

/** Pinos numerados dos capítulos (os mesmos números da lista); cinza = pátio/base. */
export function desenharCapitulos(L: L, camada: Leaflet.LayerGroup, caps: Capitulo[], aoClicar: (c: Capitulo) => void): void {
  for (const c of caps) {
    if (c.lat == null || c.lng == null) continue;
    L.marker([c.lat, c.lng], { icon: iconeHtml(L, `<div class="cap${c.tipoLugar === "base" ? " base" : ""}">${c.n}</div>`), zIndexOffset: 500 })
      .bindTooltip(`${c.n} · ${esc(c.lugar)}<br>${hhmm(c.inicio)}–${hhmm(c.fim)} · ${fmtMin(c.duracao_min)}`)
      .on("click", () => aoClicar(c))
      .addTo(camada);
  }
}
```

Em `src/app/globals.css`, depois do bloco `.mk-play .m2 { ... }`, acrescente:

```css
/* capítulos da Timeline: o mesmo número no mapa e na lista */
.cap {
  position: absolute; transform: translate(-50%, -50%); width: 24px; height: 24px; display: grid; place-items: center;
  background: var(--primaria); color: #fff; border: 2px solid #fff; border-radius: 50%;
  font: 800 11px var(--font-sans); box-shadow: 0 1px 5px rgba(0, 0, 0, .5); cursor: pointer;
}
.cap.base { background: #64748b; }
/* trilha "onde estava" da faixa do dia: em vias = listrado */
.faixa-via { background: repeating-linear-gradient(135deg, #bfdbfe 0 4px, #dbeafe 4px 8px); color: #1e40af; }
```

- [ ] **Step 3: Faixa do dia**

`src/components/historico/faixa-dia.tsx`:

```tsx
"use client";

import { useState, type PointerEvent as EventoPonteiro } from "react";
import { corDoTom } from "@/lib/cores";
import { segCap, type HistoriaDia, type TipoLugar } from "@/lib/dominio/capitulos";
import { fmtHora, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";
import { cx } from "../ui";
import type { Player } from "./use-player";

const DIA = 86400;
const pct = (s: number) => `${(Math.min(DIA, Math.max(0, s)) / DIA) * 100}%`;
export const LUGARES: Record<TipoLugar, { rotulo: string; classe: string }> = {
  base: { rotulo: "pátio/base", classe: "bg-slate-500 text-white" },
  servico: { rotulo: "área de serviço", classe: "bg-teal-700 text-white" },
  via: { rotulo: "em vias", classe: "faixa-via" },
};

interface Props {
  h: Historico;
  historia: HistoriaDia;
  player: Player;
  foco: [number, number] | null;
  mudarFoco: (f: [number, number] | null) => void;
}

/** O dia de 0h a 24h em duas trilhas alinhadas (onde estava / motor). Toque leva o caminhão ao horário; arrastar escolhe um foco. */
export function FaixaDia({ h, historia, player, foco, mudarFoco }: Props) {
  const [arrasto, setArrasto] = useState<{ a: number; b: number } | null>(null);
  const emSeg = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * DIA;
  };
  const janela = arrasto ? ([Math.min(arrasto.a, arrasto.b), Math.max(arrasto.a, arrasto.b)] as const) : foco;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-suave">
        <span className="font-semibold uppercase tracking-wider">Onde estava</span>
        <span className="flex gap-2.5">
          {(Object.keys(LUGARES) as TipoLugar[]).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <i className={cx("inline-block h-2 w-2 rounded-sm", LUGARES[t].classe)} />
              {LUGARES[t].rotulo}
            </span>
          ))}
        </span>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Faixa do dia"
        aria-valuemin={0}
        aria-valuemax={DIA}
        aria-valuenow={Math.round(player.t)}
        aria-valuetext={fmtHora(player.t)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const s = emSeg(e);
          setArrasto({ a: s, b: s });
        }}
        onPointerMove={(e) => {
          if (arrasto && e.currentTarget.hasPointerCapture(e.pointerId)) setArrasto({ a: arrasto.a, b: emSeg(e) });
        }}
        onPointerUp={(e) => {
          if (!arrasto) return;
          const b = emSeg(e);
          setArrasto(null);
          // arrastar mais que 10 min escolhe um foco; um toque leva o caminhão ao horário
          if (Math.abs(b - arrasto.a) > 600) mudarFoco([Math.min(arrasto.a, b), Math.max(arrasto.a, b)]);
          else player.irPara(b);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") player.irPara(player.t + 300);
          if (e.key === "ArrowLeft") player.irPara(player.t - 300);
          if (e.key === "Escape") mudarFoco(null);
        }}
        className="relative cursor-pointer touch-none select-none"
      >
        <div className="relative h-7 overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10">
          {historia.faixaLugar.map((f, i) => {
            const a = segCap(f.inicio);
            const b = segCap(f.fim);
            return (
              <span
                key={i}
                title={`${hhmm(f.inicio)}–${hhmm(f.fim)} · ${f.lugar || LUGARES[f.tipoLugar].rotulo}`}
                className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/70 px-1 text-[9.5px] font-semibold leading-7", LUGARES[f.tipoLugar].classe)}
                style={{ left: pct(a), width: pct(Math.max(b - a, 60)) }}
              >
                {f.lugar}
              </span>
            );
          })}
        </div>
        <p className="mb-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-suave">Motor</p>
        <div className="relative h-3 overflow-hidden rounded bg-superficie-2">
          {historia.faixaMotor.map((f, i) => {
            const a = segCap(f.inicio);
            const b = segCap(f.fim);
            return <span key={i} title={`${hhmm(f.inicio)}–${hhmm(f.fim)} · ${ESTADOS_TRECHO[f.estado].rotulo}`} className="absolute inset-y-0" style={{ left: pct(a), width: pct(Math.max(b - a, 60)), background: corDoTom(ESTADOS_TRECHO[f.estado].tom) }} />;
          })}
        </div>
        {h.motor2 && (
          <>
            <p className="mb-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-suave">⚙ Bomba (motor 2º){h.motor2.placa ? ` · ${h.motor2.placa}` : ""}</p>
            <div className="relative h-2 overflow-hidden rounded bg-superficie-2">
              {h.motor2.intervalos.map(([a, b]) => (
                <span key={a} className="absolute inset-y-0 bg-motor2" style={{ left: pct(segDe(a)), width: pct(Math.max(segDe(b) - segDe(a), 60)) }} />
              ))}
            </div>
          </>
        )}
        {janela && (
          <span aria-hidden className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-primaria" style={{ left: pct(janela[0]), width: pct(janela[1] - janela[0]), background: "color-mix(in srgb, var(--primaria) 12%, transparent)" }} />
        )}
        <span aria-hidden className="pointer-events-none absolute -bottom-1 -top-1 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: pct(player.t) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-suave">
        {["0h", "6h", "12h", "18h", "24h"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      {!h.motor2 && h.motor2_erro && <p className="mt-0.5 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
      {foco ? (
        <button type="button" onClick={() => mudarFoco(null)} className="mt-1 text-xs text-link">
          Foco {fmtHora(foco[0]).slice(0, 5)}–{fmtHora(foco[1]).slice(0, 5)} · ✕ limpar
        </button>
      ) : (
        <p className="mt-1 text-[11px] text-suave">Toque para ir ao horário · arraste para focar um período</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Capítulos e destaques**

`src/components/historico/capitulos.tsx`:

```tsx
"use client";

import { corDoTom } from "@/lib/cores";
import { MIN_CAPITULO, segCap, type Capitulo, type Destaques as TDestaques } from "@/lib/dominio/capitulos";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { Vazio, cx } from "../ui";

/** Frases neutras do dia (nada de "trabalhou": a regra ainda vai ser definida). */
export function Destaques({ d }: { d: TDestaques }) {
  const itens = [
    d.primeiraSaidaBase && `Primeira saída do pátio ${hhmm(d.primeiraSaidaBase)}`,
    d.ultimaVoltaBase && `Voltou ao pátio ${hhmm(d.ultimaVoltaBase)}`,
    d.areasServico > 0 && `${d.areasServico} área${d.areasServico > 1 ? "s" : ""} de serviço`,
    d.maiorParadoLigado && `Parado ligado mais longo: ${d.maiorParadoLigado.lugar} (${fmtMin(d.maiorParadoLigado.min)})`,
  ].filter((x): x is string => !!x);
  if (!itens.length) return null;
  return (
    <ul aria-label="Destaques do dia" className="flex flex-wrap gap-1.5">
      {itens.map((t) => (
        <li key={t} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs">
          {t}
        </li>
      ))}
    </ul>
  );
}

function BarraCapitulo({ c }: { c: Capitulo }) {
  const total = Math.max(c.duracao_min, 1);
  const partes: [number, string, string][] = [
    [c.ligado_min, corDoTom("warn"), "parado ligado"],
    [c.desligado_min, corDoTom("bad"), "desligado"],
    [c.outro_min, corDoTom("reg"), "sem sinal"],
  ];
  return (
    <span className="my-1 flex h-1.5 overflow-hidden rounded bg-superficie-2" title={partes.filter(([m]) => m).map(([m, , r]) => `${fmtMin(m)} ${r}`).join(" · ")}>
      {partes.map(([m, cor, r]) => (m ? <span key={r} style={{ width: `${(m / total) * 100}%`, background: cor }} /> : null))}
    </span>
  );
}

interface Props {
  capitulos: Capitulo[];
  atual: number | null;
  foco: [number, number] | null;
  escolher: (c: Capitulo) => void;
}

/** A história do dia: paradas longas numeradas (o mesmo número do mapa) e o caminho entre elas. */
export function ListaCapitulos({ capitulos, atual, foco, escolher }: Props) {
  if (!capitulos.length) {
    return <Vazio titulo="Nenhuma parada longa">Neste dia não houve parada de {MIN_CAPITULO} min ou mais no mesmo lugar. A faixa acima e o apontamento completo mostram tudo.</Vazio>;
  }
  const lista = foco ? capitulos.filter((c) => segCap(c.fim) >= foco[0] && segCap(c.inicio) <= foco[1]) : capitulos;
  if (!lista.length) return <p className="px-4 py-3 text-sm text-suave">Nenhum capítulo no período em foco.</p>;
  return (
    <ol aria-label="Capítulos do dia">
      {lista.map((c) => (
        <li key={c.n} data-capitulo={c.n}>
          <button
            type="button"
            onClick={() => escolher(c)}
            aria-current={atual === c.n ? "step" : undefined}
            className={cx("grid w-full grid-cols-[22px_1fr] gap-x-2.5 border-b border-borda px-4 py-2.5 text-left hover:bg-superficie-2", atual === c.n && "bg-primaria-suave")}
          >
            <span className={cx("grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold text-white", c.tipoLugar === "base" ? "bg-slate-500" : "bg-primaria")}>{c.n}</span>
            <span className="min-w-0">
              <span className="flex justify-between gap-2 text-[13px]">
                <b className="truncate font-semibold">{c.lugar}</b>
                <span className="shrink-0 tabular-nums text-suave">
                  {hhmm(c.inicio)}–{hhmm(c.fim)} · {fmtMin(c.duracao_min)}
                </span>
              </span>
              <BarraCapitulo c={c} />
              {c.ate && (
                <span className="block truncate text-xs text-link">
                  → {c.ate.km.toLocaleString("pt-BR")} km até {c.ate.destino}
                  {c.ate.passou.length ? ` · passou por ${c.ate.passou.join(", ")}` : ""}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 5: Conteúdo da Timeline**

Em `src/components/historico/barra-tempo.tsx`, apague a função `BarraTempo` e os imports que ficarem sem uso (`EventoPonteiro`, `corDoTom`, `fmtMin`, `hhmm`, `segDe`, `fracao`, `Historico`). `ControlesPlayer` e `InfoPlayer` ficam.

Substitua `src/app/timeline/_componentes/conteudo.tsx` inteiro por:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { Destaques, ListaCapitulos } from "@/components/historico/capitulos";
import { FaixaDia } from "@/components/historico/faixa-dia";
import { TempoPorArea } from "@/components/historico/tempo-area";
import { ListaTrechos } from "@/components/historico/trechos";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import { PAINEL_ROTA, desenharCapitulos, desenharRota } from "@/components/mapa/rota";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Aviso, Botao, SecaoTitulo, Selo, cx } from "@/components/ui";
import { baixarTexto } from "@/lib/arquivo";
import { MIN_CAPITULO, capituloEm, montarHistoria, proximoCapitulo, segCap, type Capitulo } from "@/lib/dominio/capitulos";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";

interface Props {
  h: Historico;
  placa: string;
  tipo: string;
  vaga: string;
  pronto: MapaPronto | null;
  celular: boolean;
  /** camada sobre o mapa (para o horário do player e, no celular, o player inteiro) */
  sobreMapa: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
}

/** Histórico carregado (use com key do histórico): a história do dia em capítulos, a faixa e o player. */
export function ConteudoHistorico({ h, placa, tipo, vaga, pronto, celular, sobreMapa, trechoSel, focarTrecho }: Props) {
  const player = usePlayer(pronto, h);
  const { trecho, tocando, irPara } = player;
  const historia = useMemo(() => montarHistoria(h.trechos), [h.trechos]);
  const [foco, setFoco] = useState<[number, number] | null>(null);
  const [verCapitulos, setVerCapitulos] = useState(false);
  const atual = capituloEm(historia.capitulos, player.t);
  const prox = proximoCapitulo(historia.capitulos, player.t);

  const irCapitulo = useCallback((c: Capitulo) => irPara(segCap(c.inicio), true), [irPara]);
  const irCapituloRef = useRef(irCapitulo);
  useEffect(() => {
    irCapituloRef.current = irCapitulo;
  });

  // rota do dia (o pedaço do foco em destaque) e os capítulos numerados no mapa
  useEffect(() => {
    if (!pronto) return;
    const { L, mapa } = pronto;
    const painel = mapa.getPane(PAINEL_ROTA) ?? mapa.createPane(PAINEL_ROTA);
    painel.style.zIndex = "390";
    const camada = L.layerGroup().addTo(mapa);
    desenharRota(L, camada, h, foco);
    desenharCapitulos(L, camada, historia.capitulos, (c) => irCapituloRef.current(c));
    return () => void camada.remove();
  }, [pronto, h, foco, historia]);

  // acompanha na lista o capítulo em que o caminhão está
  useEffect(() => {
    if (tocando && atual) document.querySelector(`[data-capitulo="${atual}"]`)?.scrollIntoView({ block: "nearest" });
  }, [atual, tocando]);

  const escolherTrecho = (i: number) => {
    focarTrecho(i);
    irPara(segDe(h.trechos[i].inicio.slice(11, 19)), false);
  };
  const andou = tocando || player.t > player.t0 || trechoSel != null;
  const botaoProximo = prox && (
    <Botao variante="secundaria" tamanho="mini" onClick={() => irCapitulo(prox)}>
      <Icone nome="proximo" className="h-4 w-4" />
      Próximo capítulo
    </Botao>
  );

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
          // no celular o horário fica na barra do player (em cima, a pílula do veículo)
          <div className="absolute inset-x-2 bottom-2 max-h-[70%] overflow-y-auto rounded-2xl border border-borda bg-superficie/95 p-3 shadow-xl">
            <InfoPlayer player={player} />
            <div className="my-2">
              <FaixaDia h={h} historia={historia} player={player} foco={foco} mudarFoco={setFoco} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ControlesPlayer player={player} />
              {botaoProximo}
              <Botao variante="secundaria" tamanho="mini" onClick={() => setVerCapitulos((x) => !x)} aria-expanded={verCapitulos}>
                Capítulos ({historia.capitulos.length})
              </Botao>
            </div>
            {verCapitulos && (
              <div className="mt-2 border-t border-borda">
                <ListaCapitulos capitulos={historia.capitulos} atual={atual} foco={foco} escolher={irCapitulo} />
              </div>
            )}
          </div>,
          sobreMapa,
        )
      : null;
  }

  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      <div className="space-y-2 border-b border-borda px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{placa}</span>
          {tipo && <Selo tom="reg">{tipo}</Selo>}
          <span className="text-[13px] text-suave">
            {diaBR(h.dia)} · {FONTE[h.fonte]}
          </span>
        </div>
        {vaga && <p className="text-xs text-suave">{vaga}</p>}
        {h.aviso && <p className="text-xs text-suave">{h.aviso}</p>}
        <Destaques d={historia.destaques} />
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
      <div className="space-y-2.5 border-b border-borda px-4 py-3">
        <FaixaDia h={h} historia={historia} player={player} foco={foco} mudarFoco={setFoco} />
        <div className="flex flex-wrap items-center gap-2">
          <ControlesPlayer player={player} />
          {botaoProximo}
        </div>
        <InfoPlayer player={player} />
      </div>
      <SecaoTitulo>Capítulos do dia · paradas de {MIN_CAPITULO} min ou mais</SecaoTitulo>
      <ListaCapitulos capitulos={historia.capitulos} atual={atual} foco={foco} escolher={irCapitulo} />
      <details className="border-t border-borda">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Apontamento completo ({h.trechos.length} trechos)</summary>
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
          Trechos
        </SecaoTitulo>
        <ListaTrechos trechos={h.trechos} sel={andou && trecho >= 0 ? trecho : null} aoEscolher={escolherTrecho} />
      </details>
    </>
  );
}
```

- [ ] **Step 6: Tela da Timeline**

Em `src/app/timeline/_componentes/timeline.tsx`:

1. Imports:
   - Remova `desenharRota` e o tipo `Leaflet`, que ficam sem uso.
   - Acrescente `import { TIPOS_EQUIP, compararEquip, nomeEquip } from "@/lib/dominio/equipamentos";`.
2. Remova `const camada = useRef<Leaflet.LayerGroup | null>(null);`.
3. A lista ordenada pela planilha:

```ts
  const lista = useMemo(() => semMotor2(todos ?? []).sort(compararEquip), [todos]);
```

4. Troque os dois `useEffect` que criam a camada e desenham a rota por:

```ts
  useEffect(() => {
    if (pronto) pronto.L.control.layers(pronto.camadasBase).addTo(pronto.mapa);
  }, [pronto]);
  // a rota e os capítulos são desenhados pelo ConteudoHistorico; aqui só enquadra o dia
  useEffect(() => {
    if (!pronto || !hist?.pontos.length) return;
    pronto.mapa.fitBounds(pronto.L.latLngBounds(hist.pontos.map((p): [number, number] => [p[0], p[1]])).pad(0.06));
  }, [pronto, hist]);
```

5. O nome mostrado:

```ts
  const placa = alvo ? nomeEquip(alvo) : (hist?.id ?? "");
```

6. Passe o tipo ao conteúdo: no `<ConteudoHistorico ... />`, acrescente `tipo={alvo?.equip ? TIPOS_EQUIP[alvo.equip.tipo].rotulo : ""}`.
7. No botão do celular, troque `<b>{escolhido.placa}</b>` por `<b>{nomeEquip(escolhido)}</b>`.

Em `src/app/timeline/_componentes/seletor-veiculo.tsx`:
- Acrescente `import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";`.
- No campo, troque `value={texto ?? escolhido?.placa ?? ""}` por `value={texto ?? (escolhido ? nomeEquip(escolhido) : "")}`.
- No filtro, troque `[v.placa, v.vaga, v.motorista]` por `[v.placa, v.equip?.nome, v.vaga, v.motorista]`.
- Em cada item da lista, onde aparece `{v.placa}`, mostre `{nomeEquip(v)}` e, ao lado, em texto suave, `{v.equip ? TIPOS_EQUIP[v.equip.tipo].sigla : ""}`.

- [ ] **Step 7: Conferência e commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: tudo passa.

```bash
git add src/components/historico src/components/mapa/rota.ts src/lib/mapa/rota.ts src/lib/mapa/rota.test.ts src/app/timeline src/app/globals.css
git commit -m "Timeline conta o dia: faixa em duas trilhas, capítulos numerados no mapa e na lista, foco por período

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tela "Dia da frota"

**Files:**
- Create: `src/app/frota/page.tsx`, `src/app/frota/_componentes/dia-frota.tsx`
- Modify: `src/lib/menu.ts`, `src/lib/menu.test.ts`, `src/components/icones.tsx`

**Interfaces:**
- Consumes:
  - `montarDiaFrota`, `agruparFrota`, `EstadoFaixa`, `OrdemFrota`, `LinhaFrota`, `GrupoFrota` (Tarefa 5)
  - `fmtHoras`, `hmDoMinuto` (Tarefa 5)
  - `vagaCurta` (Tarefa 6)
  - `useEventos` (Tarefa 3), `useRetrato`, `useAgora`, `lerDias`
- Produces: a rota `/frota/` e o item `{ href: "/frota", rotulo: "Dia da frota", curto: "Frota", icone: "frota" }` no `MENU`.

- [ ] **Step 1: Teste que falha (menu)**

Em `src/lib/menu.test.ts`, acrescente dentro do `describe`:

```ts
  it("Dia da frota está no menu, depois da Localização", () => {
    expect(MENU.map((m) => m.href)).toEqual(["/", "/frota", "/timeline", "/alertas"]);
    expect(telaAtiva("/frota/", "/frota")).toBe(true);
  });
```

(ajuste o `import` para `import { MENU, telaAtiva } from "./menu";`)

Run: `npx vitest run src/lib/menu.test.ts`
Expected: FAIL.

- [ ] **Step 2: Menu e ícone**

Em `src/components/icones.tsx`, acrescente `"frota"` ao tipo `IconeNome` e ao `CAMINHOS`:

```ts
  frota: "M4 6h16M4 12h11M4 18h14",
```

Em `src/lib/menu.ts`:

```ts
export const MENU: { href: string; rotulo: string; curto: string; icone: IconeNome }[] = [
  { href: "/", rotulo: "Localização", curto: "Mapa", icone: "mapa" },
  { href: "/frota", rotulo: "Dia da frota", curto: "Frota", icone: "frota" },
  { href: "/timeline", rotulo: "Timeline", curto: "Timeline", icone: "timeline" },
  { href: "/alertas", rotulo: "Alertas", curto: "Alertas", icone: "alertas" },
];
```

Run: `npx vitest run src/lib/menu.test.ts`
Expected: PASS.

- [ ] **Step 3: A tela**

`src/app/frota/page.tsx`:

```tsx
import { DiaFrota } from "./_componentes/dia-frota";

export default function Pagina() {
  return <DiaFrota />;
}
```

`src/app/frota/_componentes/dia-frota.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Aviso, Segmentado, Selecao, Selo, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { agruparFrota, minutoDoDia, montarDiaFrota, type EstadoFaixa, type GrupoFrota, type LinhaFrota, type OrdemFrota } from "@/lib/dominio/dia-frota";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { diaLocal, fmtHoras, hmDoMinuto, rotuloDia } from "@/lib/dominio/formato";
import { vagaCurta } from "@/lib/dominio/veiculo";
import { useAgora } from "@/lib/hooks";

const ESTADOS: Record<EstadoFaixa, { rotulo: string; estilo: CSSProperties }> = {
  ligado: { rotulo: "Ligado", estilo: { background: corDoTom("ok") } },
  desligado: { rotulo: "Desligado", estilo: { background: corDoTom("bad") } },
  manut: { rotulo: "Manutenção", estilo: { background: corDoTom("na") } },
  sem_sinal: { rotulo: "Sem sinal", estilo: { background: "repeating-linear-gradient(135deg, var(--neu-dot) 0 3px, transparent 3px 6px)" } },
  sem_registro: { rotulo: "Sem registro", estilo: {} },
};
const pct = (m: number) => `${(m / 1440) * 100}%`;
const COLUNAS = "md:grid-cols-[180px_1fr_120px]";

/** Dia da frota: uma faixa por equipamento (ligado/desligado/sem sinal ao longo do dia), por tipo. Só eventos já gravados. */
export function DiaFrota() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [dias, setDias] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<OrdemFrota>("tipo");
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);
  const { eventos, carregando, erro } = useEventos(dia);
  const ehHoje = dia === hoje;
  const grupos = useMemo(() => agruparFrota(montarDiaFrota(eventos, retrato?.veiculos ?? [], dia, agora, ehHoje), ordem), [eventos, retrato, dia, agora, ehHoje, ordem]);
  const agoraMin = ehHoje && agora ? minutoDoDia(new Date(agora).toISOString(), dia) : null;
  const opcoesDias = dias.includes(dia) ? dias : [dia, ...dias];

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-3 px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie p-3 shadow-sm">
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-40">
          {opcoesDias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
        <Segmentado
          rotulo="Ordenar"
          valor={ordem}
          mudar={setOrdem}
          opcoes={[
            { id: "tipo", rotulo: "Por tipo" },
            { id: "mais", rotulo: "Mais tempo ligado" },
            { id: "menos", rotulo: "Menos tempo ligado" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave md:ml-auto">
          {(Object.keys(ESTADOS) as EstadoFaixa[]).map((e) => (
            <span key={e} className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-sm border border-borda" style={ESTADOS[e].estilo} />
              {ESTADOS[e].rotulo}
            </span>
          ))}
          <span>· precisão de ~5 min · ligado = status do GAUSS (inclui andando)</span>
        </div>
      </div>
      {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
      {carregando ? (
        <Vazio titulo="Carregando o dia da frota…" />
      ) : !grupos.length ? (
        <Vazio titulo="Nenhum equipamento">Aguardando a primeira leitura do coletor.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
          <div className={`hidden gap-3 border-b border-borda px-3 py-1.5 text-[10px] tabular-nums text-suave md:grid ${COLUNAS}`}>
            <span />
            <span className="flex justify-between">
              {["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h", "24h"].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </span>
            <span className="text-right">ligado no dia</span>
          </div>
          {grupos.map((g) => (
            <Grupo key={g.tipo} g={g} dia={dia} agoraMin={agoraMin} />
          ))}
        </div>
      )}
    </div>
  );
}

function Grupo({ g, dia, agoraMin }: { g: GrupoFrota; dia: string; agoraMin: number | null }) {
  return (
    <section>
      <h2 className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie-2 px-3 py-2 text-[13px]">
        <b>{TIPOS_EQUIP[g.tipo].rotulo}</b>
        <span className="text-suave">{g.linhas.length}</span>
        {agoraMin != null && (
          <>
            <Selo tom="ok">{g.agoraLigados} ligados agora</Selo>
            <Selo tom="bad">{g.agoraDesligados} desligados</Selo>
            {g.agoraSemSinal > 0 && <Selo tom="neu">{g.agoraSemSinal} sem sinal</Selo>}
          </>
        )}
        <span className="ml-auto text-suave">
          ligado no dia: <b className="text-texto">{fmtHoras(g.ligado_min)}</b>
        </span>
      </h2>
      {g.linhas.map((l) => (
        <Linha key={l.id} l={l} dia={dia} agoraMin={agoraMin} />
      ))}
    </section>
  );
}

function Linha({ l, dia, agoraMin }: { l: LinhaFrota; dia: string; agoraMin: number | null }) {
  const vaga = l.tipo === "as" ? "" : vagaCurta(l.vaga);
  const base = agoraMin ?? 1440;
  return (
    <Link href={`/timeline/?v=${encodeURIComponent(l.id)}&dia=${dia}`} className={`grid grid-cols-1 gap-1 border-b border-borda px-3 py-2 hover:bg-superficie-2 hover:no-underline md:items-center md:gap-3 ${COLUNAS}`}>
      <span className="truncate text-[13px] font-semibold text-texto">
        {l.nome}
        {vaga && <span className="ml-1.5 text-xs font-normal text-suave">{vaga}</span>}
      </span>
      <span className="relative block h-4 overflow-hidden rounded bg-superficie-2">
        {l.faixas.map((f, i) => (
          <span
            key={i}
            title={`${hmDoMinuto(f.de)}–${hmDoMinuto(f.ate)} · ${f.status || ESTADOS[f.estado].rotulo}${f.area ? ` · ${f.area}` : ""}`}
            className="absolute inset-y-0"
            style={{ left: pct(f.de), width: pct(f.ate - f.de), ...ESTADOS[f.estado].estilo }}
          />
        ))}
        {agoraMin != null && <span aria-hidden className="absolute inset-y-0 w-0.5" style={{ left: pct(agoraMin), background: "var(--texto)" }} />}
      </span>
      <span className="text-right text-xs tabular-nums text-suave">
        <b className="text-texto">{fmtHoras(l.ligado_min)}</b> ligado
        <span className="mt-0.5 block h-1 overflow-hidden rounded bg-superficie-2">
          <span className="block h-full" style={{ width: `${Math.min(100, (l.ligado_min / Math.max(base, 1)) * 100)}%`, background: corDoTom("ok") }} />
        </span>
      </span>
    </Link>
  );
}
```

- [ ] **Step 4: Conferência e commit**

Run: `npx vitest run && npm run typecheck && npm run lint && npm run build`
Expected: tudo passa; o build lista `/frota`.

```bash
git add src/app/frota src/lib/menu.ts src/lib/menu.test.ts src/components/icones.tsx
git commit -m "Tela Dia da frota: uma faixa por equipamento, agrupada por tipo, abre a Timeline ao clicar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Alertas por tipo, busca Mercosul/aspirador e Ctrl K com o tipo

**Files:**
- Modify: `src/lib/busca.ts`, `src/lib/busca.test.ts`, `src/lib/dominio/eventos.ts`, `src/lib/dominio/eventos.test.ts`, `src/app/alertas/_componentes/alertas.tsx`, `src/components/paleta.tsx`

**Interfaces:**
- Consumes: `formasPlaca`, `TIPOS_EQUIP`, `ORDEM_TIPOS`, `nomeEquip` (Tarefa 1); `ehAlerta` (Tarefa 3).
- Produces:
  - `pontuarVeiculo` aceita as formas Mercosul, o nome da planilha e "asp 5"/"aspirador 05".
  - `doTipo(es: Evento[], tipo: TipoEquip | null, tipoDe: ReadonlyMap<string, TipoEquip>): Evento[]`.

- [ ] **Step 1: Testes que falham**

Em `src/lib/busca.test.ts`, acrescente (use a fábrica de veículo que o arquivo já tem; se não houver, crie uma igual à de `veiculo.test.ts`):

```ts
describe("busca pela frota", () => {
  const av = { placa: "DYB7C10", equip: { tipo: "av" as const, nome: "DYB-7210", ordem: 6 } };
  const asp5 = { placa: "ASP12-RESERVA", vaga: "ASPIRADOR INDUSTRIAL - GPS - 05", equip: { tipo: "as" as const, nome: "Aspirador 05", ordem: 5 } };
  const asp6 = { placa: "ASP06", vaga: "ASPIRADOR INDUSTRIAL - GPS - 06", equip: { tipo: "as" as const, nome: "Aspirador 06", ordem: 6 } };
  it("placa antiga acha a Mercosul e vice-versa", () => {
    expect(pontuarVeiculo(v(av), "dyb-72")).toBe(3);
    expect(pontuarVeiculo(v({ ...av, placa: "DYB7210" }), "dyb7c")).toBe(3);
  });
  it("'asp 5' e 'aspirador 05' acham só o Aspirador 05", () => {
    expect(pontuarVeiculo(v(asp5), "asp 5")).toBe(3);
    expect(pontuarVeiculo(v(asp5), "aspirador 05")).toBe(3);
    expect(pontuarVeiculo(v(asp6), "asp 5")).toBe(0);
  });
  it("acha pelo nome do tipo, sem acento", () => {
    expect(pontuarVeiculo(v(av), "alto vacuo")).toBe(1);
  });
});
```

Em `src/lib/dominio/eventos.test.ts` (ajuste o import para incluir `doTipo`):

```ts
describe("alertas por tipo de equipamento", () => {
  it("filtra pelo tipo do equipamento (o motor 2º conta como o caminhão)", () => {
    const base = { t: "2026-10-03T12:00:00.000Z", vaga: "", tipo: "entrada" as const, area: "P", lat: 0, lng: 0 };
    const es = [{ ...base, id: "10", placa: "A" }, { ...base, id: "11", placa: "A2", motor2: true as const, principal_id: "10" }, { ...base, id: "40", placa: "ASP" }];
    const tipoDe = new Map([["10", "ap" as const], ["40", "as" as const]]);
    expect(doTipo(es, "ap", tipoDe).map((e) => e.id)).toEqual(["10", "11"]);
    expect(doTipo(es, null, tipoDe)).toHaveLength(3);
  });
});
```

Run: `npx vitest run src/lib/busca.test.ts src/lib/dominio/eventos.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementação**

Em `src/lib/busca.ts`:
- Acrescente `import { TIPOS_EQUIP, formasPlaca } from "./dominio/equipamentos";`.
- Troque `pontuarVeiculo` por:

```ts
/** 3 = começo da placa (antiga ou Mercosul), do nome da planilha ou do motor 2º, ou o número do aspirador; 2 = parte; 1 = vaga/motorista/área/rua/grupo/status/tipo; 0 = não casa. */
export function pontuarVeiculo(v: Veiculo, q: string): number {
  const qn = norm(q.trim());
  const qp = normPlacaBusca(q);
  const placas = [...formasPlaca(v.placa), normPlacaBusca(v.equip?.nome), normPlacaBusca(v.motor2?.placa)].filter(Boolean);
  const asp = /^ASP(?:IRADOR)?0*(\d{1,2})$/.exec(qp);
  if (asp && v.equip?.tipo === "as" && v.equip.ordem === Number(asp[1])) return 3;
  if (asp) return 0;
  if (qp.length >= 2 && placas.some((p) => p.startsWith(qp))) return 3;
  if (qp.length >= 2 && placas.some((p) => p.includes(qp))) return 2;
  const tipo = v.equip ? TIPOS_EQUIP[v.equip.tipo].rotulo : "";
  if (qn && norm([v.vaga, v.motorista, v.area, v.via, v.grupo, v.status, tipo].join(" ")).includes(qn)) return 1;
  return 0;
}
```

Em `src/lib/dominio/eventos.ts`, acrescente:

```ts
/** Alertas de um tipo de equipamento (o do motor 2º conta como o do caminhão). */
export function doTipo(es: Evento[], tipo: TipoEquip | null, tipoDe: ReadonlyMap<string, TipoEquip>): Evento[] {
  return tipo ? es.filter((e) => tipoDe.get(veiculoDoEvento(e)) === tipo) : es;
}
```

(e `import type { Evento, TipoEquip, Tom } from "../tipos";`)

Em `src/app/alertas/_componentes/alertas.tsx`:
- Acrescente aos imports:

```ts
import { useRetrato } from "@/lib/dados/use-retrato";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import type { Evento, TipoEquip } from "@/lib/tipos";
```

e `doTipo` ao import de `@/lib/dominio/eventos`.
- Logo depois da linha `const eventos = useMemo(() => doDia.filter(ehAlerta), [doDia]);` (Tarefa 3), acrescente:

```ts
  const { retrato } = useRetrato();
  const [tipo, setTipo] = useState<TipoEquip | null>(null);
  const tipoDe = useMemo(() => new Map((retrato?.veiculos ?? []).flatMap((v) => (v.equip ? [[v.id, v.equip.tipo] as const] : []))), [retrato]);
  const doTipoEscolhido = useMemo(() => doTipo(eventos, tipo, tipoDe), [eventos, tipo, tipoDe]);
```

- Nas linhas `const conta = contarPorGrupo(eventos);` e `const lista = useMemo(() => filtrarEventos(eventos, grupos, busca), [eventos, grupos, busca]);`, troque `eventos` por `doTipoEscolhido`.
- No cartão "Total", troque `n: eventos.length` por `n: doTipoEscolhido.length`.
- Na barra de filtros, depois da `<Entrada type="search" ... />`, acrescente:

```tsx
          <div className="flex flex-wrap gap-1.5" aria-label="Tipo de equipamento">
            {ORDEM_TIPOS.map((t) => (
              <Chip key={t} ativo={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}>
                {TIPOS_EQUIP[t].rotulo}
              </Chip>
            ))}
          </div>
```

- Troque o texto `{eventos.length} eventos · ...` por `{doTipoEscolhido.length} alertas · ...`.

Em `src/components/paleta.tsx`:
- Acrescente `import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";`.
- Em `itemVeiculo`, troque `rotulo` e `sub` por:

```ts
      rotulo: v.motor2 ? `${nomeEquip(v)} · ⚙ ${v.motor2.placa}` : nomeEquip(v),
      sub: [v.equip ? TIPOS_EQUIP[v.equip.tipo].rotulo : "", v.motor2 ? `${v.status} · ⚙ 2º ${v.motor2.status}` : v.status, v.vaga || "sem vaga", v.area || v.via || "fora de cerca", v.motorista].filter(Boolean).join(" · "),
```

- [ ] **Step 3: Rodar e ver passar**

Run: `npx vitest run src/lib/busca.test.ts src/lib/dominio/eventos.test.ts`
Expected: PASS.

- [ ] **Step 4: Conferência e commit**

```bash
npx vitest run && npm run typecheck && npm run lint
git add src/lib/busca.ts src/lib/busca.test.ts src/lib/dominio/eventos.ts src/lib/dominio/eventos.test.ts src/app/alertas/_componentes/alertas.tsx src/components/paleta.tsx
git commit -m "Alertas por tipo de equipamento; busca acha placa Mercosul e 'asp 5'; Ctrl K mostra o tipo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Testes de navegador, README e conferência final

**Files:**
- Modify: `e2e/apoio.ts`, `e2e/localizacao.spec.ts`, `e2e/timeline.spec.ts`, `e2e/alertas.spec.ts`, `README.md`
- Create: `e2e/frota.spec.ts`

**Interfaces:**
- Consumes: as telas das Tarefas 6–9.
- Produces: `npm run e2e` verde (computador e celular), com dados sintéticos e nenhuma gravação.

- [ ] **Step 1: Dados sintéticos com a frota**

Em `e2e/apoio.ts`, troque `retrato`, `eventos` e `historico` por:

```ts
export const retrato = () => ({
  lido_em: minutosAtras(1), erro: null, intervalo_s: 300, sem_sinal_min: 30,
  gauss: { dia: hoje(), requisicoes: 42, logins: 1, erros: 0, desde: minutosAtras(600), pausadoAte: null },
  veiculos: [
    veiculo({ id: "10", placa: "EGC2985", grupo: "CAMINHÃO ALTA PRESSÃO", vaga: "ALTA PRESSÃO - GPS - 08 - 24 HS", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", area_desde: minutosAtras(20),
      motor2: { id: "11", placa: "EGC29852", status: "Ligado", status_cod: 1, status_desde: minutosAtras(5), posicao_em: minutosAtras(1), sem_sinal: false } }),
    veiculo({ id: "11", placa: "EGC29852", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", motor2_de: "10" }),
    veiculo({ id: "20", placa: "EGC-2984", grupo: "CAMINHÃO BROOK", status: "Desligado", status_cod: 2, lat: -19.475, lng: -42.525, area: "OFICINA" }),
    veiculo({ id: "30", placa: "DSY6472", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Em manutenção", status_cod: 9, lat: -19.470, lng: -42.520, via: "RUA 1", posicao_em: minutosAtras(90) }),
    veiculo({ id: "40", placa: "ASP12", grupo: "ASPIRADOR", vaga: "ASPIRADOR INDUSTRIAL - GPS - 03", status: "Ligado", status_cod: 1, lat: -19.4805, lng: -42.5305, area: "PATIO" }),
    // não é da frota da Mecanizada: não pode aparecer em lugar nenhum
    veiculo({ id: "90", placa: "EOF5208", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Ligado", status_cod: 1, lat: -19.479, lng: -42.529, area: "PATIO" }),
  ],
});
export const eventos = () => [
  { t: minutosAtras(600), id: "10", placa: "EGC2985", vaga: "", tipo: "abertura", status: "Desligado", area: "PATIO", sem_sinal: false },
  { t: minutosAtras(50), id: "10", placa: "EGC2985", vaga: "", tipo: "entrada", area: "PATIO", lat: -19.48, lng: -42.53 },
  { t: minutosAtras(45), id: "10", placa: "EGC2985", vaga: "", tipo: "status", de: "Desligado", para: "Ligado", area: "PATIO", duracao_min: 500 },
  { t: minutosAtras(40), id: "20", placa: "EGC-2984", vaga: "", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
  { t: minutosAtras(30), id: "90", placa: "EOF5208", vaga: "", tipo: "status", de: "Desligado", para: "Ligado", area: "PATIO", duracao_min: 10 },
];
export const historico = () => {
  const dia = hoje();
  // 08:00–08:10 andando, 08:10–08:40 parado ligado no PATIO (30 min = 1 capítulo)
  const pontos = Array.from({ length: 41 }, (_, i) => [-19.481 + Math.min(i, 10) * 0.0002, -42.531 + Math.min(i, 10) * 0.0001, `08:${pad(i)}:00`, i < 10 ? 35 : 0, i < 10 ? "movimento" : "parado_ligado", i >= 2 && i <= 5 ? 1 : 0]);
  return {
    id: "10", dia, fonte: "cache", baixado_em: minutosAtras(60), motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null,
    motor2: { intervalos: [["08:02:00", "08:05:00"]], id: "11", placa: "EGC29852" },
    trechos: [
      { estado: "movimento", inicio: `${dia} 08:00:00`, fim: `${dia} 08:10:00`, duracao_min: 10, de: "OFICINA", para: "PATIO", percurso: ["PATIO"], km: 2.1, vel_max: 35, motor2_min: 3 },
      { estado: "parado_ligado", inicio: `${dia} 08:10:00`, fim: `${dia} 08:40:00`, duracao_min: 30, local: "PATIO", lat: -19.479, lng: -42.53, motor2_min: 0 },
    ],
    resumo: { primeiro: `${dia} 08:00:00`, ultimo: `${dia} 08:40:00`, pontos: 41, km: 2.1, vel_max: 35, movimento_min: 10, parado_ligado_min: 30, desligado_min: 0, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: 3, areas: [{ area: "PATIO", min: 30 }] },
    pontos,
  };
};
```

(`veiculo`, `minutosAtras`, `pad`, `hoje`, `CERCAS` e `prepararDados` continuam como estão.)

- [ ] **Step 2: Testes de navegador**

Substitua `e2e/localizacao.spec.ts` por:

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Localização: só a frota, por tipo, e o detalhe leva ao dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    const painel = page.locator("aside");
    await expect(painel.getByRole("button", { name: /Alta Pressão/ })).toBeVisible();
    await expect(painel.getByRole("button", { name: /Aspirador 03/ })).toBeVisible();
    await expect(page.getByText("EOF5208")).toHaveCount(0);
    await painel.getByRole("button", { name: /EGC-2985/ }).click();
    await expect(painel.getByText("Bomba (motor 2º)")).toBeVisible();
    await expect(painel.getByRole("link", { name: /Ver o dia/ })).toHaveAttribute("href", /\/timeline\/\?v=10&dia=/);
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Painel recolhe numa barra com os tipos, filtra e reabre", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "barra só no computador");
  await prepararDados(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Recolher painel" }).click();
  const barra = page.getByRole("navigation", { name: "Tipos de equipamento" });
  await expect(barra).toBeVisible();
  const as = barra.getByRole("button", { name: /^AS/ });
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "true");
  await barra.getByRole("button", { name: "Abrir painel" }).click();
  await expect(page.locator("aside").getByText("Aspiradores ✕")).toBeVisible();
});

test("Busca Ctrl K acha placa com hífen e aspirador pelo número", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "atalho de teclado");
  await prepararDados(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const caixa = page.getByRole("dialog").getByRole("searchbox");
  await caixa.fill("egc-2984");
  await expect(page.getByRole("option", { name: /EGC-2984/ })).toBeVisible();
  await caixa.fill("asp 3");
  await expect(page.getByRole("option", { name: /Aspirador 03/ })).toBeVisible();
});
```

Substitua `e2e/timeline.spec.ts` por:

```ts
import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: conta o dia em capítulos e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  if (info.project.name === "computador") {
    const capitulos = page.getByRole("list", { name: "Capítulos do dia" });
    await expect(capitulos).toBeVisible();
    await capitulos.getByRole("button", { name: /PATIO/ }).click();
    await expect(page.getByText(/08:10:00/).first()).toBeVisible();
  }
  await play.click();
  await expect(page.getByRole("button", { name: /Pausar/ })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Timeline: link com o motor secundário abre o caminhão", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "o nome aparece no painel do computador");
  await prepararDados(page);
  await page.goto(`/timeline/?v=EGC29852&dia=${hoje()}`);
  await expect(page.locator("section").getByText("EGC-2985", { exact: true })).toBeVisible();
});
```

Substitua `e2e/alertas.spec.ts` por:

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Alertas: só a frota, sem a abertura do dia, e detalhe", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/alertas/");
  // entrada + 2 status da frota; a abertura do dia e o evento do EOF5208 não contam
  await expect(page.getByRole("button", { name: /Total/ })).toContainText("3");
  await expect(page.getByText("EOF5208")).toHaveCount(0);
  await page.getByRole("button", { name: /EGC-2984/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Desligado");
  await expect(page.getByRole("link", { name: "Ver timeline" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

`e2e/frota.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Dia da frota: por tipo, só a frota, e a linha abre a timeline", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/frota/");
  await expect(page.getByRole("heading", { name: /Alta Pressão/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Aspiradores/ })).toBeVisible();
  await expect(page.getByText("EOF5208")).toHaveCount(0);
  await page.getByRole("link", { name: /EGC-2985/ }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});
```

- [ ] **Step 3: Rodar**

Run: `npm run build && npm run e2e`
Expected: 14 execuções (7 testes × 2 projetos). Pulados no celular: o "Painel recolhe", a "Busca Ctrl K" e o "link com o motor secundário" (3 pulados), então **11 passam e 3 são pulados**.

Se um seletor não achar o elemento, confira o texto na tela (`npx playwright test --headed` ou o relatório). **Nunca** relaxe `expect(gravacoes).toEqual([])` nem o `toHaveCount(0)` do EOF5208.

- [ ] **Step 4: README**

Em `README.md`:

Na tabela **Arquitetura**, troque a linha de `src/app/page.tsx` e acrescente as novas:

```markdown
| `src/app/page.tsx` + `_localizacao/` | Localização: painel retrátil (barra com os tipos), lista por tipo, áreas, alertas, detalhe; gaveta no celular |
| `src/app/frota/` | Dia da frota: uma faixa por equipamento no dia, por tipo (só eventos já gravados, precisão ~5 min) |
| `src/app/timeline/` | Timeline com player e a história do dia em capítulos (`?v=<id ou placa>&dia=AAAA-MM-DD`) |
```

e a linha de `src/lib/dominio/`:

```markdown
| `src/lib/dominio/` | Regras puras com testes: frota própria e tipos (`equipamentos.ts`, `frota-propria.ts`), capítulos do dia, Dia da frota, categoria/frescor, eventos, motor 2º, geometria, apontamento, leitura do GAUSS |
```

Em **Pontos de atenção do dono**, acrescente:

```markdown
8. **Só a frota da Mecanizada aparece** (`src/lib/dominio/equipamentos.ts`, planilha "LOCAÇÃO - GPS": 41 equipamentos e o Ultravac OWU-1596). Equipamento novo ou devolvido: edite a lista e publique. Aspiradores são reconhecidos pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"). Placas de grupos da frota que não estão na lista ficam em `loc_kv` → `snapshot` → `fora_da_lista`.
9. **"Trabalhando" ainda não está definido.** As telas falam só em ligado/desligado/parado ligado; quando a regra for decidida, ela entra em `classeTempo()` (`src/lib/dominio/capitulos.ts`).
```

Em **Cuidados**, acrescente:

```markdown
- O Dia da frota parte da "abertura do dia" que o coletor grava no 1º ciclo após a meia-noite. Dia sem abertura usa o primeiro status; sem nenhum evento, a faixa fica "sem registro" (nunca é inventada).
```

Troque a seção **Pendências e estado atual** por:

```markdown
## Pendências e estado atual (04/10/2026)

| # | Pendência | Onde / como |
|---|---|---|
| 1 | Publicar a etapa "história e frota": merge da branch `historia-e-frota` na `main` (publica o site e o coletor novo) | Quando o dono pedir |
| 2 | Definir a regra de "trabalhando" (parado ligado em área de serviço? bomba ligada?) | `classeTempo()` em `src/lib/dominio/capitulos.ts` |
```

- [ ] **Step 5: Conferência final e commit**

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run e2e
git add e2e README.md
git commit -m "Testes de navegador com a frota própria, Dia da frota e capítulos; README atualizado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git log --oneline main..HEAD
git status --short
```

Expected: tudo passa e a árvore fica limpa. **Não** faça push nem merge.

Entregue ao dono:
- O que mudou.
- O que foi testado.
- O passo dele: autorizar o merge e o push. Isso publica o site e também o coletor novo, que passa a filtrar a frota e a gravar a abertura no primeiro ciclo.
- Depois do push, conferir o site no ar e, no dia seguinte, o Dia da frota com a abertura.

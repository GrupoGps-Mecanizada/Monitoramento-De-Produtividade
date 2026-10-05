# Mapa inteiro, trilhas e balões — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No computador, tirar a coluna lateral da Localização e da Timeline. O mapa passa a ocupar a tela, com uma barra fina no topo, trilhas horizontais embaixo e balões de detalhe.

**Architecture:**
- A lógica das trilhas fica em funções puras e testadas: `src/lib/dominio/trilhas.ts` (janela de horário, posição em %, agrupamento de eventos) e `src/lib/balao.ts` (onde o balão cabe na tela).
- Três peças visuais comuns ficam em `src/components/trilhas/`: `Balao`, `Regua` e `Alca`.
- A Timeline ganha `TrilhasDia`, o painel de baixo e a gaveta `Apontamento`.
- A Localização ganha `BarraTopo`, o cartão do equipamento e `FaixaAcontecimentos`.
- O celular não muda: os ramos `celular` continuam iguais.

**Tech Stack:**
- Next 16.3 (export estático), React 19.2, TypeScript, Tailwind 4 e Leaflet 1.9 com markercluster.
- Vitest 4 (ambiente node) para testes de unidade e Playwright 1.63 para testes de navegador (projetos "computador" 1440×900 e "celular" Pixel 7).

**Spec:** `docs/superpowers/specs/2026-10-04-mapa-inteiro-trilhas-design.md`

## Global Constraints

- Nenhuma dependência nova (o balão é componente próprio).
- Nenhuma requisição nova ao GAUSS; nada muda no coletor (`coletor/`), no banco nem nas leituras (`src/lib/dados/`).
- **NUNCA rodar `coletor/run.ts` no computador.**
- O celular (`useCelular() === true`) mantém gaveta, pílula, `ResumoCelular`, `FaixaDia` e o player no rodapé, sem mudança.
- Os testes de navegador usam só os dados sintéticos de `e2e/apoio.ts`; `gravacoes` tem que continuar `[]`.
- Textos de tela em português do Brasil; comentários no estilo do código (curtos, em português).
- Commits terminam com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Verificação completa: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`.
- Windows/Git Bash: build com subcaminho é `MSYS_NO_PATHCONV=1 BASE_PATH=/Monitoramento-De-Produtividade npm run build`. Não guarde cópias do site dentro do repositório (o `eslint .` lê os .js gerados).
- Não fazer push nem merge: tudo fica no ramo `historia-e-frota` até o dono mandar publicar.

## Review Focus

1. **Dia que termina à meia-noite** (último trecho com fim `…+1 00:00:00`): a régua tem que ir até 24h, e não voltar para 0h. Teste: `janelaDosTrechos` na Tarefa 1.
2. **Dia/filtro sem nenhum acontecimento:** a faixa mostra uma frase, nada quebra, e a janela vale o dia inteiro. Teste: `janelaDosEventos([])` (Tarefa 1) e o texto "Nenhum acontecimento" (Tarefa 5).
3. **Balão perto da borda da tela** (bloco no fim do dia, botão no canto): o balão troca de lado ou encosta na margem, nunca sai da tela. Teste: `posicionarBalao` na Tarefa 2.
4. **Blocos muito curtos ou fora da janela ampliada:** bloco de segundos ainda aparece (mínimo de 60 s), e o que fica fora da janela some, sem desenhar fora da faixa. Teste: `posBloco` na Tarefa 1.
5. **Preferência guardada inválida** (valor antigo no navegador, aba anônima): a altura volta ao padrão. Teste: `opcaoValida` na Tarefa 2.

---

### Task 1: Lógica das trilhas (janela, posição, agrupamento)

**Files:**
- Create: `src/lib/dominio/trilhas.ts`
- Test: `src/lib/dominio/trilhas.test.ts`

**Interfaces:**
- Consumes: `minutoDoDia(iso, dia)` de `./dia-frota`; `ehAlerta`, `grupoDoEvento`, `TODOS_GRUPOS`, `GrupoEvento` de `./eventos`; `segDe(hms)` de `./formato`; tipos `Evento`, `Trecho` de `../tipos`.
- Produces:
  - `DIA = 86400`
  - `type Janela = readonly [number, number]` (segundos do dia)
  - `janelaDosRegistros(primeiro: number | null, ultimo: number | null): Janela`
  - `janelaDosTrechos(trechos: Pick<Trecho, "inicio" | "fim">[]): Janela`
  - `emPct(s: number, j: Janela): number`
  - `segDaFracao(f: number, j: Janela): number`
  - `posBloco(ini: number, fim: number, j: Janela, minSeg?: number): { esq: number; larg: number } | null`
  - `marcasRegua(j: Janela): number[]`
  - `ampliar(foco: Janela): Janela`
  - `segDoEvento(iso: string, dia: string): number`
  - `janelaDosEventos(eventos: Evento[], dia: string): Janela`
  - `interface Bolinha { s: number; eventos: Evento[] }`
  - `agruparEventos(eventos: Evento[], dia: string, j: Janela): Record<GrupoEvento, Bolinha[]>`

- [ ] **Step 1: Write the failing test** — crie `src/lib/dominio/trilhas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Evento } from "../tipos";
import { DIA, agruparEventos, ampliar, emPct, janelaDosEventos, janelaDosRegistros, janelaDosTrechos, marcasRegua, posBloco, segDaFracao, segDoEvento } from "./trilhas";

const H = 3600;
const D = "2026-10-01";
// horário local do dia D (como o coletor grava: ISO em UTC)
const iso = (hms: string) => new Date(`${D}T${hms}`).toISOString();
const base = (hms: string, id = "1") => ({ t: iso(hms), id, placa: "AAA1111", vaga: "" });
const entrada = (hms: string): Evento => ({ ...base(hms), tipo: "entrada", area: "PATIO", lat: null, lng: null });
const status = (hms: string): Evento => ({ ...base(hms), tipo: "status", de: "Desligado", para: "Ligado", area: "PATIO", duracao_min: null });
const abertura = (hms: string): Evento => ({ ...base(hms), tipo: "abertura", status: "Ligado", area: "PATIO", sem_sinal: false });

describe("janela da régua", () => {
  it("cobre os registros em horas cheias, com no mínimo 1 h", () => {
    expect(janelaDosRegistros(7 * H + 1200, 18 * H + 300)).toEqual([7 * H, 19 * H]);
    expect(janelaDosRegistros(30000, 30000)).toEqual([8 * H, 9 * H]);
    expect(janelaDosRegistros(8 * H, 8 * H)).toEqual([8 * H, 9 * H]);
    expect(janelaDosRegistros(23.5 * H, 23.9 * H)).toEqual([23 * H, DIA]);
  });
  it("sem registros = dia inteiro", () => {
    expect(janelaDosRegistros(null, null)).toEqual([0, DIA]);
    expect(janelaDosTrechos([])).toEqual([0, DIA]);
  });
  it("trechos: do início do 1º ao fim do último", () => {
    expect(janelaDosTrechos([{ inicio: `${D} 07:20:00`, fim: `${D} 08:00:00` }, { inicio: `${D} 17:00:00`, fim: `${D} 18:05:00` }])).toEqual([7 * H, 19 * H]);
  });
  it("último trecho terminando à meia-noite (dia seguinte 00:00) vai até 24 h", () => {
    expect(janelaDosTrechos([{ inicio: `${D} 22:10:00`, fim: `${D} 23:00:00` }, { inicio: `${D} 23:10:00`, fim: "2026-10-02 00:00:00" }])).toEqual([22 * H, DIA]);
  });
});

describe("posição na janela", () => {
  const j = [8 * H, 10 * H] as const;
  it("instante em % (preso entre 0 e 100) e o inverso", () => {
    expect(emPct(9 * H, j)).toBe(50);
    expect(emPct(7 * H, j)).toBe(0);
    expect(emPct(11 * H, j)).toBe(100);
    expect(segDaFracao(0.25, [8 * H, 12 * H])).toBe(9 * H);
    expect(segDaFracao(-1, j)).toBe(8 * H);
  });
  it("bloco: esquerda e largura em %, cortado na janela", () => {
    expect(posBloco(9 * H, 9 * H + 1800, j)).toEqual({ esq: 50, larg: 25 });
    expect(posBloco(7.5 * H, 8.5 * H, j)).toEqual({ esq: 0, larg: 25 });
    expect(posBloco(7 * H, 7.5 * H, j)).toBeNull();
    expect(posBloco(10 * H, 11 * H, j)).toBeNull();
  });
  it("bloco curto ganha 60 s para aparecer", () => {
    expect(posBloco(9 * H, 9 * H + 10, j)?.larg).toBeCloseTo((60 / 7200) * 100);
  });
});

describe("régua e zoom", () => {
  it("marcas de 1 em 1 h até 8 h de janela, de 2 em 2 até 16 h, depois de 3 em 3", () => {
    expect(marcasRegua([8 * H, 10 * H])).toEqual([8 * H, 9 * H, 10 * H]);
    expect(marcasRegua([7 * H, 19 * H])).toEqual([8 * H, 10 * H, 12 * H, 14 * H, 16 * H, 18 * H]);
    expect(marcasRegua([0, DIA])).toHaveLength(9);
  });
  it("ampliar o foco: 5% de folga de cada lado, mínimo 30 min, dentro do dia", () => {
    expect(ampliar([H, 2 * H])).toEqual([3420, 7380]);
    expect(ampliar([0, 600])).toEqual([0, 1800]);
    expect(ampliar([86000, DIA])).toEqual([84600, DIA]);
  });
});

describe("acontecimentos em trilhas", () => {
  it("segundo do dia no horário local", () => {
    expect(segDoEvento(iso("08:05:00"), D)).toBe(8 * H + 300);
  });
  it("janela dos alertas (sem a abertura do dia); sem alertas = dia inteiro", () => {
    expect(janelaDosEventos([], D)).toEqual([0, DIA]);
    expect(janelaDosEventos([abertura("06:00:00"), entrada("08:05:00"), status("08:30:00")], D)).toEqual([8 * H, 9 * H]);
  });
  it("agrupa por trilha; próximos viram uma bolinha; abertura e fora da janela ficam de fora", () => {
    const j = [8 * H, 9 * H] as const;
    const t = agruparEventos([entrada("08:05:30"), entrada("08:05:00"), status("08:30:00"), abertura("08:00:00"), status("07:00:00")], D, j);
    expect(t.entrada).toHaveLength(1);
    expect(t.entrada[0].s).toBe(8 * H + 5.5 * 60);
    expect(t.entrada[0].eventos.map((e) => e.t)).toEqual([iso("08:05:00"), iso("08:05:30")]);
    expect(t.status).toEqual([{ s: 8 * H + 30.5 * 60, eventos: [status("08:30:00")] }]);
    expect(t.saida).toEqual([]);
    expect(t.sinal).toEqual([]);
  });
  it("evento no fim exato da janela fica na última bolinha, dentro da faixa", () => {
    const t = agruparEventos([status("09:00:00")], D, [8 * H, 9 * H]);
    expect(t.status[0].s).toBe(8 * H + 59.5 * 60);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dominio/trilhas.test.ts`
Expected: FAIL com "Failed to resolve import "./trilhas"".

- [ ] **Step 3: Write minimal implementation** — crie `src/lib/dominio/trilhas.ts`:

```ts
// Trilhas horizontais (Timeline e acontecimentos da Localização): a régua mostra uma "janela" do dia em segundos e
// cada bloco vira posição/largura em % dela (spec 2026-10-04-mapa-inteiro-trilhas-design.md).
import type { Evento, Trecho } from "../tipos";
import { minutoDoDia } from "./dia-frota";
import { TODOS_GRUPOS, ehAlerta, grupoDoEvento, type GrupoEvento } from "./eventos";
import { segDe } from "./formato";

export const DIA = 86400;
const HORA = 3600;
/** [início, fim] em segundos do dia (0–86400). */
export type Janela = readonly [number, number];

/** Janela que cobre os registros, em horas cheias (no mínimo 1 h); sem registros, o dia inteiro. */
export function janelaDosRegistros(primeiro: number | null, ultimo: number | null): Janela {
  if (primeiro == null || ultimo == null) return [0, DIA];
  const a = Math.max(0, Math.floor(Math.min(primeiro, ultimo) / HORA) * HORA);
  const b = Math.min(DIA, Math.max(Math.ceil(Math.max(primeiro, ultimo) / HORA) * HORA, a + HORA));
  return [a, b];
}

/** Janela dos trechos do apontamento ("AAAA-MM-DD HH:MM:SS"); fim no dia seguinte (00:00) = 24 h. */
export function janelaDosTrechos(trechos: Pick<Trecho, "inicio" | "fim">[]): Janela {
  if (!trechos.length) return [0, DIA];
  const ult = trechos[trechos.length - 1];
  const fim = ult.fim.slice(0, 10) > ult.inicio.slice(0, 10) ? DIA : segDe(ult.fim.slice(11, 19));
  return janelaDosRegistros(segDe(trechos[0].inicio.slice(11, 19)), fim);
}

/** Posição de um instante na janela, em % (presa entre 0 e 100). */
export const emPct = (s: number, [a, b]: Janela) => Math.min(100, Math.max(0, ((s - a) / (b - a)) * 100));
/** Instante de uma fração (0–1) da largura da janela. */
export const segDaFracao = (f: number, [a, b]: Janela) => a + Math.min(1, Math.max(0, f)) * (b - a);

/** Esquerda e largura (%) de um bloco na janela; null quando fica todo fora. `minSeg` faz bloco curto aparecer. */
export function posBloco(ini: number, fim: number, j: Janela, minSeg = 60): { esq: number; larg: number } | null {
  const f = Math.max(fim, ini + minSeg);
  if (f <= j[0] || ini >= j[1]) return null;
  const esq = emPct(ini, j);
  return { esq, larg: emPct(f, j) - esq };
}

/** Horas cheias marcadas na régua: de 1 em 1 h até 8 h de janela, de 2 em 2 até 16 h, depois de 3 em 3. */
export function marcasRegua([a, b]: Janela): number[] {
  const horas = (b - a) / HORA;
  const passo = (horas <= 8 ? 1 : horas <= 16 ? 2 : 3) * HORA;
  const m: number[] = [];
  for (let s = Math.ceil(a / passo) * passo; s <= b; s += passo) m.push(s);
  return m;
}

/** "Ampliar o foco": o período com 5% de folga de cada lado, no mínimo 30 min, sem sair do dia. */
export function ampliar([ini, fim]: Janela): Janela {
  const tam = Math.max((fim - ini) * 1.1, 1800);
  let a = (ini + fim) / 2 - tam / 2;
  let b = a + tam;
  if (a < 0) [a, b] = [0, Math.min(DIA, tam)];
  if (b > DIA) [a, b] = [Math.max(0, DIA - tam), DIA];
  return [Math.round(a), Math.round(b)];
}

/** Segundo do dia (horário local) de um instante ISO. */
export const segDoEvento = (iso: string, dia: string) => Math.round(minutoDoDia(iso, dia) * 60);

/** Janela dos alertas do dia (a abertura do dia não conta); sem alertas, o dia inteiro. */
export function janelaDosEventos(eventos: Evento[], dia: string): Janela {
  const ss = eventos.filter(ehAlerta).map((e) => segDoEvento(e.t, dia));
  return ss.length ? janelaDosRegistros(Math.min(...ss), Math.max(...ss)) : [0, DIA];
}

export interface Bolinha {
  /** centro da bolinha (segundo do dia) */
  s: number;
  eventos: Evento[];
}
/**
 * Alertas por trilha (Entradas, Saídas, Status, Sinal). Os que caem na mesma fatia (1/144 da janela, ~10 min no
 * dia inteiro, no mínimo 1 min) viram uma bolinha só. A abertura do dia e o que está fora da janela ficam de fora.
 */
export function agruparEventos(eventos: Evento[], dia: string, j: Janela): Record<GrupoEvento, Bolinha[]> {
  const fatia = Math.max(60, (j[1] - j[0]) / 144);
  const ultima = Math.ceil((j[1] - j[0]) / fatia) - 1;
  const porGrupo = new Map<GrupoEvento, Map<number, Evento[]>>(TODOS_GRUPOS.map((g) => [g, new Map()]));
  for (const e of eventos) {
    if (!ehAlerta(e)) continue;
    const s = segDoEvento(e.t, dia);
    if (s < j[0] || s > j[1]) continue;
    const k = Math.min(ultima, Math.floor((s - j[0]) / fatia));
    const m = porGrupo.get(grupoDoEvento(e))!;
    m.set(k, [...(m.get(k) ?? []), e]);
  }
  const r = {} as Record<GrupoEvento, Bolinha[]>;
  for (const g of TODOS_GRUPOS) {
    r[g] = [...porGrupo.get(g)!]
      .sort(([a], [b]) => a - b)
      .map(([k, es]) => ({ s: j[0] + (k + 0.5) * fatia, eventos: es.sort((x, y) => x.t.localeCompare(y.t)) }));
  }
  return r;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dominio/trilhas.test.ts`
Expected: PASS (todos os testes do arquivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/trilhas.ts src/lib/dominio/trilhas.test.ts
git commit -m "Trilhas: janela da régua, posição dos blocos e agrupamento dos acontecimentos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Balão, régua e alça (peças comuns) + preferência de várias opções

**Files:**
- Create: `src/lib/balao.ts`, `src/lib/balao.test.ts`, `src/lib/hooks.test.ts`
- Create: `src/components/trilhas/balao.tsx`, `src/components/trilhas/regua.tsx`, `src/components/trilhas/alca.tsx`
- Modify: `src/lib/hooks.ts` (acrescentar no fim)

**Interfaces:**
- Consumes: `emPct`, `marcasRegua`, `Janela` (Tarefa 1); `cx` de `src/components/ui.tsx`; `ouvintesPref` (já existe em `hooks.ts`).
- Produces:
  - `posicionarBalao(ancora: Caixa, balao: { width: number; height: number }, tela: { width: number; height: number }, lado: Lado): { left: number; top: number; lado: Lado }`, com `type Lado = "cima" | "baixo"` e `interface Caixa { left; top; width; height }`.
  - `opcaoValida<T extends string>(lido: string | null, opcoes: readonly T[], padrao: T): T`
  - `useOpcao<T extends string>(chave: string, opcoes: readonly T[], padrao: T): [T, (v: T) => void]`
  - `<Balao ancora={HTMLElement | null} rotulo lado? fechar? className?>`: sem `fechar` é `role="tooltip"` (só mostra); com `fechar` é `role="dialog"` (fecha com Esc e clique fora).
  - `<Regua janela className? />`
  - `<Alca opcoes valor mudar rotulo />`

- [ ] **Step 1: Write the failing tests** — crie `src/lib/balao.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { posicionarBalao } from "./balao";

const tela = { width: 1000, height: 800 };
const b = { width: 200, height: 50 };

describe("posição do balão", () => {
  it("fica em cima, centrado na âncora, quando cabe", () => {
    expect(posicionarBalao({ left: 400, top: 100, width: 20, height: 20 }, b, tela, "cima")).toEqual({ left: 310, top: 44, lado: "cima" });
  });
  it("sem espaço em cima, vai para baixo", () => {
    expect(posicionarBalao({ left: 400, top: 20, width: 20, height: 20 }, b, tela, "cima")).toEqual({ left: 310, top: 46, lado: "baixo" });
  });
  it("pedido embaixo sem espaço embaixo: vai para cima", () => {
    expect(posicionarBalao({ left: 400, top: 760, width: 20, height: 20 }, b, tela, "baixo")).toEqual({ left: 310, top: 704, lado: "cima" });
  });
  it("encosta na margem em vez de sair pela direita ou pela esquerda", () => {
    expect(posicionarBalao({ left: 990, top: 100, width: 20, height: 20 }, b, tela, "cima").left).toBe(792);
    expect(posicionarBalao({ left: 0, top: 100, width: 10, height: 20 }, b, tela, "cima").left).toBe(8);
  });
  it("balão maior que a tela fica preso na margem de cima", () => {
    expect(posicionarBalao({ left: 400, top: 100, width: 20, height: 20 }, { width: 200, height: 900 }, tela, "cima").top).toBe(8);
  });
});
```

E crie `src/lib/hooks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { opcaoValida } from "./hooks";

describe("preferência de várias opções", () => {
  const OPCOES = ["fina", "normal", "alta"] as const;
  it("aceita só uma das opções; o resto volta ao padrão", () => {
    expect(opcaoValida("alta", OPCOES, "normal")).toBe("alta");
    expect(opcaoValida(null, OPCOES, "normal")).toBe("normal");
    expect(opcaoValida("1", OPCOES, "normal")).toBe("normal");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/balao.test.ts src/lib/hooks.test.ts`
Expected: FAIL ("Failed to resolve import "./balao"" e "opcaoValida is not a function" / export ausente).

- [ ] **Step 3: Write the implementation**

`src/lib/balao.ts`:

```ts
// Onde o balão (Localização e Timeline) aparece: do lado pedido se couber, senão do outro; sempre dentro da tela.
export type Lado = "cima" | "baixo";
export interface Caixa {
  left: number;
  top: number;
  width: number;
  height: number;
}
const MARGEM = 8;
const VAO = 6;

export function posicionarBalao(ancora: Caixa, balao: { width: number; height: number }, tela: { width: number; height: number }, lado: Lado): { left: number; top: number; lado: Lado } {
  const emCima = ancora.top - VAO - balao.height;
  const embaixo = ancora.top + ancora.height + VAO;
  const cabeCima = emCima >= MARGEM;
  const cabeBaixo = embaixo + balao.height <= tela.height - MARGEM;
  const usado: Lado = lado === "cima" ? (cabeCima || !cabeBaixo ? "cima" : "baixo") : cabeBaixo || !cabeCima ? "baixo" : "cima";
  const top = Math.max(MARGEM, Math.min(usado === "cima" ? emCima : embaixo, tela.height - MARGEM - balao.height));
  const left = Math.max(MARGEM, Math.min(ancora.left + ancora.width / 2 - balao.width / 2, tela.width - MARGEM - balao.width));
  return { left: Math.round(left), top: Math.round(top), lado: usado };
}
```

No fim de `src/lib/hooks.ts`, acrescente:

```ts
// preferência de várias opções (ex.: altura do painel de trilhas), com a mesma regra de usePreferencia
const memoriaOpcao = new Map<string, string>();
function lerOpcao(chave: string): string | null {
  if (memoriaOpcao.has(chave)) return memoriaOpcao.get(chave)!;
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
/** Valor guardado só vale se for uma das opções (valor antigo ou estranho volta ao padrão). */
export const opcaoValida = <T extends string>(lido: string | null, opcoes: readonly T[], padrao: T): T => (lido != null && (opcoes as readonly string[]).includes(lido) ? (lido as T) : padrao);
/** Uma entre várias opções, lembrada no navegador (o padrão na geração estática e até o navegador responder). */
export function useOpcao<T extends string>(chave: string, opcoes: readonly T[], padrao: T): [T, (v: T) => void] {
  const lido = useSyncExternalStore(
    (f) => {
      ouvintesPref.add(f);
      return () => ouvintesPref.delete(f);
    },
    () => lerOpcao(chave),
    () => null,
  );
  const mudar = useCallback(
    (v: T) => {
      memoriaOpcao.set(chave, v);
      try {
        localStorage.setItem(chave, v);
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      ouvintesPref.forEach((f) => f());
    },
    [chave],
  );
  return [opcaoValida(lido, opcoes, padrao), mudar];
}
```

`src/components/trilhas/balao.tsx`:

```tsx
"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { posicionarBalao, type Lado } from "@/lib/balao";
import { cx } from "../ui";

interface Props {
  /** elemento de referência; null = fechado */
  ancora: HTMLElement | null;
  /** nome acessível */
  rotulo: string;
  lado?: Lado;
  /** com fechar: balão fixo (diálogo) que fecha com Esc e clique fora; sem: dica que só mostra */
  fechar?: () => void;
  className?: string;
  children: ReactNode;
}

/** Balão sobre a tela (portal no body): do lado pedido se couber e nunca fora da tela. */
export function Balao({ ancora, rotulo, lado = "cima", fechar, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // posiciona direto no elemento depois de medir (sem estado: nada de renderizar duas vezes)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!ancora || !el) return;
    const p = posicionarBalao(ancora.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, lado);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.style.visibility = "visible";
  });
  useEffect(() => {
    if (!ancora || !fechar) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    // clique na âncora não conta: quem abriu decide se fecha (alternar)
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!ref.current?.contains(alvo) && !ancora.contains(alvo)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora, true);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora, true);
    };
  }, [ancora, fechar]);
  if (!ancora) return null;
  return createPortal(
    <div
      ref={ref}
      role={fechar ? "dialog" : "tooltip"}
      aria-label={rotulo}
      style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
      className={cx("z-[1200] max-w-[calc(100vw-16px)] rounded-xl border border-borda bg-superficie text-[13px] text-texto shadow-xl", !fechar && "pointer-events-none", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
```

`src/components/trilhas/regua.tsx`:

```tsx
import { emPct, marcasRegua, type Janela } from "@/lib/dominio/trilhas";
import { cx } from "../ui";

/** Horas cheias da janela, alinhadas com as trilhas abaixo. */
export function Regua({ janela, className }: { janela: Janela; className?: string }) {
  return (
    <div aria-hidden className={cx("relative h-4 text-[10px] tabular-nums text-suave", className)}>
      {marcasRegua(janela).map((s) => (
        <span key={s} className={cx("absolute top-0", s === janela[0] ? "" : s === janela[1] ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${emPct(s, janela)}%` }}>
          {s / 3600}h
        </span>
      ))}
    </div>
  );
}
```

`src/components/trilhas/alca.tsx`:

```tsx
"use client";

import { useRef } from "react";

/** Alça na borda de cima de um painel: arrastar para cima aumenta, para baixo diminui; clicar passa para a próxima altura. */
export function Alca<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: readonly T[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  const y0 = useRef<number | null>(null);
  const i = opcoes.indexOf(valor);
  const ir = (d: number) => mudar(opcoes[Math.min(opcoes.length - 1, Math.max(0, i + d))]);
  const proxima = () => mudar(opcoes[(i + 1) % opcoes.length]);
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={`${rotulo} (arraste ou clique)`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        y0.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const ini = y0.current;
        y0.current = null;
        if (ini == null) return;
        const dy = e.clientY - ini;
        if (dy < -24) ir(1);
        else if (dy > 24) ir(-1);
        else proxima();
      }}
      // teclado (Enter/Espaço) chega como clique sem ponteiro
      onClick={(e) => e.detail === 0 && proxima()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          ir(e.key === "ArrowUp" ? 1 : -1);
        }
      }}
      className="mx-auto flex h-4 w-16 cursor-ns-resize touch-none items-center justify-center rounded-full hover:bg-superficie-2"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-borda" />
    </button>
  );
}
```

- [ ] **Step 4: Run tests, lint and typecheck**

Run: `npx vitest run src/lib/balao.test.ts src/lib/hooks.test.ts && npm run lint && npm run typecheck`
Expected: PASS e nenhum erro. Se o lint reclamar de `react-hooks/refs` ou de efeito sem dependências no `Balao`, mantenha o comportamento (posicionar a cada renderização) e ajuste só o que o lint pede, sem colocar estado.

- [ ] **Step 5: Commit**

```bash
git add src/lib/balao.ts src/lib/balao.test.ts src/lib/hooks.ts src/lib/hooks.test.ts src/components/trilhas
git commit -m "Balão, régua e alça comuns às trilhas; preferência de várias opções

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Timeline no computador — mapa inteiro, barra do topo, trilhas embaixo e gaveta "Apontamento"

**Files:**
- Create: `src/components/historico/trilhas-dia.tsx`, `src/components/historico/apontamento.tsx`
- Modify: `src/app/timeline/_componentes/conteudo.tsx` (ramo do computador e nova prop `noTopo`)
- Modify: `src/app/timeline/_componentes/timeline.tsx` (layout do computador)
- Modify: `e2e/timeline.spec.ts`

**Interfaces:**
- Consumes:
  - Da Tarefa 1: `janelaDosTrechos`, `ampliar`, `DIA`, `Janela`, `emPct`, `marcasRegua`, `posBloco`, `segDaFracao`.
  - Da Tarefa 2: `useOpcao`, `Balao`, `Regua`, `Alca`.
  - Já existentes: `Player` (`t`, `t0`, `irPara(s, tocar?)`, `ponto`, `tocando`, `trecho`); `HistoriaDia`; `Capitulo`; `LUGARES` (de `faixa-dia.tsx`); `Gaveta`; `ListaCapitulos`; `ListaTrechos`; `TempoPorArea`.
- Produces:
  - `ALTURAS_TRILHAS = ["fina", "normal", "alta"] as const` e `type AlturaTrilhas`.
  - `<TrilhasDia h historia player janela altura foco mudarFoco atual irCapitulo />`
  - `<Apontamento h placa historia atual foco irCapitulo trechoSel escolherTrecho fechar />`
  - Nova prop `noTopo: HTMLDivElement | null` em `ConteudoHistorico`.

- [ ] **Step 1: Write the failing e2e test** — substitua o 1º teste de `e2e/timeline.spec.ts` (o 2º teste continua igual, porque a área de baixo continua sendo um `<section>`):

```ts
test("Timeline: conta o dia em capítulos e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  if (info.project.name === "computador") {
    // sem coluna lateral: as trilhas ficam embaixo do mapa, os números no topo
    const trilhas = page.getByRole("region", { name: "Timeline do veículo" });
    await expect(page.getByText(/2,1 km/).first()).toBeVisible();
    const cap = trilhas.getByRole("button", { name: /Capítulo 1 · PATIO/ });
    await cap.hover();
    await expect(page.getByRole("tooltip")).toContainText("08:10–08:40");
    await cap.click();
    await expect(page.getByText(/08:10:00/).first()).toBeVisible();
    await trilhas.getByRole("button", { name: "Apontamento" }).click();
    const gaveta = page.getByRole("dialog", { name: /Apontamento/ });
    await expect(gaveta.getByRole("list", { name: "Capítulos do dia" })).toBeVisible();
    await expect(gaveta.getByRole("button", { name: /Exportar CSV/ })).toBeVisible();
  }
  await play.click();
  await expect(page.getByRole("button", { name: /Pausar/ })).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```

> Antes de fixar `/2,1 km/`, confira em `itensResumo` (`src/lib/dominio/historico.ts`) como o km é escrito. Use o texto exato que a função gera para `km: 2.1`.

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npm run build && npx playwright test e2e/timeline.spec.ts --project=computador`
Expected: FAIL (não existe a região "Timeline do veículo").

- [ ] **Step 3: Create `src/components/historico/trilhas-dia.tsx`**

```tsx
"use client";

import { useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { corDoTom } from "@/lib/cores";
import { segCap, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { fmtHora, fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { emPct, marcasRegua, posBloco, segDaFracao, type Janela } from "@/lib/dominio/trilhas";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";
import { Balao } from "../trilhas/balao";
import { Regua } from "../trilhas/regua";
import { cx } from "../ui";
import { LUGARES } from "./faixa-dia";
import type { Player } from "./use-player";

export const ALTURAS_TRILHAS = ["fina", "normal", "alta"] as const;
export type AlturaTrilhas = (typeof ALTURAS_TRILHAS)[number];
// altura (px) de cada trilha; 0 = escondida
const PX: Record<AlturaTrilhas, { cap: number; lugar: number; motor: number; bomba: number }> = {
  fina: { cap: 0, lugar: 12, motor: 0, bomba: 0 },
  normal: { cap: 22, lugar: 26, motor: 12, bomba: 8 },
  alta: { cap: 30, lugar: 40, motor: 20, bomba: 14 },
};

interface Props {
  h: Historico;
  historia: HistoriaDia;
  player: Player;
  janela: Janela;
  altura: AlturaTrilhas;
  foco: [number, number] | null;
  mudarFoco: (f: [number, number] | null) => void;
  atual: number | null;
  irCapitulo: (c: Capitulo) => void;
}

/**
 * O dia em trilhas horizontais (capítulos, onde estava, motor, bomba) sobre a régua. Passar o mouse mostra o balão
 * do bloco; nas faixas, um toque leva o caminhão ao horário e arrastar escolhe um foco (como a FaixaDia do celular).
 */
export function TrilhasDia({ h, historia, player, janela, altura, foco, mudarFoco, atual, irCapitulo }: Props) {
  const px = PX[altura];
  const [arrasto, setArrasto] = useState<{ a: number; b: number } | null>(null);
  const [dica, setDica] = useState<{ el: HTMLElement; c: ReactNode } | null>(null);
  const mostrar = (el: HTMLElement, c: ReactNode) => !arrasto && setDica({ el, c });
  const emSeg = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return segDaFracao((e.clientX - r.left) / r.width, janela);
  };
  const estilo = (a: number, b: number) => {
    const p = posBloco(a, b, janela);
    return p && { left: `${p.esq}%`, width: `${p.larg}%` };
  };
  const sel = arrasto ? ([Math.min(arrasto.a, arrasto.b), Math.max(arrasto.a, arrasto.b)] as const) : foco;
  const rotulos: [string, number][] = [
    ["Capítulos", px.cap],
    ["Onde estava", px.lugar],
    ["Motor", px.motor],
    ...(h.motor2 ? [[`⚙ Bomba${h.motor2.placa ? ` · ${h.motor2.placa}` : ""}`, px.bomba] as [string, number]] : []),
  ];
  const noPlayer = player.t >= janela[0] && player.t <= janela[1];

  return (
    <div className="grid grid-cols-[104px_1fr] gap-x-2">
      <div className="flex flex-col gap-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-suave">
        {rotulos
          .filter(([, a]) => a > 0)
          .map(([r, a]) => (
            <span key={r} className="flex items-center truncate" style={{ height: a }}>
              {r}
            </span>
          ))}
      </div>
      <div className="relative" onPointerLeave={() => setDica(null)}>
        <Regua janela={janela} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-5">
          {marcasRegua(janela).map((s) => (
            <span key={s} className="absolute inset-y-0 w-px bg-borda/60" style={{ left: `${emPct(s, janela)}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {px.cap > 0 && (
            <div className="relative" style={{ height: px.cap }}>
              {historia.capitulos.map((c) => {
                const st = estilo(segCap(c.inicio), segCap(c.fim));
                if (!st) return null;
                const balao = <BalaoCapitulo c={c} />;
                return (
                  <button
                    key={c.n}
                    type="button"
                    data-capitulo={c.n}
                    aria-label={`Capítulo ${c.n} · ${c.lugar} · ${hhmm(c.inicio)}–${hhmm(c.fim)}`}
                    aria-current={atual === c.n ? "step" : undefined}
                    onClick={() => irCapitulo(c)}
                    onPointerEnter={(e) => mostrar(e.currentTarget, balao)}
                    onFocus={(e) => mostrar(e.currentTarget, balao)}
                    onBlur={() => setDica(null)}
                    className={cx("absolute inset-y-0 flex min-w-[18px] items-center gap-1 overflow-hidden rounded-md px-0.5 text-[10px] font-semibold text-white", c.tipoLugar === "base" ? "bg-slate-500" : "bg-primaria", atual === c.n && "ring-2 ring-texto")}
                    style={st}
                  >
                    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-white/25 px-0.5">{c.n}</span>
                    <span className="truncate">{c.lugar}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Faixa do dia"
            aria-valuemin={janela[0]}
            aria-valuemax={janela[1]}
            aria-valuenow={Math.round(player.t)}
            aria-valuetext={fmtHora(player.t)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDica(null);
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
            className="relative flex cursor-pointer touch-none select-none flex-col gap-1"
          >
            <div className="relative overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10" style={{ height: px.lugar }}>
              {historia.faixaLugar.map((f, i) => {
                const st = estilo(segCap(f.inicio), segCap(f.fim));
                if (!st) return null;
                return (
                  <span
                    key={i}
                    onPointerEnter={(e) =>
                      mostrar(
                        e.currentTarget,
                        <>
                          <b>{f.lugar || LUGARES[f.tipoLugar].rotulo}</b>
                          <br />
                          {hhmm(f.inicio)}–{hhmm(f.fim)} · {fmtMin((segCap(f.fim) - segCap(f.inicio)) / 60)}
                        </>,
                      )
                    }
                    className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/70 px-1 text-[10px] font-semibold", LUGARES[f.tipoLugar].classe)}
                    style={{ ...st, lineHeight: `${px.lugar}px` }}
                  >
                    {px.lugar >= 20 ? f.lugar : ""}
                  </span>
                );
              })}
            </div>
            {px.motor > 0 && (
              <div className="relative overflow-hidden rounded bg-superficie-2" style={{ height: px.motor }}>
                {historia.faixaMotor.map((f, i) => {
                  const st = estilo(segCap(f.inicio), segCap(f.fim));
                  if (!st) return null;
                  return (
                    <span
                      key={i}
                      onPointerEnter={(e) =>
                        mostrar(
                          e.currentTarget,
                          <>
                            <b>{ESTADOS_TRECHO[f.estado].rotulo}</b>
                            <br />
                            {hhmm(f.inicio)}–{hhmm(f.fim)} · {fmtMin((segCap(f.fim) - segCap(f.inicio)) / 60)}
                          </>,
                        )
                      }
                      className="absolute inset-y-0"
                      style={{ ...st, background: corDoTom(ESTADOS_TRECHO[f.estado].tom) }}
                    />
                  );
                })}
              </div>
            )}
            {px.bomba > 0 && h.motor2 && (
              <div className="relative overflow-hidden rounded bg-superficie-2" style={{ height: px.bomba }}>
                {h.motor2.intervalos.map(([a, b]) => {
                  const st = estilo(segDe(a), segDe(b));
                  if (!st) return null;
                  return (
                    <span
                      key={a}
                      onPointerEnter={(e) =>
                        mostrar(
                          e.currentTarget,
                          <>
                            <b>⚙ Bomba ligada</b>
                            <br />
                            {a.slice(0, 5)}–{b.slice(0, 5)} · {fmtMin((segDe(b) - segDe(a)) / 60)}
                          </>,
                        )
                      }
                      className="absolute inset-y-0 bg-motor2"
                      style={st}
                    />
                  );
                })}
              </div>
            )}
            {sel && (
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-primaria"
                style={{ left: `${emPct(sel[0], janela)}%`, width: `${emPct(sel[1], janela) - emPct(sel[0], janela)}%`, background: "color-mix(in srgb, var(--primaria) 12%, transparent)" }}
              />
            )}
          </div>
        </div>
        {noPlayer && (
          <span aria-hidden className="pointer-events-none absolute bottom-0 top-5 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: `${emPct(player.t, janela)}%` }} />
        )}
      </div>
      <Balao ancora={dica?.el ?? null} rotulo="Detalhe do trecho" className="px-3 py-2 leading-snug">
        {dica?.c}
      </Balao>
    </div>
  );
}

function BalaoCapitulo({ c }: { c: Capitulo }) {
  return (
    <>
      <b>
        {c.n}. {c.lugar}
      </b>
      <br />
      {hhmm(c.inicio)}–{hhmm(c.fim)} · {fmtMin(c.duracao_min)}
      <br />
      <span className="text-suave">
        parado ligado {fmtMin(c.ligado_min)} · desligado {fmtMin(c.desligado_min)}
        {c.outro_min ? ` · sem sinal ${fmtMin(c.outro_min)}` : ""}
      </span>
      {c.ate && (
        <>
          <br />
          <span className="text-link">
            → {c.ate.km.toLocaleString("pt-BR")} km até {c.ate.destino}
          </span>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Create `src/components/historico/apontamento.tsx`**

```tsx
"use client";

import { useState } from "react";
import { baixarTexto } from "@/lib/arquivo";
import { MIN_CAPITULO, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR } from "@/lib/dominio/formato";
import type { Historico } from "@/lib/tipos";
import { Gaveta } from "../gaveta";
import { Icone } from "../icones";
import { Botao, Segmentado, Vazio } from "../ui";
import { ListaCapitulos } from "./capitulos";
import { TempoPorArea } from "./tempo-area";
import { ListaTrechos } from "./trechos";

type Aba = "capitulos" | "trechos" | "areas";
interface Props {
  h: Historico;
  placa: string;
  historia: HistoriaDia;
  atual: number | null;
  foco: [number, number] | null;
  irCapitulo: (c: Capitulo) => void;
  trechoSel: number | null;
  escolherTrecho: (i: number) => void;
  fechar: () => void;
}

/** Gaveta "Apontamento" (sem bloquear o mapa): capítulos, trechos e tempo por área, com o CSV. */
export function Apontamento(p: Props) {
  const [aba, setAba] = useState<Aba>("capitulos");
  const areas = p.h.resumo?.areas ?? [];
  return (
    <Gaveta
      titulo={`Apontamento · ${p.placa}`}
      sub={diaBR(p.h.dia)}
      fechar={p.fechar}
      modal={false}
      ajustavel="apontamento"
      rodape={
        <Botao variante="secundaria" onClick={() => baixarTexto(nomeCsv(p.placa, p.h.dia), csvApontamento(p.h, p.placa))}>
          <Icone nome="baixar" className="h-4 w-4" />
          Exportar CSV
        </Botao>
      }
    >
      <div className="border-b border-borda p-3">
        <Segmentado
          rotulo="O que ver"
          valor={aba}
          mudar={setAba}
          opcoes={[
            { id: "capitulos", rotulo: `Capítulos (${p.historia.capitulos.length})` },
            { id: "trechos", rotulo: `Trechos (${p.h.trechos.length})` },
            { id: "areas", rotulo: "Tempo por área" },
          ]}
        />
        {aba === "capitulos" && <p className="mt-2 text-xs text-suave">Paradas de {MIN_CAPITULO} min ou mais no mesmo lugar.</p>}
      </div>
      {aba === "capitulos" && <ListaCapitulos capitulos={p.historia.capitulos} atual={p.atual} foco={p.foco} escolher={p.irCapitulo} />}
      {aba === "trechos" && <ListaTrechos trechos={p.h.trechos} sel={p.trechoSel} aoEscolher={p.escolherTrecho} />}
      {aba === "areas" && (areas.length ? <TempoPorArea areas={areas} /> : <Vazio titulo="Sem áreas">Neste dia o equipamento não ficou dentro de nenhuma área cadastrada.</Vazio>)}
    </Gaveta>
  );
}
```

> Confira o corpo da `Gaveta` (`src/components/gaveta.tsx`): se o conteúdo não tiver rolagem própria, envolva os filhos acima em `<div className="min-h-0 flex-1 overflow-y-auto">`.

- [ ] **Step 5: Modify `conteudo.tsx`** (`src/app/timeline/_componentes/conteudo.tsx`)

5a. Imports: troque o bloco de imports por:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Apontamento } from "@/components/historico/apontamento";
import { ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { Destaques, ListaCapitulos } from "@/components/historico/capitulos";
import { FaixaDia } from "@/components/historico/faixa-dia";
import { ALTURAS_TRILHAS, TrilhasDia, type AlturaTrilhas } from "@/components/historico/trilhas-dia";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import { PAINEL_ROTA, desenharCapitulos, desenharRota } from "@/components/mapa/rota";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Alca } from "@/components/trilhas/alca";
import { Balao } from "@/components/trilhas/balao";
import { Aviso, Botao, Selo, cx } from "@/components/ui";
import { capituloEm, montarHistoria, proximoCapitulo, segCap, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { DIA, ampliar, janelaDosTrechos, type Janela } from "@/lib/dominio/trilhas";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { useOpcao } from "@/lib/hooks";
import type { Historico } from "@/lib/tipos";
```

5b. Em `interface Props`, logo depois de `sobreMapa`, acrescente:

```tsx
  /** barra do topo (computador): os números do dia e o "Resumo do dia" */
  noTopo: HTMLDivElement | null;
```

Também acrescente `noTopo` à desestruturação da assinatura de `ConteudoHistorico`.

5c. Logo depois de `const prox = proximoCapitulo(historia.capitulos, player.t);`, acrescente (antes de qualquer `return`, porque são hooks):

```tsx
  const [altura, setAltura] = useOpcao<AlturaTrilhas>("mon-trilhas-altura", ALTURAS_TRILHAS, "normal");
  const registros = useMemo(() => janelaDosTrechos(h.trechos), [h.trechos]);
  const [janela, setJanela] = useState<Janela>(registros);
  const [apontamento, setApontamento] = useState(false);
```

5d. Substitua todo o `return (` final (o do computador, depois do `if (celular) {…}`) por:

```tsx
  const diaInteiro = janela[0] === 0 && janela[1] === DIA;
  const soRegistros = janela[0] === registros[0] && janela[1] === registros[1];
  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      {noTopo && createPortal(<ResumoTopo h={h} historia={historia} vaga={vaga} />, noTopo)}
      <section aria-label="Timeline do veículo" className="shrink-0 rounded-xl border border-borda bg-superficie shadow-md">
        <Alca opcoes={ALTURAS_TRILHAS} valor={altura} mudar={setAltura} rotulo="Altura das trilhas" />
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <span className="text-base font-semibold">{placa}</span>
          {tipo && <Selo tom="reg">{tipo}</Selo>}
          <span className="text-xs text-suave">
            {diaBR(h.dia)} · {FONTE[h.fonte]}
          </span>
          <ControlesPlayer player={player} />
          {botaoProximo}
          <InfoPlayer player={player} />
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {foco && (
              <>
                <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(ampliar(foco))}>
                  Ampliar o foco
                </Botao>
                <Botao variante="discreta" tamanho="mini" onClick={() => setFoco(null)}>
                  ✕ Limpar foco
                </Botao>
              </>
            )}
            {!soRegistros && (
              <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(registros)}>
                Horas com registro
              </Botao>
            )}
            {!diaInteiro && (
              <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela([0, DIA])}>
                Dia inteiro
              </Botao>
            )}
            <Botao variante="secundaria" tamanho="mini" onClick={() => setApontamento(true)}>
              Apontamento
            </Botao>
          </span>
        </div>
        <div className="px-3 pb-3">
          <TrilhasDia h={h} historia={historia} player={player} janela={janela} altura={altura} foco={foco} mudarFoco={setFoco} atual={atual} irCapitulo={irCapitulo} />
          {!h.motor2 && h.motor2_erro && <p className="mt-1 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
        </div>
      </section>
      {apontamento && (
        <Apontamento
          h={h}
          placa={placa}
          historia={historia}
          atual={atual}
          foco={foco}
          irCapitulo={irCapitulo}
          trechoSel={andou && trecho >= 0 ? trecho : null}
          escolherTrecho={escolherTrecho}
          fechar={() => setApontamento(false)}
        />
      )}
    </>
  );
}

/** Barra do topo da Timeline: os números do dia em pílulas e o balão "Resumo do dia". */
function ResumoTopo({ h, historia, vaga }: { h: Historico; historia: HistoriaDia; vaga: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const fechar = useCallback(() => setEl(null), []);
  return (
    <>
      {itensResumo(h)
        .filter((i) => i.rotulo !== "Período")
        .map((i) => (
          <span key={i.rotulo} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs">
            <b className={cx("tabular-nums", i.motor2 && "text-motor2")}>{i.valor}</b> <span className="text-suave">{i.rotulo.toLowerCase()}</span>
          </span>
        ))}
      {h.rpm_travado != null && <Selo tom="warn">RPM travado</Selo>}
      <Botao
        variante="secundaria"
        tamanho="mini"
        aria-expanded={!!el}
        onClick={(e) => {
          const alvo = e.currentTarget;
          setEl((x) => (x ? null : alvo));
        }}
      >
        Resumo do dia
      </Botao>
      <Balao ancora={el} lado="baixo" rotulo="Resumo do dia" fechar={fechar} className="w-[360px] space-y-2 p-3">
        {vaga && <p className="text-xs text-suave">{vaga}</p>}
        {h.aviso && <p className="text-xs text-suave">{h.aviso}</p>}
        {h.rpm_travado != null && <Aviso tipo="alerta">RPM do rastreador travado em {h.rpm_travado} o dia todo: não dá para afirmar motor ligado/desligado, as paradas aparecem só como “Parado”.</Aviso>}
        <Destaques d={historia.destaques} />
      </Balao>
    </>
  );
}
```

5e. Apague de `conteudo.tsx` o que ficou sem uso: `SecaoTitulo`, `TempoPorArea`, `ListaTrechos`, `baixarTexto`, `MIN_CAPITULO`, `csvApontamento` e `nomeCsv`. Quem decide é o `npm run lint`. Mantenha `ListaCapitulos` e `FaixaDia`, que o ramo do celular usa.

- [ ] **Step 6: Modify `timeline.tsx`** (`src/app/timeline/_componentes/timeline.tsx`)

6a. Ao lado de `sobreMapa`, acrescente o estado `const [noTopo, setNoTopo] = useState<HTMLDivElement | null>(null);`.

6b. Troque `const formulario = (…)` por duas peças. O celular continua usando `formulario`:

```tsx
  const campos = (
    <div className="flex gap-2">
      <SeletorVeiculo veiculos={lista} escolhido={escolhido} escolher={(v) => setChave(v.id)} paraCima={celular} />
      <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36 shrink-0">
        {dias.map((d) => (
          <option key={d} value={d}>
            {rotuloDia(d, hoje)}
          </option>
        ))}
      </Selecao>
    </div>
  );
  const formulario = (
    <div className="space-y-2.5 p-3">
      {campos}
      <Botao onClick={ver} disabled={!escolhido || !!carga} className="w-full">
        Ver timeline
      </Botao>
    </div>
  );
```

6c. Passe `noTopo={noTopo}` no `<ConteudoHistorico … />`.

6d. Apague `const tSel = …`. Depois troque o começo do `return` (do `<div className="altura-tela …">` até o fim do `<div ref={setSobreMapa} … />`) e o cartão `{!celular && tSel && (…)}` por:

```tsx
    <div className="altura-tela relative flex flex-col md:gap-3 md:p-3">
      {!celular && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie px-3 py-2 shadow-md">
          <div className="w-[380px] shrink-0">{campos}</div>
          <Botao onClick={ver} disabled={!escolhido || !!carga}>
            Ver timeline
          </Botao>
          <div ref={setNoTopo} className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5" />
        </div>
      )}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md" onPointerDown={() => setOpcoes(false)}>
        <div ref={ref} className="absolute inset-0" />
        <Legenda itens={LEGENDA} />
        <div ref={setSobreMapa} className="pointer-events-none absolute inset-0 z-[500] [&>*]:pointer-events-auto" />
        {!celular && situacao && (
          <div className="absolute left-1/2 top-1/2 z-[600] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 shadow-xl">{situacao}</div>
        )}
```

O resto do bloco do mapa fica igual (pílula do celular, `situacao` do celular, `{celular && conteudo}`). Depois de fechar a `div` do mapa e antes do diálogo `{celular && opcoes && …}`, acrescente `{!celular && conteudo}`. Apague o `<section aria-label="Seleção e timeline do veículo" …>` antigo.

6e. Rode `npm run lint` e apague os imports que ficaram sem uso (provavelmente `fmtMin`, `hhmm` e `ESTADOS_TRECHO`, se só o cartão os usava; `LEGENDA` continua usando `ESTADOS_TRECHO`).

- [ ] **Step 7: Run checks and e2e**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test e2e/timeline.spec.ts`
Expected: PASS nos 2 projetos (computador e celular). O teste do celular não muda.

- [ ] **Step 8: Commit**

```bash
git add src/components/historico/trilhas-dia.tsx src/components/historico/apontamento.tsx src/app/timeline e2e/timeline.spec.ts
git commit -m "Timeline no computador: mapa inteiro, números no topo, trilhas com balões embaixo e gaveta Apontamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Localização no computador — barra do topo, balões de lista e cartão do equipamento (sem lateral)

**Files:**
- Create: `src/app/_localizacao/barra-topo.tsx`
- Modify: `src/app/_localizacao/painel.tsx` (exportar `ItemVeiculo` e `ListaAreas`; extrair `PainelAlertas`; tirar `recolher`)
- Modify: `src/app/_localizacao/detalhe.tsx` (prop `modo`)
- Modify: `src/app/_localizacao/localizacao.tsx` (layout do computador)
- Delete: `src/app/_localizacao/barra-tipos.tsx`
- Modify: `e2e/localizacao.spec.ts`

**Interfaces:**
- Consumes: `Balao` (Tarefa 2); já existentes: `INDICADORES`, `RESUMO_TOPO`, `noIndicador`, `nomeArea`, `ORDEM_TIPOS`, `TIPOS_EQUIP`, `compararEquip`, `FiltroVeiculos`.
- Produces:
  - `export function ItemVeiculo(...)`, `export function ListaAreas(...)` e `export function PainelAlertas({ eventos, dias, diaEventos, setDiaEventos, abrir })` em `painel.tsx`.
  - `<BarraTopo …/>` com `nav aria-label="Filtros do mapa"`.
  - Cartão do equipamento com `role="region" aria-label="Equipamento"`.
  - `Detalhe` com a prop `modo?: "voltar" | "fechar"`.

- [ ] **Step 1: Write the failing e2e test** — substitua os 2 primeiros testes de `e2e/localizacao.spec.ts` (o da busca Ctrl K continua):

```ts
test("Localização: só a frota, por tipo, e o detalhe leva ao dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    // sem coluna lateral: filtros no topo, lista do tipo num balão
    await expect(page.locator("aside")).toHaveCount(0);
    const filtros = page.getByRole("navigation", { name: "Filtros do mapa" });
    await expect(filtros.getByRole("button", { name: /^AS/ })).toBeVisible();
    await expect(page.getByText("EOF5208")).toHaveCount(0);
    const ap = filtros.getByRole("button", { name: /^AP/ });
    await ap.click();
    await expect(ap).toHaveAttribute("aria-pressed", "true");
    const lista = page.getByRole("dialog", { name: "Alta Pressão" });
    await lista.getByRole("button", { name: /EGC-2985/ }).click();
    await expect(lista).toHaveCount(0);
    const cartao = page.getByRole("region", { name: "Equipamento" });
    await expect(cartao.getByText("Bomba (motor 2º)")).toBeVisible();
    await expect(cartao.getByRole("link", { name: /Ver o dia/ })).toHaveAttribute("href", /\/timeline\/\?v=10&dia=/);
    await cartao.getByRole("button", { name: "Fechar" }).click();
    await expect(cartao).toHaveCount(0);
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Localização: sino com os alertas do dia e clique de novo no tipo tira o filtro", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "barra do topo só no computador");
  await prepararDados(page);
  await page.goto("/");
  const filtros = page.getByRole("navigation", { name: "Filtros do mapa" });
  await filtros.getByRole("button", { name: /^Alertas/ }).click();
  const alertas = page.getByRole("dialog", { name: "Alertas" });
  await expect(alertas.getByText(/EGC-2984/).first()).toBeVisible();
  await expect(alertas.getByText("Início do dia")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(alertas).toHaveCount(0);
  const as = filtros.getByRole("button", { name: /^AS/ });
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "true");
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "false");
});
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npm run build && npx playwright test e2e/localizacao.spec.ts --project=computador`
Expected: FAIL (ainda existe o `aside` e não existe "Filtros do mapa").

- [ ] **Step 3: Refactor `painel.tsx`**

3a. Troque `function ItemVeiculo(` por `export function ItemVeiculo(` e `function ListaAreas(` por `export function ListaAreas(`.

3b. Acrescente no fim do arquivo:

```tsx
/** Alertas do dia com filtro por grupo e busca (aba do celular e balão do sino no computador). */
export function PainelAlertas({ eventos, dias, diaEventos, setDiaEventos, abrir }: { eventos: Evento[]; dias: string[]; diaEventos: string; setDiaEventos: (d: string) => void; abrir: (id: string) => void }) {
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [buscaEv, setBuscaEv] = useState("");
  const conta = contarPorGrupo(eventos);
  const opcoesDia = dias.includes(diaEventos) ? dias : [diaEventos, ...dias];
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <div className="flex gap-2">
          <Selecao value={diaEventos} onChange={(e) => setDiaEventos(e.target.value)} aria-label="Dia dos alertas" className="w-36">
            {opcoesDia.map((d) => (
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
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ListaEventos eventos={filtrarEventos(eventos, grupos, buscaEv)} abrir={abrir} />
      </div>
    </div>
  );
}
```

3c. No `Painel`:
- apague os estados `grupos` e `buscaEv`, as variáveis `conta` e `dias` e a função `alternarGrupo`;
- apague o bloco `{p.aba === "alertas" && (<>…</>)}` de dentro do cabeçalho;
- apague o botão "Recolher painel" e deixe o `Segmentado` sozinho, sem a `div flex` com o botão;
- apague `recolher` de `Props`.

Troque o corpo de baixo por:

```tsx
      {p.aba === "alertas" ? (
        <PainelAlertas eventos={p.eventos} dias={p.dias} diaEventos={p.diaEventos} setDiaEventos={p.setDiaEventos} abrir={p.abrir} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {p.aba === "tipos" && <ListaTipos lista={p.visiveis} semSinalMin={p.semSinalMin} agora={p.agora} abrir={p.abrir} />}
          {p.aba === "areas" && <ListaAreas veiculos={p.veiculos} escolher={p.escolherArea} />}
        </div>
      )}
```

- [ ] **Step 4: Modify `detalhe.tsx`**

Em `Props`, acrescente `/** "fechar" no cartão do computador; "voltar" na gaveta do celular */ modo?: "voltar" | "fechar";`. Na assinatura, inclua `modo = "voltar"`. Troque o 1º botão por:

```tsx
        <Botao variante="secundaria" tamanho="mini" onClick={voltar}>
          <Icone nome={modo === "fechar" ? "fechar" : "voltar"} className="h-4 w-4" />
          {modo === "fechar" ? "Fechar" : "Voltar"}
        </Botao>
```

- [ ] **Step 5: Create `src/app/_localizacao/barra-topo.tsx`**

```tsx
"use client";

import { useCallback, useState } from "react";
import { Icone } from "@/components/icones";
import { Balao } from "@/components/trilhas/balao";
import { Botao, Chip, Contador, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { ORDEM_TIPOS, TIPOS_EQUIP, compararEquip } from "@/lib/dominio/equipamentos";
import { INDICADORES, RESUMO_TOPO, noIndicador, nomeArea, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";
import { ItemVeiculo, ListaAreas, PainelAlertas } from "./painel";

interface Props {
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
}
type Aberto = { qual: "tipo" | "areas" | "alertas"; el: HTMLElement } | null;

/** Topo da Localização no computador: tipos (filtram e abrem a lista num balão), contadores, áreas e o sino de alertas. */
export function BarraTopo(p: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const alternar = (qual: "areas" | "alertas", el: HTMLElement) => setAberto((a) => (a?.qual === qual ? null : { qual, el }));
  const escolherTipo = (t: TipoEquip, el: HTMLElement) => {
    if (p.filtro.tipo === t) {
      p.setFiltro({ ...p.filtro, tipo: null });
      fechar();
    } else {
      p.setFiltro({ ...p.filtro, tipo: t });
      setAberto({ qual: "tipo", el });
    }
  };
  const abrirEFechar = (id: string) => {
    p.abrir(id);
    fechar();
  };
  const nAreas = new Set(p.veiculos.map((v) => v.area).filter(Boolean)).size;
  const doTipo = p.filtro.tipo ? p.visiveis.filter((v) => v.equip?.tipo === p.filtro.tipo).sort(compararEquip) : [];
  const rotulo = aberto?.qual === "tipo" && p.filtro.tipo ? TIPOS_EQUIP[p.filtro.tipo].rotulo : aberto?.qual === "areas" ? "Áreas" : "Alertas";

  return (
    <nav aria-label="Filtros do mapa" className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-borda bg-superficie px-2.5 py-2 shadow-md">
      {ORDEM_TIPOS.map((t) => {
        const vs = p.veiculos.filter((v) => v.equip?.tipo === t);
        if (!vs.length) return null;
        const lig = vs.filter((v) => noIndicador("ligado", v, p.semSinalMin, p.agora)).length;
        const ativo = p.filtro.tipo === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ativo}
            title={`${TIPOS_EQUIP[t].rotulo}: ${lig} ligados de ${vs.length}`}
            onClick={(e) => escolherTipo(t, e.currentTarget)}
            className={cx("rounded-lg px-2.5 py-1 text-[12px] tabular-nums", ativo ? "bg-primaria text-white" : "bg-superficie-2 text-suave hover:text-texto")}
          >
            <b className="mr-1 text-[13px]">{TIPOS_EQUIP[t].sigla}</b>
            {vs.length}
          </button>
        );
      })}
      <span aria-hidden className="mx-1 h-6 w-px bg-borda" />
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
            className={cx("flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] text-suave", ativo ? "border-primaria bg-primaria-suave" : "border-transparent hover:bg-superficie-2")}
          >
            <b className="text-[13px] tabular-nums" style={{ color: corDoTom(i.tom) }}>
              {n}
            </b>
            {i.curto}
          </button>
        );
      })}
      {p.filtro.area && (
        <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, area: null })}>
          {nomeArea(p.filtro.area)} ✕
        </Chip>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <Botao variante="secundaria" tamanho="mini" aria-expanded={aberto?.qual === "areas"} onClick={(e) => alternar("areas", e.currentTarget)}>
          Áreas <Contador n={nAreas} />
        </Botao>
        <Botao variante="secundaria" tamanho="mini" aria-expanded={aberto?.qual === "alertas"} onClick={(e) => alternar("alertas", e.currentTarget)}>
          <Icone nome="alertas" className="h-4 w-4" />
          Alertas <Contador n={p.eventos.length} />
        </Botao>
      </span>
      <Balao ancora={aberto?.el ?? null} lado="baixo" rotulo={rotulo} fechar={fechar} className={cx("flex w-[360px] flex-col overflow-hidden", aberto?.qual === "alertas" ? "h-[60vh]" : "max-h-[60vh]")}>
        {aberto?.qual === "tipo" && p.filtro.tipo && (
          <>
            <p className="border-b border-borda px-3.5 py-2 text-xs font-semibold">
              {TIPOS_EQUIP[p.filtro.tipo].rotulo} · {doTipo.length} no mapa
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {doTipo.length ? doTipo.map((v) => <ItemVeiculo key={v.id} v={v} semSinalMin={p.semSinalMin} agora={p.agora} abrir={abrirEFechar} />) : <Vazio titulo="Nenhum equipamento">Ajuste os contadores do topo.</Vazio>}
            </div>
          </>
        )}
        {aberto?.qual === "areas" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ListaAreas
              veiculos={p.veiculos}
              escolher={(a) => {
                p.escolherArea(a);
                fechar();
              }}
            />
          </div>
        )}
        {aberto?.qual === "alertas" && <PainelAlertas eventos={p.eventos} dias={p.dias} diaEventos={p.diaEventos} setDiaEventos={p.setDiaEventos} abrir={abrirEFechar} />}
      </Balao>
    </nav>
  );
}
```

- [ ] **Step 6: Modify `localizacao.tsx`**

6a. Imports: apague `BarraTipos` e `usePreferencia`, troque por `import { useAgora, useCelular } from "@/lib/hooks";` e acrescente `import { BarraTopo } from "./barra-topo";`.

6b. Apague `const [recolhido, setRecolhido] = usePreferencia("mon-painel-recolhido");`. Em `abrir`, apague a linha `if (!celular) setRecolhido(false);` com o comentário acima dela, e tire `setRecolhido` das dependências do `useCallback`.

6c. No `<Painel … />`, apague a prop `recolher={…}`.

6d. Troque todo o `return (…)` por:

```tsx
  return (
    <div className="altura-tela flex flex-col">
      <FaixaLeitura />
      <div className="relative flex min-h-0 flex-1 flex-col md:gap-3 md:p-3">
        {!celular && (
          <BarraTopo
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
          />
        )}
        <div
          className="relative min-h-0 min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md"
          onPointerDown={() => {
            // tocar no mapa = foco no mapa: recolhe a gaveta
            if (celular && folha !== "fechada") setFolha("fechada");
          }}
        >
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={LEGENDA} />
          {!celular && vSel && (
            <div role="region" aria-label="Equipamento" className="absolute right-3 top-3 z-[600] flex max-h-[calc(100%-24px)] w-[340px] flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-xl">
              <Detalhe key={vSel.id} v={vSel} agora={agora} semSinalMin={semSinalMin} voltar={fechar} centralizar={centralizar} modo="fechar" />
            </div>
          )}
        </div>
        {celular && (
          /* Folha exatamente como estava (resumo={<ResumoCelular …/>} e {conteudo}) */
        )}
      </div>
    </div>
  );
```

> No bloco `{celular && (…)}`, cole sem mudança o `<Folha …>…</Folha>` que já existe hoje. O comentário acima só marca o lugar dele.

6e. Atualize o comentário da função: `/** Localização: no computador, mapa inteiro com filtros no topo e cartão do equipamento; no celular, o mapa com uma gaveta embaixo. */`.

- [ ] **Step 7: Delete the old bar**

Run: `git rm src/app/_localizacao/barra-tipos.tsx`

- [ ] **Step 8: Run checks and e2e**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test e2e/localizacao.spec.ts`
Expected: PASS nos 2 projetos. No celular, o 1º teste continua achando "4 veículos".

- [ ] **Step 9: Commit**

```bash
git add -A src/app/_localizacao e2e/localizacao.spec.ts
git commit -m "Localização no computador: mapa inteiro, filtros no topo com balões e cartão do equipamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Localização — faixa "Acontecimentos de hoje" embaixo do mapa

**Files:**
- Create: `src/app/_localizacao/faixa-acontecimentos.tsx`
- Modify: `src/app/_localizacao/localizacao.tsx` (colocar a faixa embaixo do mapa)
- Modify: `e2e/localizacao.spec.ts` (novo teste)

**Interfaces:**
- Consumes:
  - Da Tarefa 1: `janelaDosEventos`, `agruparEventos`, `emPct`, `Bolinha`.
  - Da Tarefa 2: `Balao`, `Regua`, `Alca`, `useOpcao`.
  - Já existentes: `doTipo`, `GRUPOS`, `TODOS_GRUPOS`, `textoEvento`, `textoPlano`, `veiculoDoEvento`, `EventoTexto`, `hora`, `diaBR`, `diaLocal`, `rotuloDia`.
- Produces: `<FaixaAcontecimentos eventos dia dias setDia tipo veiculos abrir />` com `section aria-label="Acontecimentos de hoje"` (ou `"Acontecimentos de DD/MM/AAAA"`).

- [ ] **Step 1: Write the failing e2e test** — acrescente em `e2e/localizacao.spec.ts`:

```ts
test("Localização: faixa de acontecimentos com balão e clique que abre o equipamento", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "faixa só no computador");
  await prepararDados(page);
  await page.goto("/");
  const faixa = page.getByRole("region", { name: "Acontecimentos de hoje" });
  await expect(faixa.getByText("Status")).toBeVisible();
  const bolinha = faixa.getByRole("button", { name: /EGC-2984/ });
  await bolinha.hover();
  await expect(page.getByRole("tooltip", { name: "Acontecimentos" })).toContainText("EGC-2984");
  await bolinha.click();
  await expect(page.getByRole("region", { name: "Equipamento" }).getByText("EGC-2984").first()).toBeVisible();
  // filtro de tipo vale para a faixa: só aspiradores = nenhum acontecimento
  await page.getByRole("navigation", { name: "Filtros do mapa" }).getByRole("button", { name: /^AS/ }).click();
  await page.keyboard.press("Escape");
  await expect(faixa.getByText(/Nenhum acontecimento/)).toBeVisible();
});
```

- [ ] **Step 2: Run e2e to verify it fails**

Run: `npm run build && npx playwright test e2e/localizacao.spec.ts --project=computador -g "faixa de acontecimentos"`
Expected: FAIL (a região "Acontecimentos de hoje" não existe).

- [ ] **Step 3: Create `src/app/_localizacao/faixa-acontecimentos.tsx`**

```tsx
"use client";

import { Fragment, useMemo, useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Alca } from "@/components/trilhas/alca";
import { Balao } from "@/components/trilhas/balao";
import { Regua } from "@/components/trilhas/regua";
import { Selecao } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { GRUPOS, TODOS_GRUPOS, doTipo, textoEvento, textoPlano, veiculoDoEvento } from "@/lib/dominio/eventos";
import { diaBR, diaLocal, hora, rotuloDia } from "@/lib/dominio/formato";
import { agruparEventos, emPct, janelaDosEventos, type Bolinha } from "@/lib/dominio/trilhas";
import { useOpcao } from "@/lib/hooks";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";

const ESTADOS = ["recolhida", "aberta"] as const;

interface Props {
  /** alertas do dia (sem a abertura) */
  eventos: Evento[];
  dia: string;
  dias: string[];
  setDia: (d: string) => void;
  /** filtro de tipo do topo (null = todos) */
  tipo: TipoEquip | null;
  veiculos: Veiculo[];
  abrir: (id: string) => void;
}

const rotuloBolinha = (b: Bolinha) => `${hora(b.eventos[0].t)} · ${b.eventos.length === 1 ? textoPlano(textoEvento(b.eventos[0])) : `${b.eventos.length} acontecimentos`}`;

/** Os alertas do dia numa linha do tempo por grupo (entradas, saídas, status, sinal), embaixo do mapa. */
export function FaixaAcontecimentos({ eventos, dia, dias, setDia, tipo, veiculos, abrir }: Props) {
  const [estado, setEstado] = useOpcao("mon-faixa-acontecimentos", ESTADOS, "aberta");
  const [dica, setDica] = useState<{ el: HTMLElement; b: Bolinha; fixa: boolean } | null>(null);
  const tipoDe = useMemo(() => new Map(veiculos.flatMap((v): [string, TipoEquip][] => (v.equip ? [[v.id, v.equip.tipo]] : []))), [veiculos]);
  const doFiltro = useMemo(() => doTipo(eventos, tipo, tipoDe), [eventos, tipo, tipoDe]);
  const janela = useMemo(() => janelaDosEventos(doFiltro, dia), [doFiltro, dia]);
  const trilhas = useMemo(() => agruparEventos(doFiltro, dia, janela), [doFiltro, dia, janela]);
  const opcoesDia = dias.includes(dia) ? dias : [dia, ...dias];
  const titulo = dia === diaLocal() ? "Acontecimentos de hoje" : `Acontecimentos de ${diaBR(dia)}`;

  return (
    <section aria-label={titulo} className="shrink-0 rounded-xl border border-borda bg-superficie shadow-md">
      <Alca opcoes={ESTADOS} valor={estado} mudar={setEstado} rotulo="Mostrar ou recolher os acontecimentos" />
      <div className="flex items-center gap-2 px-3 pb-2">
        <b className="text-sm">{titulo}</b>
        <span className="text-xs text-suave">
          {doFiltro.length} {doFiltro.length === 1 ? "acontecimento" : "acontecimentos"}
        </span>
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia dos acontecimentos" className="ml-auto w-36">
          {opcoesDia.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d)}
            </option>
          ))}
        </Selecao>
      </div>
      {estado === "aberta" &&
        (doFiltro.length ? (
          <div className="grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-1 px-3 pb-3" onPointerLeave={() => setDica((d) => (d?.fixa ? d : null))}>
            <span />
            <Regua janela={janela} />
            {TODOS_GRUPOS.map((g) => (
              <Fragment key={g}>
                <span className="text-[11px] text-suave">{GRUPOS[g].rotulo}</span>
                <div className="relative h-5 rounded bg-superficie-2">
                  {trilhas[g].map((b) => (
                    <button
                      key={b.s}
                      type="button"
                      aria-label={rotuloBolinha(b)}
                      onPointerEnter={(e) => {
                        const el = e.currentTarget;
                        setDica((d) => (d?.fixa ? d : { el, b, fixa: false }));
                      }}
                      onClick={(e) => (b.eventos.length === 1 ? abrir(veiculoDoEvento(b.eventos[0])) : setDica({ el: e.currentTarget, b, fixa: true }))}
                      className="absolute top-1/2 grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-superficie"
                      style={{ left: `${emPct(b.s, janela)}%`, background: corDoTom(GRUPOS[g].tom) }}
                    >
                      {b.eventos.length > 1 ? b.eventos.length : ""}
                    </button>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="px-3 pb-3 text-sm text-suave">Nenhum acontecimento {tipo ? "deste tipo " : ""}neste dia.</p>
        ))}
      <Balao ancora={dica?.el ?? null} rotulo="Acontecimentos" fechar={dica?.fixa ? () => setDica(null) : undefined} className="max-h-[50vh] w-[320px] overflow-y-auto py-1">
        {dica?.b.eventos.map((e) =>
          dica.fixa ? (
            <button
              key={`${e.t}|${e.id}|${e.tipo}`}
              type="button"
              onClick={() => {
                abrir(veiculoDoEvento(e));
                setDica(null);
              }}
              className="flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left hover:bg-superficie-2"
            >
              <span className="min-w-0 leading-snug">
                <EventoTexto e={e} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-suave">{hora(e.t)}</span>
            </button>
          ) : (
            <p key={`${e.t}|${e.id}|${e.tipo}`} className="flex items-start justify-between gap-3 px-3 py-1.5 leading-snug">
              <span className="min-w-0">
                <EventoTexto e={e} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-suave">{hora(e.t)}</span>
            </p>
          ),
        )}
      </Balao>
    </section>
  );
}
```

- [ ] **Step 4: Put the strip in `localizacao.tsx`**

Importe `import { FaixaAcontecimentos } from "./faixa-acontecimentos";`. Logo depois de fechar a `div` do mapa (antes de `{celular && (`), acrescente:

```tsx
        {!celular && <FaixaAcontecimentos eventos={eventos} dia={diaEventos} dias={dias} setDia={setDiaEventos} tipo={filtro.tipo} veiculos={veiculos} abrir={abrir} />}
```

- [ ] **Step 5: Run checks and e2e**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test e2e/localizacao.spec.ts`
Expected: PASS nos 2 projetos.

- [ ] **Step 6: Commit**

```bash
git add src/app/_localizacao/faixa-acontecimentos.tsx src/app/_localizacao/localizacao.tsx e2e/localizacao.spec.ts
git commit -m "Localização: faixa dos acontecimentos do dia embaixo do mapa, com balões

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: README, verificação completa e fotos para o dono conferir

**Files:**
- Modify: `README.md`
- Temporário (não vai para o git): `e2e/_fotos.spec.ts`

- [ ] **Step 1: Atualize o README**

Procure no `README.md` as frases que descrevem a lateral da Localização e da Timeline. Use `grep -n "lateral\|painel\|Painel\|recolh" README.md`. Troque essas frases por:

```markdown
- **Localização (computador):** o mapa ocupa a tela. No topo ficam os tipos (AP · AV · HV · UV · PG · AS); clicar num tipo filtra o mapa e abre a lista dele num balão. Ao lado ficam os contadores (ligados, desligados, sem sinal, manutenção), o balão de **Áreas** e o sino de **Alertas**. Clicar num equipamento abre o cartão no canto do mapa, com "Ver o dia ▸". Embaixo, a faixa **Acontecimentos de hoje** mostra entradas, saídas, status e sinal numa linha do tempo; passar o mouse mostra o balão e clicar abre o equipamento. A faixa recolhe pela alça.
- **Timeline (computador):** no topo ficam o veículo, o dia, os números do dia e o "Resumo do dia". Embaixo do mapa ficam as trilhas **Capítulos · Onde estava · Motor · Bomba** sobre uma régua de horário. A régua abre nas horas com registro, e há os botões "Dia inteiro" e "Ampliar o foco". Passar o mouse mostra o balão do bloco; um toque vai ao horário; arrastar escolhe o foco. A alça muda a altura (fina, normal, alta). Capítulos, trechos, tempo por área e o CSV ficam na gaveta **Apontamento**.
- **Celular:** igual a antes (gaveta embaixo e player no rodapé).
```

- [ ] **Step 2: Verificação completa**

Run: `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`
Expected: tudo passa. Unidade: os 145 testes anteriores mais os novos de `trilhas`, `balao` e `hooks`. e2e: só os testes de celular marcados como pulados.

- [ ] **Step 3: Fotos para o dono (dados sintéticos, nada gravado)**

Crie `e2e/_fotos.spec.ts`. É temporário: não faça commit dele.

```ts
import { test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const PASTA = process.env.FOTOS ?? "fotos";
test("fotos das telas novas", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "só computador");
  await prepararDados(page);
  await page.goto("/");
  await page.getByRole("navigation", { name: "Filtros do mapa" }).getByRole("button", { name: /^AP/ }).click();
  await page.screenshot({ path: `${PASTA}/localizacao.png` });
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  await page.getByRole("region", { name: "Timeline do veículo" }).getByRole("button", { name: /Capítulo 1/ }).hover();
  await page.screenshot({ path: `${PASTA}/timeline.png` });
});
```

Run (Git Bash; troque `<SCRATCH>` pela pasta de rascunho da sessão, fora do repositório):
`FOTOS="<SCRATCH>/fotos" npx playwright test e2e/_fotos.spec.ts --project=computador && rm e2e/_fotos.spec.ts`

Abra as duas imagens (ferramenta Read) e confira:
- não há coluna lateral;
- as trilhas estão alinhadas com a régua;
- o balão aparece inteiro;
- o cartão não cobre a barra do topo.

Mostre as fotos ao dono.

- [ ] **Step 4: Commit**

```bash
git status --short   # e2e/_fotos.spec.ts não pode aparecer
git add README.md
git commit -m "README: telas de mapa inteiro com trilhas e balões

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Não publicar**

Não faça `git push` nem merge. Avise o dono de que está tudo no ramo `historia-e-frota`, pronto para revisão e para publicar quando ele mandar.

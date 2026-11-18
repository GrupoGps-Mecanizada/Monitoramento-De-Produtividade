# Alertas da frota — Etapa 1 (banco + nota + detector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gravar no Supabase, a cada 10 min, cada exceção do dia como um alerta único (sem duplicado), com nota 0–100, os motivos da nota, o destino (whatsapp / resumo / tela) e a situação (aberto / visto / resolvido / silenciado). Sem WhatsApp e sem tela ainda.

**Architecture:** Regras puras novas em `src/lib/dominio/alertas/` (config, nota, contexto, montagem), usando a `excecoesDoDia` que a tela já usa (uma regra só). O coletor (GitHub Actions, disparado pelo Supabase a cada 5 min) chama um detector em `coletor/alertas.ts` que só faz leitura/gravação no Supabase e respeita um intervalo de 10 min. A chave única no banco garante que rodar 2 vezes não duplica.

**Tech Stack:** TypeScript, Vitest, Supabase (Postgres + supabase-js 2.117.1), tsx no coletor.

**Spec:** `docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md` (seções 4, 5, 6, 7A e 10). Etapas 2 (tela), 3 (enviador WhatsApp) e 4 (resumo diário) terão planos próprios.

## Global Constraints

- Repositório: worktree `C:\Users\Meu Computador\Desktop\Projetos\SGE\_worktrees\monit-alertas`, branch `alertas-whatsapp`. Nunca mexer no checkout principal (outro chat usa).
- Banco: Supabase **PRODUTIVIDADE**. SQL novo em `supabase/alertas.sql`, idempotente ("Pode rodar de novo"), com bloco de conferência no fim, como os outros `.sql`.
- Nenhuma regra nova de exceção: usar só `REGRAS` de `src/lib/dominio/excecoes.ts`.
- Supervisor pela **vaga**, nunca pela placa: usar `supervisorDaParada` de `src/lib/dominio/supervisor-vaga.ts`.
- Padrões da nota (spec 7A): cortes whatsapp 60, resumo 30, coordenador 85; máx. 6 msg/hora; modo teste ligado; resumo 07:00. Pesos: desligado 40, saída tarde 35, chegada cedo 35, ida ao Pátio 30, restaurante 30, ociosidade 30, bica 30, velocidade 30, Servitec 0, oficina de fora 0. Faixas: saída tarde e chegada cedo +30 acima de 15 min, +55 acima de 30 min; desligado +25 acima de 60 min, +45 acima de 120 min, +60 acima de 180 min. Repetição na mesma vaga em 7 dias: +10 na 2ª vez, +20 da 3ª em diante. Justificativas (tirar): manutenção 40, preparação 30, aguardando 25, pausas 25, logística 15 (vale a maior, não soma). Sem sinal em mais da metade do período: −40. Regime presumido: −10. Nota limitada a 0–100.
- `espera_min` 10, `lembrete_min` 120, `escalar_min` nulo (gravados agora, usados na etapa 3).
- Falha do detector nunca derruba o ciclo do coletor (`try/catch` com `console.warn`, como os outros passos).
- Telefones (tabela `alerta_destino`) **não** são legíveis pela chave pública.
- Textos e comentários em português, no estilo do repositório (comentário curto explicando o porquê).
- Comandos de verificação: `npm test`, `npm run typecheck`, `npm run lint` (raiz do worktree).

## Review Focus

- Saída tarde "ainda não saiu" que vira "saiu 08:10" no ciclo seguinte: `ini` muda, mas a chave tem de ser a mesma (usa `ref` = horário-limite) — teste na Task 4.
- Alerta resolvido ou silenciado pelo gestor não pode voltar a "aberto" quando o detector roda de novo — teste na Task 4.
- Tablet com placa escrita com hífen ("EGC-2985") e rastreador sem hífen: a justificativa tem de valer — teste na Task 3.
- Sinal perdido que nunca foi retomado (ainda sem sinal agora) conta até o fim do período — teste na Task 3.
- Tabelas ainda não criadas (SQL não rodado): o detector falha com aviso e o coletor segue — teste na Task 5.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/alertas.sql` (criar) | Tabelas, RLS, padrões e conferência |
| `src/lib/dominio/excecoes.ts` (mudar) | Novo campo `ref` em `Excecao` (horário estável para a chave) |
| `src/lib/dominio/alertas/config.ts` (criar) | Tipos `ConfigRegra`, `Politica`; padrões; `configCompleta` |
| `src/lib/dominio/alertas/nota.ts` (criar) | `excessoMin`, `notaDoAlerta`, `destinoDaNota` |
| `src/lib/dominio/alertas/contexto.ts` (criar) | `janelaDoAlerta`, `familiasNoPeriodo`, `fracaoSemSinal`, `repeticoes` |
| `src/lib/dominio/alertas/montar.ts` (criar) | `chaveDoAlerta`, `situacaoNova`, `montarAlertas` (tudo puro) |
| `coletor/alertas.ts` (criar) | Detector: leitura/gravação no Supabase, intervalo de 10 min |
| `coletor/run.ts` (mudar) | Chamar o detector no ciclo |
| testes `*.test.ts` ao lado de cada arquivo | Vitest |

---

### Task 1: Banco — `supabase/alertas.sql`

**Files:**
- Create: `supabase/alertas.sql`

**Interfaces:**
- Produces: tabelas `alerta_regra`, `alerta_politica`, `alerta_destino`, `alerta_silencio`, `alertas`, `alerta_envios` com as colunas abaixo (as Tasks 5+ leem/gravam exatamente esses nomes).

- [ ] **Step 1: Escrever o SQL**

```sql
-- Alertas da frota (15/10/2026, P-026) - Supabase PRODUTIVIDADE
--
-- Cada exceção do dia vira UM alerta (chave única), com nota 0-100 que decide se vai ao WhatsApp, ao resumo
-- diário ou só à tela. Desenho: docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md
-- O coletor grava com a chave secreta (ignora o RLS). A página só lê. Telefones não são públicos.
-- Pode rodar de novo.

-- Configuração de cada regra das Exceções do dia (src/lib/dominio/excecoes.ts, REGRAS)
create table if not exists public.alerta_regra (
  regra text primary key,
  ativa boolean not null default true,
  peso int not null check (peso between 0 and 100),
  faixas jsonb not null default '[]'::jsonb,          -- [{ "acima_min": 15, "pontos": 30 }, ...]
  justificativas jsonb not null default '{}'::jsonb,  -- { "manutencao": 40, ... } (família -> pontos a tirar)
  espera_min int not null default 10 check (espera_min between 0 and 240),
  lembrete_min int not null default 120 check (lembrete_min between 15 and 1440),
  escalar_min int check (escalar_min between 5 and 1440),
  atualizado_em timestamptz not null default now()
);

-- Cortes do filtro (uma linha só)
create table if not exists public.alerta_politica (
  id int primary key default 1 check (id = 1),
  corte_whatsapp int not null default 60 check (corte_whatsapp between 0 and 100),
  corte_resumo int not null default 30 check (corte_resumo between 0 and 100),
  corte_coordenador int not null default 85 check (corte_coordenador between 0 and 100),
  max_por_hora int not null default 6 check (max_por_hora between 1 and 60),
  modo_teste boolean not null default true,
  resumo_hora time not null default '07:00',
  atualizado_em timestamptz not null default now()
);

-- Quem recebe (telefone = dado pessoal: sem leitura pública)
create table if not exists public.alerta_destino (
  id bigint generated always as identity primary key,
  nome text not null check (length(trim(nome)) between 2 and 60),
  telefone text check (telefone ~ '^[0-9]{12,13}$'),  -- 55 + DDD + número, só dígitos
  grupo_id text,
  tipo text not null check (tipo in ('grupo', 'supervisor', 'coordenador', 'teste')),
  supervisor text,                                     -- nome como em supervisor-vaga.ts ("Junior Pereira")
  regras text[] not null default '{}',                 -- vazio = todas
  nao_perturbe_ini time,
  nao_perturbe_fim time,
  resumo_diario boolean not null default false,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  check (telefone is not null or grupo_id is not null)
);

-- Silenciar um equipamento, uma regra ou os dois juntos até uma data
create table if not exists public.alerta_silencio (
  id bigint generated always as identity primary key,
  veiculo_id text,
  regra text,
  motivo text not null check (length(trim(motivo)) between 2 and 200),
  ate timestamptz not null,
  criado_em timestamptz not null default now(),
  check (veiculo_id is not null or regra is not null)
);

-- Um registro por ocorrência: chave = regra|veiculo|dia|ref (ref = horário estável da exceção, em segundos do dia)
create table if not exists public.alertas (
  id bigint generated always as identity primary key,
  chave text not null unique,
  regra text not null,
  veiculo_id text not null,
  placa text not null,
  vaga text not null default '',
  supervisor text,
  dia date not null,
  ini int not null,                 -- segundos do dia
  fim int,
  ref int not null,
  local text,
  detalhe text not null,
  situacao text not null default 'aberto' check (situacao in ('aberto', 'visto', 'resolvido', 'silenciado')),
  nota int not null check (nota between 0 and 100),
  motivos jsonb not null default '[]'::jsonb,
  destino text not null check (destino in ('whatsapp', 'resumo', 'tela')),
  avaliacao text check (avaliacao in ('problema', 'nao_era_problema')),
  contagem int not null default 1,
  visto_por text,
  visto_em timestamptz,
  resolvido_em timestamptz,
  ultimo_aviso_em timestamptz,
  detectado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists alertas_dia_idx on public.alertas (dia desc, situacao);
create index if not exists alertas_regra_vaga_idx on public.alertas (regra, vaga, dia);

-- Fila do WhatsApp (usada na etapa 3)
create table if not exists public.alerta_envios (
  id bigint generated always as identity primary key,
  destino_id bigint not null references public.alerta_destino (id),
  tipo text not null check (tipo in ('alerta', 'lembrete', 'escala', 'resumo')),
  chave text unique,                -- resumo|dia|destino: o resumo não duplica
  alertas bigint[] not null default '{}',
  texto text not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'descartado', 'erro')),
  tentativas int not null default 0,
  erro text,
  enviar_apos timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index if not exists alerta_envios_status_idx on public.alerta_envios (status, enviar_apos);

-- RLS: a página lê alertas e configuração; destino e fila só o coletor/enviador (chave secreta)
alter table public.alerta_regra enable row level security;
alter table public.alerta_politica enable row level security;
alter table public.alerta_destino enable row level security;
alter table public.alerta_silencio enable row level security;
alter table public.alertas enable row level security;
alter table public.alerta_envios enable row level security;

drop policy if exists alerta_regra_ler on public.alerta_regra;
create policy alerta_regra_ler on public.alerta_regra for select to anon, authenticated using (true);
drop policy if exists alerta_politica_ler on public.alerta_politica;
create policy alerta_politica_ler on public.alerta_politica for select to anon, authenticated using (true);
drop policy if exists alerta_silencio_ler on public.alerta_silencio;
create policy alerta_silencio_ler on public.alerta_silencio for select to anon, authenticated using (true);
drop policy if exists alertas_ler on public.alertas;
create policy alertas_ler on public.alertas for select to anon, authenticated using (true);

grant select on public.alerta_regra, public.alerta_politica, public.alerta_silencio, public.alertas to anon, authenticated;
revoke all on public.alerta_destino, public.alerta_envios from anon, authenticated;

-- Padrões (spec 7A). "on conflict do nothing": rodar de novo não desfaz o que o gestor mudou na tela.
insert into public.alerta_politica (id) values (1) on conflict (id) do nothing;
insert into public.alerta_regra (regra, peso, faixas, justificativas) values
  ('saida_tarde', 35, '[{"acima_min":15,"pontos":30},{"acima_min":30,"pontos":55}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('chegada_cedo', 35, '[{"acima_min":15,"pontos":30},{"acima_min":30,"pontos":55}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('desligado', 40, '[{"acima_min":60,"pontos":25},{"acima_min":120,"pontos":45},{"acima_min":180,"pontos":60}]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('patio', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('restaurante', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('ocioso', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('bica_vacuo', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('velocidade', 30, '[]', '{"manutencao":40,"preparacao":30,"aguardando":25,"pausas":25,"logistica":15}'),
  ('servitec', 0, '[]', '{}'),
  ('oficina_fora', 0, '[]', '{}')
on conflict (regra) do nothing;

-- Conferência: 10 regras, 1 política e os alertas de hoje
select (select count(*) from public.alerta_regra) as regras,
       (select count(*) from public.alerta_politica) as politica,
       (select count(*) from public.alertas where dia = current_date) as alertas_hoje;
```

- [ ] **Step 2: Conferir que nenhum nome de regra ficou de fora**

Run: `grep -o "\"[a-z_]*\"" src/lib/dominio/excecoes.ts | head -12` e comparar com as 10 linhas do `insert` (saida_tarde, chegada_cedo, patio, servitec, oficina_fora, bica_vacuo, restaurante, ocioso, desligado, velocidade).
Expected: mesmos 10 nomes.

- [ ] **Step 3: Commit**

```bash
git add supabase/alertas.sql
git commit -m "Alertas: tabelas, RLS e padrões do filtro (P-026)"
```

(O dono roda o SQL no Supabase PRODUTIVIDADE ao fim do plano — Task 6.)

---

### Task 2: `ref` nas exceções + configuração + nota

**Files:**
- Modify: `src/lib/dominio/excecoes.ts` (interface `Excecao`, função `add` e as chamadas de `saida_tarde`/`chegada_cedo` dentro de `excecoesDoDia`)
- Modify: `src/lib/dominio/excecoes.test.ts` (novo teste)
- Create: `src/lib/dominio/alertas/config.ts`
- Create: `src/lib/dominio/alertas/nota.ts`
- Test: `src/lib/dominio/alertas/nota.test.ts`

**Interfaces:**
- Produces:
  - `Excecao.ref: number` (segundos do dia; saída tarde = horário-limite de saída; chegada cedo = horário-limite de chegada; demais = `ini`).
  - `config.ts`: `interface Faixa { acima_min: number; pontos: number }`, `type FamiliaJust = Exclude<Familia, "sem">`, `interface ConfigRegra { regra: RegraExcecao; ativa: boolean; peso: number; faixas: Faixa[]; justificativas: Partial<Record<FamiliaJust, number>>; espera_min: number; lembrete_min: number; escalar_min: number | null }`, `interface Politica { corte_whatsapp: number; corte_resumo: number; corte_coordenador: number; max_por_hora: number; modo_teste: boolean; resumo_hora: string }`, `POLITICA_PADRAO: Politica`, `REGRAS_PADRAO: Record<RegraExcecao, ConfigRegra>`, `configCompleta(linhas: Partial<ConfigRegra>[]): Record<RegraExcecao, ConfigRegra>`, `politicaCompleta(p: Partial<Politica> | null): Politica`, constantes `REPETICAO_SEGUNDA = 10`, `REPETICAO_TERCEIRA = 20`, `SEM_SINAL_FRACAO = 0.5`, `SEM_SINAL_PONTOS = 40`, `PRESUMIDO_PONTOS = 10`.
  - `nota.ts`: `interface ContextoNota { excessoMin: number; repeticoes: number; familias: Familia[]; fracaoSemSinal: number; presumido: boolean }`, `interface Motivo { texto: string; pontos: number }`, `excessoMin(x: Excecao, agoraSeg: number | null): number`, `notaDoAlerta(cfg: ConfigRegra, c: ContextoNota): { nota: number; motivos: Motivo[] }`, `type Destino = "whatsapp" | "resumo" | "tela"`, `destinoDaNota(nota: number, p: Politica): Destino`.

- [ ] **Step 1: Teste do `ref` (falha)** — acrescentar no fim de `src/lib/dominio/excecoes.test.ts`:

```ts
describe("ref: horário estável para a chave do alerta", () => {
  it("saída tarde e chegada cedo guardam o horário-limite; as outras, o início", () => {
    const xs = excecoesDoDia(entrada()).filter((x) => x.veiculo === "1");
    const ref = (r: string) => xs.find((x) => x.regra === r)?.ref;
    expect(ref("saida_tarde")).toBe(hs("07:45"));
    expect(ref("chegada_cedo")).toBe(hs("16:30"));
    expect(ref("desligado")).toBe(hs("10:00"));
  });
  it("'ainda não saiu' e 'saiu' têm o mesmo ref", () => {
    const antes = excecoesDoDia(entrada({ agoraSeg: hs("08:00") })).find((x) => x.veiculo === "1" && x.regra === "saida_tarde");
    const depois = excecoesDoDia(entrada()).find((x) => x.veiculo === "1" && x.regra === "saida_tarde");
    expect(antes?.detalhe).toMatch(/não saiu/);
    expect(antes?.ref).toBe(depois?.ref);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/excecoes.test.ts`
Expected: FAIL (`ref` é `undefined`).

- [ ] **Step 3: Implementar o `ref`** em `src/lib/dominio/excecoes.ts`:

Na interface `Excecao`, depois de `fim`:
```ts
  /** horário estável da ocorrência (segundos do dia): o limite na saída tarde e na chegada cedo, o início nas outras. A chave do alerta usa este. */
  ref: number;
```
Trocar a função `add` dentro de `excecoesDoDia` por:
```ts
    const add = (regra: RegraExcecao, ini: number, fimX: number | null, local: string | null, detalhe: string, ref = ini) =>
      out.push({ regra, veiculo: v.id, ini: ini - DIA, fim: fimX == null ? null : fimX - DIA, ref: ref - DIA, local, detalhe, gravidade: GRAVIDADE[regra] });
```
E nas três chamadas de saída/chegada passar o limite como último argumento:
```ts
          if (p && p.b < Math.min(e.c, fim)) add("saida_tarde", p.b, null, LOCAL_BASE, `saiu ${hhmm(p.b)} · limite ${hhmm(e.s)}`, e.s);
          else if (p) add("saida_tarde", e.s, null, LOCAL_BASE, `não saiu do Pátio · limite ${hhmm(e.s)}`, e.s);
```
```ts
          if (p && p.a > e.s + tol) add("chegada_cedo", p.a, null, LOCAL_BASE, `chegou ${hhmm(p.a)} · limite ${hhmm(e.c)}`, e.c);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/excecoes.test.ts`
Expected: PASS (todos, inclusive os antigos).

- [ ] **Step 5: Criar `src/lib/dominio/alertas/config.ts`**

```ts
// Configuração do filtro inteligente dos alertas (spec 2026-10-15-alertas-whatsapp-design.md, seção 7A).
// Os padrões daqui são os mesmos do supabase/alertas.sql; o banco manda (o gestor muda na tela).
import { REGRAS, type RegraExcecao } from "../excecoes";
import type { Familia } from "../familias";

export interface Faixa {
  /** pontos quando o problema passa deste tanto de minutos */
  acima_min: number;
  pontos: number;
}
export type FamiliaJust = Exclude<Familia, "sem">;
export interface ConfigRegra {
  regra: RegraExcecao;
  ativa: boolean;
  /** gravidade base (0-100) */
  peso: number;
  faixas: Faixa[];
  /** família de apontamento do tablet -> pontos a tirar */
  justificativas: Partial<Record<FamiliaJust, number>>;
  espera_min: number;
  lembrete_min: number;
  escalar_min: number | null;
}
export interface Politica {
  corte_whatsapp: number;
  corte_resumo: number;
  corte_coordenador: number;
  max_por_hora: number;
  modo_teste: boolean;
  /** "HH:MM" */
  resumo_hora: string;
}

export const REPETICAO_SEGUNDA = 10;
export const REPETICAO_TERCEIRA = 20;
/** Sem sinal em mais desta fração do período: provavelmente não é "desligado" de verdade. */
export const SEM_SINAL_FRACAO = 0.5;
export const SEM_SINAL_PONTOS = 40;
export const PRESUMIDO_PONTOS = 10;

export const POLITICA_PADRAO: Politica = { corte_whatsapp: 60, corte_resumo: 30, corte_coordenador: 85, max_por_hora: 6, modo_teste: true, resumo_hora: "07:00" };

const JUST: ConfigRegra["justificativas"] = { manutencao: 40, preparacao: 30, aguardando: 25, pausas: 25, logistica: 15 };
const HORARIO: Faixa[] = [{ acima_min: 15, pontos: 30 }, { acima_min: 30, pontos: 55 }];
const regra = (r: RegraExcecao, peso: number, faixas: Faixa[] = [], justificativas = JUST): ConfigRegra => ({ regra: r, ativa: true, peso, faixas, justificativas, espera_min: 10, lembrete_min: 120, escalar_min: null });

export const REGRAS_PADRAO: Record<RegraExcecao, ConfigRegra> = {
  saida_tarde: regra("saida_tarde", 35, HORARIO),
  chegada_cedo: regra("chegada_cedo", 35, HORARIO),
  desligado: regra("desligado", 40, [{ acima_min: 60, pontos: 25 }, { acima_min: 120, pontos: 45 }, { acima_min: 180, pontos: 60 }]),
  patio: regra("patio", 30),
  restaurante: regra("restaurante", 30),
  ocioso: regra("ocioso", 30),
  bica_vacuo: regra("bica_vacuo", 30),
  velocidade: regra("velocidade", 30),
  servitec: regra("servitec", 0, [], {}),
  oficina_fora: regra("oficina_fora", 0, [], {}),
};

/** Linhas do banco por cima dos padrões; regra desconhecida no banco é ignorada. */
export function configCompleta(linhas: Partial<ConfigRegra>[]): Record<RegraExcecao, ConfigRegra> {
  const out = { ...REGRAS_PADRAO };
  for (const l of linhas) if (l.regra && (REGRAS as readonly string[]).includes(l.regra)) out[l.regra] = { ...REGRAS_PADRAO[l.regra], ...l, regra: l.regra };
  return out;
}
export const politicaCompleta = (p: Partial<Politica> | null): Politica => ({ ...POLITICA_PADRAO, ...(p ?? {}) });
```

- [ ] **Step 6: Testes da nota (falham)** — criar `src/lib/dominio/alertas/nota.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import { destinoDaNota, excessoMin, notaDoAlerta, type ContextoNota } from "./nota";

const H = 3600;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "saida_tarde", veiculo: "1", ini: 0, fim: null, ref: 0, local: null, detalhe: "", gravidade: "alerta", ...o });
const ctx = (o: Partial<ContextoNota> = {}): ContextoNota => ({ excessoMin: 0, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false, ...o });

describe("excesso em minutos", () => {
  it("saída tarde: saiu depois do limite", () => expect(excessoMin(exc({ ini: 8 * H + 10 * 60, ref: 7 * H + 45 * 60 }), null)).toBe(25));
  it("saída tarde: ainda não saiu conta até agora", () => expect(excessoMin(exc({ ini: 7 * H, ref: 7 * H }), 8 * H)).toBe(60));
  it("chegada cedo: quanto antes do limite", () => expect(excessoMin(exc({ regra: "chegada_cedo", ini: 16 * H, ref: 16 * H + 30 * 60 }), null)).toBe(30));
  it("desligado: a duração", () => expect(excessoMin(exc({ regra: "desligado", ini: 10 * H, fim: 11 * H + 10 * 60, ref: 10 * H }), null)).toBe(70));
});

describe("nota do alerta", () => {
  const st = REGRAS_PADRAO.saida_tarde;
  it("saída tarde 10 min: só o peso (35) -> resumo", () => {
    const n = notaDoAlerta(st, ctx({ excessoMin: 10 }));
    expect(n.nota).toBe(35);
    expect(destinoDaNota(n.nota, POLITICA_PADRAO)).toBe("resumo");
  });
  it("saída tarde 25 min: 35 + 30 = 65 -> WhatsApp", () => expect(notaDoAlerta(st, ctx({ excessoMin: 25 })).nota).toBe(65));
  it("saída tarde 40 min: 35 + 55 = 90 (coordenador)", () => expect(notaDoAlerta(st, ctx({ excessoMin: 40 })).nota).toBe(90));
  it("exatamente no limite da faixa não sobe (acima de)", () => expect(notaDoAlerta(st, ctx({ excessoMin: 15 })).nota).toBe(35));
  it("repetição: +10 na 2ª vez, +20 da 3ª em diante", () => {
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, repeticoes: 1 })).nota).toBe(45);
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, repeticoes: 4 })).nota).toBe(55);
  });
  it("justificativa: vale a maior família, não soma", () => {
    const n = notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, familias: ["manutencao", "aguardando", "sem"] }));
    expect(n.nota).toBe(40 + 25 - 40);
    expect(n.motivos.map((m) => m.pontos)).toEqual([40, 25, -40]);
  });
  it("sem sinal em mais da metade: -40; regime presumido: -10", () => {
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, fracaoSemSinal: 0.6 })).nota).toBe(25);
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, fracaoSemSinal: 0.5 })).nota).toBe(65);
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, presumido: true })).nota).toBe(25);
  });
  it("fica entre 0 e 100", () => {
    expect(notaDoAlerta(REGRAS_PADRAO.servitec, ctx({ presumido: true, fracaoSemSinal: 1 })).nota).toBe(0);
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 300, repeticoes: 5 })).nota).toBe(100);
  });
  it("cada parte vira um motivo legível", () => {
    const n = notaDoAlerta(st, ctx({ excessoMin: 25, repeticoes: 1 }));
    expect(n.motivos.map((m) => m.texto)).toEqual(["Peso da regra", "Passou de 15 min", "2ª vez na semana nesta vaga"]);
  });
});

describe("destino pelos cortes", () => {
  it("60+ WhatsApp, 30+ resumo, abaixo tela", () => {
    expect(destinoDaNota(60, POLITICA_PADRAO)).toBe("whatsapp");
    expect(destinoDaNota(59, POLITICA_PADRAO)).toBe("resumo");
    expect(destinoDaNota(29, POLITICA_PADRAO)).toBe("tela");
  });
});

describe("configuração do banco por cima dos padrões", () => {
  it("muda só o que veio e ignora regra desconhecida", () => {
    const c = configCompleta([{ regra: "ocioso", peso: 70 }, { regra: "inventada" as never, peso: 1 }]);
    expect(c.ocioso.peso).toBe(70);
    expect(c.ocioso.justificativas).toEqual(REGRAS_PADRAO.ocioso.justificativas);
    expect(c.desligado).toEqual(REGRAS_PADRAO.desligado);
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/alertas/nota.test.ts`
Expected: FAIL ("Cannot find module './nota'").

- [ ] **Step 8: Criar `src/lib/dominio/alertas/nota.ts`**

```ts
// Nota 0-100 de um alerta: decide se vai ao WhatsApp, ao resumo ou só à tela (spec, seção 7A).
// Cada parte vira um "motivo" para a tela explicar a nota.
import type { Excecao } from "../excecoes";
import { ROTULO_FAMILIA, type Familia } from "../familias";
import { DIA } from "../trilhas";
import { PRESUMIDO_PONTOS, REPETICAO_SEGUNDA, REPETICAO_TERCEIRA, SEM_SINAL_FRACAO, SEM_SINAL_PONTOS, type ConfigRegra, type FamiliaJust, type Politica } from "./config";

export interface ContextoNota {
  /** quanto passou do limite (minutos) */
  excessoMin: number;
  /** alertas anteriores da mesma regra na mesma vaga nos últimos 7 dias */
  repeticoes: number;
  /** famílias de apontamento do tablet no período */
  familias: Familia[];
  /** 0 a 1: parte do período sem sinal do rastreador */
  fracaoSemSinal: number;
  presumido: boolean;
}
export interface Motivo {
  texto: string;
  pontos: number;
}
export type Destino = "whatsapp" | "resumo" | "tela";

/** Minutos além do limite: saída tarde (ainda no Pátio conta até agora), chegada cedo, ou a duração nas outras. */
export function excessoMin(x: Excecao, agoraSeg: number | null): number {
  const seg =
    x.regra === "saida_tarde" ? (x.ini > x.ref ? x.ini : (agoraSeg ?? DIA)) - x.ref : x.regra === "chegada_cedo" ? x.ref - x.ini : (x.fim ?? x.ini) - x.ini;
  return Math.max(0, seg / 60);
}

export function notaDoAlerta(cfg: ConfigRegra, c: ContextoNota): { nota: number; motivos: Motivo[] } {
  const motivos: Motivo[] = [{ texto: "Peso da regra", pontos: cfg.peso }];
  const faixa = [...cfg.faixas].sort((a, b) => b.acima_min - a.acima_min).find((f) => c.excessoMin > f.acima_min);
  if (faixa) motivos.push({ texto: `Passou de ${faixa.acima_min} min`, pontos: faixa.pontos });
  if (c.repeticoes >= 2) motivos.push({ texto: `${c.repeticoes + 1}ª vez na semana nesta vaga`, pontos: REPETICAO_TERCEIRA });
  else if (c.repeticoes === 1) motivos.push({ texto: "2ª vez na semana nesta vaga", pontos: REPETICAO_SEGUNDA });
  // vale a justificativa mais forte: duas famílias no mesmo período não somam
  const just = c.familias
    .filter((f): f is FamiliaJust => f !== "sem")
    .map((f) => ({ f, p: cfg.justificativas[f] ?? 0 }))
    .sort((a, b) => b.p - a.p)[0];
  if (just && just.p > 0) motivos.push({ texto: `Apontado no tablet: ${ROTULO_FAMILIA[just.f]}`, pontos: -just.p });
  if (c.fracaoSemSinal > SEM_SINAL_FRACAO) motivos.push({ texto: "Rastreador sem sinal na maior parte do tempo", pontos: -SEM_SINAL_PONTOS });
  if (c.presumido) motivos.push({ texto: "Regime presumido (ADM)", pontos: -PRESUMIDO_PONTOS });
  const soma = motivos.reduce((s, m) => s + m.pontos, 0);
  return { nota: Math.max(0, Math.min(100, Math.round(soma))), motivos };
}

export const destinoDaNota = (nota: number, p: Politica): Destino => (nota >= p.corte_whatsapp ? "whatsapp" : nota >= p.corte_resumo ? "resumo" : "tela");
```

- [ ] **Step 9: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/alertas src/lib/dominio/excecoes.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/dominio/excecoes.ts src/lib/dominio/excecoes.test.ts src/lib/dominio/alertas/config.ts src/lib/dominio/alertas/nota.ts src/lib/dominio/alertas/nota.test.ts
git commit -m "Alertas: ref estável nas exceções e nota 0-100 com motivos (P-026)"
```

---

### Task 3: Contexto da nota (justificativa, sem sinal, repetição)

**Files:**
- Create: `src/lib/dominio/alertas/contexto.ts`
- Test: `src/lib/dominio/alertas/contexto.test.ts`

**Interfaces:**
- Consumes: `Excecao` (com `ref`), `familiaDe` (`../familias`), `formasDaPlaca`, `LinhaTablet` (`../gauss-dia`), `Evento` (`../../tipos`), `diaMenos` (`../analise`).
- Produces: `janelaDoAlerta(x: Excecao): { a: number; b: number }`, `familiasNoPeriodo(tablet: (LinhaTablet & { placa: string })[], placa: string, dia: string, j: { a: number; b: number }): Familia[]`, `fracaoSemSinal(eventos: Evento[], veiculoId: string, dia: string, j: { a: number; b: number }): number`, `interface HistoricoAlerta { chave: string; regra: string; vaga: string; dia: string; situacao: Situacao; resolvido_em: string | null; contagem: number }` (com `type Situacao = "aberto" | "visto" | "resolvido" | "silenciado"`), `repeticoes(historico: HistoricoAlerta[], regra: string, vaga: string, dia: string, chave: string): number`.

- [ ] **Step 1: Testes (falham)** — criar `src/lib/dominio/alertas/contexto.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import type { Evento } from "../../tipos";
import { familiasNoPeriodo, fracaoSemSinal, janelaDoAlerta, repeticoes, type HistoricoAlerta } from "./contexto";

const D = "2026-10-07";
const H = 3600;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "desligado", veiculo: "1", ini: 10 * H, fim: 11 * H, ref: 10 * H, local: null, detalhe: "", gravidade: "alerta", ...o });
const tab = (placa: string, ini: string, fim: string | null, cat: string) => ({ placa, demora_cod: 1, inicio: `${D} ${ini}:00`, fim: fim ? `${D} ${fim}:00` : null, categoria_demora: cat, motorista: null, concluido: null });
const ev = (tipo: string, hora: string, id = "1") => ({ id, tipo, t: `${D}T${hora}:00-03:00`, area: "", placa: "", vaga: "" }) as unknown as Evento;

describe("janela do alerta", () => {
  it("desligado: do início ao fim", () => expect(janelaDoAlerta(exc({}))).toEqual({ a: 10 * H, b: 11 * H }));
  it("saída tarde: do limite até a saída", () => expect(janelaDoAlerta(exc({ regra: "saida_tarde", ini: 8 * H, fim: null, ref: 7 * H }))).toEqual({ a: 7 * H, b: 8 * H }));
  it("chegada cedo: da chegada até o limite", () => expect(janelaDoAlerta(exc({ regra: "chegada_cedo", ini: 16 * H, fim: null, ref: 16 * H + 1800 }))).toEqual({ a: 16 * H, b: 16 * H + 1800 }));
  it("instante (ainda não saiu): pelo menos 1 min", () => expect(janelaDoAlerta(exc({ regra: "saida_tarde", ini: 7 * H, fim: null, ref: 7 * H }))).toEqual({ a: 7 * H, b: 7 * H + 60 }));
});

describe("famílias do tablet no período", () => {
  const j = { a: 10 * H, b: 11 * H };
  it("placa com hífen no tablet vale para a placa sem hífen", () => {
    expect(familiasNoPeriodo([tab("EGC-2985", "10:20", "10:40", "Pequenas manutenções")], "EGC2985", D, j)).toEqual(["manutencao"]);
  });
  it("fora do período ou de outra placa não conta", () => {
    expect(familiasNoPeriodo([tab("EGC2985", "11:00", "11:30", "Aguardando Área"), tab("XYZ1234", "10:10", "10:20", "Aguardando Área")], "EGC2985", D, j)).toEqual([]);
  });
  it("apontamento ainda aberto (sem fim) conta", () => {
    expect(familiasNoPeriodo([tab("EGC2985", "09:00", null, "Aguardando Área")], "EGC2985", D, j)).toEqual(["aguardando"]);
  });
});

describe("fração sem sinal", () => {
  const j = { a: 10 * H, b: 12 * H };
  it("perdeu 10:30 e voltou 11:30: metade", () => expect(fracaoSemSinal([ev("sinal_perdido", "10:30"), ev("sinal_retomado", "11:30")], "1", D, j)).toBe(0.5));
  it("perdeu e nunca voltou: até o fim do período", () => expect(fracaoSemSinal([ev("sinal_perdido", "11:00")], "1", D, j)).toBe(0.5));
  it("já estava sem sinal antes do período", () => expect(fracaoSemSinal([ev("sinal_perdido", "09:00"), ev("sinal_retomado", "11:00")], "1", D, j)).toBe(0.5));
  it("outro veículo não conta", () => expect(fracaoSemSinal([ev("sinal_perdido", "10:00", "2")], "1", D, j)).toBe(0));
});

describe("repetições na mesma vaga em 7 dias", () => {
  const h = (dia: string, chave: string, vaga = "AP-02", regra = "desligado"): HistoricoAlerta => ({ chave, regra, vaga, dia, situacao: "resolvido", resolvido_em: null, contagem: 1 });
  it("conta outras ocorrências da mesma regra e vaga, dentro de 7 dias, sem contar a própria", () => {
    const hist = [h("2026-10-01", "a"), h("2026-10-06", "b"), h("2026-10-07", "atual"), h("2026-10-05", "c", "AP-03"), h("2026-10-05", "d", "AP-02", "ocioso"), h("2026-09-30", "e")];
    expect(repeticoes(hist, "desligado", "AP-02", D, "atual")).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/alertas/contexto.test.ts`
Expected: FAIL ("Cannot find module './contexto'").

- [ ] **Step 3: Criar `src/lib/dominio/alertas/contexto.ts`**

```ts
// O que pesa na nota além da regra: apontamento do tablet, sinal do rastreador e repetição na vaga.
// Tempos em segundos desde 00:00 do dia do alerta (o mesmo eixo de Excecao.ini/fim).
import type { Evento } from "../../tipos";
import { diaMenos } from "../analise";
import type { Excecao } from "../excecoes";
import { familiaDe, type Familia } from "../familias";
import { formasDaPlaca, type LinhaTablet } from "../gauss-dia";

export type Situacao = "aberto" | "visto" | "resolvido" | "silenciado";
export interface HistoricoAlerta {
  chave: string;
  regra: string;
  vaga: string;
  dia: string;
  situacao: Situacao;
  resolvido_em: string | null;
  contagem: number;
}

const segIso = (iso: string, dia: string) => (Date.parse(iso) - Date.parse(`${dia}T00:00:00-03:00`)) / 1000;
// o GAUSS grava "AAAA-MM-DD HH:MM:SS" no horário local
const segLocal = (ts: string, dia: string) => segIso(`${ts.slice(0, 10)}T${ts.slice(11, 19)}-03:00`, dia);

/** Período que o alerta cobre: do limite à saída (saída tarde), da chegada ao limite (chegada cedo), ou ini–fim. Mínimo 1 min. */
export function janelaDoAlerta(x: Excecao): { a: number; b: number } {
  const a = Math.min(x.ini, x.ref);
  const b = Math.max(x.fim ?? x.ini, x.ref);
  return { a, b: Math.max(b, a + 60) };
}

export function familiasNoPeriodo(tablet: (LinhaTablet & { placa: string })[], placa: string, dia: string, j: { a: number; b: number }): Familia[] {
  const placas = new Set(formasDaPlaca(placa));
  const out = new Set<Familia>();
  for (const t of tablet) {
    if (!placas.has(t.placa)) continue;
    const a = segLocal(t.inicio, dia);
    const b = t.fim ? segLocal(t.fim, dia) : Infinity;
    if (a < j.b && b > j.a) out.add(familiaDe(t.categoria_demora));
  }
  return [...out];
}

/** Parte do período (0 a 1) em que o rastreador estava sem sinal; perdido e não retomado vale até o fim. */
export function fracaoSemSinal(eventos: Evento[], veiculoId: string, dia: string, j: { a: number; b: number }): number {
  let semDesde: number | null = null;
  let soma = 0;
  const conta = (de: number, ate: number) => (soma += Math.max(0, Math.min(ate, j.b) - Math.max(de, j.a)));
  for (const e of eventos.filter((x) => x.id === veiculoId && !x.motor2).sort((p, q) => p.t.localeCompare(q.t))) {
    const t = segIso(e.t, dia);
    if (e.tipo === "sinal_perdido" && semDesde == null) semDesde = t;
    else if (e.tipo === "sinal_retomado" && semDesde != null) {
      conta(semDesde, t);
      semDesde = null;
    }
  }
  if (semDesde != null) conta(semDesde, j.b);
  return j.b > j.a ? soma / (j.b - j.a) : 0;
}

/** Quantas vezes a mesma regra aconteceu na mesma vaga nos 7 dias até `dia` (sem contar o próprio alerta). */
export function repeticoes(historico: HistoricoAlerta[], regra: string, vaga: string, dia: string, chave: string): number {
  const desde = diaMenos(dia, 6);
  return historico.filter((h) => h.regra === regra && h.vaga === vaga && h.chave !== chave && h.dia >= desde && h.dia <= dia).length;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/alertas/contexto.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/alertas/contexto.ts src/lib/dominio/alertas/contexto.test.ts
git commit -m "Alertas: justificativa do tablet, sem sinal e repetição na vaga (P-026)"
```

---

### Task 4: Montagem dos alertas (chave, situação, sem duplicado)

**Files:**
- Create: `src/lib/dominio/alertas/montar.ts`
- Test: `src/lib/dominio/alertas/montar.test.ts`

**Interfaces:**
- Consumes: Tasks 2 e 3; `regimeDoEquip` (`../regras-frota`), `supervisorDaParada` (`../supervisor-vaga`), `Veiculo` (`../../tipos`).
- Produces:
  - `chaveDoAlerta(x: Excecao, dia: string): string` → `"regra|veiculo|dia|ref"`.
  - `interface Silencio { veiculo_id: string | null; regra: string | null; ate: string }`.
  - `situacaoNova(anterior: Situacao | null, terminou: boolean, silenciado: boolean): Situacao`.
  - `interface LinhaAlerta { chave: string; regra: string; veiculo_id: string; placa: string; vaga: string; supervisor: string | null; dia: string; ini: number; fim: number | null; ref: number; local: string | null; detalhe: string; situacao: Situacao; nota: number; motivos: Motivo[]; destino: Destino; contagem: number; resolvido_em: string | null; atualizado_em: string }`.
  - `interface EntradaMontar { dia: string; agoraSeg: number | null; agoraIso: string; excecoes: Excecao[]; veiculos: Veiculo[]; tablet: (LinhaTablet & { placa: string })[]; eventos: Evento[]; historico: HistoricoAlerta[]; silencios: Silencio[]; regras: Record<RegraExcecao, ConfigRegra>; politica: Politica }`.
  - `montarAlertas(x: EntradaMontar): LinhaAlerta[]`.
  - `FOLGA_FIM_S = 600`.

- [ ] **Step 1: Testes (falham)** — criar `src/lib/dominio/alertas/montar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import type { Veiculo } from "../../tipos";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import type { HistoricoAlerta } from "./contexto";
import { chaveDoAlerta, montarAlertas, situacaoNova, type EntradaMontar } from "./montar";

const D = "2026-10-07";
const H = 3600;
const veic = (id: string, placa: string, vaga: string, regime: string | null = "ADM"): Veiculo =>
  ({ id, placa, vaga, equip: { tipo: "ap", nome: placa, ordem: 1, regime, status: "ATIVO", supervisor: "Da Matriz" } }) as unknown as Veiculo;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "desligado", veiculo: "1", ini: 10 * H, fim: 11 * H + 10 * 60, ref: 10 * H, local: "ALTO FORNO 3", detalhe: "1 h 10 min", gravidade: "alerta", ...o });
const entrada = (o: Partial<EntradaMontar> = {}): EntradaMontar => ({
  dia: D, agoraSeg: 12 * H, agoraIso: "2026-10-07T15:00:00.000Z", excecoes: [exc({})], veiculos: [veic("1", "EGC2985", "ALTA PRESSÃO - GPS - 02")],
  tablet: [], eventos: [], historico: [], silencios: [], regras: REGRAS_PADRAO, politica: POLITICA_PADRAO, ...o,
});
const hist = (chave: string, situacao: HistoricoAlerta["situacao"], o: Partial<HistoricoAlerta> = {}): HistoricoAlerta => ({ chave, regra: "desligado", vaga: "ALTA PRESSÃO - GPS - 02", dia: D, situacao, resolvido_em: null, contagem: 3, ...o });

describe("chave", () => {
  it("regra|veiculo|dia|ref", () => expect(chaveDoAlerta(exc({}), D)).toBe(`desligado|1|${D}|36000`));
});

describe("situação", () => {
  it("resolvido e silenciado não voltam a abrir", () => {
    expect(situacaoNova("resolvido", false, false)).toBe("resolvido");
    expect(situacaoNova("silenciado", false, false)).toBe("silenciado");
  });
  it("silêncio vale sobre aberto e visto", () => expect(situacaoNova("visto", false, true)).toBe("silenciado"));
  it("terminou -> resolvido; visto fica visto; novo -> aberto", () => {
    expect(situacaoNova("aberto", true, false)).toBe("resolvido");
    expect(situacaoNova("visto", false, false)).toBe("visto");
    expect(situacaoNova(null, false, false)).toBe("aberto");
  });
});

describe("montar alertas", () => {
  it("desligado de 70 min terminado há mais de 10 min: resolvido, nota 65, WhatsApp, supervisor pela vaga", () => {
    const [a] = montarAlertas(entrada());
    expect(a).toMatchObject({ chave: `desligado|1|${D}|36000`, placa: "EGC2985", supervisor: "Junior Pereira", situacao: "resolvido", nota: 65, destino: "whatsapp", contagem: 1, resolvido_em: "2026-10-07T15:00:00.000Z" });
  });
  it("ainda acontecendo (fim = agora): aberto", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60 }));
    expect(a.situacao).toBe("aberto");
    expect(a.resolvido_em).toBeNull();
  });
  it("rodar de novo com o mesmo dado: mesma chave, contagem sobe, nada novo", () => {
    const um = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60 }));
    const dois = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(um[0].chave, "aberto", { contagem: 1 })] }));
    expect(dois.map((x) => x.chave)).toEqual(um.map((x) => x.chave));
    expect(dois[0].contagem).toBe(2);
  });
  it("saída tarde: 'não saiu' e depois 'saiu' caem na mesma chave", () => {
    const antes = montarAlertas(entrada({ excecoes: [exc({ regra: "saida_tarde", ini: 7 * H + 45 * 60, fim: null, ref: 7 * H + 45 * 60, detalhe: "não saiu do Pátio" })] }));
    const depois = montarAlertas(entrada({ excecoes: [exc({ regra: "saida_tarde", ini: 8 * H + 10 * 60, fim: null, ref: 7 * H + 45 * 60, detalhe: "saiu 08:10" })] }));
    expect(depois[0].chave).toBe(antes[0].chave);
  });
  it("resolvido pelo gestor não reabre e guarda a data de resolução", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(`desligado|1|${D}|36000`, "resolvido", { resolvido_em: "2026-10-07T14:30:00.000Z" })] }));
    expect(a.situacao).toBe("resolvido");
    expect(a.resolvido_em).toBe("2026-10-07T14:30:00.000Z");
  });
  it("silêncio do equipamento ainda valendo: silenciado; vencido: não", () => {
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: "1", regra: null, ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("silenciado");
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: "1", regra: null, ate: "2026-10-07T10:00:00.000Z" }] }))[0].situacao).toBe("aberto");
  });
  it("silêncio só da regra vale para todos os equipamentos; de outra regra não", () => {
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: null, regra: "desligado", ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("silenciado");
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: null, regra: "ocioso", ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("aberto");
  });
  it("regra desligada não gera alerta", () => {
    expect(montarAlertas(entrada({ regras: configCompleta([{ regra: "desligado", ativa: false }]) }))).toEqual([]);
  });
  it("veículo fora da lista (desmobilizado) não gera alerta", () => {
    expect(montarAlertas(entrada({ veiculos: [] }))).toEqual([]);
  });
  it("regime presumido tira 10 pontos e aparece nos motivos", () => {
    const [a] = montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", "ALTA PRESSÃO - GPS - 02", null)] }));
    expect(a.nota).toBe(55);
    expect(a.motivos.at(-1)?.texto).toBe("Regime presumido (ADM)");
  });
  it("dia fechado (agoraSeg null): tudo resolvido", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: null, excecoes: [exc({ regra: "saida_tarde", ini: 8 * H, fim: null, ref: 7 * H + 45 * 60 })] }));
    expect(a.situacao).toBe("resolvido");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/lib/dominio/alertas/montar.test.ts`
Expected: FAIL ("Cannot find module './montar'").

- [ ] **Step 3: Criar `src/lib/dominio/alertas/montar.ts`**

```ts
// Exceções do dia -> linhas da tabela `alertas` (tudo puro; o coletor só lê e grava).
// Sem duplicado: a chave usa o `ref` (estável) e o banco tem `chave unique`. Resolvido e silenciado não reabrem.
import type { Evento, Veiculo } from "../../tipos";
import type { Excecao, RegraExcecao } from "../excecoes";
import type { LinhaTablet } from "../gauss-dia";
import { regimeDoEquip } from "../regras-frota";
import { supervisorDaParada } from "../supervisor-vaga";
import type { ConfigRegra, Politica } from "./config";
import { familiasNoPeriodo, fracaoSemSinal, janelaDoAlerta, repeticoes, type HistoricoAlerta, type Situacao } from "./contexto";
import { destinoDaNota, excessoMin, notaDoAlerta, type Destino, type Motivo } from "./nota";

/** O coletor vê o motor a cada 10 min: só dá como terminado o que acabou há mais que isso. */
export const FOLGA_FIM_S = 600;

export interface Silencio {
  veiculo_id: string | null;
  regra: string | null;
  /** ISO */
  ate: string;
}
export interface LinhaAlerta {
  chave: string;
  regra: string;
  veiculo_id: string;
  placa: string;
  vaga: string;
  supervisor: string | null;
  dia: string;
  ini: number;
  fim: number | null;
  ref: number;
  local: string | null;
  detalhe: string;
  situacao: Situacao;
  nota: number;
  motivos: Motivo[];
  destino: Destino;
  contagem: number;
  resolvido_em: string | null;
  atualizado_em: string;
}
export interface EntradaMontar {
  dia: string;
  /** segundos do dia agora (hoje); null = dia fechado */
  agoraSeg: number | null;
  agoraIso: string;
  excecoes: Excecao[];
  veiculos: Veiculo[];
  tablet: (LinhaTablet & { placa: string })[];
  eventos: Evento[];
  /** alertas dos últimos 7 dias (inclui os de hoje já gravados) */
  historico: HistoricoAlerta[];
  silencios: Silencio[];
  regras: Record<RegraExcecao, ConfigRegra>;
  politica: Politica;
}

export const chaveDoAlerta = (x: Excecao, dia: string) => `${x.regra}|${x.veiculo}|${dia}|${x.ref}`;

export function situacaoNova(anterior: Situacao | null, terminou: boolean, silenciado: boolean): Situacao {
  if (anterior === "resolvido" || anterior === "silenciado") return anterior;
  if (silenciado) return "silenciado";
  if (terminou) return "resolvido";
  return anterior === "visto" ? "visto" : "aberto";
}

/** Instante (saída tarde, chegada cedo) só termina com o dia; o resto, quando o fim ficou para trás. */
const terminou = (x: Excecao, agoraSeg: number | null) => agoraSeg == null || (x.fim != null && x.fim < agoraSeg - FOLGA_FIM_S);

export function montarAlertas(x: EntradaMontar): LinhaAlerta[] {
  const porId = new Map(x.veiculos.map((v) => [v.id, v]));
  const anteriores = new Map(x.historico.map((h) => [h.chave, h]));
  const silenciado = (e: Excecao) =>
    x.silencios.some((s) => s.ate > x.agoraIso && (s.veiculo_id == null || s.veiculo_id === e.veiculo) && (s.regra == null || s.regra === e.regra));
  const out: LinhaAlerta[] = [];
  for (const e of x.excecoes) {
    const cfg = x.regras[e.regra];
    const v = porId.get(e.veiculo);
    if (!cfg?.ativa || !v?.equip) continue;
    const chave = chaveDoAlerta(e, x.dia);
    const ant = anteriores.get(chave) ?? null;
    const j = janelaDoAlerta(e);
    const { nota, motivos } = notaDoAlerta(cfg, {
      excessoMin: excessoMin(e, x.agoraSeg),
      repeticoes: repeticoes(x.historico, e.regra, v.vaga, x.dia, chave),
      familias: familiasNoPeriodo(x.tablet, v.placa, x.dia, j),
      fracaoSemSinal: fracaoSemSinal(x.eventos, v.id, x.dia, j),
      presumido: regimeDoEquip(v.equip.regime, v.vaga).presumido,
    });
    const situacao = situacaoNova(ant?.situacao ?? null, terminou(e, x.agoraSeg), silenciado(e));
    out.push({
      chave,
      regra: e.regra,
      veiculo_id: v.id,
      placa: v.placa,
      vaga: v.vaga,
      // o supervisor é da vaga em que o caminhão estava, não da placa
      supervisor: supervisorDaParada(v.equip.tipo, v.vaga || undefined, x.dia, e.ini, v.equip.supervisor ?? null),
      dia: x.dia,
      ini: e.ini,
      fim: e.fim,
      ref: e.ref,
      local: e.local,
      detalhe: e.detalhe,
      situacao,
      nota,
      motivos,
      destino: destinoDaNota(nota, x.politica),
      contagem: (ant?.contagem ?? 0) + 1,
      resolvido_em: ant?.resolvido_em ?? (situacao === "resolvido" ? x.agoraIso : null),
      atualizado_em: x.agoraIso,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/lib/dominio/alertas`
Expected: PASS. Se o teste "supervisor pela vaga" falhar, conferir em `supervisor-vaga.ts` que "ALTA PRESSÃO - GPS - 02" devolve "Junior Pereira" (AP 02 → Junior Pereira).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dominio/alertas/montar.ts src/lib/dominio/alertas/montar.test.ts
git commit -m "Alertas: montagem com chave estável, situação e silêncio (P-026)"
```

---

### Task 5: Detector no coletor

**Files:**
- Create: `coletor/alertas.ts`
- Test: `coletor/alertas.test.ts`
- Modify: `coletor/run.ts` (import + bloco no `main`, logo depois do bloco "paradas ao vivo")

**Interfaces:**
- Consumes: `excecoesDoDia`, `EntradaExcecoes` (`../src/lib/dominio/excecoes`), `montarAlertas`, `LinhaAlerta`, `Silencio` (Task 4), `configCompleta`, `politicaCompleta`, `ConfigRegra`, `Politica` (Task 2), `HistoricoAlerta` (Task 3), `diaMenos` (`../src/lib/dominio/analise`), `diaLocal` (`../src/lib/dominio/formato`), `db`, `ok`, `kvGet`, `kvSet` (`./supabase`).
- Produces: `interface DepsAlertas`, `INTERVALO_ALERTAS_MS = 10 * 60 * 1000`, `deveRodar(ultima: string | null, agora: Date): boolean`, `detectarAlertas(deps: DepsAlertas, veiculos: Veiculo[], agora: Date): Promise<string | null>`, `depsAlertasReais(): DepsAlertas`.

- [ ] **Step 1: Testes (falham)** — criar `coletor/alertas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../src/lib/tipos";
import type { LinhaAlerta } from "../src/lib/dominio/alertas/montar";
import { deveRodar, detectarAlertas, type DepsAlertas } from "./alertas";

const D = "2026-10-07";
const ev = (tipo: string, dia: string, hora: string, area: string) => ({ id: "1", tipo, t: `${dia}T${hora}:00-03:00`, area, placa: "", vaga: "" }) as unknown as Evento;
const VEIC = [{ id: "1", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", equip: { tipo: "ap", nome: "EGC2985", ordem: 1, regime: "ADM", status: "ATIVO" } }] as unknown as Veiculo[];
// ADM: limite de saída 07:45; saiu 08:10 -> saída tarde
const EVENTOS = [ev("abertura", "2026-10-06", "00:05", "PÁTIO DO TRANSPORTE RODOVIÁRIO"), ev("saida", D, "08:10", "PÁTIO DO TRANSPORTE RODOVIÁRIO")];

function falso(o: Partial<DepsAlertas> = {}) {
  const banco = new Map<string, LinhaAlerta>();
  let ultima: string | null = null;
  const fechados: string[] = [];
  const deps: DepsAlertas = {
    ultimaExecucao: async () => ultima,
    marcarExecucao: async (iso) => void (ultima = iso),
    lerEntrada: async () => ({ eventos: EVENTOS, motor: [], tablet: [] }),
    lerConfig: async () => ({ regras: [], politica: null }),
    lerHistorico: async () => [...banco.values()].map((l) => ({ chave: l.chave, regra: l.regra, vaga: l.vaga, dia: l.dia, situacao: l.situacao, resolvido_em: l.resolvido_em, contagem: l.contagem })),
    lerSilencios: async () => [],
    gravar: async (linhas) => linhas.forEach((l) => banco.set(l.chave, l)),
    fecharDiasAnteriores: async (hoje) => void fechados.push(hoje),
    ...o,
  };
  return { deps, banco, fechados };
}
const agora = new Date(`${D}T09:00:00-03:00`);

describe("intervalo de 10 min", () => {
  it("roda na primeira vez e depois de 10 min; não antes", () => {
    expect(deveRodar(null, agora)).toBe(true);
    expect(deveRodar(new Date(agora.getTime() - 9 * 60000).toISOString(), agora)).toBe(false);
    expect(deveRodar(new Date(agora.getTime() - 10 * 60000).toISOString(), agora)).toBe(true);
  });
});

describe("detector", () => {
  it("grava a saída tarde com nota e fecha os dias anteriores", async () => {
    const { deps, banco, fechados } = falso();
    const r = await detectarAlertas(deps, VEIC, agora);
    expect(r).toBe("1 alerta(s), 1 novo(s) para WhatsApp");
    const [a] = [...banco.values()];
    expect(a).toMatchObject({ regra: "saida_tarde", nota: 65, destino: "whatsapp", situacao: "aberto" });
    expect(fechados).toEqual([D]);
  });
  it("rodar 2 vezes não duplica (mesma chave, contagem 2)", async () => {
    const { deps, banco } = falso();
    await detectarAlertas(deps, VEIC, agora);
    await detectarAlertas(deps, VEIC, new Date(agora.getTime() + 10 * 60000));
    expect(banco.size).toBe(1);
    expect([...banco.values()][0].contagem).toBe(2);
  });
  it("antes de 10 min não faz nada", async () => {
    const { deps, banco } = falso();
    await detectarAlertas(deps, VEIC, agora);
    expect(await detectarAlertas(deps, VEIC, new Date(agora.getTime() + 60000))).toBeNull();
    expect([...banco.values()][0].contagem).toBe(1);
  });
  it("tabela não criada: o erro sobe (o run.ts transforma em aviso) e não marca a execução", async () => {
    const { deps } = falso({ lerConfig: async () => { throw new Error('relation "public.alerta_regra" does not exist'); } });
    await expect(detectarAlertas(deps, VEIC, agora)).rejects.toThrow(/alerta_regra/);
    expect(await deps.ultimaExecucao()).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run coletor/alertas.test.ts`
Expected: FAIL ("Cannot find module './alertas'").

- [ ] **Step 3: Criar `coletor/alertas.ts`**

```ts
// Detector de alertas (P-026): a cada 10 min, as Exceções do dia viram linhas em `alertas`, com nota e destino.
// Só lê e grava no Supabase (nada no GAUSS). Regras puras em src/lib/dominio/alertas/.
// Desenho: docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md
import type { Evento, Veiculo } from "../src/lib/tipos";
import { configCompleta, politicaCompleta, type ConfigRegra, type Politica } from "../src/lib/dominio/alertas/config";
import type { HistoricoAlerta } from "../src/lib/dominio/alertas/contexto";
import { montarAlertas, type LinhaAlerta, type Silencio } from "../src/lib/dominio/alertas/montar";
import { diaMenos } from "../src/lib/dominio/analise";
import type { LinhaMotorFrota } from "../src/lib/dominio/dia-frota";
import { excecoesDoDia } from "../src/lib/dominio/excecoes";
import { diaLocal } from "../src/lib/dominio/formato";
import type { LinhaTablet } from "../src/lib/dominio/gauss-dia";
import { db, kvGet, kvSet, ok } from "./supabase";

export const INTERVALO_ALERTAS_MS = 10 * 60 * 1000;
const PAGINA = 1000;
const MAX_LINHAS = 20000;

export interface DepsAlertas {
  ultimaExecucao(): Promise<string | null>;
  marcarExecucao(iso: string): Promise<void>;
  lerEntrada(vespera: string, dia: string): Promise<{ eventos: Evento[]; motor: LinhaMotorFrota[]; tablet: (LinhaTablet & { placa: string })[] }>;
  lerConfig(): Promise<{ regras: Partial<ConfigRegra>[]; politica: Partial<Politica> | null }>;
  lerHistorico(desde: string): Promise<HistoricoAlerta[]>;
  lerSilencios(): Promise<Silencio[]>;
  gravar(linhas: LinhaAlerta[]): Promise<void>;
  /** aberto/visto de dias anteriores vira resolvido; apaga alertas e envios com mais de 90 dias */
  fecharDiasAnteriores(hoje: string): Promise<void>;
}

export const deveRodar = (ultima: string | null, agora: Date) => ultima == null || agora.getTime() - Date.parse(ultima) >= INTERVALO_ALERTAS_MS;

export async function detectarAlertas(deps: DepsAlertas, veiculos: Veiculo[], agora: Date): Promise<string | null> {
  if (!deveRodar(await deps.ultimaExecucao(), agora)) return null;
  const dia = diaLocal(agora);
  const vespera = diaMenos(dia, 1);
  const [cfg, entrada, historico, silencios] = await Promise.all([deps.lerConfig(), deps.lerEntrada(vespera, dia), deps.lerHistorico(diaMenos(dia, 7)), deps.lerSilencios()]);
  const agoraSeg = Math.floor((agora.getTime() - Date.parse(`${dia}T00:00:00-03:00`)) / 1000);
  const excecoes = excecoesDoDia({ dia, agoraSeg, veiculos, ...entrada });
  const politica = politicaCompleta(cfg.politica);
  const linhas = montarAlertas({ dia, agoraSeg, agoraIso: agora.toISOString(), excecoes, veiculos, ...entrada, historico, silencios, regras: configCompleta(cfg.regras), politica });
  if (linhas.length) await deps.gravar(linhas);
  await deps.fecharDiasAnteriores(dia);
  // marca só no fim: se algo falhou, o próximo ciclo tenta de novo
  await deps.marcarExecucao(agora.toISOString());
  const conhecidas = new Set(historico.map((h) => h.chave));
  const novosWhats = linhas.filter((l) => !conhecidas.has(l.chave) && l.destino === "whatsapp").length;
  return `${linhas.length} alerta(s), ${novosWhats} novo(s) para WhatsApp`;
}

async function paginar<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(consulta(de, de + PAGINA - 1))) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

export function depsAlertasReais(): DepsAlertas {
  return {
    ultimaExecucao: async () => (await kvGet<{ em: string }>("alertas"))?.em ?? null,
    marcarExecucao: async (em) => void (await kvSet("alertas", { em })),
    async lerEntrada(vespera, dia) {
      const ate = diaMenos(dia, -1);
      const [ev, motor, tablet] = await Promise.all([
        // id desempata eventos do mesmo instante: as páginas não repetem nem pulam linhas
        paginar<{ dados: Evento }>((de, a) => db().from("loc_eventos").select("dados").in("dia", [vespera, dia]).order("t").order("id").range(de, a)),
        paginar<LinhaMotorFrota>((de, a) => db().from("timeline_motor_vaga").select("placa_ou_codigo, inicio, fim, status, status_label").lt("inicio", ate).gt("fim", vespera).order("id").range(de, a)),
        paginar<LinhaTablet & { placa: string }>((de, a) =>
          db().from("demoras_categorizadas").select("placa, demora_cod, inicio, fim, categoria_demora, motorista, concluido").lt("inicio", ate).or(`fim.is.null,fim.gt.${vespera}`).order("inicio").order("demora_cod").range(de, a),
        ),
      ]);
      return { eventos: ev.map((l) => l.dados), motor, tablet };
    },
    async lerConfig() {
      const [regras, politica] = await Promise.all([
        ok(db().from("alerta_regra").select("regra, ativa, peso, faixas, justificativas, espera_min, lembrete_min, escalar_min")),
        ok(db().from("alerta_politica").select("corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora").eq("id", 1).maybeSingle()),
      ]);
      return { regras: (regras ?? []) as Partial<ConfigRegra>[], politica: politica as Partial<Politica> | null };
    },
    lerHistorico: (desde) => paginar<HistoricoAlerta>((de, a) => db().from("alertas").select("chave, regra, vaga, dia, situacao, resolvido_em, contagem").gte("dia", desde).order("id").range(de, a)),
    lerSilencios: async () => ((await ok(db().from("alerta_silencio").select("veiculo_id, regra, ate").gt("ate", new Date().toISOString()))) ?? []) as Silencio[],
    async gravar(linhas) {
      // on conflict (chave): só atualiza; detectado_em, visto_* e avaliacao (não enviados) ficam como estão
      for (let i = 0; i < linhas.length; i += 500) await ok(db().from("alertas").upsert(linhas.slice(i, i + 500), { onConflict: "chave" }));
    },
    async fecharDiasAnteriores(hoje) {
      await ok(db().from("alertas").update({ situacao: "resolvido", resolvido_em: new Date().toISOString() }).lt("dia", hoje).in("situacao", ["aberto", "visto"]));
      await ok(db().from("alertas").delete().lt("dia", diaMenos(hoje, 90)));
      await ok(db().from("alerta_envios").delete().lt("criado_em", new Date(Date.now() - 90 * 86400000).toISOString()));
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run coletor/alertas.test.ts`
Expected: PASS. Se o 1º teste der nota diferente de 65: a saída é 08:10 com limite 07:45 = 25 min → 35 + 30 = 65; conferir que `agoraSeg` não está entrando no cálculo do "saiu".

- [ ] **Step 5: Ligar no `coletor/run.ts`**

Junto dos outros imports locais (depois de `import { coletarMotor } from "./motor-vaga";`):
```ts
import { depsAlertasReais, detectarAlertas } from "./alertas";
```
No `main`, logo depois do bloco `// paradas de hoje a cada 10 min ...` (o `try/catch` de `paradasAoVivo`):
```ts
    // alertas (P-026): exceções do dia com nota, a cada 10 min; falha aqui (ex.: SQL ainda não rodado) não derruba o ciclo
    try {
      const a = await detectarAlertas(depsAlertasReais(), frota.veiculos, agora);
      if (a) console.log(`✅ alertas: ${a}`);
    } catch (e) {
      console.warn(`⚠ alertas: ${e instanceof Error ? e.message : String(e)}`);
    }
```

- [ ] **Step 6: Verificação completa**

Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo verde (zero falhas, zero erros de tipo, zero erros de lint).

- [ ] **Step 7: Commit**

```bash
git add coletor/alertas.ts coletor/alertas.test.ts coletor/run.ts
git commit -m "Alertas: detector no coletor a cada 10 min (P-026)"
```

---

### Task 6: Documentação e entrega ao dono

**Files:**
- Modify: `README.md` (nova regra numerada depois da 13, "Exceções do dia")
- Modify: `CHANGELOG.md` (entrada do dia, no formato das existentes)

- [ ] **Step 1: README** — acrescentar depois do item 13:

```markdown
14. **Alertas guardados** (P-026, 15/10/2026; desenho em `docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md`): a cada 10 min o coletor (`coletor/alertas.ts`) transforma as Exceções do dia em linhas da tabela `alertas` (`supabase/alertas.sql`), **uma por ocorrência** (chave `regra|veículo|dia|ref`, única no banco: rodar de novo não duplica). Cada alerta tem **nota 0–100** com os motivos (peso da regra, faixa de quanto passou, repetição na vaga em 7 dias, justificativa no tablet, sem sinal, regime presumido) e o **destino** pelos cortes (60+ WhatsApp, 30+ resumo, abaixo só tela; 85+ também o coordenador). Resolvido e silenciado não reabrem; aberto de dias anteriores fecha sozinho; 90 dias de histórico. Regras puras em `src/lib/dominio/alertas/`; configuração no banco (`alerta_regra`, `alerta_politica`). Tela de gestão e envio pelo WhatsApp: próximas etapas.
```

- [ ] **Step 2: CHANGELOG** — abrir `CHANGELOG.md`, copiar o formato da entrada mais recente e acrescentar a de 15/10/2026: "Alertas guardados com nota (etapa 1 do P-026): tabelas `alerta_*`, regras puras em `src/lib/dominio/alertas/`, detector no coletor."

- [ ] **Step 3: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "Alertas: documentação da etapa 1 (P-026)"
```

- [ ] **Step 4: Entrega ao dono (sem publicar)** — a branch fica só local até o dono aprovar. Passar ao dono:
  1. Rodar `supabase/alertas.sql` no Supabase **PRODUTIVIDADE** (link clicável com caminho absoluto, espaços como `%20`).
  2. Conferir o resultado: `regras = 10`, `politica = 1`.
  3. Publicar (juntar a branch `alertas-whatsapp` ao `main`) só com o "pode publicar" do dono, seguindo a habilidade `checklist-publicar` — e combinando com o chat que cuida do Monitoramento.
```

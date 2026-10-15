# Alertas da frota — Etapa 2 (tela de gestão) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela nova **Gestão de alertas** (`/gestao-alertas`) no Monitoramento: fila com nota e "por quê", ações (visto, resolver, silenciar, avaliar), histórico de 90 dias, filtro inteligente editável com simulador e sugestões, destinatários e saúde — ações e telefones só com login.

**Architecture:** Página estática do Next (como as outras) que lê e grava no Supabase com um cliente próprio que guarda a sessão (Supabase Auth, e-mail e senha). As contas são para o simulador e as sugestões são funções puras com testes (`src/lib/dominio/alertas/gestao.ts`); o simulador recalcula a nota com o `contexto` que o detector passa a gravar em cada alerta. Permissões no banco: leitura pública dos alertas; escrita e telefones só `authenticated`, por colunas.

**Tech Stack:** Next 15 (export estático), React, Tailwind, supabase-js 2.117.1 (Auth), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md` (seções 6, 7A e 9). Etapa 1 já feita (plano `2026-10-15-alertas-etapa1-deteccao.md`).

## Global Constraints

- Worktree `C:\Users\Meu Computador\Desktop\Projetos\SGE\_worktrees\monit-alertas`, branch `alertas-whatsapp`. Nada de publicar.
- O SQL **ainda não foi rodado** pelo dono: mudanças de banco vão no próprio `supabase/alertas.sql` (um arquivo só para ele rodar).
- Tela nova `/gestao-alertas`, rótulo "Gestão de alertas", curto "Gestão", ícone `opcoes`, na categoria **Ao vivo** depois de Alertas.
- Ver a fila, o histórico e o filtro: sem login. Ações, salvar o filtro, destinatários e fila de envio: **só com login**.
- **Cadastro aberto tem de ficar desligado** no Supabase (Authentication → Sign In / Providers → "Allow new users to sign up" desligado); senão qualquer pessoa cria conta e ganha a gestão. O dono cria os usuários à mão.
- Abas: Fila · Histórico · Filtro inteligente · Destinatários · Saúde.
- "Nada muda sozinho": sugestões só sugerem.
- Textos de tela simples, em português, como no resto do sistema.
- Verificação: `npm test`, `npm run typecheck`, `npm run lint`, e o e2e da tela (`npx playwright test e2e/gestao-alertas.spec.ts`, com build de CI: `NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci npm run build`).

## Review Focus

- Sem login, nenhum botão de ação pode gravar (o e2e confere zero gravações).
- Telefone digitado com espaços, parênteses, traço ou sem o 55: tem de virar só dígitos com 55; inválido não grava — teste na Task 2.
- Alerta sem `contexto` (gravado antes desta etapa) no simulador: conta igual antes e depois, sem quebrar — teste na Task 2.
- Tabelas ainda não criadas: a tela mostra o aviso "rode o SQL", não uma página quebrada — coberto pelo tratamento de erro da Task 4.
- Silenciar pede motivo (2 a 200 letras, como o banco exige); vazio não grava — validado na Task 4.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `supabase/alertas.sql` (mudar) | coluna `contexto`, permissões de gestão por coluna |
| `src/lib/dominio/alertas/montar.ts` (mudar) | `LinhaAlerta.contexto` |
| `src/lib/dominio/alertas/gestao.ts` (criar) | `AlertaGravado`, `simular`, `sugestoes`, `normalizarTelefone` |
| `src/lib/supabase/sessao.ts` (criar) | cliente com sessão + `useSessao` |
| `src/lib/dados/alertas.ts` (criar) | leituras/gravações da gestão + `useGestaoDados` |
| `src/lib/menu.ts` (mudar) | item e categoria |
| `src/app/gestao-alertas/page.tsx` + `_componentes/*.tsx` (criar) | a tela |
| `e2e/apoio.ts` (mudar), `e2e/gestao-alertas.spec.ts` (criar) | teste de ponta a ponta |

---

### Task 1: Banco — contexto e permissões de gestão

**Files:**
- Modify: `supabase/alertas.sql`

**Interfaces:**
- Produces: coluna `alertas.contexto jsonb`; `authenticated` pode: atualizar em `alertas` só `situacao, visto_por, visto_em, resolvido_em, resolvido_por, avaliacao`; atualizar `alerta_regra` (`ativa, peso, faixas, justificativas, lembrete_min, escalar_min, atualizado_em`) e `alerta_politica` (`corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora, atualizado_em`); inserir/apagar `alerta_silencio`; tudo em `alerta_destino`; ler `alerta_envios`.

- [ ] **Step 1:** Em `create table if not exists public.alertas`, depois de `motivos jsonb ...`, acrescentar:
```sql
  contexto jsonb,                   -- o que entrou na nota (o simulador recalcula com outra configuração)
```
e logo depois do `alter table public.alertas add column if not exists resolvido_por ...`:
```sql
alter table public.alertas add column if not exists contexto jsonb;
```

- [ ] **Step 2:** Trocar a linha
```sql
revoke all on public.alerta_destino, public.alerta_envios from anon, authenticated;
```
por
```sql
revoke all on public.alerta_destino, public.alerta_envios from anon;
```

- [ ] **Step 3:** Antes do bloco "-- Padrões (spec 7A)", acrescentar:
```sql
-- Gestão (tela /gestao-alertas): só quem entrou com e-mail e senha. O cadastro aberto fica DESLIGADO no painel do
-- Supabase (Authentication -> Sign In / Providers -> "Allow new users to sign up"): os usuários são criados à mão.
-- O Supabase dá todas as permissões às tabelas novas; aqui elas são tiradas e devolvidas só por coluna.
revoke insert, update, delete on public.alertas, public.alerta_regra, public.alerta_politica, public.alerta_silencio from anon, authenticated;
grant update (situacao, visto_por, visto_em, resolvido_em, resolvido_por, avaliacao) on public.alertas to authenticated;
grant update (ativa, peso, faixas, justificativas, lembrete_min, escalar_min, atualizado_em) on public.alerta_regra to authenticated;
grant update (corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora, atualizado_em) on public.alerta_politica to authenticated;
grant insert, delete on public.alerta_silencio to authenticated;
grant select, insert, update, delete on public.alerta_destino to authenticated;
grant select on public.alerta_envios to authenticated;

drop policy if exists alertas_gerir on public.alertas;
create policy alertas_gerir on public.alertas for update to authenticated using (true) with check (true);
drop policy if exists alerta_regra_gerir on public.alerta_regra;
create policy alerta_regra_gerir on public.alerta_regra for update to authenticated using (true) with check (true);
drop policy if exists alerta_politica_gerir on public.alerta_politica;
create policy alerta_politica_gerir on public.alerta_politica for update to authenticated using (true) with check (true);
drop policy if exists alerta_silencio_criar on public.alerta_silencio;
create policy alerta_silencio_criar on public.alerta_silencio for insert to authenticated with check (true);
drop policy if exists alerta_silencio_apagar on public.alerta_silencio;
create policy alerta_silencio_apagar on public.alerta_silencio for delete to authenticated using (true);
drop policy if exists alerta_destino_gerir on public.alerta_destino;
create policy alerta_destino_gerir on public.alerta_destino for all to authenticated using (true) with check (true);
drop policy if exists alerta_envios_ler on public.alerta_envios;
create policy alerta_envios_ler on public.alerta_envios for select to authenticated using (true);
```

- [ ] **Step 4: Commit**
```bash
git add supabase/alertas.sql
git commit -m "Alertas: contexto da nota e permissões da gestão (P-026)"
```

---

### Task 2: Contexto gravado + contas da gestão (simulador, sugestões, telefone)

**Files:**
- Modify: `src/lib/dominio/alertas/montar.ts`, `src/lib/dominio/alertas/montar.test.ts`
- Create: `src/lib/dominio/alertas/gestao.ts`, `src/lib/dominio/alertas/gestao.test.ts`

**Interfaces:**
- Consumes: `notaDoAlerta`, `destinoDaNota`, `ContextoNota`, `Destino` (nota.ts); `ConfigRegra`, `Politica` (config.ts); `LinhaAlerta` (montar.ts); `ROTULO_REGRA`, `RegraExcecao` (excecoes.ts); `diaMenos` (analise.ts).
- Produces:
  - `LinhaAlerta.contexto: ContextoNota`.
  - `gestao.ts`: `type Avaliacao = "problema" | "nao_era_problema"`; `interface AlertaGravado extends Omit<LinhaAlerta, "contexto"> { id: number; contexto: ContextoNota | null; avaliacao: Avaliacao | null; visto_por: string | null; visto_em: string | null; ultimo_aviso_em: string | null; detectado_em: string }`; `interface Simulacao { total: number; antes: Record<Destino, number>; depois: Record<Destino, number>; mudaram: number; porRegra: { regra: string; antes: number; depois: number }[] }` (porRegra = WhatsApp antes/depois, só regras com algum); `simular(alertas: AlertaGravado[], regras: Record<RegraExcecao, ConfigRegra>, p: Politica): Simulacao`; `interface Sugestao { regra: RegraExcecao; avaliados: number; fracao: number; texto: string }`; `sugestoes(alertas: AlertaGravado[], hoje: string): Sugestao[]`; `normalizarTelefone(s: string): string | null`; constantes `SUGESTAO_MIN = 10`, `SUGESTAO_FRACAO = 0.6`.

- [ ] **Step 1: Testes (falham)**

Acrescentar em `src/lib/dominio/alertas/montar.test.ts`, dentro do `describe("montar alertas", ...)`:
```ts
  it("grava o contexto da nota (o simulador recalcula com ele)", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 13 * H }));
    expect(a.contexto).toEqual({ excessoMin: 70, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false });
  });
```
Criar `src/lib/dominio/alertas/gestao.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import { normalizarTelefone, simular, sugestoes, type AlertaGravado } from "./gestao";

const D = "2026-10-07";
const al = (o: Partial<AlertaGravado> = {}): AlertaGravado => ({
  id: 1, chave: "k", regra: "saida_tarde", veiculo_id: "1", placa: "EGC2985", vaga: "AP-02", supervisor: null, dia: D, ini: 0, fim: null, ref: 0, local: null, detalhe: "",
  situacao: "aberto", nota: 65, motivos: [], destino: "whatsapp", contagem: 1, resolvido_em: null, resolvido_por: null, atualizado_em: "", avaliacao: null, visto_por: null,
  visto_em: null, ultimo_aviso_em: null, detectado_em: "", contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

describe("simulador", () => {
  it("mesma configuração: nada muda", () => {
    const s = simular([al(), al({ id: 2, regra: "ocioso", nota: 30, destino: "resumo", contexto: { excessoMin: 40, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false } })], REGRAS_PADRAO, POLITICA_PADRAO);
    expect(s).toMatchObject({ total: 2, mudaram: 0, antes: { whatsapp: 1, resumo: 1, tela: 0 }, depois: { whatsapp: 1, resumo: 1, tela: 0 } });
  });
  it("peso menor na saída tarde: sai do WhatsApp para o resumo", () => {
    const s = simular([al()], configCompleta([{ regra: "saida_tarde", peso: 5 }]), POLITICA_PADRAO);
    expect(s.depois).toEqual({ whatsapp: 0, resumo: 1, tela: 0 });
    expect(s.mudaram).toBe(1);
    expect(s.porRegra).toEqual([{ regra: "saida_tarde", antes: 1, depois: 0 }]);
  });
  it("corte do WhatsApp mais alto", () => expect(simular([al()], REGRAS_PADRAO, { ...POLITICA_PADRAO, corte_whatsapp: 70 }).depois.whatsapp).toBe(0));
  it("regra desligada: vai para 'só tela'", () => expect(simular([al()], configCompleta([{ regra: "saida_tarde", ativa: false }]), POLITICA_PADRAO).depois.tela).toBe(1));
  it("alerta antigo sem contexto: igual antes e depois", () => {
    const s = simular([al({ contexto: null })], configCompleta([{ regra: "saida_tarde", peso: 5 }]), POLITICA_PADRAO);
    expect(s.depois.whatsapp).toBe(1);
    expect(s.mudaram).toBe(0);
  });
});

describe("sugestões", () => {
  const avaliados = (n: number, nao: number, regra = "ocioso") =>
    Array.from({ length: n }, (_, i) => al({ id: i, regra, avaliacao: i < nao ? "nao_era_problema" : "problema" }));
  it("10 avaliações com 60% 'não era problema': sugere", () => {
    const [s] = sugestoes(avaliados(10, 6), D);
    expect(s).toMatchObject({ regra: "ocioso", avaliados: 10, fracao: 0.6 });
    expect(s.texto).toMatch(/60% dos alertas de "Ociosidade"/);
  });
  it("menos de 10 avaliações ou menos de 60%: não sugere", () => {
    expect(sugestoes(avaliados(9, 9), D)).toEqual([]);
    expect(sugestoes(avaliados(10, 5), D)).toEqual([]);
  });
  it("avaliações com mais de 30 dias não contam", () => {
    expect(sugestoes(avaliados(10, 10).map((a) => ({ ...a, dia: "2026-09-01" })), D)).toEqual([]);
  });
});

describe("telefone", () => {
  it("só dígitos, com 55", () => {
    expect(normalizarTelefone("(31) 98888-7777")).toBe("5531988887777");
    expect(normalizarTelefone("+55 31 3333-4444")).toBe("553133334444");
    expect(normalizarTelefone("5531988887777")).toBe("5531988887777");
  });
  it("inválido: null", () => {
    expect(normalizarTelefone("9888-7777")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**
Run: `npx vitest run src/lib/dominio/alertas`
Expected: FAIL (`contexto` undefined; "Cannot find module './gestao'").

- [ ] **Step 3: `contexto` no `montar.ts`**

Em `LinhaAlerta`, depois de `motivos: Motivo[];`:
```ts
  /** o que entrou na nota: o simulador da tela recalcula com outra configuração */
  contexto: ContextoNota;
```
Trocar o import de `./nota` por:
```ts
import { destinoDaNota, excessoMin, notaDoAlerta, type ContextoNota, type Destino, type Motivo } from "./nota";
```
No laço de `montarAlertas`, trocar o bloco `const { nota, motivos } = notaDoAlerta(cfg, { ... });` por:
```ts
    const contexto: ContextoNota = {
      excessoMin: excessoMin(e, x.agoraSeg),
      repeticoes: repeticoes(x.historico, e.regra, v.vaga, x.dia, chave, e.ref),
      familias: familiasNoPeriodo(x.tablet, v.placa, x.dia, j),
      fracaoSemSinal: fracaoSemSinal(x.eventos, v.id, x.dia, j),
      presumido: regimeDoEquip(v.equip.regime, v.vaga).presumido,
    };
    const { nota, motivos } = notaDoAlerta(cfg, contexto);
```
e no objeto empurrado em `out`, depois de `motivos,`: `contexto,`.

- [ ] **Step 4: Criar `src/lib/dominio/alertas/gestao.ts`**
```ts
// Contas da tela de gestão dos alertas (spec, seções 7A e 9): simulador, sugestões e telefone. Tudo puro.
import { diaMenos } from "../analise";
import { ROTULO_REGRA, type RegraExcecao } from "../excecoes";
import type { ConfigRegra, Politica } from "./config";
import type { LinhaAlerta } from "./montar";
import { destinoDaNota, notaDoAlerta, type ContextoNota, type Destino } from "./nota";

export type Avaliacao = "problema" | "nao_era_problema";
/** Linha da tabela `alertas` como a tela lê. */
export interface AlertaGravado extends Omit<LinhaAlerta, "contexto"> {
  id: number;
  /** null em alerta gravado antes da etapa 2 */
  contexto: ContextoNota | null;
  avaliacao: Avaliacao | null;
  visto_por: string | null;
  visto_em: string | null;
  ultimo_aviso_em: string | null;
  detectado_em: string;
}

export interface Simulacao {
  total: number;
  antes: Record<Destino, number>;
  depois: Record<Destino, number>;
  /** quantos mudariam de destino */
  mudaram: number;
  /** mensagens de WhatsApp por regra, antes e depois (só regras com alguma) */
  porRegra: { regra: string; antes: number; depois: number }[];
}

const zero = (): Record<Destino, number> => ({ whatsapp: 0, resumo: 0, tela: 0 });

/** Destino de cada alerta com outra configuração (regra desligada = só tela; sem contexto = fica como está). */
export function simular(alertas: AlertaGravado[], regras: Record<RegraExcecao, ConfigRegra>, p: Politica): Simulacao {
  const antes = zero();
  const depois = zero();
  const porRegra = new Map<string, { antes: number; depois: number }>();
  let mudaram = 0;
  for (const a of alertas) {
    const cfg = regras[a.regra as RegraExcecao];
    const novo: Destino = !a.contexto || !cfg ? a.destino : !cfg.ativa ? "tela" : destinoDaNota(notaDoAlerta(cfg, a.contexto).nota, p);
    antes[a.destino]++;
    depois[novo]++;
    if (novo !== a.destino) mudaram++;
    const r = porRegra.get(a.regra) ?? { antes: 0, depois: 0 };
    if (a.destino === "whatsapp") r.antes++;
    if (novo === "whatsapp") r.depois++;
    porRegra.set(a.regra, r);
  }
  return {
    total: alertas.length,
    antes,
    depois,
    mudaram,
    porRegra: [...porRegra].filter(([, r]) => r.antes || r.depois).map(([regra, r]) => ({ regra, ...r })),
  };
}

export const SUGESTAO_MIN = 10;
export const SUGESTAO_FRACAO = 0.6;
export interface Sugestao {
  regra: RegraExcecao;
  avaliados: number;
  fracao: number;
  texto: string;
}

/** Regras em que a maioria das avaliações dos últimos 30 dias foi "não era problema". Só sugere; quem muda é o gestor. */
export function sugestoes(alertas: AlertaGravado[], hoje: string): Sugestao[] {
  const desde = diaMenos(hoje, 29);
  const porRegra = new Map<RegraExcecao, { n: number; nao: number }>();
  for (const a of alertas) {
    if (!a.avaliacao || a.dia < desde) continue;
    const r = porRegra.get(a.regra as RegraExcecao) ?? { n: 0, nao: 0 };
    r.n++;
    if (a.avaliacao === "nao_era_problema") r.nao++;
    porRegra.set(a.regra as RegraExcecao, r);
  }
  return [...porRegra]
    .filter(([, r]) => r.n >= SUGESTAO_MIN && r.nao / r.n >= SUGESTAO_FRACAO)
    .map(([regra, r]) => {
      const fracao = r.nao / r.n;
      return {
        regra,
        avaliados: r.n,
        fracao,
        texto: `${Math.round(fracao * 100)}% dos alertas de "${ROTULO_REGRA[regra]}" foram marcados como "não era problema" (${r.n} avaliados em 30 dias). Que tal diminuir o peso (vai só para o resumo) ou subir a faixa?`,
      };
    });
}

/** Telefone para o WhatsApp: só dígitos, com 55 na frente (DDD + 8 ou 9 dígitos). Inválido: null. */
export function normalizarTelefone(s: string): string | null {
  const d = s.replace(/\D/g, "");
  const com55 = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^55\d{10,11}$/.test(com55) ? com55 : null;
}
```

- [ ] **Step 5: Rodar e ver passar**
Run: `npx vitest run src/lib/dominio/alertas coletor/alertas.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/dominio/alertas/
git commit -m "Alertas: contexto gravado, simulador, sugestões e telefone (P-026)"
```

---

### Task 3: Sessão, dados da gestão e menu

**Files:**
- Create: `src/lib/supabase/sessao.ts`, `src/lib/dados/alertas.ts`
- Modify: `src/lib/menu.ts`, `src/lib/menu.test.ts`

**Interfaces:**
- Consumes: `AlertaGravado`, `Avaliacao` (Task 2); `configCompleta`, `politicaCompleta`, `ConfigRegra`, `Politica`; `ok` (`../supabase/cliente`); `diaMenos`.
- Produces:
  - `sessao.ts`: `dbLogado(): SupabaseClient`; `interface Sessao { email: string | null; carregando: boolean; entrar(email: string, senha: string): Promise<string | null>; sair(): Promise<void> }`; `useSessao(): Sessao`.
  - `dados/alertas.ts`: `interface ConfigGestao { regras: Record<RegraExcecao, ConfigRegra>; politica: Politica }`; `interface Destinatario { id?: number; nome: string; telefone: string | null; grupo_id: string | null; tipo: "grupo" | "supervisor" | "coordenador" | "teste"; supervisor: string | null; regras: string[]; nao_perturbe_ini: string | null; nao_perturbe_fim: string | null; resumo_diario: boolean; ativo: boolean }`; `interface SilencioGravado { id: number; veiculo_id: string | null; regra: string | null; motivo: string; ate: string; criado_em: string }`; funções `lerAlertas(desde)`, `lerConfig()`, `salvarRegra(cfg)`, `salvarPolitica(p)`, `marcarVisto(id, email)`, `resolver(id)`, `avaliar(id, v)`, `silenciar(a, motivo, dias)`, `lerSilencios()`, `apagarSilencio(id)`, `lerDestinos()`, `salvarDestino(d)`, `apagarDestino(id)`, `lerFilaEnvio()`; hook `useGestaoDados(hoje): { alertas: AlertaGravado[]; config: ConfigGestao | null; erro: string | null; recarregar(): void }`.
  - `MENU` com `{ href: "/gestao-alertas", rotulo: "Gestão de alertas", curto: "Gestão", icone: "opcoes" }` no fim; categoria Ao vivo `["/", "/alertas", "/gestao-alertas"]`.

- [ ] **Step 1: Teste do menu (falha)** — em `src/lib/menu.test.ts`, trocar a lista esperada:
```ts
    expect(MENU.map((m) => m.href)).toEqual(["/", "/frota", "/analise", "/cronoanalise", "/timeline", "/equipamentos", "/alertas", "/gestao-alertas"]);
```
e no fim do `describe("categorias do menu", ...)` acrescentar:
```ts
  it("Gestão de alertas fica em Ao vivo, depois de Alertas", () => {
    expect(telasDa(CATEGORIAS[0]).map((m) => m.rotulo)).toEqual(["Localização", "Alertas", "Gestão de alertas"]);
    expect(categoriaAtiva("/gestao-alertas/")?.id).toBe("ao-vivo");
  });
```
Run: `npx vitest run src/lib/menu.test.ts` — Expected: FAIL.

- [ ] **Step 2: Menu** — em `src/lib/menu.ts`, acrescentar no fim de `MENU`:
```ts
  { href: "/gestao-alertas", rotulo: "Gestão de alertas", curto: "Gestão", icone: "opcoes" },
```
e trocar a categoria Ao vivo por:
```ts
  { id: "ao-vivo", rotulo: "Ao vivo", icone: "mapa", telas: ["/", "/alertas", "/gestao-alertas"] },
```
Run: `npx vitest run src/lib/menu.test.ts` — Expected: PASS. Se outro teste conferir o número de telas (ex.: `e2e/menu.spec.ts`), ajustar a contagem ali também.

- [ ] **Step 3: Criar `src/lib/supabase/sessao.ts`**
```ts
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";

let cliente: SupabaseClient | null = null;

/**
 * Cliente da Gestão de alertas: o mesmo Supabase, mas guarda a sessão (Supabase Auth, e-mail e senha) para as ações
 * e os telefones, que o RLS só libera para quem entrou (supabase/alertas.sql). O resto do site segue sem login (cliente.ts).
 */
export function dbLogado(): SupabaseClient {
  cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "mon-gestao-alertas" },
  });
  return cliente;
}

export interface Sessao {
  email: string | null;
  carregando: boolean;
  /** devolve a mensagem de erro, ou null quando entrou */
  entrar(email: string, senha: string): Promise<string | null>;
  sair(): Promise<void>;
}

export function useSessao(): Sessao {
  const [email, setEmail] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    const c = dbLogado();
    void c.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setCarregando(false);
    });
    const { data } = c.auth.onAuthStateChange((_evento, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const entrar = useCallback(async (e: string, senha: string) => {
    const { error } = await dbLogado().auth.signInWithPassword({ email: e.trim(), password: senha });
    return error ? "E-mail ou senha não conferem." : null;
  }, []);
  const sair = useCallback(async () => {
    await dbLogado().auth.signOut();
  }, []);
  return { email, carregando, entrar, sair };
}
```

- [ ] **Step 4: Criar `src/lib/dados/alertas.ts`**
```ts
"use client";

// Leituras e gravações da Gestão de alertas (tabelas de supabase/alertas.sql). Gravar pede login (RLS).
import { useCallback, useEffect, useState } from "react";
import { configCompleta, politicaCompleta, type ConfigRegra, type Politica } from "../dominio/alertas/config";
import type { AlertaGravado, Avaliacao } from "../dominio/alertas/gestao";
import type { RegraExcecao } from "../dominio/excecoes";
import { diaMenos } from "../dominio/analise";
import { ok } from "../supabase/cliente";
import { dbLogado } from "../supabase/sessao";

const COLUNAS =
  "id, chave, regra, veiculo_id, placa, vaga, supervisor, dia, ini, fim, ref, local, detalhe, situacao, nota, motivos, contexto, destino, avaliacao, contagem, visto_por, visto_em, resolvido_em, resolvido_por, ultimo_aviso_em, detectado_em, atualizado_em";
const PAGINA = 1000;
const MAX = 20000;
const agoraIso = () => new Date().toISOString();

export interface ConfigGestao {
  regras: Record<RegraExcecao, ConfigRegra>;
  politica: Politica;
}
export interface Destinatario {
  id?: number;
  nome: string;
  telefone: string | null;
  grupo_id: string | null;
  tipo: "grupo" | "supervisor" | "coordenador" | "teste";
  supervisor: string | null;
  /** vazio = todas */
  regras: string[];
  nao_perturbe_ini: string | null;
  nao_perturbe_fim: string | null;
  resumo_diario: boolean;
  ativo: boolean;
}
export interface SilencioGravado {
  id: number;
  veiculo_id: string | null;
  regra: string | null;
  motivo: string;
  ate: string;
  criado_em: string;
}

export async function lerAlertas(desde: string): Promise<AlertaGravado[]> {
  const out: AlertaGravado[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    // id desempata: as páginas não repetem nem pulam linhas
    const pag = ((await ok(dbLogado().from("alertas").select(COLUNAS).gte("dia", desde).order("dia", { ascending: false }).order("id").range(de, de + PAGINA - 1))) ?? []) as AlertaGravado[];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

export async function lerConfig(): Promise<ConfigGestao> {
  const [regras, politica] = await Promise.all([
    ok(dbLogado().from("alerta_regra").select("regra, ativa, peso, faixas, justificativas, espera_min, lembrete_min, escalar_min")),
    ok(dbLogado().from("alerta_politica").select("corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora").eq("id", 1).maybeSingle()),
  ]);
  const p = politica as (Partial<Politica> & { resumo_hora?: string }) | null;
  // o banco devolve "07:00:00"; a tela usa "07:00"
  return { regras: configCompleta((regras ?? []) as Partial<ConfigRegra>[]), politica: politicaCompleta(p ? { ...p, resumo_hora: p.resumo_hora?.slice(0, 5) } : null) };
}

export const salvarRegra = (c: ConfigRegra) =>
  ok(
    dbLogado()
      .from("alerta_regra")
      .update({ ativa: c.ativa, peso: c.peso, faixas: c.faixas, justificativas: c.justificativas, lembrete_min: c.lembrete_min, escalar_min: c.escalar_min, atualizado_em: agoraIso() })
      .eq("regra", c.regra),
  );
export const salvarPolitica = (p: Politica) =>
  ok(
    dbLogado()
      .from("alerta_politica")
      .update({ corte_whatsapp: p.corte_whatsapp, corte_resumo: p.corte_resumo, corte_coordenador: p.corte_coordenador, max_por_hora: p.max_por_hora, modo_teste: p.modo_teste, resumo_hora: p.resumo_hora, atualizado_em: agoraIso() })
      .eq("id", 1),
  );

export const marcarVisto = (id: number, email: string) => ok(dbLogado().from("alertas").update({ situacao: "visto", visto_por: email, visto_em: agoraIso() }).eq("id", id).eq("situacao", "aberto"));
export const resolver = (id: number) => ok(dbLogado().from("alertas").update({ situacao: "resolvido", resolvido_em: agoraIso(), resolvido_por: "gestor" }).eq("id", id));
export const avaliar = (id: number, v: Avaliacao) => ok(dbLogado().from("alertas").update({ avaliacao: v }).eq("id", id));

/** Silencia este equipamento nesta regra por `dias` e marca o alerta como silenciado. */
export async function silenciar(a: AlertaGravado, motivo: string, dias: number) {
  const ate = new Date(Date.now() + dias * 86400000).toISOString();
  await ok(dbLogado().from("alerta_silencio").insert({ veiculo_id: a.veiculo_id, regra: a.regra, motivo: motivo.trim(), ate }));
  await ok(dbLogado().from("alertas").update({ situacao: "silenciado" }).eq("id", a.id));
}
export const lerSilencios = async () =>
  ((await ok(dbLogado().from("alerta_silencio").select("id, veiculo_id, regra, motivo, ate, criado_em").gt("ate", agoraIso()).order("ate"))) ?? []) as SilencioGravado[];
export const apagarSilencio = (id: number) => ok(dbLogado().from("alerta_silencio").delete().eq("id", id));

export const lerDestinos = async () =>
  ((await ok(
    dbLogado().from("alerta_destino").select("id, nome, telefone, grupo_id, tipo, supervisor, regras, nao_perturbe_ini, nao_perturbe_fim, resumo_diario, ativo").order("nome"),
  )) ?? []) as Destinatario[];
export async function salvarDestino(d: Destinatario) {
  const { id, ...campos } = d;
  if (id) await ok(dbLogado().from("alerta_destino").update(campos).eq("id", id));
  else await ok(dbLogado().from("alerta_destino").insert(campos));
}
export const apagarDestino = (id: number) => ok(dbLogado().from("alerta_destino").delete().eq("id", id));

/** Fila do WhatsApp (só com login): pendentes, com erro e o último envio. */
export async function lerFilaEnvio(): Promise<{ pendentes: number; erros: number; ultimoEnvio: string | null }> {
  const linhas = ((await ok(dbLogado().from("alerta_envios").select("status, enviado_em").gte("criado_em", new Date(Date.now() - 7 * 86400000).toISOString()).limit(5000))) ??
    []) as { status: string; enviado_em: string | null }[];
  const enviados = linhas.map((l) => l.enviado_em).filter((x): x is string => !!x).sort();
  return { pendentes: linhas.filter((l) => l.status === "pendente").length, erros: linhas.filter((l) => l.status === "erro").length, ultimoEnvio: enviados.at(-1) ?? null };
}

/** Alertas dos últimos 90 dias e a configuração; relê a cada 5 min e depois de cada ação (recarregar). */
export function useGestaoDados(hoje: string): { alertas: AlertaGravado[]; config: ConfigGestao | null; erro: string | null; recarregar: () => void } {
  const [estado, setEstado] = useState<{ alertas: AlertaGravado[]; config: ConfigGestao | null; erro: string | null }>({ alertas: [], config: null, erro: null });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      Promise.all([lerAlertas(diaMenos(hoje, 89)), lerConfig()]).then(
        ([alertas, config]) => vivo && setEstado({ alertas, config, erro: null }),
        (e: unknown) => vivo && setEstado((s) => ({ ...s, erro: e instanceof Error ? e.message : String(e) })),
      );
    void ler();
    const t = setInterval(ler, 5 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [hoje, versao]);
  return { ...estado, recarregar };
}
```

- [ ] **Step 5: Verificar**
Run: `npx vitest run src/lib/menu.test.ts && npm run typecheck`
Expected: PASS e zero erros.

- [ ] **Step 6: Commit**
```bash
git add src/lib/supabase/sessao.ts src/lib/dados/alertas.ts src/lib/menu.ts src/lib/menu.test.ts
git commit -m "Gestão de alertas: sessão, leituras/gravações e item no menu (P-026)"
```

---

### Task 4: A tela `/gestao-alertas` + e2e

**Files:**
- Create: `src/app/gestao-alertas/page.tsx`, `src/app/gestao-alertas/_componentes/gestao.tsx`, `cartao.tsx`, `fila.tsx`, `historico.tsx`, `filtro.tsx`, `destinos.tsx`, `saude.tsx`
- Modify: `e2e/apoio.ts`
- Create: `e2e/gestao-alertas.spec.ts`

**Interfaces:**
- Consumes: Tasks 2 e 3; `Botao`, `Entrada`, `Selecao`, `Aviso`, `Selo`, `Chip`, `Vazio`, `cx` (`@/components/ui`); `corDoTom` (`@/lib/cores`); `ROTULO_REGRA`, `REGRAS`, `RegraExcecao`; `ROTULO_FAMILIA`; `diaLocal`, `fmtHora`, `rotuloDia`.
- Produces: rota `/gestao-alertas/`; regiões acessíveis "Fila de alertas", "Histórico de alertas", "Simulador"; abas "Fila", "Histórico", "Filtro inteligente", "Destinatários", "Saúde".

- [ ] **Step 1: e2e (falha)** — em `e2e/apoio.ts`, acrescentar `alertas?: unknown[];` às opções de `prepararDados` e, antes de `return json([]);` no fim do roteador:
```ts
    if (tabela === "alertas") return json(opcoes.alertas ?? []);
    if (tabela === "alerta_regra" || tabela === "alerta_politica" || tabela === "alerta_silencio") return json([]);
```
Criar `e2e/gestao-alertas.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const alerta = (o: Record<string, unknown>) => ({
  id: 1, chave: "k1", regra: "saida_tarde", veiculo_id: "10", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: hoje(), ini: 29400, fim: null, ref: 27900,
  local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", detalhe: "saiu 08:10 · limite 07:45", situacao: "aberto", nota: 65, destino: "whatsapp", avaliacao: null, contagem: 3, visto_por: null, visto_em: null,
  resolvido_em: null, resolvido_por: null, ultimo_aviso_em: null, detectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  motivos: [{ texto: "Peso da regra", pontos: 35 }, { texto: "Passou de 15 min", pontos: 30 }],
  contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

test("Gestão de alertas: fila com nota e motivos, histórico, simulador e destinatários protegidos; sem login nada grava", async ({ page }) => {
  const alertas = [alerta({}), alerta({ id: 2, chave: "k2", regra: "ocioso", nota: 30, destino: "resumo", situacao: "resolvido", detalhe: "40 min", motivos: [{ texto: "Peso da regra", pontos: 30 }] })];
  const gravacoes = await prepararDados(page, { alertas });
  await page.goto("/gestao-alertas/");
  await expect(page.getByRole("tab", { name: "Fila" })).toHaveAttribute("aria-selected", "true");
  const fila = page.getByRole("region", { name: "Fila de alertas" });
  await expect(fila).toContainText("EGC2985");
  await expect(fila).toContainText("Saída tarde do Pátio");
  await expect(fila).not.toContainText("Ociosidade");
  await fila.getByText("Por que essa nota?").click();
  await expect(fila).toContainText("Passou de 15 min");
  await expect(fila.getByRole("button", { name: "Visto" })).toBeDisabled();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByRole("region", { name: "Histórico de alertas" })).toContainText("Ociosidade");
  await page.getByRole("tab", { name: "Filtro inteligente" }).click();
  await expect(page.getByRole("region", { name: "Simulador" })).toContainText("2 alertas");
  await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await page.getByRole("tab", { name: "Destinatários" }).click();
  await expect(page.getByText(/Entre para ver/)).toBeVisible();
  expect(gravacoes).toEqual([]);
});
```
Run (build de CI): `NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci npm run build && npx playwright test e2e/gestao-alertas.spec.ts`
Expected: FAIL (página não existe).

- [ ] **Step 2: `src/app/gestao-alertas/page.tsx`**
```tsx
import { Gestao } from "./_componentes/gestao";

export default function Pagina() {
  return <Gestao />;
}
```

- [ ] **Step 3: `_componentes/cartao.tsx`** (um alerta, usado na Fila e no Histórico)
```tsx
"use client";

import type { ReactNode } from "react";
import { Selo } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import type { Tom } from "@/lib/tipos";

export const TOM_DESTINO: Record<Destino, Tom> = { whatsapp: "bad", resumo: "warn", tela: "na" };
export const ROTULO_DESTINO: Record<Destino, string> = { whatsapp: "WhatsApp", resumo: "Resumo diário", tela: "Só na tela" };
const ROTULO_SITUACAO = { aberto: "Aberto", visto: "Visto", resolvido: "Resolvido", silenciado: "Silenciado" } as const;
const TOM_SITUACAO: Record<keyof typeof ROTULO_SITUACAO, Tom> = { aberto: "bad", visto: "warn", resolvido: "ok", silenciado: "na" };

export function CartaoAlerta({ a, hoje, acoes }: { a: AlertaGravado; hoje: string; acoes?: ReactNode }) {
  return (
    <li className="grid gap-x-4 gap-y-2 border-b border-borda px-4 py-3 text-[13px] last:border-b-0 md:grid-cols-[56px_1fr_auto]">
      <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: corDoTom(TOM_DESTINO[a.destino]) }} title={`Nota ${a.nota}: ${ROTULO_DESTINO[a.destino]}`}>
        {a.nota}
      </span>
      <div className="min-w-0 space-y-1">
        <p>
          <b>{a.placa}</b> · {ROTULO_REGRA[a.regra as RegraExcecao] ?? a.regra} · {a.detalhe}
        </p>
        <p className="text-xs text-suave">
          {rotuloDia(a.dia, hoje)} {fmtHora(a.ini).slice(0, 5)}
          {a.local && ` · ${a.local}`} · supervisor: {a.supervisor ?? "—"}
          {a.visto_por && ` · visto por ${a.visto_por}`}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom={TOM_SITUACAO[a.situacao]}>{ROTULO_SITUACAO[a.situacao]}</Selo>
          <Selo tom={TOM_DESTINO[a.destino]}>{ROTULO_DESTINO[a.destino]}</Selo>
          {a.avaliacao && <Selo tom="neu">{a.avaliacao === "problema" ? "Era problema" : "Não era problema"}</Selo>}
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-link">Por que essa nota?</summary>
          <ul className="mt-1 space-y-0.5">
            {a.motivos.map((m) => (
              <li key={m.texto} className="tabular-nums">
                <b>
                  {m.pontos > 0 ? "+" : ""}
                  {m.pontos}
                </b>{" "}
                {m.texto}
              </li>
            ))}
          </ul>
        </details>
      </div>
      {acoes && <div className="flex flex-wrap items-start gap-1.5 md:justify-end">{acoes}</div>}
    </li>
  );
}
```

- [ ] **Step 4: `_componentes/fila.tsx`**
```tsx
"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Entrada, Selecao, Vazio } from "@/components/ui";
import { avaliar, marcarVisto, resolver, silenciar } from "@/lib/dados/alertas";
import type { AlertaGravado, Avaliacao } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { CartaoAlerta, ROTULO_DESTINO } from "./cartao";

const DIAS_SILENCIO = [1, 3, 7, 30];

function Acoes({ a, email, aoMudar }: { a: AlertaGravado; email: string | null; aoMudar: () => void }) {
  const [silencio, setSilencio] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const travado = !email;
  const dica = travado ? "Entre para usar as ações" : undefined;
  const fazer = (p: Promise<unknown>) => p.then(aoMudar, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  const motivoOk = motivo.trim().length >= 2 && motivo.trim().length <= 200;
  return (
    <div className="flex flex-col items-stretch gap-1.5 md:items-end">
      <div className="flex flex-wrap gap-1.5">
        {a.situacao === "aberto" && (
          <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => email && void fazer(marcarVisto(a.id, email))}>
            Visto
          </Botao>
        )}
        <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => void fazer(resolver(a.id))}>
          Resolver
        </Botao>
        <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => setSilencio((s) => !s)}>
          Silenciar
        </Botao>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["problema", "nao_era_problema"] as Avaliacao[]).map((v) => (
          <Botao key={v} tamanho="mini" variante="discreta" disabled={travado || a.avaliacao === v} title={dica} onClick={() => void fazer(avaliar(a.id, v))}>
            {v === "problema" ? "Era problema" : "Não era problema"}
          </Botao>
        ))}
      </div>
      {silencio && !travado && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Entrada placeholder="Motivo (ex.: em manutenção)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do silêncio" className="w-48" />
          <Selecao value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Por quanto tempo">
            {DIAS_SILENCIO.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "1 dia" : `${d} dias`}
              </option>
            ))}
          </Selecao>
          <Botao tamanho="mini" disabled={!motivoOk} onClick={() => void fazer(silenciar(a, motivo, dias))}>
            Silenciar este equipamento
          </Botao>
        </div>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

/** Alertas abertos e vistos (os de dias anteriores o robô fecha sozinho), da maior nota para a menor. */
export function Fila({ alertas, hoje, email, aoMudar }: { alertas: AlertaGravado[]; hoje: string; email: string | null; aoMudar: () => void }) {
  const [regra, setRegra] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [destino, setDestino] = useState("");
  const abertos = useMemo(() => alertas.filter((a) => a.situacao === "aberto" || a.situacao === "visto"), [alertas]);
  const supervisores = useMemo(() => [...new Set(abertos.map((a) => a.supervisor).filter((s): s is string => !!s))].sort(), [abertos]);
  const lista = abertos
    .filter((a) => (!regra || a.regra === regra) && (!supervisor || a.supervisor === supervisor) && (!destino || a.destino === destino))
    .sort((p, q) => q.nota - p.nota);
  return (
    <section aria-label="Fila de alertas" className="rounded-xl border border-borda bg-superficie shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
        <Selecao value={regra} onChange={(e) => setRegra(e.target.value)} aria-label="Regra">
          <option value="">Todas as regras</option>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {ROTULO_REGRA[r]}
            </option>
          ))}
        </Selecao>
        <Selecao value={supervisor} onChange={(e) => setSupervisor(e.target.value)} aria-label="Supervisor">
          <option value="">Todos os supervisores</option>
          {supervisores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selecao>
        <Selecao value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Destino">
          <option value="">Todos os destinos</option>
          {Object.entries(ROTULO_DESTINO).map(([id, r]) => (
            <option key={id} value={id}>
              {r}
            </option>
          ))}
        </Selecao>
        <span className="text-sm text-suave md:ml-auto">
          <b className="tabular-nums text-texto">{lista.length}</b> {lista.length === 1 ? "alerta" : "alertas"} na fila
        </span>
      </div>
      {lista.length ? (
        <ul>
          {lista.map((a) => (
            <CartaoAlerta key={a.id} a={a} hoje={hoje} acoes={<Acoes a={a} email={email} aoMudar={aoMudar} />} />
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nenhum alerta na fila">Os alertas resolvidos e silenciados ficam no Histórico.</Vazio>
      )}
    </section>
  );
}
```

- [ ] **Step 5: `_componentes/historico.tsx`**
```tsx
"use client";

import { useMemo, useState } from "react";
import { Entrada, Selecao, Vazio } from "@/components/ui";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { rotuloDia } from "@/lib/dominio/formato";
import { CartaoAlerta } from "./cartao";

const MAX_LINHAS = 300;

/** 90 dias de alertas, do mais novo para o mais antigo, com filtros. */
export function Historico({ alertas, hoje }: { alertas: AlertaGravado[]; hoje: string }) {
  const [dia, setDia] = useState("");
  const [regra, setRegra] = useState("");
  const [situacao, setSituacao] = useState("");
  const [placa, setPlaca] = useState("");
  const dias = useMemo(() => [...new Set(alertas.map((a) => a.dia))].sort().reverse(), [alertas]);
  const busca = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const lista = alertas
    .filter(
      (a) =>
        (!dia || a.dia === dia) &&
        (!regra || a.regra === regra) &&
        (!situacao || a.situacao === situacao) &&
        (!busca || a.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase().includes(busca)),
    )
    .sort((p, q) => q.dia.localeCompare(p.dia) || q.ini - p.ini);
  return (
    <section aria-label="Histórico de alertas" className="rounded-xl border border-borda bg-superficie shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia">
          <option value="">Últimos 90 dias</option>
          {dias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
        <Selecao value={regra} onChange={(e) => setRegra(e.target.value)} aria-label="Regra">
          <option value="">Todas as regras</option>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {ROTULO_REGRA[r]}
            </option>
          ))}
        </Selecao>
        <Selecao value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="aberto">Aberto</option>
          <option value="visto">Visto</option>
          <option value="resolvido">Resolvido</option>
          <option value="silenciado">Silenciado</option>
        </Selecao>
        <Entrada value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="Placa" aria-label="Placa" className="w-32" />
        <span className="text-sm text-suave md:ml-auto">
          <b className="tabular-nums text-texto">{lista.length}</b> {lista.length === 1 ? "alerta" : "alertas"}
          {lista.length > MAX_LINHAS && ` (mostrando ${MAX_LINHAS}; use os filtros)`}
        </span>
      </div>
      {lista.length ? (
        <ul>
          {lista.slice(0, MAX_LINHAS).map((a) => (
            <CartaoAlerta key={a.id} a={a} hoje={hoje} />
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nenhum alerta com esses filtros" />
      )}
    </section>
  );
}
```

- [ ] **Step 6: `_componentes/filtro.tsx`**
```tsx
"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Entrada } from "@/components/ui";
import { salvarPolitica, salvarRegra, type ConfigGestao } from "@/lib/dados/alertas";
import { simular, sugestoes, type AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { ConfigRegra, Faixa, FamiliaJust, Politica } from "@/lib/dominio/alertas/config";
import { diaMenos } from "@/lib/dominio/analise";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { ROTULO_FAMILIA } from "@/lib/dominio/familias";
import { ROTULO_DESTINO } from "./cartao";

const FAMILIAS_JUST: FamiliaJust[] = ["manutencao", "preparacao", "aguardando", "pausas", "logistica"];
const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

function Numero({ rotulo, valor, mudar, min = 0, max = 100, travado }: { rotulo: string; valor: number; mudar: (n: number) => void; min?: number; max?: number; travado: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="text-suave">{rotulo}</span>
      <Entrada type="number" min={min} max={max} value={valor} disabled={travado} onChange={(e) => mudar(num(e.target.value, min, max))} className="w-20 tabular-nums" />
    </label>
  );
}

function CartaoRegra({ c, mudar, travado }: { c: ConfigRegra; mudar: (c: ConfigRegra) => void; travado: boolean }) {
  const faixa = (i: number, f: Faixa) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? f : x)) });
  return (
    <div className="space-y-2 rounded-lg border border-borda p-3">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={c.ativa} disabled={travado} onChange={(e) => mudar({ ...c, ativa: e.target.checked })} />
        {ROTULO_REGRA[c.regra]}
      </label>
      <div className="flex flex-wrap gap-3">
        <Numero rotulo="Peso" valor={c.peso} mudar={(peso) => mudar({ ...c, peso })} travado={travado} />
        <Numero rotulo="Lembrete (min)" valor={c.lembrete_min} min={15} max={1440} mudar={(lembrete_min) => mudar({ ...c, lembrete_min })} travado={travado} />
      </div>
      <div className="space-y-1 text-[13px]">
        <p className="text-suave">Faixas (pontos a mais quando passa de X minutos)</p>
        {c.faixas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Numero rotulo="acima de" valor={f.acima_min} max={1440} mudar={(acima_min) => faixa(i, { ...f, acima_min })} travado={travado} />
            <Numero rotulo="min: +" valor={f.pontos} mudar={(pontos) => faixa(i, { ...f, pontos })} travado={travado} />
            <Botao tamanho="mini" variante="discreta" disabled={travado} onClick={() => mudar({ ...c, faixas: c.faixas.filter((_, k) => k !== i) })}>
              Tirar
            </Botao>
          </div>
        ))}
        <Botao tamanho="mini" variante="discreta" disabled={travado} onClick={() => mudar({ ...c, faixas: [...c.faixas, { acima_min: 30, pontos: 20 }] })}>
          + Faixa
        </Botao>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="w-full text-[13px] text-suave">Apontamento no tablet tira pontos (vale o maior)</span>
        {FAMILIAS_JUST.map((f) => (
          <Numero key={f} rotulo={ROTULO_FAMILIA[f]} valor={c.justificativas[f] ?? 0} mudar={(n) => mudar({ ...c, justificativas: { ...c.justificativas, [f]: n } })} travado={travado} />
        ))}
      </div>
    </div>
  );
}

/** Pesos, faixas, justificativas e cortes, com o simulador (últimos 7 dias) e as sugestões. Salvar pede login. */
export function Filtro({ alertas, config, hoje, logado, aoSalvar }: { alertas: AlertaGravado[]; config: ConfigGestao; hoje: string; logado: boolean; aoSalvar: () => void }) {
  const [regras, setRegras] = useState(config.regras);
  const [pol, setPol] = useState<Politica>(config.politica);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const semana = useMemo(() => alertas.filter((a) => a.dia >= diaMenos(hoje, 6)), [alertas, hoje]);
  const sim = useMemo(() => simular(semana, regras, pol), [semana, regras, pol]);
  const sugs = useMemo(() => sugestoes(alertas, hoje), [alertas, hoje]);
  const mudadas = REGRAS.filter((r) => JSON.stringify(regras[r]) !== JSON.stringify(config.regras[r]));
  const polMudou = JSON.stringify(pol) !== JSON.stringify(config.politica);
  const travado = !logado;
  async function salvar() {
    try {
      for (const r of mudadas) await salvarRegra(regras[r]);
      if (polMudou) await salvarPolitica(pol);
      setMsg({ tipo: "ok", texto: "Salvo. Vale a partir do próximo ciclo do robô (até 10 min)." });
      aoSalvar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  }
  return (
    <div className="space-y-4">
      <section aria-label="Simulador" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Simulador · últimos 7 dias</p>
        <p className="text-sm">
          <b className="tabular-nums">{sim.total}</b> alertas. Com esta configuração:{" "}
          {(["whatsapp", "resumo", "tela"] as const).map((d, i) => (
            <span key={d}>
              {i > 0 && " · "}
              <b className="tabular-nums">{sim.depois[d]}</b> {ROTULO_DESTINO[d]} <span className="text-suave">(hoje: {sim.antes[d]})</span>
            </span>
          ))}
          {sim.mudaram > 0 && <span> · {sim.mudaram} mudariam de destino</span>}
        </p>
        {sim.porRegra.length > 0 && (
          <ul className="text-xs text-suave">
            {sim.porRegra.map((r) => (
              <li key={r.regra}>
                {ROTULO_REGRA[r.regra as keyof typeof ROTULO_REGRA] ?? r.regra}: {r.antes} → {r.depois} no WhatsApp
              </li>
            ))}
          </ul>
        )}
      </section>
      {sugs.map((s) => (
        <Aviso key={s.regra} tipo="alerta">
          {s.texto}
        </Aviso>
      ))}
      <section aria-label="Cortes" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Cortes da nota</p>
        <div className="flex flex-wrap gap-4">
          <Numero rotulo="WhatsApp a partir de" valor={pol.corte_whatsapp} mudar={(n) => setPol({ ...pol, corte_whatsapp: n })} travado={travado} />
          <Numero rotulo="Resumo a partir de" valor={pol.corte_resumo} mudar={(n) => setPol({ ...pol, corte_resumo: n })} travado={travado} />
          <Numero rotulo="Coordenador a partir de" valor={pol.corte_coordenador} mudar={(n) => setPol({ ...pol, corte_coordenador: n })} travado={travado} />
          <Numero rotulo="Máx. mensagens por hora" valor={pol.max_por_hora} min={1} max={60} mudar={(n) => setPol({ ...pol, max_por_hora: n })} travado={travado} />
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-suave">Resumo diário às</span>
            <Entrada type="time" value={pol.resumo_hora} disabled={travado} onChange={(e) => setPol({ ...pol, resumo_hora: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={pol.modo_teste} disabled={travado} onChange={(e) => setPol({ ...pol, modo_teste: e.target.checked })} />
            Modo teste (tudo vai só para o destinatário de teste)
          </label>
        </div>
      </section>
      <section aria-label="Regras" className="grid gap-3 md:grid-cols-2">
        {REGRAS.map((r) => (
          <CartaoRegra key={r} c={regras[r]} mudar={(c) => setRegras({ ...regras, [r]: c })} travado={travado} />
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Botao disabled={travado || (!mudadas.length && !polMudou)} onClick={() => void salvar()}>
          Salvar
        </Botao>
        {travado && <span className="text-sm text-suave">Entre para salvar. Dá para testar no simulador sem entrar.</span>}
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `_componentes/destinos.tsx`**
```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Aviso, Botao, Chip, Entrada, Selecao, Vazio } from "@/components/ui";
import { apagarDestino, apagarSilencio, lerDestinos, lerSilencios, salvarDestino, type Destinatario, type SilencioGravado } from "@/lib/dados/alertas";
import { normalizarTelefone } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";

const NOVO: Destinatario = { nome: "", telefone: null, grupo_id: null, tipo: "supervisor", supervisor: null, regras: [], nao_perturbe_ini: null, nao_perturbe_fim: null, resumo_diario: false, ativo: true };
const TIPOS: Destinatario["tipo"][] = ["supervisor", "coordenador", "grupo", "teste"];
const ROTULO_TIPO: Record<Destinatario["tipo"], string> = { supervisor: "Supervisor", coordenador: "Coordenador", grupo: "Grupo do WhatsApp", teste: "Teste (modo teste)" };

function Formulario({ inicial, aoSalvar, aoCancelar }: { inicial: Destinatario; aoSalvar: () => void; aoCancelar: () => void }) {
  const [d, setD] = useState(inicial);
  const [telefone, setTelefone] = useState(inicial.telefone ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const grupo = d.tipo === "grupo";
  async function salvar() {
    const tel = grupo ? null : normalizarTelefone(telefone);
    if (d.nome.trim().length < 2) return setErro("Escreva o nome.");
    if (!grupo && !tel) return setErro("Telefone inválido: use DDD + número, ex.: (31) 98888-7777.");
    if (grupo && !d.grupo_id?.trim()) return setErro("Informe o código do grupo do WhatsApp.");
    try {
      await salvarDestino({ ...d, nome: d.nome.trim(), telefone: tel, grupo_id: grupo ? (d.grupo_id?.trim() ?? null) : null });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }
  const alternar = (r: RegraExcecao) => setD({ ...d, regras: d.regras.includes(r) ? d.regras.filter((x) => x !== r) : [...d.regras, r] });
  return (
    <div className="space-y-3 rounded-lg border border-borda p-3 text-[13px]">
      <div className="flex flex-wrap gap-2">
        <Entrada placeholder="Nome" aria-label="Nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        <Selecao aria-label="Tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as Destinatario["tipo"] })}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </Selecao>
        {grupo ? (
          <Entrada placeholder="Código do grupo" aria-label="Código do grupo" value={d.grupo_id ?? ""} onChange={(e) => setD({ ...d, grupo_id: e.target.value })} />
        ) : (
          <Entrada placeholder="(31) 98888-7777" aria-label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        )}
        {d.tipo === "supervisor" && (
          <Entrada placeholder="Supervisor (ex.: Junior Pereira)" aria-label="Supervisor" value={d.supervisor ?? ""} onChange={(e) => setD({ ...d, supervisor: e.target.value || null })} />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-suave">Regras (nenhuma marcada = todas):</span>
        {REGRAS.map((r) => (
          <Chip key={r} ativo={d.regras.includes(r)} onClick={() => alternar(r)}>
            {ROTULO_REGRA[r]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-suave">Não perturbe das</span>
          <Entrada type="time" value={d.nao_perturbe_ini ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_ini: e.target.value || null })} />
          <span className="text-suave">às</span>
          <Entrada type="time" value={d.nao_perturbe_fim ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_fim: e.target.value || null })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.resumo_diario} onChange={(e) => setD({ ...d, resumo_diario: e.target.checked })} /> Recebe o resumo diário
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /> Ativo
        </label>
      </div>
      <div className="flex gap-2">
        <Botao onClick={() => void salvar()}>Salvar</Botao>
        <Botao variante="secundaria" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

/** Quem recebe e os silêncios valendo. Telefone é dado pessoal: só com login. */
export function Destinos({ logado }: { logado: boolean }) {
  const [lista, setLista] = useState<Destinatario[]>([]);
  const [silencios, setSilencios] = useState<SilencioGravado[]>([]);
  const [editando, setEditando] = useState<Destinatario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ler = useCallback(() => {
    Promise.all([lerDestinos(), lerSilencios()]).then(
      ([d, s]) => {
        setLista(d);
        setSilencios(s);
      },
      (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, []);
  useEffect(() => {
    if (logado) ler();
  }, [logado, ler]);
  if (!logado) return <Vazio titulo="Entre para ver e editar quem recebe">Os telefones são dados pessoais: só aparecem para quem entrou com e-mail e senha.</Vazio>;
  return (
    <div className="space-y-4">
      <section aria-label="Destinatários" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Quem recebe</p>
          <Botao tamanho="mini" onClick={() => setEditando(NOVO)}>
            + Destinatário
          </Botao>
        </div>
        {editando && <Formulario key={editando.id ?? "novo"} inicial={editando} aoCancelar={() => setEditando(null)} aoSalvar={() => (setEditando(null), ler())} />}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <ul className="divide-y divide-borda text-[13px]">
          {lista.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <b>{d.nome}</b>
              <span className="text-suave">
                {ROTULO_TIPO[d.tipo]} · {d.telefone ?? d.grupo_id}
                {d.supervisor && ` · ${d.supervisor}`}
                {d.regras.length ? ` · ${d.regras.length} regra(s)` : " · todas as regras"}
                {d.nao_perturbe_ini && ` · não perturbe ${d.nao_perturbe_ini.slice(0, 5)}–${d.nao_perturbe_fim?.slice(0, 5)}`}
                {d.resumo_diario && " · resumo diário"}
                {!d.ativo && " · inativo"}
              </span>
              <span className="ml-auto flex gap-1">
                <Botao tamanho="mini" variante="secundaria" onClick={() => setEditando(d)}>
                  Editar
                </Botao>
                <Botao tamanho="mini" variante="discreta" onClick={() => d.id && confirm(`Apagar ${d.nome}?`) && void apagarDestino(d.id).then(ler)}>
                  Apagar
                </Botao>
              </span>
            </li>
          ))}
          {!lista.length && <li className="py-2 text-suave">Ninguém cadastrado ainda.</li>}
        </ul>
      </section>
      <section aria-label="Silêncios" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Silêncios valendo</p>
        <ul className="divide-y divide-borda text-[13px]">
          {silencios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
              <span>
                {s.veiculo_id ? `Equipamento ${s.veiculo_id}` : "Todos"} · {s.regra ? (ROTULO_REGRA[s.regra as RegraExcecao] ?? s.regra) : "todas as regras"} · até{" "}
                {new Date(s.ate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {s.motivo}
              </span>
              <Botao tamanho="mini" variante="discreta" className="ml-auto" onClick={() => void apagarSilencio(s.id).then(ler)}>
                Tirar silêncio
              </Botao>
            </li>
          ))}
          {!silencios.length && <li className="py-2 text-suave">Nenhum silêncio valendo.</li>}
        </ul>
      </section>
    </div>
  );
}
```

- [ ] **Step 8: `_componentes/saude.tsx`**
```tsx
"use client";

import { useEffect, useState } from "react";
import { Aviso, Campos } from "@/components/ui";
import { lerFilaEnvio } from "@/lib/dados/alertas";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** O robô está gravando? A fila do WhatsApp anda? (o envio é a etapa 3) */
export function Saude({ alertas, logado }: { alertas: AlertaGravado[]; logado: boolean }) {
  const [fila, setFila] = useState<{ pendentes: number; erros: number; ultimoEnvio: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (logado) lerFilaEnvio().then(setFila, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, [logado]);
  const ultimo = alertas.map((a) => a.atualizado_em).sort().at(-1) ?? null;
  const atrasado = !ultimo || Date.now() - Date.parse(ultimo) > 30 * 60000;
  return (
    <section aria-label="Saúde" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
      <Campos
        itens={[
          ["Robô dos alertas", `${quando(ultimo)} (última gravação)`],
          ["Mensagens na fila", logado ? String(fila?.pendentes ?? "…") : "entre para ver"],
          ["Mensagens com erro", logado ? String(fila?.erros ?? "…") : "entre para ver"],
          ["Último WhatsApp enviado", logado ? quando(fila?.ultimoEnvio ?? null) : "entre para ver"],
        ]}
      />
      {atrasado && <Aviso tipo="alerta">O robô não grava há mais de 30 min (ou não há alertas no período). Sem exceções no dia, é normal.</Aviso>}
      {logado && fila && !fila.ultimoEnvio && <Aviso tipo="info">O envio pelo WhatsApp ainda não foi ligado (etapa 3).</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </section>
  );
}
```

- [ ] **Step 9: `_componentes/gestao.tsx`**
```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Aviso, Botao, Entrada, cx } from "@/components/ui";
import { useGestaoDados } from "@/lib/dados/alertas";
import { diaLocal } from "@/lib/dominio/formato";
import { useSessao, type Sessao } from "@/lib/supabase/sessao";
import { Destinos } from "./destinos";
import { Filtro } from "./filtro";
import { Fila } from "./fila";
import { Historico } from "./historico";
import { Saude } from "./saude";

type Aba = "fila" | "historico" | "filtro" | "destinos" | "saude";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "fila", rotulo: "Fila" },
  { id: "historico", rotulo: "Histórico" },
  { id: "filtro", rotulo: "Filtro inteligente" },
  { id: "destinos", rotulo: "Destinatários" },
  { id: "saude", rotulo: "Saúde" },
];

function Entrar({ s }: { s: Sessao }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  if (s.carregando) return null;
  if (s.email)
    return (
      <span className="flex items-center gap-2 text-sm text-suave">
        {s.email}
        <Botao tamanho="mini" variante="secundaria" onClick={() => void s.sair()}>
          Sair
        </Botao>
      </span>
    );
  if (!aberto)
    return (
      <Botao tamanho="mini" onClick={() => setAberto(true)}>
        Entrar
      </Botao>
    );
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(await s.entrar(email, senha));
  }
  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-wrap items-center gap-2">
      <Entrada type="email" placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      <Entrada type="password" placeholder="Senha" aria-label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
      <Botao type="submit" tamanho="mini">
        Entrar
      </Botao>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

/** Gestão de alertas (P-026): o que o robô gravou, o que vai para o WhatsApp e quem recebe. */
export function Gestao() {
  const sessao = useSessao();
  const [aba, setAba] = useState<Aba>("fila");
  const [hoje] = useState(() => diaLocal());
  const { alertas, config, erro, recarregar } = useGestaoDados(hoje);
  const logado = !!sessao.email;
  return (
    <div className="w-full space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Gestão de alertas" className="flex w-fit flex-wrap gap-1 rounded-xl border border-borda bg-superficie p-1 shadow-sm">
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
        <span className="md:ml-auto">
          <Entrar s={sessao} />
        </span>
      </div>
      {erro && (
        <Aviso tipo="erro">
          Não deu para ler os alertas ({erro}). Se for a primeira vez, rode o SQL <code>supabase/alertas.sql</code> no Supabase PRODUTIVIDADE.
        </Aviso>
      )}
      {aba === "fila" && <Fila alertas={alertas} hoje={hoje} email={sessao.email} aoMudar={recarregar} />}
      {aba === "historico" && <Historico alertas={alertas} hoje={hoje} />}
      {aba === "filtro" && (config ? <Filtro key={JSON.stringify(config)} alertas={alertas} config={config} hoje={hoje} logado={logado} aoSalvar={recarregar} /> : !erro && <p>Carregando…</p>)}
      {aba === "destinos" && <Destinos logado={logado} />}
      {aba === "saude" && <Saude alertas={alertas} logado={logado} />}
    </div>
  );
}
```

- [ ] **Step 10: Verificar**
Run: `npm test && npm run typecheck && npm run lint`
Expected: tudo verde.
Run: `NEXT_PUBLIC_SUPABASE_URL=https://exemplo.supabase.co NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ci npm run build && npx playwright test e2e/gestao-alertas.spec.ts e2e/menu.spec.ts`
Expected: PASS.

- [ ] **Step 11: Commit**
```bash
git add src/app/gestao-alertas e2e/apoio.ts e2e/gestao-alertas.spec.ts
git commit -m "Gestão de alertas: tela com fila, histórico, filtro com simulador, destinatários e saúde (P-026)"
```

---

### Task 5: Documentação

**Files:** `README.md` (item 18 depois do 17; tabela de telas: linha de `src/app/gestao-alertas/`), `CHANGELOG.md` (entrada no topo).

- [ ] **Step 1:** README, depois do item 17:
```markdown
18. **Gestão de alertas** (`/gestao-alertas`, P-026, 15/10/2026): abas **Fila** (abertos e vistos, da maior nota para a menor, com "Por que essa nota?" e as ações Visto, Resolver, Silenciar este equipamento e Era / Não era problema), **Histórico** (90 dias), **Filtro inteligente** (pesos, faixas, justificativas e cortes, com **simulador** dos últimos 7 dias e **sugestões** pelas avaliações; nada muda sozinho), **Destinatários** (telefone ou grupo, regras, não perturbe, resumo) e **Saúde**. Ver não pede login; agir, salvar e ver telefones pede (Supabase Auth, e-mail e senha; **cadastro aberto desligado** no painel, usuários criados à mão). O simulador recalcula a nota com o `contexto` que o robô grava em cada alerta.
```
Na tabela de pastas, depois da linha de `src/app/alertas/` (ou no fim da tabela de telas):
```markdown
| `src/app/gestao-alertas/` | Gestão de alertas: fila, histórico, filtro inteligente com simulador, destinatários e saúde (login para agir) |
```
- [ ] **Step 2:** CHANGELOG, nova entrada no topo: "## Gestão de alertas · 15/10/2026 (não publicado; ramo `alertas-whatsapp`)" com 2–3 itens resumindo o item 18.
- [ ] **Step 3: Commit**
```bash
git add README.md CHANGELOG.md
git commit -m "Gestão de alertas: documentação (P-026)"
```

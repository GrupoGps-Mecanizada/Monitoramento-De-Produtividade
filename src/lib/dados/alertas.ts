"use client";

// Leituras e gravações da Gestão de alertas (tabelas de supabase/alertas.sql). Gravar pede login (RLS).
import { useCallback, useEffect, useState } from "react";
import { configCompleta, politicaCompleta, type ConfigRegra, type Politica } from "../dominio/alertas/config";
import type { AlertaGravado, Avaliacao } from "../dominio/alertas/gestao";
import type { RegraExcecao } from "../dominio/excecoes";
import { diaMenos } from "../dominio/analise";
import { colunasAlertas } from "./colunas";
import { ok } from "../supabase/cliente";
import { dbLogado } from "../supabase/sessao";

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

export async function lerAlertas(desde: string, logado: boolean): Promise<AlertaGravado[]> {
  const out: AlertaGravado[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    // id desempata: as páginas não repetem nem pulam linhas
    const pag = ((await ok(dbLogado().from("alertas").select(colunasAlertas(logado)).gte("dia", desde).order("dia", { ascending: false }).order("id").range(de, de + PAGINA - 1))) ?? []) as unknown as AlertaGravado[];
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
/** Ações em lote (vários alertas marcados na lista). */
export const marcarVistoVarios = (ids: number[], email: string) =>
  ok(dbLogado().from("alertas").update({ situacao: "visto", visto_por: email, visto_em: agoraIso() }).in("id", ids).eq("situacao", "aberto"));
export const resolverVarios = (ids: number[]) => ok(dbLogado().from("alertas").update({ situacao: "resolvido", resolvido_em: agoraIso(), resolvido_por: "gestor" }).in("id", ids));
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
export function useGestaoDados(hoje: string, logado: boolean): { alertas: AlertaGravado[]; config: ConfigGestao | null; erro: string | null; recarregar: () => void } {
  const [estado, setEstado] = useState<{ alertas: AlertaGravado[]; config: ConfigGestao | null; erro: string | null }>({ alertas: [], config: null, erro: null });
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      Promise.all([lerAlertas(diaMenos(hoje, 89), logado), lerConfig()]).then(
        ([alertas, config]) => vivo && setEstado({ alertas, config, erro: null }),
        (e: unknown) => vivo && setEstado((s) => ({ ...s, erro: e instanceof Error ? e.message : String(e) })),
      );
    void ler();
    const t = setInterval(ler, 5 * 60 * 1000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [hoje, logado, versao]);
  return { ...estado, recarregar };
}

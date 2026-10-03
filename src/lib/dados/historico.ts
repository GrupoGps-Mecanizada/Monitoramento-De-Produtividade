import type { SupabaseClient } from "@supabase/supabase-js";
import type { Historico, StatusPedido } from "../tipos";
import { db, ok } from "../supabase/cliente";
import { validarHistorico } from "./esquemas";

// o coletor roda a cada ~5 min: histórico de hoje mais velho que isso pede atualização (dia encerrado é definitivo)
export const HISTORICO_FRESCO_MS = 10 * 60 * 1000;
export const ESPERA_MAX_MS = 25 * 60 * 1000;
const CONSULTA_MS = 6000;

export type EtapaPedido = "fila" | "processando";
export interface OpcoesHistorico {
  /** chamado enquanto o coletor não atende (para a tela mostrar o andamento) */
  aoAndar?: (etapa: EtapaPedido) => void;
  sinal?: AbortSignal;
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
}
interface LinhaHistorico {
  resultado: unknown;
  baixado_em: string;
  fechado: boolean;
}

const ler = async (c: SupabaseClient, id: string, dia: string) =>
  (await ok(c.from("loc_historico").select("resultado, baixado_em, fechado").eq("veiculo_id", id).eq("dia", dia).maybeSingle())) as LinhaHistorico | null;

/**
 * Histórico (rota + apontamento) de um veículo num dia. Se já está no banco e é definitivo/recente, devolve na
 * hora. Senão deixa um pedido para o coletor (GitHub Actions) e espera ele ficar pronto.
 */
export async function pedirHistorico(id: string, dia: string, op: OpcoesHistorico = {}, c: SupabaseClient = db()): Promise<Historico> {
  if (!/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new Error("parâmetros inválidos");
  const agora = op.agora ?? Date.now;
  const esperar = op.esperar ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const atual = await ler(c, id, dia);
  const fresco = atual?.resultado && (atual.fechado || agora() - new Date(atual.baixado_em).getTime() < HISTORICO_FRESCO_MS);
  if (atual && fresco) return { ...validarHistorico(atual.resultado), fonte: "cache" };

  const { error } = await c.from("loc_pedidos").insert({ veiculo_id: id, dia });
  // 23505 = já existe pedido em aberto para esse veículo/dia: é só esperar ele
  if (error && error.code !== "23505") throw new Error(error.message);
  // tem versão antiga de hoje: mostra já, a nova chega no próximo ciclo
  if (atual?.resultado) return { ...validarHistorico(atual.resultado), fonte: "cache", aviso: "atualização pedida ao coletor" };

  op.aoAndar?.("fila");
  const limite = agora() + ESPERA_MAX_MS;
  while (agora() < limite) {
    await esperar(CONSULTA_MS);
    if (op.sinal?.aborted) throw new DOMException("cancelado", "AbortError");
    const ped = (await ok(
      c.from("loc_pedidos").select("status, erro").eq("veiculo_id", id).eq("dia", dia).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    )) as { status: StatusPedido; erro: string | null } | null;
    if (ped?.status === "pendente" || ped?.status === "processando") op.aoAndar?.(ped.status === "processando" ? "processando" : "fila");
    if (ped?.status === "erro") throw new Error(ped.erro || "o coletor não conseguiu buscar o histórico");
    if (ped?.status === "pronto") {
      const novo = await ler(c, id, dia);
      if (novo?.resultado) return validarHistorico(novo.resultado); // fonte (gauss/incremental/cache) vem do coletor
    }
  }
  throw new Error("o coletor ainda não atendeu o pedido - confira se o workflow está rodando no GitHub Actions");
}

"use client";

import { useSyncExternalStore } from "react";
import type { EquipamentoCadastro, ItemLista } from "../tipos";
import { db } from "../supabase/cliente";
import { lerCadastro, lerListas } from "./cadastro";
import { esquecerCadastro } from "./leituras";

/** Matriz de equipamentos ao vivo (tela Equipamentos): uma assinatura Realtime nas 3 tabelas, compartilhada. */
export interface EstadoMatriz {
  cadastro: EquipamentoCadastro[] | null;
  supervisores: ItemLista[];
  regimes: ItemLista[];
  erro: string | null;
}
const INICIAL: EstadoMatriz = { cadastro: null, supervisores: [], regimes: [], erro: null };

let estado = INICIAL;
const ouvintes = new Set<() => void>();
let parar: (() => void) | null = null;
const mudar = (novo: Partial<EstadoMatriz>) => {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
};

/** Relê tudo (também depois de gravar: não espera o Realtime). */
export async function recarregarMatriz() {
  try {
    esquecerCadastro();
    const [cadastro, listas] = await Promise.all([lerCadastro(db()), lerListas(db())]);
    mudar({ cadastro, ...listas, erro: null });
  } catch (e) {
    mudar({ erro: e instanceof Error ? e.message : String(e) });
  }
}

function iniciar(): () => void {
  void recarregarMatriz();
  let canal = db().channel(`matriz-${Math.random().toString(36).slice(2)}`);
  for (const table of ["frota_equipamento", "frota_supervisor", "frota_regime"])
    canal = canal.on("postgres_changes", { event: "*", schema: "public", table }, () => void recarregarMatriz());
  canal.subscribe();
  return () => void db().removeChannel(canal);
}

function assinar(f: () => void) {
  ouvintes.add(f);
  parar ??= iniciar();
  return () => {
    ouvintes.delete(f);
    if (!ouvintes.size) {
      parar?.();
      parar = null;
    }
  };
}

export const useMatriz = (): EstadoMatriz => useSyncExternalStore(assinar, () => estado, () => INICIAL);

/** Mensagem clara para os erros do banco ao gravar. */
function traduzir(msg: string): string {
  if (/row-level security|permission denied/i.test(msg)) return "O banco não aceitou a gravação. Avise o responsável pelo sistema.";
  if (/duplicate key|unique/i.test(msg)) return "Já existe um equipamento (ou item) com esse nome/placa.";
  if (/fetch|network/i.test(msg)) return "Sem conexão. Confira a internet e tente de novo.";
  return msg;
}

/** Cadastra (sem id) ou altera um equipamento. Devolve a mensagem de erro, ou null se gravou. */
export async function salvarEquipamento(linha: Record<string, unknown>, id?: number): Promise<string | null> {
  const t = db().from("frota_equipamento");
  // .select() confirma a gravação: sem permissão o update "passa" sem mudar nenhuma linha
  const { data, error } = id ? await t.update(linha).eq("id", id).select("id") : await t.insert(linha).select("id");
  if (error) return traduzir(error.message);
  if (!data?.length) return traduzir("row-level security");
  await recarregarMatriz();
  return null;
}

export type TabelaLista = "frota_supervisor" | "frota_regime";

/** Cadastra um supervisor/regime ou muda nome/ativo. Devolve a mensagem de erro, ou null. */
export async function salvarItemLista(tabela: TabelaLista, dados: { nome?: string; ativo?: boolean }, id?: number): Promise<string | null> {
  const nome = dados.nome?.trim().toUpperCase();
  if (dados.nome !== undefined && (!nome || nome.length < 2)) return "Escreva o nome (pelo menos 2 letras).";
  const linha = { ...dados, ...(nome ? { nome } : {}) };
  const t = db().from(tabela);
  const { data, error } = id ? await t.update(linha).eq("id", id).select("id") : await t.insert(linha).select("id");
  if (error) return traduzir(error.message);
  if (!data?.length) return traduzir("row-level security");
  await recarregarMatriz();
  return null;
}

export interface MudancaHistorico {
  id: number;
  em: string;
  por: string | null;
  mudancas: Record<string, { de: unknown; para: unknown }> | { novo: true };
}

/** Histórico de um equipamento, do mais novo para o mais antigo. */
export async function lerHistoricoEquip(id: number): Promise<MudancaHistorico[]> {
  const { data, error } = await db()
    .from("frota_equipamento_historico")
    .select("id, em, por, mudancas")
    .eq("equipamento_id", id)
    .order("em", { ascending: false })
    .limit(50);
  if (error) throw new Error(traduzir(error.message));
  return data as MudancaHistorico[];
}

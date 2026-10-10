// Leitura da matriz de equipamentos (frota_equipamento + nomes do supervisor e do regime). Usada pelo site (chave
// publishable) e pelo coletor (chave secreta): por isso não importa nada além dos tipos.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EquipamentoCadastro, ItemLista, StatusEquip, TipoEquip } from "../tipos";

const COLUNAS =
  "id, tipo, placa, numero, codigo, status, supervisor_id, regime_id, observacao, ordem, atualizado_em, supervisor:frota_supervisor(nome), regime:frota_regime(nome)";

const TIPOS = new Set<TipoEquip>(["ap", "av", "hv", "uv", "pg", "as"]);
const STATUS = new Set<StatusEquip>(["ATIVO", "EM_MANUTENCAO", "DESMOBILIZADO"]);

type Linha = Omit<EquipamentoCadastro, "supervisor" | "regime"> & { supervisor: { nome: string } | null; regime: { nome: string } | null };

/** Linha do banco -> EquipamentoCadastro; formato estranho (tipo ou status desconhecido) é erro, não some em silêncio. */
export function paraCadastro(l: Linha): EquipamentoCadastro {
  if (!TIPOS.has(l.tipo) || !STATUS.has(l.status) || typeof l.id !== "number") {
    throw new Error(`Matriz de equipamentos em formato inesperado (linha ${String(l.id)}) - avise o responsável pelo sistema`);
  }
  return { ...l, supervisor: l.supervisor?.nome ?? null, regime: l.regime?.nome ?? null };
}

/** A matriz inteira (são dezenas de linhas: cabe numa consulta). */
export async function lerCadastro(c: SupabaseClient): Promise<EquipamentoCadastro[]> {
  const { data, error } = await c.from("frota_equipamento").select(COLUNAS).order("id").limit(1000);
  if (error) throw new Error(`Matriz de equipamentos: ${error.message}`);
  return (data as unknown as Linha[]).map(paraCadastro);
}

/** Supervisores e regimes (ativos e inativos: a matriz mostra o nome mesmo de quem saiu). */
export async function lerListas(c: SupabaseClient): Promise<{ supervisores: ItemLista[]; regimes: ItemLista[] }> {
  const [s, r] = await Promise.all([
    c.from("frota_supervisor").select("id, nome, ativo").order("nome"),
    c.from("frota_regime").select("id, nome, ativo").order("nome"),
  ]);
  if (s.error || r.error) throw new Error(`Listas da matriz: ${(s.error ?? r.error)!.message}`);
  return { supervisores: s.data as ItemLista[], regimes: r.data as ItemLista[] };
}

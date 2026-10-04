import type { SupabaseClient } from "@supabase/supabase-js";
import { diaLocal } from "../dominio/formato";
import { aplicarFrota } from "../dominio/frota-propria";
import type { Cerca, Evento, Retrato } from "../tipos";
import { db, ok } from "../supabase/cliente";
import { validarCercas, validarEvento, validarRetrato } from "./esquemas";

/** Retrato da frota (loc_kv.snapshot), só com os equipamentos da Mecanizada. Antes da 1ª leitura do coletor: retrato vazio. */
export async function lerRetrato(c: SupabaseClient = db()): Promise<Retrato> {
  const r = (await ok(c.from("loc_kv").select("valor").eq("chave", "snapshot").maybeSingle())) as { valor: unknown } | null;
  return aplicarFrota(validarRetrato(r?.valor));
}

let cercasCache: Promise<Cerca[]> | null = null;
/** Cercas mudam raramente (o coletor guarda por 7 dias): uma leitura por aba. Lista vazia não fica guardada. */
export function lerCercas(c: SupabaseClient = db()): Promise<Cerca[]> {
  cercasCache ??= ok(c.from("loc_kv").select("valor").eq("chave", "cercas").maybeSingle())
    .then((r) => validarCercas((r as { valor?: { cercas?: unknown } } | null)?.valor?.cercas))
    .then((cercas) => {
      if (!cercas.length) cercasCache = null;
      return cercas;
    })
    .catch((e: unknown) => {
      cercasCache = null;
      throw e;
    });
  return cercasCache;
}

// o Supabase entrega no máximo 1000 linhas por consulta: dia movimentado vem em páginas
const PAGINA_EVENTOS = 1000;
const MAX_EVENTOS = 5000;

/** Eventos de um dia (opcionalmente de um veículo), do mais antigo para o mais novo; até 5000. */
export async function lerEventos(dia: string, id?: string, c: SupabaseClient = db()): Promise<Evento[]> {
  const eventos: Evento[] = [];
  for (let de = 0; de < MAX_EVENTOS; de += PAGINA_EVENTOS) {
    let q = c.from("loc_eventos").select("dados").eq("dia", dia);
    if (id) q = q.eq("veiculo_id", id);
    // id desempata eventos do mesmo instante: as páginas não repetem nem pulam linhas
    const linhas = (await ok(q.order("t").order("id").range(de, de + PAGINA_EVENTOS - 1))) as { dados: unknown }[];
    eventos.push(...linhas.map((l) => validarEvento(l.dados)));
    if (linhas.length < PAGINA_EVENTOS) break;
  }
  return eventos;
}

/** Dias com eventos (seletor de dia), do mais novo; hoje sempre aparece. */
export async function lerDias(c: SupabaseClient = db()): Promise<string[]> {
  const dias = ((await ok(c.from("loc_dias").select("dia").order("dia", { ascending: false }).limit(120))) as { dia: string }[]).map((r) => r.dia);
  const hoje = diaLocal();
  return dias.includes(hoje) ? dias : [hoje, ...dias];
}

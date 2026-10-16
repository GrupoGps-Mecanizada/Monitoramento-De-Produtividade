import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;
/** Chave secreta (ignora RLS): só existe no segredo do Actions, nunca na página. */
export const db = (): SupabaseClient => (cliente ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }));

export async function ok<T>(promessa: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}

// Cada requisição ao Supabase vira uma linha de log (o plano grátis inclui 1 GB/mês de log). O coletor roda a cada
// 5 min: as chaves que ele lê em toda execução vêm numa requisição só (kvCarregar) e ficam em memória até o fim.
let lidas: Map<string, unknown> | null = null;

/** Lê de uma vez as chaves do loc_kv; daí em diante kvGet delas não vai ao banco (kvSet mantém a memória em dia). */
export async function kvCarregar(chaves: string[]): Promise<void> {
  const linhas = ((await ok(db().from("loc_kv").select("chave, valor").in("chave", chaves))) ?? []) as { chave: string; valor: unknown }[];
  lidas = new Map(chaves.map((c) => [c, null]));
  for (const l of linhas) lidas.set(l.chave, l.valor);
}

export async function kvGet<T>(chave: string): Promise<T | null> {
  if (lidas?.has(chave)) return (lidas.get(chave) as T | undefined) ?? null;
  const r = (await ok(db().from("loc_kv").select("valor, atualizado_em").eq("chave", chave).maybeSingle())) as { valor?: unknown } | null;
  return (r?.valor as T | undefined) ?? null;
}

/** Grava várias chaves numa requisição só. */
export async function kvSetVarias(valores: Record<string, unknown>): Promise<void> {
  const atualizado_em = new Date().toISOString();
  const linhas = Object.entries(valores).map(([chave, valor]) => ({ chave, valor, atualizado_em }));
  if (!linhas.length) return;
  await ok(db().from("loc_kv").upsert(linhas));
  for (const l of linhas) lidas?.set(l.chave, l.valor);
}
export const kvSet = (chave: string, valor: unknown) => kvSetVarias({ [chave]: valor });

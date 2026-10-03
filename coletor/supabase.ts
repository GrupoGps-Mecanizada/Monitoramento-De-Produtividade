import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;
/** Chave secreta (ignora RLS): só existe no segredo do Actions, nunca na página. */
export const db = (): SupabaseClient => (cliente ??= createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } }));

export async function ok<T>(promessa: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}

export async function kvGet<T>(chave: string): Promise<T | null> {
  const r = (await ok(db().from("loc_kv").select("valor, atualizado_em").eq("chave", chave).maybeSingle())) as { valor?: unknown } | null;
  return (r?.valor as T | undefined) ?? null;
}
export const kvSet = (chave: string, valor: unknown) => ok(db().from("loc_kv").upsert({ chave, valor, atualizado_em: new Date().toISOString() }));

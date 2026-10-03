import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cliente: SupabaseClient | null = null;

/**
 * Cliente do navegador com a chave PÚBLICA (publishable). O RLS (supabase/schema.sql) só deixa ler o retrato,
 * as cercas, os eventos e os apontamentos, e criar pedido de histórico. Não há login.
 */
export function db(): SupabaseClient {
  cliente ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cliente;
}

export async function ok<T>(promessa: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await promessa;
  if (error) throw new Error(error.message);
  return data;
}

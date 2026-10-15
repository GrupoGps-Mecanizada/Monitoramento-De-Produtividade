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

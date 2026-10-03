"use client";

import { useEffect, useState } from "react";
import { diaLocal } from "../dominio/formato";
import type { Evento } from "../tipos";
import { db } from "../supabase/cliente";
import { validarEvento } from "./esquemas";
import { lerEventos } from "./leituras";

interface Carga {
  dia: string;
  eventos: Evento[];
  erro: string | null;
}

/** Eventos do dia; no dia de hoje, os novos chegam ao vivo (Realtime). */
export function useEventos(dia: string): { eventos: Evento[]; carregando: boolean; erro: string | null } {
  const [carga, setCarga] = useState<Carga | null>(null);
  useEffect(() => {
    let vivo = true;
    lerEventos(dia).then(
      (eventos) => {
        if (vivo) setCarga({ dia, eventos, erro: null });
      },
      (e: unknown) => {
        if (vivo) setCarga({ dia, eventos: [], erro: e instanceof Error ? e.message : String(e) });
      },
    );
    if (dia !== diaLocal()) return () => void (vivo = false);
    const canal = db()
      .channel(`eventos-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "loc_eventos" }, (p) => {
        const linha = p.new as { dia?: string; dados?: unknown };
        if (linha.dia !== dia || !linha.dados) return;
        try {
          const ev = validarEvento(linha.dados);
          setCarga((c) => (c && c.dia === dia ? { ...c, eventos: [...c.eventos, ev] } : c));
        } catch {
          // formato inesperado: ignora só este evento ao vivo (a leitura completa avisa)
        }
      })
      .subscribe();
    return () => {
      vivo = false;
      void db().removeChannel(canal);
    };
  }, [dia]);
  const atual = carga?.dia === dia ? carga : null;
  return { eventos: atual?.eventos ?? [], carregando: !atual, erro: atual?.erro ?? null };
}

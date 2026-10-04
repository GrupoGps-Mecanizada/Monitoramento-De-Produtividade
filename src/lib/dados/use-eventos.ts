"use client";

import { useEffect, useMemo, useState } from "react";
import { diaLocal } from "../dominio/formato";
import { eventosDaFrota, idsDaFrota } from "../dominio/frota-propria";
import type { Evento } from "../tipos";
import { db } from "../supabase/cliente";
import { validarEvento } from "./esquemas";
import { lerEventos } from "./leituras";
import { useRetrato } from "./use-retrato";

interface Carga {
  dia: string;
  eventos: Evento[];
  erro: string | null;
}

/** Eventos do dia, só da frota da Mecanizada; no dia de hoje, os novos chegam ao vivo (Realtime). */
export function useEventos(dia: string): { eventos: Evento[]; carregando: boolean; erro: string | null } {
  const [carga, setCarga] = useState<Carga | null>(null);
  const { retrato } = useRetrato();
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
  // eventos gravados antes do filtro do coletor: a frota vem do retrato atual
  const ids = useMemo(() => (retrato ? idsDaFrota(retrato) : null), [retrato]);
  const eventos = useMemo(() => (atual && ids ? eventosDaFrota(atual.eventos, ids) : []), [atual, ids]);
  return { eventos, carregando: !atual || !ids, erro: atual?.erro ?? null };
}

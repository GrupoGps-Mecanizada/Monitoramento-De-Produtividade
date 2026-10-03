"use client";

import { useSyncExternalStore } from "react";
import type { Retrato } from "../tipos";
import { db } from "../supabase/cliente";
import { lerRetrato } from "./leituras";

export interface EstadoRetrato {
  retrato: Retrato | null;
  conectado: boolean;
  erro: string | null;
}

// rede de segurança caso o Realtime perca alguma atualização
const RELEITURA_MS = 2 * 60 * 1000;
const INICIAL: EstadoRetrato = { retrato: null, conectado: true, erro: null };

let estado = INICIAL;
const ouvintes = new Set<() => void>();
let parar: (() => void) | null = null;
const mudar = (novo: Partial<EstadoRetrato>) => {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
};

async function reler() {
  try {
    mudar({ retrato: await lerRetrato(), erro: null });
  } catch (e) {
    mudar({ erro: e instanceof Error ? e.message : String(e) });
  }
}

function iniciar(): () => void {
  void reler();
  // relê o retrato inteiro quando o coletor grava (não confia no payload, que pode ser grande)
  const canal = db()
    .channel(`retrato-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "loc_kv", filter: "chave=eq.snapshot" }, () => void reler())
    .subscribe((s) => {
      if (s === "SUBSCRIBED") mudar({ conectado: true });
      else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") mudar({ conectado: false });
    });
  const timer = setInterval(() => void reler(), RELEITURA_MS);
  return () => {
    clearInterval(timer);
    void db().removeChannel(canal);
  };
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

/** Retrato da frota ao vivo. Uma assinatura só (Realtime + releitura a cada 2 min), compartilhada pela barra e pelas telas. */
export function useRetrato(): EstadoRetrato {
  return useSyncExternalStore(assinar, () => estado, () => INICIAL);
}

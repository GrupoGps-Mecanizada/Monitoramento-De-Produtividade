"use client";

import { useSyncExternalStore } from "react";

/** Tema claro/escuro: escolha guardada neste navegador; sem escolha, segue o sistema operacional. */
export type Tema = "claro" | "escuro";

const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => {
  ouvintes.add(f);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", f);
  return () => {
    ouvintes.delete(f);
    mq.removeEventListener("change", f);
  };
};
const atual = (): Tema => {
  const d = document.documentElement.dataset.tema;
  if (d === "claro" || d === "escuro") return d;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
};

export function useTema(): [Tema, () => void] {
  const tema = useSyncExternalStore(assinar, atual, () => "claro" as Tema);
  const alternar = () => {
    const novo: Tema = atual() === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("mon-tema", novo);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    ouvintes.forEach((f) => f());
  };
  return [tema, alternar];
}

"use client";

import { useSyncExternalStore } from "react";

/**
 * Tema claro/escuro: um tema só para o Portal SGE e os sistemas (chave `sge_tema`, a mesma da Barra Universal).
 * Sem escolha: sempre claro. Trocado em outra página do mesmo endereço (o portal ou outro sistema), segue junto.
 */
export type Tema = "claro" | "escuro";
const CHAVE = "sge_tema";

const ouvintes = new Set<() => void>();
const assinar = (f: () => void) => {
  ouvintes.add(f);
  const deFora = (ev: StorageEvent) => {
    if (ev.key !== CHAVE) return;
    document.documentElement.dataset.tema = ev.newValue === "escuro" ? "escuro" : "claro";
    f();
  };
  window.addEventListener("storage", deFora);
  return () => {
    ouvintes.delete(f);
    window.removeEventListener("storage", deFora);
  };
};
const atual = (): Tema => (document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro");

export function useTema(): [Tema, () => void] {
  const tema = useSyncExternalStore(assinar, atual, () => "claro" as Tema);
  const alternar = () => {
    const novo: Tema = atual() === "escuro" ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem(CHAVE, novo);
    } catch {
      // sem armazenamento: vale só nesta visita
    }
    ouvintes.forEach((f) => f());
  };
  return [tema, alternar];
}

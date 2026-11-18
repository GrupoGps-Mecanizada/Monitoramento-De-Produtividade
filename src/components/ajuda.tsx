"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Tela limpa (regra do dono, 17/11/2026 · Portfólio 27, opção D): subtítulos e explicações ficam escondidos;
 * o botão (?) mostra ou esconde todos de uma vez. Mesmo jeito do kit do SGE (sge-kit.css, peça 12) e do SST:
 * classe k-ajuda-on no <html> e a escolha guardada em "sge_ajuda".
 */
const CHAVE = "sge_ajuda";
const EVENTO = "sge-ajuda";
const lerAjuda = () => {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false; // sem armazenamento: começa sem ajuda
  }
};
const ouvir = (avisar: () => void) => {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
};

export function BotaoAjuda() {
  const ligada = useSyncExternalStore(ouvir, lerAjuda, () => false);
  useEffect(() => {
    document.documentElement.classList.toggle("k-ajuda-on", ligada);
  }, [ligada]);
  const trocar = () => {
    try {
      localStorage.setItem(CHAVE, ligada ? "0" : "1");
    } catch {
      /* segue sem lembrar */
    }
    window.dispatchEvent(new Event(EVENTO));
  };
  return (
    <button
      type="button"
      onClick={trocar}
      aria-pressed={ligada}
      title={ligada ? "Esconder as explicações" : "Mostrar as explicações da tela"}
      className={cx(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[13px] font-bold transition",
        ligada ? "border-transparent bg-primaria text-primaria-texto" : "border-borda bg-superficie text-suave hover:text-texto",
      )}
    >
      ?
    </button>
  );
}

/** Texto que só aparece com a ajuda ligada (na mesma linha; `bloco` para ocupar a linha de baixo). */
export function Explica({ children, bloco, className }: { children: ReactNode; bloco?: boolean; className?: string }) {
  return <span className={cx("k-explica", bloco && "bloco", className)}>{children}</span>;
}

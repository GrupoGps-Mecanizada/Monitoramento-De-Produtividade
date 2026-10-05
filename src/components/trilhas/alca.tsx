"use client";

import { useRef } from "react";

/** Alça na borda de cima de um painel: arrastar para cima aumenta, para baixo diminui; clicar passa para a próxima altura. */
export function Alca<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: readonly T[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  const y0 = useRef<number | null>(null);
  const i = opcoes.indexOf(valor);
  const ir = (d: number) => mudar(opcoes[Math.min(opcoes.length - 1, Math.max(0, i + d))]);
  const proxima = () => mudar(opcoes[(i + 1) % opcoes.length]);
  return (
    <button
      type="button"
      aria-label={rotulo}
      title={`${rotulo} (arraste ou clique)`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        y0.current = e.clientY;
      }}
      onPointerUp={(e) => {
        const ini = y0.current;
        y0.current = null;
        if (ini == null) return;
        const dy = e.clientY - ini;
        if (dy < -24) ir(1);
        else if (dy > 24) ir(-1);
        else proxima();
      }}
      // teclado (Enter/Espaço) chega como clique sem ponteiro
      onClick={(e) => e.detail === 0 && proxima()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          ir(e.key === "ArrowUp" ? 1 : -1);
        }
      }}
      className="mx-auto flex h-4 w-16 cursor-ns-resize touch-none items-center justify-center rounded-full hover:bg-superficie-2"
    >
      <span aria-hidden className="h-1 w-10 rounded-full bg-borda" />
    </button>
  );
}

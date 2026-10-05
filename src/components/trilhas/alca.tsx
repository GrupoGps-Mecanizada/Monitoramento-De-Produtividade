"use client";

import { useRef } from "react";

interface Props {
  /** altura atual do painel (px) */
  altura: number;
  /** altura máxima agora (px) */
  maximo: number;
  /** enquanto arrasta: a altura acompanha o ponteiro */
  mudando: (px: number) => void;
  /** ao soltar (ou pelo teclado): a altura final */
  soltar: (px: number) => void;
  rotulo: string;
}

/** Alça na borda de cima de um painel: arrastar muda a altura em tempo real (para cima cresce, para baixo diminui). */
export function Alca({ altura, maximo, mudando, soltar, rotulo }: Props) {
  const inicio = useRef<{ y: number; h: number } | null>(null);
  const medir = (y: number) => {
    const i = inicio.current!;
    return Math.min(maximo, Math.max(0, i.h + (i.y - y)));
  };
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={rotulo}
      aria-valuemin={0}
      aria-valuemax={Math.round(maximo)}
      aria-valuenow={Math.round(altura)}
      tabIndex={0}
      title={`${rotulo} (arraste)`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        inicio.current = { y: e.clientY, h: altura };
      }}
      onPointerMove={(e) => {
        if (inicio.current && e.currentTarget.hasPointerCapture(e.pointerId)) mudando(medir(e.clientY));
      }}
      onPointerUp={(e) => {
        if (!inicio.current) return;
        const px = medir(e.clientY);
        inicio.current = null;
        soltar(px);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          soltar(Math.min(maximo, Math.max(0, altura + (e.key === "ArrowUp" ? 24 : -24))));
        }
      }}
      className="group mx-auto flex h-4 w-24 cursor-ns-resize touch-none items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primaria"
    >
      <span aria-hidden className="h-1 w-12 rounded-full bg-borda transition-colors group-hover:bg-suave" />
    </div>
  );
}

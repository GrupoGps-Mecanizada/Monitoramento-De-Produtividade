"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { cx } from "./ui";

export type EstadoFolha = "fechada" | "meio" | "cheia";
const ORDEM: EstadoFolha[] = ["fechada", "meio", "cheia"];

/**
 * Gaveta de baixo do celular (o foco é o mapa): fechada mostra só o resumo; meio e cheia mostram a lista.
 * Arrasta pela alça ou pelo resumo; toque na alça alterna fechada/meio.
 */
export function Folha({ estado, mudar, resumo, children }: { estado: EstadoFolha; mudar: (e: EstadoFolha) => void; resumo: ReactNode; children: ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null);
  const topo = useRef<HTMLDivElement>(null);
  const arraste = useRef<{ y: number; h: number; t: number; moveu: boolean } | null>(null);
  const arrastou = useRef(false);
  const [medidas, setMedidas] = useState({ fechada: 96, max: 520 });
  const [altura, setAltura] = useState<number | null>(null);

  // a altura fechada acompanha o resumo; a cheia, o espaço do mapa
  useEffect(() => {
    const el = raiz.current;
    const t = topo.current;
    const pai = el?.parentElement;
    if (!el || !t || !pai) return;
    const obs = new ResizeObserver(() => setMedidas({ fechada: t.offsetHeight + 6, max: Math.max(260, pai.clientHeight - 6) }));
    obs.observe(t);
    obs.observe(pai);
    return () => obs.disconnect();
  }, []);

  const alturas: Record<EstadoFolha, number> = { fechada: medidas.fechada, meio: Math.round(medidas.max * 0.5), cheia: medidas.max };
  const alternar = () => mudar(estado === "fechada" ? "meio" : "fechada");

  const inicio = (e: EventoPonteiro<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input, select, a")) return;
    arraste.current = { y: e.clientY, h: raiz.current?.getBoundingClientRect().height ?? alturas[estado], t: performance.now(), moveu: false };
  };
  const mover = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arraste.current;
    if (!a) return;
    const dy = a.y - e.clientY;
    if (Math.abs(dy) > 6 && !a.moveu) {
      a.moveu = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    if (a.moveu) setAltura(Math.max(alturas.fechada - 20, Math.min(alturas.cheia, a.h + dy)));
  };
  const fim = (e: EventoPonteiro<HTMLDivElement>) => {
    const a = arraste.current;
    arraste.current = null;
    if (!a) return;
    if (!a.moveu) {
      // toque sem arrastar: só a alça alterna; nos botões o clique segue normal
      if ((e.target as HTMLElement).closest("[data-alca]")) alternar();
      return;
    }
    const h = a.h + (a.y - e.clientY);
    const vel = (a.y - e.clientY) / Math.max(1, performance.now() - a.t); // px/ms, + = para cima
    let alvo = ORDEM.reduce((m, k) => (Math.abs(alturas[k] - h) < Math.abs(alturas[m] - h) ? k : m), "fechada" as EstadoFolha);
    if (Math.abs(vel) > 0.5) alvo = ORDEM[Math.max(0, Math.min(2, ORDEM.indexOf(estado) + (vel > 0 ? 1 : -1)))];
    setAltura(null);
    mudar(alvo);
    // o clique que o navegador gera no fim do arraste não pode acionar botão
    arrastou.current = true;
    setTimeout(() => {
      arrastou.current = false;
    }, 80);
  };

  return (
    <div
      ref={raiz}
      style={{ height: altura ?? alturas[estado] }}
      className={cx(
        "absolute inset-x-0 bottom-0 z-[600] flex flex-col overflow-hidden rounded-t-2xl border-t border-borda bg-superficie shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.35)]",
        altura == null && "transition-[height] duration-200",
      )}
    >
      <div
        ref={topo}
        className="shrink-0 touch-none"
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fim}
        onPointerCancel={fim}
        onClickCapture={(e) => {
          if (!arrastou.current) return;
          e.stopPropagation();
          e.preventDefault();
          arrastou.current = false;
        }}
      >
        <div
          data-alca
          role="button"
          tabIndex={0}
          aria-label="Arrastar para ver mais ou menos da lista"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") alternar();
          }}
          className="flex justify-center py-2"
        >
          <span className="h-1.5 w-10 rounded-full bg-borda-2" />
        </div>
        {resumo}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  );
}

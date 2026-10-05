"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { posicionarBalao, type Lado } from "@/lib/balao";
import { cx } from "../ui";

interface Props {
  /** elemento de referência; null = fechado */
  ancora: HTMLElement | null;
  /** nome acessível */
  rotulo: string;
  lado?: Lado;
  /** com fechar: balão fixo (diálogo) que fecha com Esc e clique fora; sem: dica que só mostra */
  fechar?: () => void;
  className?: string;
  children: ReactNode;
}

/** Balão sobre a tela (portal no body): do lado pedido se couber e nunca fora da tela. */
export function Balao({ ancora, rotulo, lado = "cima", fechar, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // posiciona direto no elemento depois de medir (sem estado: nada de renderizar duas vezes)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!ancora || !el) return;
    const p = posicionarBalao(ancora.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }, lado);
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.style.visibility = "visible";
  });
  useEffect(() => {
    if (!ancora || !fechar) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    // clique na âncora não conta: quem abriu decide se fecha (alternar)
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!ref.current?.contains(alvo) && !ancora.contains(alvo)) fechar();
    };
    document.addEventListener("keydown", tecla);
    document.addEventListener("pointerdown", fora, true);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("pointerdown", fora, true);
    };
  }, [ancora, fechar]);
  if (!ancora) return null;
  return createPortal(
    <div
      ref={ref}
      role={fechar ? "dialog" : "tooltip"}
      aria-label={rotulo}
      style={{ position: "fixed", left: 0, top: 0, visibility: "hidden" }}
      className={cx("z-[1200] max-w-[calc(100vw-16px)] rounded-xl border border-borda bg-superficie text-[13px] text-texto shadow-xl", !fechar && "pointer-events-none", className)}
    >
      {children}
    </div>,
    document.body,
  );
}

"use client";

import { useEffect, useRef, type RefObject } from "react";
import { deslocarJanela, segDaFracao, zoomJanela, type Janela } from "@/lib/dominio/trilhas";

/**
 * Rodinha do mouse sobre a faixa: para cima aproxima (no ponto do mouse), para baixo afasta. Rodinha na horizontal
 * (touchpad) ou Shift + rodinha arrasta para os lados. `ref` é o elemento cuja largura é a janela inteira.
 * O ouvinte é nativo (passive: false) para a página e o mapa não rolarem junto.
 */
export function useZoomRoda(ref: RefObject<HTMLElement | null>, janela: Janela, mudar: (j: Janela) => void) {
  const atual = useRef({ janela, mudar });
  useEffect(() => {
    atual.current = { janela, mudar };
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const { janela: j, mudar: m } = atual.current;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const lado = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (lado) return m(deslocarJanela(j, (lado / r.width) * (j[1] - j[0])));
      if (!e.deltaY) return;
      const centro = segDaFracao((e.clientX - r.left) / r.width, j);
      m(zoomJanela(j, centro, e.deltaY < 0 ? 0.8 : 1.25));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [ref]);
}

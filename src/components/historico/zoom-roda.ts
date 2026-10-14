"use client";

import { useEffect, useRef, type RefObject } from "react";
import { deslocarJanela, segDaFracao, zoomJanela, type Janela } from "@/lib/dominio/trilhas";

/**
 * Rodinha do mouse sobre a faixa: para cima aproxima (no ponto do mouse), para baixo afasta. Rodinha na horizontal
 * (touchpad) ou Shift + rodinha arrasta para os lados. `ref` é o elemento cuja largura é a janela inteira.
 * O ouvinte é nativo (passive: false) para a página e o mapa não rolarem junto. `limite`: tamanho da régua (padrão:
 * o dia). `medida`: elemento com a largura da janela, quando a rodinha vale numa área maior (ex.: com os rótulos).
 */
export function useZoomRoda(ref: RefObject<HTMLElement | null>, janela: Janela, mudar: (j: Janela) => void, limite?: number, medida?: RefObject<HTMLElement | null>) {
  const atual = useRef({ janela, mudar, limite });
  useEffect(() => {
    atual.current = { janela, mudar, limite };
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const { janela: j, mudar: m, limite: l } = atual.current;
      const r = (medida?.current ?? el).getBoundingClientRect();
      if (!r.width) return;
      const lado = e.shiftKey ? e.deltaY || e.deltaX : Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : 0;
      if (lado) return m(deslocarJanela(j, (lado / r.width) * (j[1] - j[0]), l));
      if (!e.deltaY) return;
      const fracao = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      const centro = segDaFracao(fracao, j);
      m(zoomJanela(j, centro, e.deltaY < 0 ? 0.8 : 1.25, l));
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [ref, medida]);
}

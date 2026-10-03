"use client";

import { useSyncExternalStore } from "react";

// relógio compartilhado: idades ("há 2 min") envelhecem mesmo sem leitura nova
let agora = 0;
const ouvintesRelogio = new Set<() => void>();
let relogio: ReturnType<typeof setInterval> | null = null;
function assinarRelogio(f: () => void) {
  ouvintesRelogio.add(f);
  agora = Date.now();
  relogio ??= setInterval(() => {
    agora = Date.now();
    ouvintesRelogio.forEach((g) => g());
  }, 30_000);
  return () => {
    ouvintesRelogio.delete(f);
    if (!ouvintesRelogio.size && relogio) {
      clearInterval(relogio);
      relogio = null;
    }
  };
}
/** Hora atual em ms, atualizada a cada 30 s (0 na geração estática). */
export const useAgora = () => useSyncExternalStore(assinarRelogio, () => agora, () => 0);

const CELULAR = "(max-width: 767px)";
/** Tela de celular (abaixo do breakpoint md do Tailwind). */
export function useCelular(): boolean {
  return useSyncExternalStore(
    (f) => {
      const mq = window.matchMedia(CELULAR);
      mq.addEventListener("change", f);
      return () => mq.removeEventListener("change", f);
    },
    () => window.matchMedia(CELULAR).matches,
    () => false,
  );
}

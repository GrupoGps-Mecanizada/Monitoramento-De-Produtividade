"use client";

import { useCallback, useSyncExternalStore } from "react";

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

// preferências da tela (ex.: painel recolhido). Sem armazenamento no navegador (aba anônima, bloqueado),
// vale só nesta visita: a memória abaixo responde no lugar do localStorage.
const memoriaPref = new Map<string, boolean>();
const ouvintesPref = new Set<() => void>();
function lerPref(chave: string): boolean {
  if (memoriaPref.has(chave)) return memoriaPref.get(chave)!;
  try {
    return localStorage.getItem(chave) === "1";
  } catch {
    return false;
  }
}
/** Liga/desliga lembrado no navegador (falso na geração estática e até o navegador responder). */
export function usePreferencia(chave: string): [boolean, (v: boolean) => void] {
  const valor = useSyncExternalStore(
    (f) => {
      ouvintesPref.add(f);
      return () => ouvintesPref.delete(f);
    },
    () => lerPref(chave),
    () => false,
  );
  const mudar = useCallback(
    (v: boolean) => {
      memoriaPref.set(chave, v);
      try {
        localStorage.setItem(chave, v ? "1" : "0");
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      ouvintesPref.forEach((f) => f());
    },
    [chave],
  );
  return [valor, mudar];
}

// preferência de várias opções (ex.: altura do painel de trilhas), com a mesma regra de usePreferencia
const memoriaOpcao = new Map<string, string>();
function lerOpcao(chave: string): string | null {
  if (memoriaOpcao.has(chave)) return memoriaOpcao.get(chave)!;
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
/** Valor guardado só vale se for uma das opções (valor antigo ou estranho volta ao padrão). */
export const opcaoValida = <T extends string>(lido: string | null, opcoes: readonly T[], padrao: T): T => (lido != null && (opcoes as readonly string[]).includes(lido) ? (lido as T) : padrao);
/** Uma entre várias opções, lembrada no navegador (o padrão na geração estática e até o navegador responder). */
export function useOpcao<T extends string>(chave: string, opcoes: readonly T[], padrao: T): [T, (v: T) => void] {
  const lido = useSyncExternalStore(
    (f) => {
      ouvintesPref.add(f);
      return () => ouvintesPref.delete(f);
    },
    () => lerOpcao(chave),
    () => null,
  );
  const mudar = useCallback(
    (v: T) => {
      memoriaOpcao.set(chave, v);
      try {
        localStorage.setItem(chave, v);
      } catch {
        // sem armazenamento: vale só nesta visita
      }
      ouvintesPref.forEach((f) => f());
    },
    [chave],
  );
  return [opcaoValida(lido, opcoes, padrao), mudar];
}

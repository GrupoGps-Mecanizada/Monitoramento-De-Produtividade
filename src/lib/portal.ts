"use client";

import { useSyncExternalStore } from "react";

/**
 * Portal SGE (https://sge-portal.pages.dev): o Monitoramento abre numa moldura do portal, no mesmo endereço
 * (/Monitoramento-De-Produtividade/, repassado pelo roteador). O portal expõe `window.SGEPortal` (o mesmo contrato
 * da Barra Universal do sge-core): a barra do Monitoramento se apresenta e a do portal some; a logo volta ao início
 * do portal e "Sair" sai de todos os sistemas. Fora do portal (github.io aberto direto) tudo fica como antes.
 * Este sistema não tem login próprio (chave pública + RLS), então não há `SGEPortal.entrar()` a chamar.
 */
type Portal = {
  inicio: () => void;
  sair: () => void;
  entrar: () => void;
  registrarBarra: (janela: Window) => void;
};

export function portalSGE(): Portal | null {
  if (typeof window === "undefined") return null;
  try {
    const p = window.top !== window ? (window.top as Window & { SGEPortal?: Portal }).SGEPortal : undefined;
    return p ?? null;
  } catch {
    return null; // moldura de outro endereço: o navegador não deixa olhar a página de cima
  }
}

/** A barra do Monitoramento se apresenta ao portal (ele esconde a dele). */
export function avisarBarraAoPortal() {
  try {
    portalSGE()?.registrarBarra(window);
  } catch {
    /* portal antigo: segue com as duas barras */
  }
}

const nada = () => () => {};
/** true quando a tela está dentro do portal (no servidor e fora do portal: false). */
export function useNoPortal(): boolean {
  return useSyncExternalStore(nada, () => portalSGE() !== null, () => false);
}

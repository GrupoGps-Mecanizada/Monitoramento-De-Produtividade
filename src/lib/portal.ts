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
  /** Portal novo (casca Obsidian, 17/11/2026): versão 2 recebe as telas do sistema no menu em árvore dele. */
  versao?: number;
  receberMenu?: (janela: Window, dados: { secoes: SecaoPortal[]; atual: string | null; navegar: (href: string) => void }) => void;
};

/** Uma parte do sistema no menu em árvore do portal: título + telas (endereços completos, com o basePath). */
export type SecaoPortal = { rotulo: string; href: string | null; itens: { rotulo: string; href: string }[] | null };

/** Portal novo (versão 2, com menu em árvore): o sistema esconde a barra dele e manda as telas para o portal. */
export function portalNovo(): (Portal & Required<Pick<Portal, "receberMenu">>) | null {
  const p = portalSGE();
  return p && (p.versao ?? 0) >= 2 && typeof p.receberMenu === "function" ? (p as Portal & Required<Pick<Portal, "receberMenu">>) : null;
}

/** Partes do menu (Ao vivo, Análises, Cadastros) → partes do menu em árvore do portal, com o endereço completo (com barra no fim). */
export function secoesParaPortal(partes: { rotulo: string; telas: { href: string; rotulo: string }[] }[], base: string): SecaoPortal[] {
  const completo = (h: string) => (h === "/" ? `${base}/` : `${base}${h}/`);
  return partes.filter((p) => p.telas.length).map((p) => ({ rotulo: p.rotulo, href: null, itens: p.telas.map((t) => ({ rotulo: t.rotulo, href: completo(t.href) })) }));
}

/**
 * Um visual só (dono, 17/11/2026): aberto direto no endereço do portal (sge-portal.pages.dev/Monitoramento-De-Produtividade/…,
 * fora de moldura), vai para dentro do portal na mesma tela (#/u/<caminho>). Devolve para onde ir, ou null para ficar.
 * Fica quando: já está numa moldura, é outro endereço (github.io, localhost) ou o portal abriu numa aba própria (sge_fora).
 */
export function destinoForaDoPortal(href: string, emQuadro: boolean, marcadoFora: boolean): string | null {
  if (emQuadro || marcadoFora) return null;
  let u: URL;
  try { u = new URL(href); } catch { return null; }
  if (u.protocol !== "https:" || u.hostname !== "sge-portal.pages.dev" || u.searchParams.has("sge_fora")) return null;
  return `${u.origin}/#/u/${encodeURIComponent(u.pathname + u.search + u.hash)}`;
}

export function irParaOPortalSeAbertoPorFora() {
  if (typeof window === "undefined") return;
  if (recarregarPortalAntigo()) return;
  let marcado = false;
  try {
    if (new URL(location.href).searchParams.has("sge_fora")) sessionStorage.setItem("sge_fora", "1");
    marcado = sessionStorage.getItem("sge_fora") === "1";
  } catch { /* sem sessionStorage: decide só pelo endereço */ }
  const ir = destinoForaDoPortal(location.href, window.top !== window, marcado);
  if (ir) location.replace(ir);
}

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

/** Portal antigo: tem SGEPortal (registrarBarra), mas sem versao >= 2. */
export function ePortalAntigo(p: unknown): boolean {
  const q = p as { registrarBarra?: unknown; versao?: unknown } | null;
  return !!q && typeof q === "object" && typeof q.registrarBarra === "function" && !((Number(q.versao) || 0) >= 2);
}

/**
 * Portal antigo aberto (pedido do dono, 18/11/2026): ele não tem aviso de versão. Quando o sistema abre dentro dele,
 * recarrega a página de cima, que volta no portal novo. Trava de 2 minutos (mesma chave do sge-core) contra laço.
 */
export function recarregarPortalAntigo(janela: Window = window): boolean {
  try {
    const topo = janela.top as (Window & { SGEPortal?: unknown }) | null;
    if (!topo || topo === janela || !ePortalAntigo(topo.SGEPortal)) return false;
    const antes = Number(topo.sessionStorage.getItem("sge_recarregou_portal")) || 0;
    if (Date.now() - antes < 120000) return false;
    topo.sessionStorage.setItem("sge_recarregou_portal", String(Date.now()));
    topo.location.reload();
    return true;
  } catch {
    return false; // outro endereço ou sem sessionStorage
  }
}

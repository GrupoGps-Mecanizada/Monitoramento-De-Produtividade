"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BASE } from "@/lib/marca";
import { CATEGORIAS, MENU, telaAtiva, telasDa } from "@/lib/menu";
import { irParaOPortalSeAbertoPorFora, portalNovo, secoesParaPortal } from "@/lib/portal";

const nada = () => () => {};

/**
 * Portal novo (casca Obsidian, 17/11/2026): um visual só. Dentro dele o Controle de Frota não desenha a barra de cima
 * (nem a de baixo do celular); manda as telas para o menu em árvore do portal e troca de tela quando o portal pede.
 * Aberto direto no endereço do portal, vai para dentro dele.
 */
export function useNoPortalNovo(): boolean {
  useEffect(() => { irParaOPortalSeAbertoPorFora(); }, []);
  return useSyncExternalStore(nada, () => portalNovo() !== null, () => false);
}

export function MenuNoPortal() {
  const caminho = usePathname();
  const router = useRouter();
  // tela cheia (Portfólio 24, opção C): sem cinza em volta nem caixa na planilha (regras em globals.css)
  useEffect(() => {
    document.documentElement.classList.add("sge-embutido");
  }, []);
  useEffect(() => {
    const portal = portalNovo();
    if (!portal) return;
    const atual = MENU.filter((m) => telaAtiva(caminho, m.href)).sort((a, b) => b.href.length - a.href.length)[0];
    const completo = (h: string) => (h === "/" ? `${BASE}/` : `${BASE}${h}/`);
    try {
      portal.receberMenu(window, {
        secoes: secoesParaPortal(CATEGORIAS.map((c) => ({ rotulo: c.rotulo, telas: telasDa(c) })), BASE),
        atual: atual ? completo(atual.href) : null,
        // o portal manda o endereço completo; o Next navega sem o basePath. Roda numa tarefa desta página
        // (chamado direto pela página de cima, o Next quebra).
        navegar: (href: string) => {
          const destino = href.startsWith(BASE) ? href.slice(BASE.length) || "/" : href;
          window.setTimeout(() => router.push(destino), 0);
        },
      });
    } catch {
      /* portal fechado ou trocado: segue sem avisar */
    }
  }, [caminho, router]);
  return null;
}

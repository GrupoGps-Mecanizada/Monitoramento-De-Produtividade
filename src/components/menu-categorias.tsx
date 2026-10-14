"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIAS, MENU, categoriaAtiva, telaAtiva, telasDa } from "@/lib/menu";
import { Icone } from "./icones";
import { cx } from "./ui";

/** Abre e fecha a lista de uma categoria; fecha ao trocar de tela, com Esc ou clicando fora. */
function useAberto() {
  const caminho = usePathname();
  const [aberto, setAberto] = useState<string | null>(null);
  const caixa = useRef<HTMLElement>(null);
  const [visto, setVisto] = useState(caminho);
  if (visto !== caminho) {
    setVisto(caminho);
    setAberto(null);
  }
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => !caixa.current?.contains(e.target as Node) && setAberto(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(null);
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  return { caminho, aberto, setAberto, caixa };
}

const seta = (aberta: boolean) => (
  <svg aria-hidden viewBox="0 0 12 12" className={cx("h-3 w-3 opacity-70 transition-transform", aberta && "rotate-180")}>
    <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Menu do computador: 3 categorias; a categoria com uma tela só vai direto; a categoria aberta mostra a tela atual. */
export function MenuCategorias() {
  const { caminho, aberto, setAberto, caixa } = useAberto();
  const ativa = categoriaAtiva(caminho);
  const atual = MENU.find((m) => telaAtiva(caminho, m.href));
  const estilo = (ligado: boolean) =>
    cx(
      "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:no-underline",
      ligado ? "bg-nav-ativo text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-nav-suave hover:bg-nav-hover hover:text-white",
    );
  return (
    <nav ref={caixa} aria-label="Menu principal" className="flex min-w-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
      {CATEGORIAS.map((c) => {
        const ligada = c === ativa;
        const telas = telasDa(c);
        if (telas.length === 1)
          return (
            <Link key={c.id} href={telas[0].href} aria-current={ligada ? "page" : undefined} aria-label={c.rotulo} className={estilo(ligada)}>
              <Icone nome={c.icone} className={cx("h-[17px] w-[17px]", ligada ? "text-[#8fb1f5]" : "opacity-80")} />
              {c.rotulo}
            </Link>
          );
        return (
          <div key={c.id} className="relative">
            <button type="button" aria-expanded={aberto === c.id} onClick={() => setAberto((a) => (a === c.id ? null : c.id))} className={estilo(ligada)}>
              <Icone nome={c.icone} className={cx("h-[17px] w-[17px]", ligada ? "text-[#8fb1f5]" : "opacity-80")} />
              {c.rotulo}
              {ligada && atual && <span className="font-normal text-nav-suave">· {atual.rotulo}</span>}
              {seta(aberto === c.id)}
            </button>
            {aberto === c.id && (
              <div className="absolute left-0 top-full z-[1100] mt-2 min-w-[220px] rounded-xl border border-nav-borda bg-nav p-1 shadow-2xl">
                {telas.map((m) => {
                  const ativo = telaAtiva(caminho, m.href);
                  return (
                    <Link
                      key={m.href}
                      href={m.href}
                      aria-current={ativo ? "page" : undefined}
                      className={cx("flex h-9 items-center gap-2.5 rounded-lg px-3 text-[13.5px] hover:no-underline", ativo ? "bg-nav-ativo text-white" : "text-nav-suave hover:bg-nav-hover hover:text-white")}
                    >
                      <Icone nome={m.icone} className="h-[17px] w-[17px] opacity-80" />
                      {m.rotulo}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Menu do celular (barra de baixo): 3 categorias + a busca; a categoria abre a lista das telas por cima da barra. */
export function MenuCelular({ buscar, iconeBusca }: { buscar: () => void; iconeBusca: React.ReactNode }) {
  const { caminho, aberto, setAberto, caixa } = useAberto();
  const ativa = categoriaAtiva(caminho);
  const item = (ligada: boolean) => cx("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold hover:no-underline", ligada ? "text-link" : "text-suave");
  const lista = CATEGORIAS.find((c) => c.id === aberto);
  return (
    <nav ref={caixa} aria-label="Telas" className="fixed inset-x-0 bottom-0 z-[1000] flex h-16 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
      {lista && (
        <div className="absolute inset-x-2 bottom-[calc(100%+8px)] rounded-xl border border-borda bg-superficie p-1 shadow-2xl">
          {telasDa(lista).map((m) => (
            <Link
              key={m.href}
              href={m.href}
              aria-current={telaAtiva(caminho, m.href) ? "page" : undefined}
              className={cx("flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] hover:no-underline", telaAtiva(caminho, m.href) ? "bg-primaria-suave font-semibold text-texto" : "text-texto")}
            >
              <Icone nome={m.icone} className="h-5 w-5 opacity-80" />
              {m.rotulo}
            </Link>
          ))}
        </div>
      )}
      {CATEGORIAS.map((c) => {
        const telas = telasDa(c);
        if (telas.length === 1)
          return (
            <Link key={c.id} href={telas[0].href} aria-current={c === ativa ? "page" : undefined} className={item(c === ativa)}>
              <Icone nome={c.icone} className="h-[21px] w-[21px]" />
              {c.rotulo}
            </Link>
          );
        return (
          <button key={c.id} type="button" aria-expanded={aberto === c.id} onClick={() => setAberto((a) => (a === c.id ? null : c.id))} className={item(c === ativa)}>
            <Icone nome={c.icone} className="h-[21px] w-[21px]" />
            {c.rotulo}
          </button>
        );
      })}
      <button type="button" onClick={buscar} className={item(false)}>
        {iconeBusca}
        Buscar
      </button>
    </nav>
  );
}

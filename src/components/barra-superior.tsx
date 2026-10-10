"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MARCA } from "@/lib/marca";
import { MENU, telaAtiva } from "@/lib/menu";
import { avisarBarraAoPortal, portalSGE, useNoPortal } from "@/lib/portal";
import { useTema } from "@/lib/tema";
import { CAMINHOS, Icone } from "./icones";
import { IndicadorVivo } from "./indicador-vivo";
import { abrirPaleta } from "./paleta";
import { cx } from "./ui";

/**
 * Barra superior "Campo" (a mesma do SST): logo, telas com ícone num trilho próprio, leitura ao vivo,
 * busca Ctrl K e tema. No celular: cabeçalho compacto + barra inferior com as telas e a busca.
 * Dentro do Portal SGE: a barra do portal some, a logo volta ao início do portal e aparece "Sair".
 */
export function BarraSuperior() {
  const caminho = usePathname();
  const [tema, alternarTema] = useTema();
  const atual = MENU.find((m) => telaAtiva(caminho, m.href));
  const noPortal = useNoPortal();
  useEffect(() => avisarBarraAoPortal(), []);
  // no portal, a logo volta para o início do portal (de onde se troca de sistema)
  const inicioDoPortal = (e: React.MouseEvent) => {
    const portal = portalSGE();
    if (!portal) return;
    e.preventDefault();
    portal.inicio();
  };
  // só existe no portal: sair vale para todos os sistemas (este não tem login próprio)
  const botaoSair = noPortal && (
    <button
      type="button"
      onClick={() => portalSGE()?.sair()}
      title="Sair do portal"
      aria-label="Sair"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-nav-texto transition-colors hover:bg-white/[0.1]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
      </svg>
    </button>
  );

  const logo = (tam: string) => (
    <span className={cx("flex shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm ring-1 ring-black/5", tam)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARCA.logo} alt={MARCA.dona} className="h-full w-full object-contain" />
    </span>
  );
  const botaoTema = (
    <button
      type="button"
      onClick={alternarTema}
      title={tema === "escuro" ? "Tema claro" : "Tema escuro"}
      aria-label="Alternar tema"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-nav-texto transition-colors hover:bg-white/[0.1]"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
    </button>
  );
  const iconeBusca = (tam: string) => (
    <svg viewBox="0 0 24 24" className={tam} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <path d={CAMINHOS.busca} />
    </svg>
  );

  return (
    <>
      {/* computador */}
      <header className="sticky top-0 z-[1000] hidden h-[62px] items-center gap-3 border-b border-nav-borda bg-nav px-5 text-nav-texto shadow-[0_1px_0_rgba(255,255,255,0.04),0_6px_16px_-8px_rgba(0,0,0,0.5)] md:flex">
        <Link href="/" onClick={inicioDoPortal} className="flex shrink-0 items-center gap-3 whitespace-nowrap hover:no-underline">
          {logo("h-9 w-9")}
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-white">
              {MARCA.sigla} <span className="font-normal text-nav-suave">·</span> {MARCA.empresa}
            </span>
            <span className="block text-[12px] text-nav-suave">{MARCA.area}</span>
          </span>
        </Link>
        <span aria-hidden className="mx-3 h-7 w-px shrink-0 bg-nav-borda lg:mx-5" />
        <nav aria-label="Menu principal" className="flex min-w-0 items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
          {MENU.map((m) => {
            const ativo = telaAtiva(caminho, m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={ativo ? "page" : undefined}
                className={cx(
                  "flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-[13.5px] font-medium transition-colors hover:no-underline",
                  ativo ? "bg-nav-ativo text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "text-nav-suave hover:bg-nav-hover hover:text-white",
                )}
              >
                <Icone nome={m.icone} className={cx("h-[17px] w-[17px]", ativo ? "text-[#8fb1f5]" : "opacity-80")} />
                {m.rotulo}
              </Link>
            );
          })}
        </nav>
        <div className="flex-1" />
        <IndicadorVivo />
        <button
          type="button"
          onClick={abrirPaleta}
          title="Buscar (Ctrl K)"
          className="flex h-9 min-w-9 shrink items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[13px] text-nav-suave transition-colors hover:border-white/15 hover:bg-white/[0.08] hover:text-nav-texto min-[1400px]:w-60"
        >
          {iconeBusca("h-[15px] w-[15px] shrink-0")}
          <span className="hidden flex-1 text-left min-[1400px]:inline">Buscar veículo, área…</span>
          <kbd className="hidden rounded-md border border-white/10 bg-white/[0.06] px-1.5 text-[11px] min-[1400px]:inline">Ctrl K</kbd>
        </button>
        {botaoTema}
        {botaoSair}
      </header>

      {/* celular */}
      <header className="sticky top-0 z-[1000] flex h-14 items-center gap-2.5 border-b border-nav-borda bg-nav px-3.5 text-nav-texto md:hidden">
        {noPortal ? (
          <button type="button" onClick={inicioDoPortal} title="Início do portal" aria-label="Início do portal" className="shrink-0">
            {logo("h-[34px] w-[34px]")}
          </button>
        ) : (
          logo("h-[34px] w-[34px]")
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-semibold">
            {MARCA.sigla} · {MARCA.area}
          </p>
          <p className="truncate text-[11px] text-nav-suave">{atual?.rotulo}</p>
        </div>
        <IndicadorVivo curto />
        {botaoTema}
        {botaoSair}
      </header>
      <nav aria-label="Telas" className="fixed inset-x-0 bottom-0 z-[1000] flex h-16 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        {MENU.map((m) => {
          const ativo = telaAtiva(caminho, m.href);
          return (
            <Link
              key={m.href}
              href={m.href}
              aria-current={ativo ? "page" : undefined}
              className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold hover:no-underline", ativo ? "text-link" : "text-suave")}
            >
              <Icone nome={m.icone} className="h-[21px] w-[21px]" />
              {m.curto}
            </Link>
          );
        })}
        <button type="button" onClick={abrirPaleta} className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-suave">
          {iconeBusca("h-[21px] w-[21px]")}
          Buscar
        </button>
      </nav>
    </>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { Gaveta } from "@/components/gaveta";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Segmentado } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { STATUS_GAUSS } from "@/lib/dominio/gauss-dia";

/** Botão do funil (canto de cima, à direita do mapa): abre veículo, dia e opções. */
export function BotaoFunil({ abrir, rotulo = "Veículo, dia e opções" }: { abrir: () => void; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={rotulo}
      title={rotulo}
      className="absolute right-3 top-3 z-[600] grid h-10 w-10 place-items-center rounded-full bg-[#0b1220]/80 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#0b1220]"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" aria-hidden>
        <path d="M3 5h18l-7 8.5V19l-4 1.5v-7z" />
      </svg>
    </button>
  );
}

/** Cartão de cima, à esquerda: "DSY-6472 · 18:44:10 · Ligado · PATIO". Toque abre o funil. */
export function CartaoTopo({ abrir, children, rotulo }: { abrir: () => void; children: ReactNode; rotulo?: string }) {
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label={rotulo}
      className="absolute left-3 top-3 z-[600] flex max-w-[calc(100%-80px)] items-center gap-2 overflow-hidden whitespace-nowrap rounded-full bg-[#0b1220]/80 px-3.5 py-2 text-[13px] text-white shadow-lg backdrop-blur-sm transition hover:bg-[#0b1220]"
    >
      {children}
    </button>
  );
}

// cores da linha do motor: os status mais comuns da timeline de motor do GAUSS
const LEGENDA = ["on", "secondary_motor_on", "stopped", "off", "categorized_stop", "maintenance"].map((c) => STATUS_GAUSS[c]);

/** Seção do painel do funil (título pequeno em maiúsculas). */
export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-b border-borda py-4 first:pt-0 last:border-0">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-suave">{titulo}</h3>
      {children}
    </section>
  );
}

/** Camada do mapa (satélite ou ruas), escolhida no funil: o mapa fica sem botões por cima. */
function CamadaMapa({ pronto }: { pronto: MapaPronto }) {
  const nomes = Object.keys(pronto.camadasBase);
  const [atual, setAtual] = useState(() => nomes.find((n) => pronto.mapa.hasLayer(pronto.camadasBase[n])) ?? nomes[0]);
  const trocar = (n: string) => {
    for (const [k, c] of Object.entries(pronto.camadasBase)) if (k !== n) c.remove();
    pronto.camadasBase[n].addTo(pronto.mapa);
    setAtual(n);
  };
  return <Segmentado rotulo="Camada do mapa" valor={atual} mudar={trocar} opcoes={nomes.map((n) => ({ id: n, rotulo: n }))} />;
}

/** Painel do funil: veículo e dia, o que o dia carregado oferece (children) e o mapa (camada e cores). */
export function PainelOpcoes({ fechar, formulario, pronto, children }: { fechar: () => void; formulario: ReactNode; pronto: MapaPronto | null; children?: ReactNode }) {
  return (
    <Gaveta titulo="Timeline" sub="Veículo, dia e opções" fechar={fechar} largura="min(420px, 100vw)">
      <Secao titulo="Veículo e dia">{formulario}</Secao>
      {children}
      <Secao titulo="Mapa">
        <div className="space-y-3">
          {pronto && <CamadaMapa pronto={pronto} />}
          <ul aria-label="Cores da linha do motor" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-suave">
            {LEGENDA.map((e) => (
              <li key={e.rotulo} className="flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full" style={{ background: corDoTom(e.tom) }} />
                {e.rotulo}
              </li>
            ))}
          </ul>
        </div>
      </Secao>
    </Gaveta>
  );
}

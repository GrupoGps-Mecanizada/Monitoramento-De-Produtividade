"use client";

import { useState, type PointerEvent as EventoPonteiro } from "react";
import { corDoTom } from "@/lib/cores";
import { fmtHora, fmtMin } from "@/lib/dominio/formato";
import type { BlocoGauss } from "@/lib/dominio/gauss-dia";
import { DIA, emPct, posBloco, segDaFracao, type Janela } from "@/lib/dominio/trilhas";
import type { Player } from "./use-player";

/**
 * Linha fina do dia com a cor do status do motor (timeline de motor do GAUSS) e o marcador da hora. Mostra a janela
 * (o dia inteiro ou o zoom da rodinha do mouse). Clicar ou arrastar leva o caminhão ao horário; setas andam 5 min.
 */
export function LinhaDia({ blocos, player, janela = [0, DIA] }: { blocos: BlocoGauss[]; player: Player; janela?: Janela }) {
  const [arrastando, setArrastando] = useState(false);
  const [sobre, setSobre] = useState<number | null>(null);
  const emSeg = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return segDaFracao((e.clientX - r.left) / r.width, janela);
  };
  const naJanela = player.t >= janela[0] && player.t <= janela[1];
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Linha do dia"
      aria-valuemin={janela[0]}
      aria-valuemax={janela[1]}
      aria-valuenow={Math.round(player.t)}
      aria-valuetext={fmtHora(player.t)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setArrastando(true);
        player.irPara(emSeg(e));
      }}
      onPointerMove={(e) => {
        const s = emSeg(e);
        setSobre(s);
        if (arrastando && e.currentTarget.hasPointerCapture(e.pointerId)) player.irPara(s);
      }}
      onPointerUp={() => setArrastando(false)}
      onPointerLeave={() => setSobre(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") player.irPara(player.t + 300);
        if (e.key === "ArrowLeft") player.irPara(player.t - 300);
      }}
      className="group relative flex h-6 cursor-pointer touch-none select-none items-center"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover:h-2.5">
        {blocos.map((x, i) => {
          const p = posBloco(x.a, x.b, janela);
          if (!p) return null;
          return (
            <span
              key={i}
              title={`${fmtHora(x.a).slice(0, 5)}–${fmtHora(x.b).slice(0, 5)} · ${x.rotulo} · ${fmtMin((x.b - x.a) / 60)}`}
              className="absolute inset-y-0"
              style={{ left: `${p.esq}%`, width: `${p.larg}%`, background: corDoTom(x.tom) }}
            />
          );
        })}
      </div>
      {/* marcador da hora */}
      {naJanela && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#0b1220] shadow" style={{ left: `${emPct(player.t, janela)}%` }} />
      )}
      {sobre != null && (
        <span aria-hidden className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded bg-[#0b1220]/90 px-1.5 py-0.5 text-[11px] tabular-nums text-white" style={{ left: `${emPct(sobre, janela)}%` }}>
          {fmtHora(sobre).slice(0, 5)}
        </span>
      )}
    </div>
  );
}

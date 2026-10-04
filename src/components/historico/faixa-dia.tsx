"use client";

import { useState, type PointerEvent as EventoPonteiro } from "react";
import { corDoTom } from "@/lib/cores";
import { segCap, type HistoriaDia, type TipoLugar } from "@/lib/dominio/capitulos";
import { fmtHora, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";
import { cx } from "../ui";
import type { Player } from "./use-player";

const DIA = 86400;
const pct = (s: number) => `${(Math.min(DIA, Math.max(0, s)) / DIA) * 100}%`;
export const LUGARES: Record<TipoLugar, { rotulo: string; classe: string }> = {
  base: { rotulo: "pátio/base", classe: "bg-slate-500 text-white" },
  servico: { rotulo: "área de serviço", classe: "bg-teal-700 text-white" },
  via: { rotulo: "em vias", classe: "faixa-via" },
};

interface Props {
  h: Historico;
  historia: HistoriaDia;
  player: Player;
  foco: [number, number] | null;
  mudarFoco: (f: [number, number] | null) => void;
}

/** O dia de 0h a 24h em duas trilhas alinhadas (onde estava / motor). Toque leva o caminhão ao horário; arrastar escolhe um foco. */
export function FaixaDia({ h, historia, player, foco, mudarFoco }: Props) {
  const [arrasto, setArrasto] = useState<{ a: number; b: number } | null>(null);
  const emSeg = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * DIA;
  };
  const janela = arrasto ? ([Math.min(arrasto.a, arrasto.b), Math.max(arrasto.a, arrasto.b)] as const) : foco;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 text-[10px] text-suave">
        <span className="font-semibold uppercase tracking-wider">Onde estava</span>
        <span className="flex gap-2.5">
          {(Object.keys(LUGARES) as TipoLugar[]).map((t) => (
            <span key={t} className="flex items-center gap-1">
              <i className={cx("inline-block h-2 w-2 rounded-sm", LUGARES[t].classe)} />
              {LUGARES[t].rotulo}
            </span>
          ))}
        </span>
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Faixa do dia"
        aria-valuemin={0}
        aria-valuemax={DIA}
        aria-valuenow={Math.round(player.t)}
        aria-valuetext={fmtHora(player.t)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          const s = emSeg(e);
          setArrasto({ a: s, b: s });
        }}
        onPointerMove={(e) => {
          if (arrasto && e.currentTarget.hasPointerCapture(e.pointerId)) setArrasto({ a: arrasto.a, b: emSeg(e) });
        }}
        onPointerUp={(e) => {
          if (!arrasto) return;
          const b = emSeg(e);
          setArrasto(null);
          // arrastar mais que 10 min escolhe um foco; um toque leva o caminhão ao horário
          if (Math.abs(b - arrasto.a) > 600) mudarFoco([Math.min(arrasto.a, b), Math.max(arrasto.a, b)]);
          else player.irPara(b);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") player.irPara(player.t + 300);
          if (e.key === "ArrowLeft") player.irPara(player.t - 300);
          if (e.key === "Escape") mudarFoco(null);
        }}
        className="relative cursor-pointer touch-none select-none"
      >
        <div className="relative h-7 overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10">
          {historia.faixaLugar.map((f, i) => {
            const a = segCap(f.inicio);
            const b = segCap(f.fim);
            return (
              <span
                key={i}
                title={`${hhmm(f.inicio)}–${hhmm(f.fim)} · ${f.lugar || LUGARES[f.tipoLugar].rotulo}`}
                className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/70 px-1 text-[9.5px] font-semibold leading-7", LUGARES[f.tipoLugar].classe)}
                style={{ left: pct(a), width: pct(Math.max(b - a, 60)) }}
              >
                {f.lugar}
              </span>
            );
          })}
        </div>
        <p className="mb-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-suave">Motor</p>
        <div className="relative h-3 overflow-hidden rounded bg-superficie-2">
          {historia.faixaMotor.map((f, i) => {
            const a = segCap(f.inicio);
            const b = segCap(f.fim);
            return <span key={i} title={`${hhmm(f.inicio)}–${hhmm(f.fim)} · ${ESTADOS_TRECHO[f.estado].rotulo}`} className="absolute inset-y-0" style={{ left: pct(a), width: pct(Math.max(b - a, 60)), background: corDoTom(ESTADOS_TRECHO[f.estado].tom) }} />;
          })}
        </div>
        {h.motor2 && (
          <>
            <p className="mb-1 mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-suave">⚙ Bomba (motor 2º){h.motor2.placa ? ` · ${h.motor2.placa}` : ""}</p>
            <div className="relative h-2 overflow-hidden rounded bg-superficie-2">
              {h.motor2.intervalos.map(([a, b]) => (
                <span key={a} className="absolute inset-y-0 bg-motor2" style={{ left: pct(segDe(a)), width: pct(Math.max(segDe(b) - segDe(a), 60)) }} />
              ))}
            </div>
          </>
        )}
        {janela && (
          <span aria-hidden className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-primaria" style={{ left: pct(janela[0]), width: pct(janela[1] - janela[0]), background: "color-mix(in srgb, var(--primaria) 12%, transparent)" }} />
        )}
        <span aria-hidden className="pointer-events-none absolute -bottom-1 -top-1 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: pct(player.t) }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-suave">
        {["0h", "6h", "12h", "18h", "24h"].map((x) => (
          <span key={x}>{x}</span>
        ))}
      </div>
      {!h.motor2 && h.motor2_erro && <p className="mt-0.5 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
      {foco ? (
        <button type="button" onClick={() => mudarFoco(null)} className="mt-1 text-xs text-link">
          Foco {fmtHora(foco[0]).slice(0, 5)}–{fmtHora(foco[1]).slice(0, 5)} · ✕ limpar
        </button>
      ) : (
        <p className="mt-1 text-[11px] text-suave">Toque para ir ao horário · arraste para focar um período</p>
      )}
    </div>
  );
}

"use client";

import { useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { corDoTom } from "@/lib/cores";
import { segCap, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { fmtHora, fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { emPct, marcasRegua, posBloco, segDaFracao, type Janela } from "@/lib/dominio/trilhas";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";
import { Balao } from "../trilhas/balao";
import { Regua } from "../trilhas/regua";
import { cx } from "../ui";
import { LUGARES } from "./faixa-dia";
import type { Player } from "./use-player";

export const ALTURAS_TRILHAS = ["fina", "normal", "alta"] as const;
export type AlturaTrilhas = (typeof ALTURAS_TRILHAS)[number];
// altura (px) de cada trilha; 0 = escondida
const PX: Record<AlturaTrilhas, { cap: number; lugar: number; motor: number; bomba: number }> = {
  fina: { cap: 0, lugar: 12, motor: 0, bomba: 0 },
  normal: { cap: 22, lugar: 26, motor: 12, bomba: 8 },
  alta: { cap: 30, lugar: 40, motor: 20, bomba: 14 },
};

interface Props {
  h: Historico;
  historia: HistoriaDia;
  player: Player;
  janela: Janela;
  altura: AlturaTrilhas;
  foco: [number, number] | null;
  mudarFoco: (f: [number, number] | null) => void;
  atual: number | null;
  irCapitulo: (c: Capitulo) => void;
}

/**
 * O dia em trilhas horizontais (capítulos, onde estava, motor, bomba) sobre a régua. Passar o mouse mostra o balão
 * do bloco; nas faixas, um toque leva o caminhão ao horário e arrastar escolhe um foco (como a FaixaDia do celular).
 */
export function TrilhasDia({ h, historia, player, janela, altura, foco, mudarFoco, atual, irCapitulo }: Props) {
  const px = PX[altura];
  const [arrasto, setArrasto] = useState<{ a: number; b: number } | null>(null);
  const [dica, setDica] = useState<{ el: HTMLElement; c: ReactNode } | null>(null);
  const mostrar = (el: HTMLElement, c: ReactNode) => !arrasto && setDica({ el, c });
  const emSeg = (e: EventoPonteiro<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return segDaFracao((e.clientX - r.left) / r.width, janela);
  };
  const estilo = (a: number, b: number) => {
    const p = posBloco(a, b, janela);
    return p && { left: `${p.esq}%`, width: `${p.larg}%` };
  };
  const sel = arrasto ? ([Math.min(arrasto.a, arrasto.b), Math.max(arrasto.a, arrasto.b)] as const) : foco;
  const rotulos: [string, number][] = [
    ["Capítulos", px.cap],
    ["Onde estava", px.lugar],
    ["Motor", px.motor],
    ...(h.motor2 ? [[`⚙ Bomba${h.motor2.placa ? ` · ${h.motor2.placa}` : ""}`, px.bomba] as [string, number]] : []),
  ];
  const noPlayer = player.t >= janela[0] && player.t <= janela[1];

  return (
    <div className="grid grid-cols-[104px_1fr] gap-x-2">
      <div className="flex flex-col gap-1 pt-5 text-[10px] font-semibold uppercase tracking-wider text-suave">
        {rotulos
          .filter(([, a]) => a > 0)
          .map(([r, a]) => (
            <span key={r} className="flex items-center truncate" style={{ height: a }}>
              {r}
            </span>
          ))}
      </div>
      <div className="relative" onPointerLeave={() => setDica(null)}>
        <Regua janela={janela} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-5">
          {marcasRegua(janela).map((s) => (
            <span key={s} className="absolute inset-y-0 w-px bg-borda/60" style={{ left: `${emPct(s, janela)}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {px.cap > 0 && (
            <div className="relative" style={{ height: px.cap }}>
              {historia.capitulos.map((c) => {
                const st = estilo(segCap(c.inicio), segCap(c.fim));
                if (!st) return null;
                const balao = <BalaoCapitulo c={c} />;
                return (
                  <button
                    key={c.n}
                    type="button"
                    data-capitulo={c.n}
                    aria-label={`Capítulo ${c.n} · ${c.lugar} · ${hhmm(c.inicio)}–${hhmm(c.fim)}`}
                    aria-current={atual === c.n ? "step" : undefined}
                    onClick={() => irCapitulo(c)}
                    onPointerEnter={(e) => mostrar(e.currentTarget, balao)}
                    onFocus={(e) => mostrar(e.currentTarget, balao)}
                    onBlur={() => setDica(null)}
                    className={cx("absolute inset-y-0 flex min-w-[18px] items-center gap-1 overflow-hidden rounded-md px-0.5 text-[10px] font-semibold text-white", c.tipoLugar === "base" ? "bg-slate-500" : "bg-primaria", atual === c.n && "ring-2 ring-texto")}
                    style={st}
                  >
                    <span className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-white/25 px-0.5">{c.n}</span>
                    <span className="truncate">{c.lugar}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div
            role="slider"
            tabIndex={0}
            aria-label="Faixa do dia"
            aria-valuemin={janela[0]}
            aria-valuemax={janela[1]}
            aria-valuenow={Math.round(player.t)}
            aria-valuetext={fmtHora(player.t)}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDica(null);
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
            className="relative flex cursor-pointer touch-none select-none flex-col gap-1"
          >
            <div className="relative overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10" style={{ height: px.lugar }}>
              {historia.faixaLugar.map((f, i) => {
                const st = estilo(segCap(f.inicio), segCap(f.fim));
                if (!st) return null;
                return (
                  <span
                    key={i}
                    onPointerEnter={(e) =>
                      mostrar(
                        e.currentTarget,
                        <>
                          <b>{f.lugar || LUGARES[f.tipoLugar].rotulo}</b>
                          <br />
                          {hhmm(f.inicio)}–{hhmm(f.fim)} · {fmtMin((segCap(f.fim) - segCap(f.inicio)) / 60)}
                        </>,
                      )
                    }
                    className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/70 px-1 text-[10px] font-semibold", LUGARES[f.tipoLugar].classe)}
                    style={{ ...st, lineHeight: `${px.lugar}px` }}
                  >
                    {px.lugar >= 20 ? f.lugar : ""}
                  </span>
                );
              })}
            </div>
            {px.motor > 0 && (
              <div className="relative overflow-hidden rounded bg-superficie-2" style={{ height: px.motor }}>
                {historia.faixaMotor.map((f, i) => {
                  const st = estilo(segCap(f.inicio), segCap(f.fim));
                  if (!st) return null;
                  return (
                    <span
                      key={i}
                      onPointerEnter={(e) =>
                        mostrar(
                          e.currentTarget,
                          <>
                            <b>{ESTADOS_TRECHO[f.estado].rotulo}</b>
                            <br />
                            {hhmm(f.inicio)}–{hhmm(f.fim)} · {fmtMin((segCap(f.fim) - segCap(f.inicio)) / 60)}
                          </>,
                        )
                      }
                      className="absolute inset-y-0"
                      style={{ ...st, background: corDoTom(ESTADOS_TRECHO[f.estado].tom) }}
                    />
                  );
                })}
              </div>
            )}
            {px.bomba > 0 && h.motor2 && (
              <div className="relative overflow-hidden rounded bg-superficie-2" style={{ height: px.bomba }}>
                {h.motor2.intervalos.map(([a, b]) => {
                  const st = estilo(segDe(a), segDe(b));
                  if (!st) return null;
                  return (
                    <span
                      key={a}
                      onPointerEnter={(e) =>
                        mostrar(
                          e.currentTarget,
                          <>
                            <b>⚙ Bomba ligada</b>
                            <br />
                            {a.slice(0, 5)}–{b.slice(0, 5)} · {fmtMin((segDe(b) - segDe(a)) / 60)}
                          </>,
                        )
                      }
                      className="absolute inset-y-0 bg-motor2"
                      style={st}
                    />
                  );
                })}
              </div>
            )}
            {sel && (
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-y-1 rounded-md border-2 border-primaria"
                style={{ left: `${emPct(sel[0], janela)}%`, width: `${emPct(sel[1], janela) - emPct(sel[0], janela)}%`, background: "color-mix(in srgb, var(--primaria) 12%, transparent)" }}
              />
            )}
          </div>
        </div>
        {noPlayer && (
          <span aria-hidden className="pointer-events-none absolute bottom-0 top-5 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: `${emPct(player.t, janela)}%` }} />
        )}
      </div>
      <Balao ancora={dica?.el ?? null} rotulo="Detalhe do trecho" className="px-3 py-2 leading-snug">
        {dica?.c}
      </Balao>
    </div>
  );
}

function BalaoCapitulo({ c }: { c: Capitulo }) {
  return (
    <>
      <b>
        {c.n}. {c.lugar}
      </b>
      <br />
      {hhmm(c.inicio)}–{hhmm(c.fim)} · {fmtMin(c.duracao_min)}
      <br />
      <span className="text-suave">
        parado ligado {fmtMin(c.ligado_min)} · desligado {fmtMin(c.desligado_min)}
        {c.outro_min ? ` · sem sinal ${fmtMin(c.outro_min)}` : ""}
      </span>
      {c.ate && (
        <>
          <br />
          <span className="text-link">
            → {c.ate.km.toLocaleString("pt-BR")} km até {c.ate.destino}
          </span>
        </>
      )}
    </>
  );
}

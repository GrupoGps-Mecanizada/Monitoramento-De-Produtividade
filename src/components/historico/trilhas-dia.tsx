"use client";

import { useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { CLASSE_TOM } from "@/lib/cores";
import { segCap, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { fmtHora, fmtMin, hhmm } from "@/lib/dominio/formato";
import type { GaussDia } from "@/lib/dominio/gauss-dia";
import { alturasTrilhas, emPct, marcasRegua, posBloco, segDaFracao, segFim, type Janela } from "@/lib/dominio/trilhas";
import { Balao } from "../trilhas/balao";
import { Regua } from "../trilhas/regua";
import { cx } from "../ui";
import { LUGARES } from "./faixa-dia";
import type { Player } from "./use-player";
import { useZoomRoda } from "./zoom-roda";

export const TAMANHOS_REGUA = ["normal", "grande"] as const;
export type TamanhoRegua = (typeof TAMANHOS_REGUA)[number];

interface Props {
  historia: HistoriaDia;
  player: Player;
  janela: Janela;
  /** altura (px) que o painel dá às trilhas, régua incluída: as trilhas crescem e diminuem junto */
  alturaPx: number;
  /** régua grande (A+): horários maiores e marcas de meia em meia hora */
  regua: TamanhoRegua;
  foco: [number, number] | null;
  mudarFoco: (f: [number, number] | null) => void;
  atual: number | null;
  irCapitulo: (c: Capitulo) => void;
  /** motor (timeline de motor do GAUSS) e apontamentos do tablet; null enquanto carrega ou se falhou */
  gauss: GaussDia | null;
  /** rodinha do mouse: aproxima ou afasta a janela */
  mudarJanela: (j: Janela) => void;
}

/**
 * O dia em trilhas horizontais sobre a régua: capítulos, onde estava (GPS), motor (GAUSS, com o motor 2º) e tablet.
 * Sem RPM (decisão do dono, 07/10/2026). Passar o mouse mostra o balão do bloco; nas faixas, um toque leva o caminhão
 * ao horário, arrastar escolhe um foco e a rodinha do mouse aproxima/afasta.
 */
export function TrilhasDia({ historia, player, janela, alturaPx, regua, foco, mudarFoco, atual, irCapitulo, gauss, mudarJanela }: Props) {
  const grande = regua === "grande";
  // altura da régua: as linhas e o player começam logo abaixo dela
  const topo = grande ? 24 : 16;
  const px = alturasTrilhas(alturaPx - topo - 4);
  const faixaRef = useRef<HTMLDivElement>(null);
  useZoomRoda(faixaRef, janela, mudarJanela);
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
  const rotulos: [string, number, string][] = [
    ["Capítulos", px.cap, ""],
    ["Onde estava", px.lugar, "pelo GPS do rastreador"],
    ["Motor", px.motor, "timeline de motor do GAUSS (inclui o motor 2º)"],
    ["Tablet", px.tablet, "apontamentos do tablet"],
  ];
  const noPlayer = player.t >= janela[0] && player.t <= janela[1];
  const dicaSeg = (titulo: string, a: number, b: number, extra?: ReactNode) => (
    <>
      <b>{titulo}</b>
      <br />
      {fmtHora(a).slice(0, 5)}–{fmtHora(b).slice(0, 5)} · {fmtMin((b - a) / 60)}
      {extra}
    </>
  );
  const semGauss = <span className="text-[10px] text-suave">{gauss ? "sem dados do GAUSS neste dia" : "carregando…"}</span>;

  return (
    <div className="grid grid-cols-[104px_1fr] gap-x-2">
      <div style={{ paddingTop: topo }} className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-suave">
        {rotulos.map(([r, a, t]) => (
          <span key={r} title={t || undefined} className="flex items-center truncate leading-none" style={{ height: a }}>
            {r}
          </span>
        ))}
      </div>
      <div ref={faixaRef} className="relative" onPointerLeave={() => setDica(null)} title="Rodinha do mouse: aproxima ou afasta">
        <Regua janela={janela} grande={grande} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0" style={{ top: topo }}>
          {marcasRegua(janela, grande).map((s) => (
            <span key={s} className="absolute inset-y-0 w-px bg-borda/60" style={{ left: `${emPct(s, janela)}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <div className="relative" style={{ height: px.cap }}>
            {historia.capitulos.map((c) => {
              const st = estilo(segCap(c.inicio), segFim(c.inicio, c.fim));
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
                  className={cx("absolute inset-y-0 flex min-w-[18px] items-center gap-1 overflow-hidden rounded-md px-0.5 text-[10px] font-semibold ring-1", c.tipoLugar === "base" ? "st-cinza ring-slate-400/50" : "bg-primaria-suave text-texto ring-primaria/40", atual === c.n && "ring-2 ring-texto")}
                  style={st}
                >
                  <span className={cx("grid h-4 min-w-4 shrink-0 place-items-center rounded-full px-0.5 text-white", c.tipoLugar === "base" ? "bg-slate-500" : "bg-primaria")}>{c.n}</span>
                  <span className="truncate">{c.lugar}</span>
                </button>
              );
            })}
          </div>
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
                const st = estilo(segCap(f.inicio), segFim(f.inicio, f.fim));
                if (!st) return null;
                return (
                  <span
                    key={i}
                    onPointerEnter={(e) => mostrar(e.currentTarget, dicaSeg(f.lugar || LUGARES[f.tipoLugar].rotulo, segCap(f.inicio), segFim(f.inicio, f.fim)))}
                    className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/70 px-1 text-[10px] font-semibold", LUGARES[f.tipoLugar].classe)}
                    style={{ ...st, lineHeight: `${px.lugar}px` }}
                  >
                    {px.lugar >= 18 ? f.lugar : ""}
                  </span>
                );
              })}
            </div>
            <div data-testid="trilha-motor" className="relative flex items-center overflow-hidden rounded-md bg-superficie-2 px-1 ring-1 ring-black/10" style={{ height: px.motor }}>
              {!gauss?.status.length && semGauss}
              {gauss?.status.map((x, i) => {
                const st = estilo(x.a, x.b);
                if (!st) return null;
                return (
                  <span
                    key={i}
                    onPointerEnter={(e) => mostrar(e.currentTarget, dicaSeg(x.rotulo, x.a, x.b))}
                    className={cx("absolute inset-y-0 overflow-hidden whitespace-nowrap border-r border-white/60 px-1 text-[10px] font-semibold", CLASSE_TOM[x.tom])}
                    style={{ ...st, lineHeight: `${px.motor}px` }}
                  >
                    {px.motor >= 18 ? `${x.rotulo} · ${fmtMin((x.b - x.a) / 60)}` : ""}
                  </span>
                );
              })}
            </div>
            <div data-testid="trilha-tablet" className="relative flex items-center overflow-hidden rounded-md bg-superficie-2 px-1 ring-1 ring-black/10" style={{ height: px.tablet }}>
              {gauss && !gauss.tablet.length && <span className="text-[10px] text-suave">nenhum apontamento no tablet</span>}
              {gauss?.tablet.map((x) => {
                const st = estilo(x.a, x.b);
                if (!st) return null;
                return (
                  <span
                    key={x.cod}
                    onPointerEnter={(e) =>
                      mostrar(
                        e.currentTarget,
                        dicaSeg(
                          x.categoria,
                          x.a,
                          x.b,
                          <>
                            <br />
                            <span className="text-suave">
                              apontamento do tablet{x.aberto ? " · ainda aberto" : ""}
                              {x.motorista ? ` · ${x.motorista}` : ""}
                            </span>
                          </>,
                        ),
                      )
                    }
                    className="st-cinza-azulado absolute inset-y-0 overflow-hidden whitespace-nowrap rounded-sm border-r border-white/60 px-1 text-[10px] font-semibold"
                    style={{ ...st, lineHeight: `${px.tablet}px` }}
                  >
                    {px.tablet >= 16 ? x.categoria : ""}
                  </span>
                );
              })}
            </div>
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
          <span aria-hidden className="pointer-events-none absolute bottom-0 w-[3px] -translate-x-1/2 bg-texto shadow-[0_0_0_1px_var(--superficie),0_0_6px_rgba(0,0,0,.35)]" style={{ top: topo, left: `${emPct(player.t, janela)}%` }} />
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
        motor ligado {fmtMin(c.ligado_min)} · desligado {fmtMin(c.desligado_min)}
        {c.outro_min ? ` · outros ${fmtMin(c.outro_min)}` : ""}
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

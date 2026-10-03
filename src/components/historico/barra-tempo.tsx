"use client";

import type { PointerEvent as EventoPonteiro } from "react";
import { corDoTom } from "@/lib/cores";
import { fmtHora, fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { VELOCIDADES, fracao } from "@/lib/player";
import type { Historico } from "@/lib/tipos";
import { Icone } from "../icones";
import { Botao, Selecao } from "../ui";
import type { Player } from "./use-player";

/** Linha do tempo colorida por estado (clicar/arrastar leva o caminhão ao horário) + faixa do motor 2º. */
export function BarraTempo({ h, player }: { h: Historico; player: Player }) {
  const { t0, t1 } = player;
  const total = Math.max(t1 - t0, 1);
  const ir = (e: EventoPonteiro<HTMLDivElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    player.irPara(t0 + Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)) * total);
  };
  const arrastar = {
    onPointerDown: (e: EventoPonteiro<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      ir(e);
    },
    onPointerMove: (e: EventoPonteiro<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) ir(e);
    },
  };
  return (
    <div>
      <div
        {...arrastar}
        role="slider"
        tabIndex={0}
        aria-label="Linha do tempo"
        aria-valuemin={t0}
        aria-valuemax={t1}
        aria-valuenow={Math.round(player.t)}
        aria-valuetext={fmtHora(player.t)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") player.irPara(player.t + 60);
          if (e.key === "ArrowLeft") player.irPara(player.t - 60);
        }}
        className="relative flex h-[22px] cursor-pointer touch-none overflow-hidden rounded-md bg-superficie-2 ring-1 ring-black/10"
      >
        {h.trechos.map((tr, i) => {
          const a = segDe(tr.inicio.slice(11, 19));
          const b = segDe(tr.fim.slice(11, 19));
          return (
            <span
              key={i}
              title={`${ESTADOS_TRECHO[tr.estado].rotulo}: ${fmtMin(tr.duracao_min)}`}
              className="block h-full shrink-0"
              style={{ width: `${(Math.max(b - a, 60) / total) * 100}%`, minWidth: 2, background: corDoTom(ESTADOS_TRECHO[tr.estado].tom) }}
            />
          );
        })}
        <span aria-hidden className="pointer-events-none absolute -bottom-0.5 -top-0.5 w-[3px] -translate-x-1/2 bg-white shadow-[0_0_0_1px_#0b1220,0_0_6px_rgba(0,0,0,.6)]" style={{ left: `${fracao(player.t, t0, t1) * 100}%` }} />
      </div>
      {h.motor2 && (
        <>
          <div {...arrastar} className="relative mt-1 h-[7px] cursor-pointer touch-none rounded bg-superficie-2" title="Motor secundário ligado">
            {h.motor2.intervalos.map(([a, b]) => (
              <span key={a} className="absolute inset-y-0 rounded-sm bg-motor2" style={{ left: `${fracao(segDe(a), t0, t1) * 100}%`, width: `${Math.max(((segDe(b) - segDe(a)) / total) * 100, 0.3)}%` }} />
            ))}
          </div>
          <p className="mt-0.5 text-[10px] text-suave">⚙ motor secundário ligado{h.motor2.placa ? ` (${h.motor2.placa})` : ""}</p>
        </>
      )}
      {!h.motor2 && h.motor2_erro && <p className="mt-0.5 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-suave">
        <span>{h.resumo ? hhmm(h.resumo.primeiro) : ""}</span>
        <span>{h.resumo ? hhmm(h.resumo.ultimo) : ""}</span>
      </div>
    </div>
  );
}

/** ⏮ ▶ ⏭, velocidade, acelerar paradas e seguir o caminhão. */
export function ControlesPlayer({ player }: { player: Player }) {
  const pequeno = "grid h-8 w-8 place-items-center rounded-lg border border-borda bg-superficie text-suave hover:text-texto";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={pequeno} onClick={() => player.pular(-1)} aria-label="Deslocamento anterior" title="Deslocamento anterior">
        <Icone nome="anterior" className="h-4 w-4" />
      </button>
      <Botao tamanho="mini" onClick={player.alternar} title="Espaço">
        <Icone nome={player.tocando ? "pausa" : "play"} className="h-4 w-4" />
        {player.tocando ? "Pausar" : "Reproduzir"}
      </Botao>
      <button type="button" className={pequeno} onClick={() => player.pular(1)} aria-label="Próximo deslocamento" title="Próximo deslocamento">
        <Icone nome="proximo" className="h-4 w-4" />
      </button>
      <Selecao value={player.velocidade} onChange={(e) => player.setVelocidade(Number(e.target.value))} aria-label="Velocidade" className="h-8 w-28 text-[13px]">
        {VELOCIDADES.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </Selecao>
      <label className="flex items-center gap-1.5 text-xs text-suave" title="Paradas passam 20x mais rápido">
        <input type="checkbox" checked={player.acelerar} onChange={(e) => player.setAcelerar(e.target.checked)} /> Acelerar paradas
      </label>
      <label className="flex items-center gap-1.5 text-xs text-suave">
        <input type="checkbox" checked={player.seguir} onChange={(e) => player.setSeguir(e.target.checked)} /> Seguir caminhão
      </label>
    </div>
  );
}

/** "08:42:10 · Em deslocamento · 32 km/h · ⚙ motor 2º ligado" */
export function InfoPlayer({ player }: { player: Player }) {
  const p = player.ponto;
  if (!p) return null;
  return (
    <p className="text-xs tabular-nums">
      <b>{fmtHora(player.t)}</b> · {ESTADOS_TRECHO[p.estado].rotulo}
      {p.estado === "movimento" ? ` · ${p.vel} km/h` : ""}
      {p.m2 === 1 && <span className="font-semibold text-motor2"> · ⚙ motor 2º ligado</span>}
      {p.m2 === 0 && " · motor 2º desligado"}
    </p>
  );
}

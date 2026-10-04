"use client";

import { fmtHora } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { VELOCIDADES } from "@/lib/player";
import { Icone } from "../icones";
import { Botao, Selecao } from "../ui";
import type { Player } from "./use-player";

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

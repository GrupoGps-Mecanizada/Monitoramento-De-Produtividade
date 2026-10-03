"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { BarraTempo, ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { TempoPorArea } from "@/components/historico/tempo-area";
import { ListaTrechos } from "@/components/historico/trechos";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Aviso, Botao, SecaoTitulo, cx } from "@/components/ui";
import { baixarTexto } from "@/lib/arquivo";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";

interface Props {
  h: Historico;
  placa: string;
  vaga: string;
  pronto: MapaPronto | null;
  celular: boolean;
  /** camada sobre o mapa (para o horário do player e, no celular, o player inteiro) */
  sobreMapa: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
}

/** Histórico carregado (use com key do histórico). */
export function ConteudoHistorico({ h, placa, vaga, pronto, celular, sobreMapa, trechoSel, focarTrecho }: Props) {
  const player = usePlayer(pronto, h);
  const { trecho, tocando } = player;
  // destaca no apontamento o trecho em que o caminhão está
  useEffect(() => {
    if (tocando && trecho >= 0) document.querySelector(`[data-trecho="${trecho}"]`)?.scrollIntoView({ block: "nearest" });
  }, [trecho, tocando]);
  const escolher = (i: number) => {
    focarTrecho(i);
    player.irPara(segDe(h.trechos[i].inicio.slice(11, 19)), false);
  };
  const andou = tocando || player.t > player.t0 || trechoSel != null;

  const horario = andou && player.ponto && (
    <div className="absolute left-1/2 top-2.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#0b1220]/90 px-3.5 py-1.5 text-[13px] tabular-nums text-white shadow-md">
      <b className="mr-2 text-lg">{fmtHora(player.t)}</b>
      {placa} · {ESTADOS_TRECHO[player.ponto.estado].rotulo}
      {player.ponto.estado === "movimento" ? ` · ${player.ponto.vel} km/h` : ""}
      {player.ponto.m2 === 1 ? " · ⚙ 2º ligado" : ""}
    </div>
  );

  if (celular) {
    return sobreMapa
      ? createPortal(
          <>
            {/* no celular o horário fica na barra do player (em cima, a pílula do veículo) */}
            <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-borda bg-superficie/95 p-3 shadow-xl">
              <InfoPlayer player={player} />
              <div className="my-2">
                <BarraTempo h={h} player={player} />
              </div>
              <ControlesPlayer player={player} />
            </div>
          </>,
          sobreMapa,
        )
      : null;
  }

  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      <div className="border-b border-borda px-4 py-3">
        <p className="text-lg font-semibold">{placa}</p>
        <p className="text-[13px] text-suave">
          {vaga || "Sem vaga"} · {diaBR(h.dia)} · {FONTE[h.fonte]}
        </p>
        {h.aviso && <p className="mt-1 text-xs text-suave">{h.aviso}</p>}
      </div>
      {h.rpm_travado != null && (
        <div className="px-4 pt-3">
          <Aviso tipo="alerta">RPM do rastreador travado em {h.rpm_travado} o dia todo: não dá para afirmar motor ligado/desligado, as paradas aparecem só como “Parado”.</Aviso>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-px border-y border-borda bg-borda">
        {itensResumo(h)
          .filter((i) => i.rotulo !== "Período")
          .map((i) => (
            <div key={i.rotulo} className="bg-superficie px-4 py-2.5">
              <p className={cx("text-base font-semibold tabular-nums", i.motor2 && "text-motor2")}>{i.valor}</p>
              <p className="text-[11px] text-suave">{i.rotulo}</p>
            </div>
          ))}
      </div>
      <div className="space-y-2 border-b border-borda px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-suave">Linha do tempo · clique para ir ao horário</p>
        <BarraTempo h={h} player={player} />
        <ControlesPlayer player={player} />
        <InfoPlayer player={player} />
      </div>
      {!!h.resumo?.areas.length && (
        <>
          <SecaoTitulo>Tempo por área</SecaoTitulo>
          <TempoPorArea areas={h.resumo.areas} />
        </>
      )}
      <SecaoTitulo
        acao={
          <Botao variante="secundaria" tamanho="mini" onClick={() => baixarTexto(nomeCsv(placa, h.dia), csvApontamento(h, placa))}>
            <Icone nome="baixar" className="h-4 w-4" />
            Exportar CSV
          </Botao>
        }
      >
        Apontamento ({h.trechos.length} trechos)
      </SecaoTitulo>
      <ListaTrechos trechos={h.trechos} sel={andou && trecho >= 0 ? trecho : null} aoEscolher={escolher} />
    </>
  );
}

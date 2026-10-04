"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { Destaques, ListaCapitulos } from "@/components/historico/capitulos";
import { FaixaDia } from "@/components/historico/faixa-dia";
import { TempoPorArea } from "@/components/historico/tempo-area";
import { ListaTrechos } from "@/components/historico/trechos";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import { PAINEL_ROTA, desenharCapitulos, desenharRota } from "@/components/mapa/rota";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Aviso, Botao, SecaoTitulo, Selo, cx } from "@/components/ui";
import { baixarTexto } from "@/lib/arquivo";
import { MIN_CAPITULO, capituloEm, montarHistoria, proximoCapitulo, segCap, type Capitulo } from "@/lib/dominio/capitulos";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Historico } from "@/lib/tipos";

interface Props {
  h: Historico;
  placa: string;
  tipo: string;
  vaga: string;
  pronto: MapaPronto | null;
  celular: boolean;
  /** camada sobre o mapa (para o horário do player e, no celular, o player inteiro) */
  sobreMapa: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
}

/** Histórico carregado (use com key do histórico): a história do dia em capítulos, a faixa e o player. */
export function ConteudoHistorico({ h, placa, tipo, vaga, pronto, celular, sobreMapa, trechoSel, focarTrecho }: Props) {
  const player = usePlayer(pronto, h);
  const { trecho, tocando, irPara } = player;
  const historia = useMemo(() => montarHistoria(h.trechos), [h.trechos]);
  const [foco, setFoco] = useState<[number, number] | null>(null);
  const [verCapitulos, setVerCapitulos] = useState(false);
  const atual = capituloEm(historia.capitulos, player.t);
  const prox = proximoCapitulo(historia.capitulos, player.t);

  const irCapitulo = useCallback((c: Capitulo) => irPara(segCap(c.inicio), true), [irPara]);
  const irCapituloRef = useRef(irCapitulo);
  useEffect(() => {
    irCapituloRef.current = irCapitulo;
  });

  // rota do dia (o pedaço do foco em destaque) e os capítulos numerados no mapa
  useEffect(() => {
    if (!pronto) return;
    const { L, mapa } = pronto;
    const painel = mapa.getPane(PAINEL_ROTA) ?? mapa.createPane(PAINEL_ROTA);
    painel.style.zIndex = "390";
    const camada = L.layerGroup().addTo(mapa);
    desenharRota(L, camada, h, foco);
    desenharCapitulos(L, camada, historia.capitulos, (c) => irCapituloRef.current(c));
    return () => void camada.remove();
  }, [pronto, h, foco, historia]);

  // acompanha na lista o capítulo em que o caminhão está
  useEffect(() => {
    if (tocando && atual) document.querySelector(`[data-capitulo="${atual}"]`)?.scrollIntoView({ block: "nearest" });
  }, [atual, tocando]);

  const escolherTrecho = (i: number) => {
    focarTrecho(i);
    irPara(segDe(h.trechos[i].inicio.slice(11, 19)), false);
  };
  const andou = tocando || player.t > player.t0 || trechoSel != null;
  const botaoProximo = prox && (
    <Botao variante="secundaria" tamanho="mini" onClick={() => irCapitulo(prox)}>
      <Icone nome="proximo" className="h-4 w-4" />
      Próximo capítulo
    </Botao>
  );

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
          // no celular o horário fica na barra do player (em cima, a pílula do veículo)
          <div className="absolute inset-x-2 bottom-2 max-h-[70%] overflow-y-auto rounded-2xl border border-borda bg-superficie/95 p-3 shadow-xl">
            <InfoPlayer player={player} />
            <div className="my-2">
              <FaixaDia h={h} historia={historia} player={player} foco={foco} mudarFoco={setFoco} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ControlesPlayer player={player} />
              {botaoProximo}
              <Botao variante="secundaria" tamanho="mini" onClick={() => setVerCapitulos((x) => !x)} aria-expanded={verCapitulos}>
                Capítulos ({historia.capitulos.length})
              </Botao>
            </div>
            {verCapitulos && (
              <div className="mt-2 border-t border-borda">
                <ListaCapitulos capitulos={historia.capitulos} atual={atual} foco={foco} escolher={irCapitulo} />
              </div>
            )}
          </div>,
          sobreMapa,
        )
      : null;
  }

  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      <div className="space-y-2 border-b border-borda px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{placa}</span>
          {tipo && <Selo tom="reg">{tipo}</Selo>}
          <span className="text-[13px] text-suave">
            {diaBR(h.dia)} · {FONTE[h.fonte]}
          </span>
        </div>
        {vaga && <p className="text-xs text-suave">{vaga}</p>}
        {h.aviso && <p className="text-xs text-suave">{h.aviso}</p>}
        <Destaques d={historia.destaques} />
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
      <div className="space-y-2.5 border-b border-borda px-4 py-3">
        <FaixaDia h={h} historia={historia} player={player} foco={foco} mudarFoco={setFoco} />
        <div className="flex flex-wrap items-center gap-2">
          <ControlesPlayer player={player} />
          {botaoProximo}
        </div>
        <InfoPlayer player={player} />
      </div>
      <SecaoTitulo>Capítulos do dia · paradas de {MIN_CAPITULO} min ou mais</SecaoTitulo>
      <ListaCapitulos capitulos={historia.capitulos} atual={atual} foco={foco} escolher={irCapitulo} />
      <details className="border-t border-borda">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Apontamento completo ({h.trechos.length} trechos)</summary>
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
          Trechos
        </SecaoTitulo>
        <ListaTrechos trechos={h.trechos} sel={andou && trecho >= 0 ? trecho : null} aoEscolher={escolherTrecho} />
      </details>
    </>
  );
}

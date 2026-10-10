"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Apontamento } from "@/components/historico/apontamento";
import { LinhaTabletFina, agoraGauss, useHistoriaComGauss } from "@/components/historico/faixas-gauss";
import { LinhaDia } from "@/components/historico/linha-dia";
import { usePlayer } from "@/components/historico/use-player";
import { useZoomRoda } from "@/components/historico/zoom-roda";
import { Icone } from "@/components/icones";
import { PAINEL_ROTA, desenharCapitulos, desenharRota } from "@/components/mapa/rota";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Selecao } from "@/components/ui";
import { useGaussDia } from "@/lib/dados/gauss-dia";
import { capituloEm, montarHistoria, segCap, type Capitulo } from "@/lib/dominio/capitulos";
import { segDe } from "@/lib/dominio/formato";
import { statusProdutivo } from "@/lib/dominio/produtividade";
import { DIA, rotuloMarca, type Janela } from "@/lib/dominio/trilhas";
import { VELOCIDADES } from "@/lib/player";
import type { Historico, TipoEquip } from "@/lib/tipos";
import { BotaoFunil, PainelOpcoes, Secao } from "./opcoes";
import { CartaoAgora, SecoesDoDia } from "./partes";

export interface PropsConteudo {
  h: Historico;
  placa: string;
  /** placa como o GAUSS grava (para achar os apontamentos do tablet e a regra de produtividade) */
  placaGauss: string;
  /** tipo do equipamento (Alta Pressão, Alto Vácuo...): decide o que é produtivo */
  tipoEquip: TipoEquip | undefined;
  tipo: string;
  vaga: string;
  /** motorista atual (só quando o dia é hoje: o histórico do GAUSS não traz o motorista de cada hora) */
  motorista: string | null;
  pronto: MapaPronto | null;
  /** camada sobre o mapa: cartão, funil, linha do dia e botões */
  sobreMapa: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
  /** funil (veículo, dia e opções), controlado pela tela */
  opcoes: boolean;
  abrirOpcoes: () => void;
  fecharOpcoes: () => void;
  formulario: ReactNode;
}

/** O que as duas Timelines (nova e clássica) calculam igual: player, história, motor do GAUSS, tablet e produtivo. */
export function useConteudoDia({ h, placaGauss, tipoEquip, pronto, focarTrecho }: Pick<PropsConteudo, "h" | "placaGauss" | "tipoEquip" | "pronto" | "focarTrecho">, foco: [number, number] | null) {
  const player = usePlayer(pronto, h);
  const { trecho, irPara } = player;
  // motor (timeline de motor do GAUSS) e apontamentos do tablet: lidos do Supabase, sem consulta nova ao GAUSS
  const gauss = useGaussDia(h.id, placaGauss, h.dia);
  const historia = useHistoriaComGauss(
    useMemo(() => montarHistoria(h.trechos), [h.trechos]),
    gauss.dados,
    h.dia,
  );
  const agora = agoraGauss(gauss.dados, player.t);
  const produtivo = statusProdutivo(tipoEquip, placaGauss);
  const atual = capituloEm(historia.capitulos, player.t);

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

  const escolherTrecho = (i: number) => {
    focarTrecho(i);
    irPara(segDe(h.trechos[i].inicio.slice(11, 19)), false);
  };
  const tAtual = trecho >= 0 ? h.trechos[trecho] : null;
  const ondeEsta = !tAtual ? "" : tAtual.estado === "movimento" ? (tAtual.para ? `indo para ${tAtual.para}` : "em vias") : tAtual.local;
  return { player, gauss, historia, agora, produtivo, atual, irCapitulo, escolherTrecho, ondeEsta };
}

/**
 * Timeline nova (use com key do histórico). O foco é o mapa: em cima, o cartão do horário e o funil; embaixo, a linha
 * do tablet, a linha do motor (GAUSS) e ◀ ▶ ▶. A rodinha do mouse sobre as linhas aproxima/afasta.
 */
export function ConteudoHistorico(props: PropsConteudo) {
  const { h, placa, tipo, vaga, motorista, pronto, sobreMapa, trechoSel, opcoes, abrirOpcoes, fecharOpcoes, formulario } = props;
  const { player, gauss, historia, agora, produtivo, atual, irCapitulo, escolherTrecho, ondeEsta } = useConteudoDia(props, null);
  const { trecho, tocando, irPara } = player;
  const [apontamento, setApontamento] = useState(false);
  // zoom das linhas pela rodinha do mouse (começa no dia inteiro)
  const [janela, setJanela] = useState<Janela>([0, DIA]);
  const faixasRef = useRef<HTMLDivElement>(null);
  useZoomRoda(faixasRef, janela, setJanela);
  const andou = tocando || player.t > player.t0 || trechoSel != null;

  const icone = "grid h-10 w-10 place-items-center rounded-full text-white/90 transition hover:bg-white/15 hover:text-white";
  const sobre = (
    <>
      <CartaoAgora placa={placa} player={player} ondeEsta={ondeEsta} agora={agora} abrir={abrirOpcoes} />
      <BotaoFunil abrir={abrirOpcoes} />
      {/* embaixo: linhas do dia e ◀ ▶ ▶ (o degradê é só para os botões aparecerem sobre qualquer mapa) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[600] bg-gradient-to-t from-black/55 via-black/20 to-transparent px-4 pb-2 pt-12">
        <div className="pointer-events-auto mx-auto max-w-5xl">
          {(janela[0] > 0 || janela[1] < DIA) && (
            <div className="mb-1 flex items-center justify-center gap-2 text-[11px] tabular-nums text-white/85">
              Zoom {rotuloMarca(janela[0])} – {rotuloMarca(janela[1])}
              <button type="button" onClick={() => setJanela([0, DIA])} className="rounded-full bg-white/15 px-2 py-0.5 font-semibold text-white hover:bg-white/25">
                Dia inteiro
              </button>
            </div>
          )}
          {/* rodinha do mouse sobre as linhas: para cima aproxima, para baixo afasta */}
          <div ref={faixasRef} title="Rodinha do mouse: aproxima ou afasta">
            {gauss.dados && <LinhaTabletFina g={gauss.dados} player={player} janela={janela} />}
            <div className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-white/80">Motor</span>
              <div className="min-w-0 flex-1">
                <LinhaDia blocos={gauss.dados?.status ?? []} player={player} janela={janela} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4">
            <button type="button" className={icone} onClick={() => player.pular(-1)} aria-label="Deslocamento anterior" title="Deslocamento anterior">
              <Icone nome="anterior" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={player.alternar}
              aria-label={player.tocando ? "Pausar" : "Reproduzir"}
              title={`${player.tocando ? "Pausar" : "Reproduzir"} (Espaço)`}
              className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#0b1220] shadow-lg transition hover:scale-105"
            >
              <Icone nome={player.tocando ? "pausa" : "play"} className="h-5 w-5" />
            </button>
            <button type="button" className={icone} onClick={() => player.pular(1)} aria-label="Próximo deslocamento" title="Próximo deslocamento">
              <Icone nome="proximo" className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      {sobreMapa && createPortal(sobre, sobreMapa)}
      {opcoes && (
        <PainelOpcoes fechar={fecharOpcoes} formulario={formulario} pronto={pronto}>
          <Secao titulo="Reprodução">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Selecao value={player.velocidade} onChange={(e) => player.setVelocidade(Number(e.target.value))} aria-label="Velocidade" className="w-32">
                {VELOCIDADES.map(([v, r]) => (
                  <option key={v} value={v}>
                    {r}
                  </option>
                ))}
              </Selecao>
              <label className="flex items-center gap-1.5 text-sm" title="Paradas passam 20x mais rápido">
                <input type="checkbox" checked={player.acelerar} onChange={(e) => player.setAcelerar(e.target.checked)} /> Acelerar paradas
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={player.seguir} onChange={(e) => player.setSeguir(e.target.checked)} /> Seguir caminhão
              </label>
            </div>
          </Secao>
          <SecoesDoDia
            h={h}
            historia={historia}
            gauss={gauss}
            produtivo={produtivo}
            info={[tipo, vaga, motorista && `Motorista: ${motorista}`].filter(Boolean).join(" · ")}
            agora={agora}
            abrirApontamento={() => {
              fecharOpcoes();
              setApontamento(true);
            }}
            irPara={(s) => {
              fecharOpcoes();
              irPara(s, true);
            }}
          />
        </PainelOpcoes>
      )}
      {apontamento && (
        <Apontamento
          h={h}
          placa={placa}
          historia={historia}
          atual={atual}
          foco={null}
          irCapitulo={irCapitulo}
          trechoSel={andou && trecho >= 0 ? trecho : null}
          escolherTrecho={escolherTrecho}
          fechar={() => setApontamento(false)}
        />
      )}
    </>
  );
}

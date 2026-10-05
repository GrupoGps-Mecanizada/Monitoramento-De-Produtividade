"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Apontamento } from "@/components/historico/apontamento";
import { ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { Destaques, ListaCapitulos } from "@/components/historico/capitulos";
import { FaixaDia } from "@/components/historico/faixa-dia";
import { ALTURAS_TRILHAS, TrilhasDia, type AlturaTrilhas } from "@/components/historico/trilhas-dia";
import { usePlayer } from "@/components/historico/use-player";
import { Icone } from "@/components/icones";
import { PAINEL_ROTA, desenharCapitulos, desenharRota } from "@/components/mapa/rota";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { Alca } from "@/components/trilhas/alca";
import { Balao } from "@/components/trilhas/balao";
import { Aviso, Botao, Selo, cx } from "@/components/ui";
import { capituloEm, montarHistoria, proximoCapitulo, segCap, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { diaBR, fmtHora, segDe } from "@/lib/dominio/formato";
import { FONTE, itensResumo } from "@/lib/dominio/historico";
import { DIA, ampliar, janelaDosTrechos, type Janela } from "@/lib/dominio/trilhas";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { useOpcao } from "@/lib/hooks";
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
  /** barra do topo (computador): os números do dia e o "Resumo do dia" */
  noTopo: HTMLDivElement | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
}

/** Histórico carregado (use com key do histórico): a história do dia em capítulos, a faixa e o player. */
export function ConteudoHistorico({ h, placa, tipo, vaga, pronto, celular, sobreMapa, noTopo, trechoSel, focarTrecho }: Props) {
  const player = usePlayer(pronto, h);
  const { trecho, tocando, irPara } = player;
  const historia = useMemo(() => montarHistoria(h.trechos), [h.trechos]);
  const [foco, setFoco] = useState<[number, number] | null>(null);
  const [verCapitulos, setVerCapitulos] = useState(false);
  const atual = capituloEm(historia.capitulos, player.t);
  const prox = proximoCapitulo(historia.capitulos, player.t);
  const [altura, setAltura] = useOpcao<AlturaTrilhas>("mon-trilhas-altura", ALTURAS_TRILHAS, "normal");
  const registros = useMemo(() => janelaDosTrechos(h.trechos), [h.trechos]);
  const [janela, setJanela] = useState<Janela>(registros);
  const [apontamento, setApontamento] = useState(false);

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

  const diaInteiro = janela[0] === 0 && janela[1] === DIA;
  const soRegistros = janela[0] === registros[0] && janela[1] === registros[1];
  return (
    <>
      {sobreMapa && horario && createPortal(horario, sobreMapa)}
      {noTopo && createPortal(<ResumoTopo h={h} historia={historia} vaga={vaga} />, noTopo)}
      <section aria-label="Timeline do veículo" className="shrink-0 rounded-xl border border-borda bg-superficie shadow-md">
        <Alca opcoes={ALTURAS_TRILHAS} valor={altura} mudar={setAltura} rotulo="Altura das trilhas" />
        <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
          <span className="text-base font-semibold">{placa}</span>
          {tipo && <Selo tom="reg">{tipo}</Selo>}
          <span className="text-xs text-suave">
            {diaBR(h.dia)} · {FONTE[h.fonte]}
          </span>
          <ControlesPlayer player={player} />
          {botaoProximo}
          <InfoPlayer player={player} />
          <span className="ml-auto flex flex-wrap items-center gap-1.5">
            {foco && (
              <>
                <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(ampliar(foco))}>
                  Ampliar o foco
                </Botao>
                <Botao variante="discreta" tamanho="mini" onClick={() => setFoco(null)}>
                  ✕ Limpar foco
                </Botao>
              </>
            )}
            {!soRegistros && (
              <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(registros)}>
                Horas com registro
              </Botao>
            )}
            {!diaInteiro && (
              <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela([0, DIA])}>
                Dia inteiro
              </Botao>
            )}
            <Botao variante="secundaria" tamanho="mini" onClick={() => setApontamento(true)}>
              Apontamento
            </Botao>
          </span>
        </div>
        <div className="px-3 pb-3">
          <TrilhasDia h={h} historia={historia} player={player} janela={janela} altura={altura} foco={foco} mudarFoco={setFoco} atual={atual} irCapitulo={irCapitulo} />
          {!h.motor2 && h.motor2_erro && <p className="mt-1 text-[10px] text-suave">motor secundário não carregou: {h.motor2_erro}</p>}
        </div>
      </section>
      {apontamento && (
        <Apontamento
          h={h}
          placa={placa}
          historia={historia}
          atual={atual}
          foco={foco}
          irCapitulo={irCapitulo}
          trechoSel={andou && trecho >= 0 ? trecho : null}
          escolherTrecho={escolherTrecho}
          fechar={() => setApontamento(false)}
        />
      )}
    </>
  );
}

/** Barra do topo da Timeline: os números do dia em pílulas e o balão "Resumo do dia". */
function ResumoTopo({ h, historia, vaga }: { h: Historico; historia: HistoriaDia; vaga: string }) {
  const [el, setEl] = useState<HTMLElement | null>(null);
  const fechar = useCallback(() => setEl(null), []);
  return (
    <>
      {itensResumo(h)
        .filter((i) => i.rotulo !== "Período")
        .map((i) => (
          <span key={i.rotulo} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs">
            <b className={cx("tabular-nums", i.motor2 && "text-motor2")}>{i.valor}</b> <span className="text-suave">{i.rotulo.toLowerCase()}</span>
          </span>
        ))}
      {h.rpm_travado != null && <Selo tom="warn">RPM travado</Selo>}
      <Botao
        variante="secundaria"
        tamanho="mini"
        aria-expanded={!!el}
        onClick={(e) => {
          const alvo = e.currentTarget;
          setEl((x) => (x ? null : alvo));
        }}
      >
        Resumo do dia
      </Botao>
      <Balao ancora={el} lado="baixo" rotulo="Resumo do dia" fechar={fechar} className="w-[360px] space-y-2 p-3">
        {vaga && <p className="text-xs text-suave">{vaga}</p>}
        {h.aviso && <p className="text-xs text-suave">{h.aviso}</p>}
        {h.rpm_travado != null && <Aviso tipo="alerta">RPM do rastreador travado em {h.rpm_travado} o dia todo: não dá para afirmar motor ligado/desligado, as paradas aparecem só como “Parado”.</Aviso>}
        <Destaques d={historia.destaques} />
      </Balao>
    </>
  );
}

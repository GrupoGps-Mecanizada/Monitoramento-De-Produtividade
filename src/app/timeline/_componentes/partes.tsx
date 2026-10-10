"use client";

import { Destaques } from "@/components/historico/capitulos";
import { LegendaGauss, ListaTablet, agoraGauss, itensDoDia } from "@/components/historico/faixas-gauss";
import type { Player } from "@/components/historico/use-player";
import { Botao, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import type { EstadoGaussDia } from "@/lib/dados/gauss-dia";
import type { HistoriaDia } from "@/lib/dominio/capitulos";
import { diaBR, fmtHora } from "@/lib/dominio/formato";
import { statusGauss } from "@/lib/dominio/gauss-dia";
import { FONTE } from "@/lib/dominio/historico";
import type { Historico } from "@/lib/tipos";
import { CartaoTopo, Secao } from "./opcoes";

/** Cartão de cima: "EGC-2985 · 08:30:00 · Motor 2º ligado · PATIO · Tablet: Refeição". Motor pelo GAUSS, lugar pelo GPS. */
export function CartaoAgora({ placa, player, ondeEsta, agora, abrir }: { placa: string; player: Player; ondeEsta: string; agora: ReturnType<typeof agoraGauss>; abrir: () => void }) {
  const p = player.ponto;
  return (
    <CartaoTopo abrir={abrir} rotulo="Agora no mapa">
      <b className="text-[14px]">{placa}</b>
      <span className="tabular-nums">{fmtHora(player.t)}</span>
      <span className="flex items-center gap-1.5" title="Status do motor na timeline do GAUSS">
        <i aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: agora.status ? corDoTom(agora.status.tom) : "transparent" }} />
        {agora.status?.rotulo ?? "Motor: sem dados do GAUSS"}
      </span>
      {p?.estado === "movimento" && <span className="tabular-nums">andando {p.vel} km/h</span>}
      {ondeEsta && <span className="truncate text-white/80">{ondeEsta}</span>}
      {agora.tablet && (
        <span className="truncate" title="Apontamento do tablet">
          <span className="text-white/60">Tablet:</span> {agora.tablet.categoria}
        </span>
      )}
    </CartaoTopo>
  );
}

interface SecoesProps {
  h: Historico;
  historia: HistoriaDia;
  gauss: EstadoGaussDia;
  produtivo: string | null;
  info: string;
  agora: ReturnType<typeof agoraGauss>;
  abrirApontamento: () => void;
  irPara: (s: number) => void;
}

/** Seções do funil com o dia carregado: os números (GPS + motor do GAUSS + produtivo), o motor no dia e o tablet. */
export function SecoesDoDia({ h, historia, gauss, produtivo, info, agora, abrirApontamento, irPara }: SecoesProps) {
  const carregando = <p className="text-xs text-suave">{gauss.erro ? `Não carregou: ${gauss.erro}` : "Carregando…"}</p>;
  return (
    <>
      <Secao titulo={`O dia · ${diaBR(h.dia)}`}>
        <div className="space-y-3">
          <p className="text-xs text-suave">{[info, FONTE[h.fonte]].filter(Boolean).join(" · ")}</p>
          <div className="flex flex-wrap gap-1.5">
            {itensDoDia(h, gauss.dados, produtivo)
              .filter((i) => i.rotulo !== "Período")
              .map((i) => (
                <span key={i.rotulo} title={i.nota} className={cx("rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs", i.rotulo.startsWith("Produtivo") && "border-primaria bg-primaria-suave")}>
                  <b className={cx("tabular-nums", i.motor2 && "text-motor2")}>{i.valor}</b> <span className="text-suave">{i.rotulo.toLowerCase()}</span>
                </span>
              ))}
          </div>
          {!produtivo && <p className="text-xs text-suave">Este tipo de equipamento não tem regra de produtividade.</p>}
          {h.aviso && <p className="text-xs text-suave">{h.aviso}</p>}
          <Destaques d={historia.destaques} />
          <Botao variante="secundaria" className="w-full" onClick={abrirApontamento}>
            Apontamento (capítulos, trechos, áreas e CSV)
          </Botao>
        </div>
      </Secao>
      <Secao titulo={`Motor no dia (GAUSS)${produtivo ? ` · produtivo = ${statusGauss(produtivo).rotulo.toLowerCase()}` : ""}`}>{gauss.dados ? <LegendaGauss g={gauss.dados} /> : carregando}</Secao>
      <Secao titulo={`Apontamentos do tablet${gauss.dados ? ` (${gauss.dados.tablet.length})` : ""}`}>
        {gauss.dados ? <ListaTablet g={gauss.dados} atual={agora.tablet} irPara={irPara} /> : carregando}
      </Secao>
    </>
  );
}

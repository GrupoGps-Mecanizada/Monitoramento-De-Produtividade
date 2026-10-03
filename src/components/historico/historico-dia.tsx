import Link from "next/link";
import type { ReactNode } from "react";
import { baixarTexto } from "@/lib/arquivo";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR } from "@/lib/dominio/formato";
import { FONTE, itensResumo, type ItemResumo } from "@/lib/dominio/historico";
import type { Historico } from "@/lib/tipos";
import { Icone } from "../icones";
import { Botao, Campos, SecaoTitulo, Vazio, cx } from "../ui";
import { TempoPorArea } from "./tempo-area";
import { ListaTrechos } from "./trechos";

function ValorResumo({ item }: { item: ItemResumo }) {
  return (
    <>
      <span className={cx(item.motor2 && "font-semibold text-motor2")}>{item.valor}</span>
      {item.nota && <span className="text-suave"> ({item.nota})</span>}
    </>
  );
}

/** Histórico de um dia no detalhe do veículo: resumo, tempo por área, CSV e apontamento. */
export function HistoricoDia({ h, placa, trechoSel, focarTrecho }: { h: Historico; placa: string; trechoSel: number | null; focarTrecho: (i: number) => void }) {
  if (!h.trechos.length || !h.resumo) return <Vazio titulo="Sem dados neste dia">O GAUSS não tem posições do veículo para a data escolhida.</Vazio>;
  return (
    <>
      <SecaoTitulo>
        Resumo de {diaBR(h.dia)} <span className="normal-case tracking-normal">· {FONTE[h.fonte]}</span>
      </SecaoTitulo>
      {h.aviso && <p className="px-4 pb-2 text-xs text-suave">{h.aviso}</p>}
      <div className="px-4 pb-3">
        <Link href={`/timeline/?v=${encodeURIComponent(h.id)}&dia=${h.dia}`} className="btn-pri h-8 px-3 text-[13px] hover:no-underline">
          <Icone nome="play" className="h-4 w-4" />
          Reproduzir trajetória na Timeline
        </Link>
      </div>
      <div className="px-4 pb-2">
        <Campos itens={itensResumo(h).map((i): [string, ReactNode] => [i.rotulo, <ValorResumo key={i.rotulo} item={i} />])} />
      </div>
      {h.resumo.areas.length > 0 && (
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
      <ListaTrechos trechos={h.trechos} sel={trechoSel} aoEscolher={focarTrecho} />
    </>
  );
}

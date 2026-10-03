"use client";

import Link from "next/link";
import { Icone } from "@/components/icones";
import { Chip, Ponto } from "@/components/ui";
import { diaLocal, idadeCurta } from "@/lib/dominio/formato";
import { CATEGORIAS, INDICADORES, categoria, motor2Ligado, noIndicador, nomeArea, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

interface Props {
  veiculos: Veiculo[];
  filtro: FiltroVeiculos;
  vSel: Veiculo | null;
  agora: number;
  semSinalMin: number;
  mudarFiltro: (f: FiltroVeiculos) => void;
  abrirFolha: () => void;
  fechar: () => void;
}

/** Gaveta fechada: números da frota tocáveis, ou o cartão do caminhão escolhido. */
export function ResumoCelular({ veiculos, filtro, vSel, agora, semSinalMin, mudarFiltro, abrirFolha, fechar }: Props) {
  if (vSel) {
    return (
      <div className="flex items-center gap-3 px-4 pb-3">
        <button type="button" onClick={abrirFolha} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Ponto tom={CATEGORIAS[categoria(vSel)].tom} className="h-3 w-3" />
          <span className="min-w-0 leading-snug">
            <b className="block text-base">{vSel.placa}</b>
            <span className="block truncate text-xs text-suave">
              {vSel.status}
              {motor2Ligado(vSel) ? " · ⚙ 2º ligado" : ""} · há {idadeCurta(vSel.posicao_em, agora)}
            </span>
            <span className="block truncate text-xs text-suave">{vSel.area || vSel.via || "fora de cerca"}</span>
          </span>
        </button>
        <Link href={`/timeline/?v=${encodeURIComponent(vSel.id)}&dia=${diaLocal()}`} aria-label={`Timeline de ${vSel.placa}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primaria text-white">
          <Icone nome="play" className="h-4 w-4" />
        </Link>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-borda">
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </div>
    );
  }
  const numeros = INDICADORES.map((i) => ({ i, total: veiculos.filter((v) => noIndicador(i.id, v, semSinalMin, agora)).length })).filter((x) => x.total);
  return (
    <div className="flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none]">
      <button type="button" onClick={abrirFolha} className="shrink-0 rounded-full bg-primaria px-3 py-1 text-xs font-semibold text-white">
        <b>{veiculos.length}</b> veículos
      </button>
      {numeros.map(({ i, total }) => (
        <Chip key={i.id} ativo={filtro.indicador === i.id} tom={i.tom} onClick={() => mudarFiltro({ ...filtro, indicador: filtro.indicador === i.id ? null : i.id })}>
          <b>{total}</b> {i.curto}
        </Chip>
      ))}
      {filtro.area && (
        <Chip ativo tom="warn" onClick={() => mudarFiltro({ ...filtro, area: null })}>
          {nomeArea(filtro.area)} ✕
        </Chip>
      )}
    </div>
  );
}

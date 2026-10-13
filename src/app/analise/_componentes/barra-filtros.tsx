"use client";

import type { ReactNode } from "react";
import { Selecao } from "@/components/ui";
import type { DimensaoSelecao, EquipAnalise } from "@/lib/dominio/analise";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import type { TipoEquip } from "@/lib/tipos";

/** Filtros do topo (valem para tudo). */
export interface FiltrosTopo {
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
}
export const FILTROS_TOPO_VAZIOS: FiltrosTopo = { tipo: null, supervisor: null, regime: null };
/** Uma escolha feita com clique no mapa ou num gráfico. */
export interface Etiqueta {
  dim: DimensaoSelecao;
  texto: string;
}
const distintos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

/** Uma linha: abas e período (vêm de fora em `topo`), tipo, supervisor e regime; embaixo, as etiquetas do que foi clicado ("Servitec ×") e "Limpar tudo". */
export function BarraFiltros({
  topo,
  filtros,
  mudarFiltros,
  equip,
  etiquetas,
  tirar,
  limpar,
}: {
  topo: ReactNode;
  filtros: FiltrosTopo;
  mudarFiltros: (p: Partial<FiltrosTopo>) => void;
  equip: EquipAnalise[];
  etiquetas: Etiqueta[];
  tirar: (d: DimensaoSelecao) => void;
  limpar: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {topo}
        <Selecao aria-label="Tipo" value={filtros.tipo ?? ""} onChange={(e) => mudarFiltros({ tipo: (e.target.value || null) as TipoEquip | null })} className="w-auto min-w-[160px]">
          <option value="">Todos os tipos</option>
          {ORDEM_TIPOS.map((t) => (
            <option key={t} value={t}>
              {TIPOS_EQUIP[t].rotulo}
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Supervisor" value={filtros.supervisor ?? ""} onChange={(e) => mudarFiltros({ supervisor: e.target.value || null })} className="w-auto min-w-[180px]">
          <option value="">Todos os supervisores</option>
          {distintos(equip.map((e) => e.supervisor)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
        <Selecao aria-label="Regime" value={filtros.regime ?? ""} onChange={(e) => mudarFiltros({ regime: e.target.value || null })} className="w-auto min-w-[160px]">
          <option value="">Todos os regimes</option>
          {distintos(equip.map((e) => e.regime)).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Selecao>
      </div>
      {etiquetas.length > 0 && (
        <div role="group" aria-label="Filtrando" className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-suave">Filtrando:</span>
          {etiquetas.map((e) => (
            <button
              key={e.dim}
              type="button"
              onClick={() => tirar(e.dim)}
              aria-label={`Tirar filtro: ${e.texto}`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-primaria/40 bg-primaria-suave px-2.5 font-medium text-texto"
            >
              {e.texto}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" onClick={limpar} className="font-semibold text-primaria hover:underline">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}

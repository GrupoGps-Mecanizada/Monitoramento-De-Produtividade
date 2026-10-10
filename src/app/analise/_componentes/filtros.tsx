"use client";

import { Chip, Selecao } from "@/components/ui";
import { FAIXAS, type EquipAnalise, type Faixa } from "@/lib/dominio/analise";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import type { TipoEquip } from "@/lib/tipos";

const ROTULO_FAIXA: Record<Faixa, string> = { madrugada: "Madrugada", manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"];
const NOME_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const alternar = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);
const distintos = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));

/** Filtros do funil da Análise (junto da medida e do período). */
export interface EstadoFiltros {
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
  faixas: Faixa[];
  diasSemana: number[];
}
export const FILTROS_VAZIOS: EstadoFiltros = { tipo: null, supervisor: null, regime: null, faixas: [], diasSemana: [] };
/** Quantos filtros estão ligados (aparece no botão). */
export const filtrosAtivos = (f: EstadoFiltros) => [f.tipo, f.supervisor, f.regime].filter(Boolean).length + (f.faixas.length ? 1 : 0) + (f.diasSemana.length ? 1 : 0);

/** Filtros: tipo, supervisor, regime, faixa do dia e dia da semana (dentro do funil). */
export function Filtros({ f, mudar, equip }: { f: EstadoFiltros; mudar: (p: Partial<EstadoFiltros>) => void; equip: EquipAnalise[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Selecao aria-label="Tipo" value={f.tipo ?? ""} onChange={(e) => mudar({ tipo: (e.target.value || null) as TipoEquip | null })} className="w-full">
        <option value="">Todos os tipos</option>
        {ORDEM_TIPOS.map((t) => (
          <option key={t} value={t}>
            {TIPOS_EQUIP[t].rotulo}
          </option>
        ))}
      </Selecao>
      <Selecao aria-label="Supervisor" value={f.supervisor ?? ""} onChange={(e) => mudar({ supervisor: e.target.value || null })} className="w-full">
        <option value="">Todos os supervisores</option>
        {distintos(equip.map((e) => e.supervisor)).map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Selecao>
      <Selecao aria-label="Regime" value={f.regime ?? ""} onChange={(e) => mudar({ regime: e.target.value || null })} className="w-full">
        <option value="">Todos os regimes</option>
        {distintos(equip.map((e) => e.regime)).map((s) => (
          <option key={s}>{s}</option>
        ))}
      </Selecao>
      <div role="group" aria-label="Hora do início da parada" className="flex flex-wrap gap-1.5">
        {FAIXAS.map((x) => (
          <Chip key={x} ativo={f.faixas.includes(x)} onClick={() => mudar({ faixas: alternar(f.faixas, x) })}>
            {ROTULO_FAIXA[x]}
          </Chip>
        ))}
      </div>
      <div role="group" aria-label="Dia da semana" className="flex flex-wrap gap-1.5">
        {DIAS.map((d, i) => (
          <Chip key={i} ativo={f.diasSemana.includes(i)} onClick={() => mudar({ diasSemana: alternar(f.diasSemana, i) })}>
            <span aria-hidden>{d}</span>
            <span className="sr-only">{NOME_DIA[i]}</span>
          </Chip>
        ))}
      </div>
      {filtrosAtivos(f) > 0 && (
        <button type="button" onClick={() => mudar(FILTROS_VAZIOS)} className="text-xs font-semibold text-primaria hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  );
}

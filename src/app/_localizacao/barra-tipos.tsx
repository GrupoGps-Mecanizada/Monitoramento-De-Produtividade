"use client";

import { cx } from "@/components/ui";
import { ORDEM_TIPOS, TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { noIndicador } from "@/lib/dominio/veiculo";
import type { TipoEquip, Veiculo } from "@/lib/tipos";

interface Props {
  veiculos: Veiculo[];
  tipo: TipoEquip | null;
  escolher: (t: TipoEquip | null) => void;
  abrir: () => void;
  semSinalMin: number;
  agora: number;
}

/** Painel recolhido: o mapa ganha a tela; fica a sigla de cada tipo com ligados/total (clicar filtra o mapa). */
export function BarraTipos({ veiculos, tipo, escolher, abrir, semSinalMin, agora }: Props) {
  return (
    <nav aria-label="Tipos de equipamento" className="flex w-[60px] shrink-0 flex-col items-center gap-1.5 overflow-y-auto rounded-xl border border-borda bg-superficie py-2 shadow-md">
      <button type="button" onClick={abrir} aria-label="Abrir painel" title="Abrir painel" className="grid h-9 w-11 place-items-center rounded-lg text-lg text-suave hover:bg-superficie-2 hover:text-texto">
        ▸
      </button>
      {ORDEM_TIPOS.map((t) => {
        const vs = veiculos.filter((v) => v.equip?.tipo === t);
        if (!vs.length) return null;
        const lig = vs.filter((v) => noIndicador("ligado", v, semSinalMin, agora)).length;
        const ativo = tipo === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ativo}
            title={`${TIPOS_EQUIP[t].rotulo}: ${lig} ligados de ${vs.length}`}
            onClick={() => escolher(ativo ? null : t)}
            className={cx("w-11 rounded-lg py-1 text-center text-[10px] tabular-nums", ativo ? "bg-primaria text-white" : "bg-superficie-2 text-suave hover:text-texto")}
          >
            <b className="block text-[13px]">{TIPOS_EQUIP[t].sigla}</b>
            {lig}/{vs.length}
          </button>
        );
      })}
    </nav>
  );
}

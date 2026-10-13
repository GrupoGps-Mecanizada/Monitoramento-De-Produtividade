"use client";

import { cx } from "@/components/ui";
import { ABAS_FAMILIA, ROTULO_FAMILIA, type AbaFamilia } from "@/lib/dominio/familias";

/** Subabas acima dos gráficos: Visão geral e uma por família de apontamento (rolam na horizontal se não couberem). */
export function SubabasFamilia({ valor, mudar }: { valor: AbaFamilia; mudar: (f: AbaFamilia) => void }) {
  return (
    <div role="tablist" aria-label="Família" className="flex shrink-0 gap-1 overflow-x-auto rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {ABAS_FAMILIA.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === valor}
          onClick={() => mudar(id)}
          className={cx("shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] font-medium transition", id === valor ? "bg-superficie text-texto shadow-sm" : "text-suave hover:text-texto")}
        >
          {id === "geral" ? "Visão geral" : ROTULO_FAMILIA[id]}
        </button>
      ))}
    </div>
  );
}

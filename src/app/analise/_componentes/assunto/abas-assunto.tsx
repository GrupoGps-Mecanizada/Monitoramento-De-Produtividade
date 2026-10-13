"use client";

import { cx } from "@/components/ui";
import { ASSUNTOS, ROTULO_ASSUNTO, type Assunto } from "@/lib/dominio/assuntos";

/** Abas de assunto acima dos gráficos: Status do motor, Motor secundário e Apontamentos. */
export function AbasAssunto({ valor, mudar }: { valor: Assunto; mudar: (a: Assunto) => void }) {
  return (
    <div role="tablist" aria-label="Assunto" className="grid shrink-0 grid-cols-3 gap-1 rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {ASSUNTOS.map((id) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={id === valor}
          onClick={() => mudar(id)}
          className={cx("rounded-md px-2 py-2 text-[13px] font-semibold transition", id === valor ? "bg-primaria text-white shadow-sm" : "text-suave hover:text-texto")}
        >
          {ROTULO_ASSUNTO[id]}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { fmtHoras } from "@/lib/dominio/formato";

/** 24 colunas (0h–23h) com as horas paradas pela hora de início. Passar o mouse mostra o valor; clicar escolhe a hora. */
export function GraficoHoras({ minutos, selecionada, escolher, vazio }: { minutos: number[]; selecionada: number | null; escolher: (h: number) => void; vazio: string }) {
  const [foco, setFoco] = useState<number | null>(null);
  const max = Math.max(0, ...minutos);
  const h = foco ?? selecionada;
  return (
    <section aria-label="Hora do dia" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Hora do dia <span className="font-normal normal-case tracking-normal">· horas paradas pela hora de início</span>
      </h2>
      {max <= 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <p className="mt-1 h-4 text-[11px] text-texto">{h != null ? `${h}h · ${fmtHoras(minutos[h])} parado` : ""}</p>
          <div role="group" aria-label="Horas" className="mt-1 flex h-24 items-end gap-[2px]" onMouseLeave={() => setFoco(null)}>
            {minutos.map((m, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={selecionada === i}
                aria-label={`${i}h, ${fmtHoras(m)} parado`}
                onMouseEnter={() => setFoco(i)}
                onFocus={() => setFoco(i)}
                onBlur={() => setFoco(null)}
                onClick={() => escolher(i)}
                className={cx("flex h-full flex-1 items-end rounded-sm hover:bg-superficie-2", selecionada != null && selecionada !== i && "opacity-40")}
              >
                <span className="block w-full rounded-t-[4px] bg-primaria" style={{ height: `${m > 0 ? Math.max(3, (m / max) * 100) : 0}%` }} />
              </button>
            ))}
          </div>
          <div aria-hidden className="mt-1 flex justify-between text-[10px] text-suave">
            <span>0h</span>
            <span>6h</span>
            <span>12h</span>
            <span>18h</span>
            <span>23h</span>
          </div>
        </>
      )}
    </section>
  );
}

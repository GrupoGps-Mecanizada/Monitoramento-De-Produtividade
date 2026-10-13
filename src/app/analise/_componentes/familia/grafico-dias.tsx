"use client";

import { diaBR, fmtHoras } from "@/lib/dominio/formato";

/** Colunas com as horas paradas em cada dia do período (dia sem parada fica vazio, para não esconder buracos). */
export function GraficoDias({ dias, vazio }: { dias: { dia: string; min: number }[]; vazio: string }) {
  const max = Math.max(0, ...dias.map((d) => d.min));
  return (
    <section aria-label="Tendência por dia" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Tendência por dia <span className="font-normal normal-case tracking-normal">· horas paradas em cada dia</span>
      </h2>
      {max <= 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <ol aria-label="Dias" className="mt-2 flex h-24 items-end gap-[2px]">
            {dias.map((d) => (
              <li key={d.dia} aria-label={`${diaBR(d.dia)}, ${fmtHoras(d.min)}`} title={`${diaBR(d.dia)}: ${fmtHoras(d.min)}`} className="flex h-full flex-1 items-end">
                <span className="block w-full rounded-t-[4px] bg-primaria" style={{ height: `${d.min > 0 ? Math.max(3, (d.min / max) * 100) : 0}%` }} />
              </li>
            ))}
          </ol>
          <div aria-hidden className="mt-1 flex justify-between text-[10px] text-suave">
            <span>{diaBR(dias[0].dia).slice(0, 5)}</span>
            <span>{diaBR(dias[dias.length - 1].dia).slice(0, 5)}</span>
          </div>
        </>
      )}
    </section>
  );
}

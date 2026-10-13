"use client";

import { cx } from "@/components/ui";
import { fmtDf, fmtH, motivoPrincipal, type VagaBoletim } from "@/lib/dominio/medicao";

/** Vagas da pior DF para a melhor; clicar abre o detalhe (clicar de novo fecha). */
export function ListaVagas({ vagas, selecionada, escolher, carregando }: { vagas: VagaBoletim[]; selecionada: number | null; escolher: (id: number) => void; carregando: boolean }) {
  return (
    <section aria-label="Vagas" className="flex min-h-0 flex-col rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Vagas <span className="font-normal normal-case tracking-normal">· da pior DF para a melhor</span>
      </h2>
      {carregando ? (
        <p className="mt-2 text-xs text-suave">Carregando as vagas…</p>
      ) : (
        <ul className="mt-2 grid gap-1 lg:min-h-0 lg:overflow-y-auto">
          {vagas.map((v) => {
            const motivo = motivoPrincipal(v);
            const dica = `${v.vaga}, DF ${fmtDf(v.df)}, ${fmtH(v.horas_indisp)} indisponível${motivo ? `, mais: ${motivo.nome}` : ""}`;
            return (
              <li key={v.vaga_id}>
                <button
                  type="button"
                  aria-pressed={selecionada === v.vaga_id}
                  aria-label={dica}
                  title={dica}
                  onClick={() => escolher(v.vaga_id)}
                  className={cx(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2",
                    selecionada === v.vaga_id && "bg-primaria-suave",
                  )}
                >
                  <span className="truncate">{v.vaga}</span>
                  <b className="tabular-nums text-texto">{fmtDf(v.df)}</b>
                  <span className="col-span-2 truncate text-[11px] text-suave">
                    {fmtH(v.horas_indisp)} indisponível{motivo ? ` · ${motivo.nome}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

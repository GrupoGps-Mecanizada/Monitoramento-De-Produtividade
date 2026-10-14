"use client";

import { cx } from "@/components/ui";
import { ORDEM_STATUS, rotuloStatus, type PlacaStatus } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { corDoStatus } from "./cores-analise";

/** Uma barra por placa dividida pelo tempo de cada status, cada um na sua cor (a da Timeline); o status em destaque ordena e vem escrito com o total. */
export function BarrasStatus({ linhas, destaque, selecionada, escolher, vazio }: { linhas: PlacaStatus[]; destaque: string; selecionada: string | null; escolher: (placa: string) => void; vazio: string }) {
  const rotulo = rotuloStatus(destaque);
  // legenda: os status que aparecem nas barras, na ordem fixa
  const presentes = [...new Map(linhas.flatMap((l) => l.partes).map((p) => [p.cod, p] as const)).values()].sort((a, b) => ORDEM_STATUS.indexOf(a.cod) - ORDEM_STATUS.indexOf(b.cod));
  return (
    <section aria-label="Placas" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Placas <span className="font-normal normal-case tracking-normal">· tempo de cada status do motor</span>
      </h2>
      {linhas.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <>
          <ul className="mt-2 grid gap-1">
            {linhas.map((l) => {
              return (
                <li key={l.chave}>
                  <button
                    type="button"
                    aria-pressed={selecionada === l.chave}
                    aria-label={`${l.nome}, ${rotulo} ${fmtHoras(l.destaque)} de ${fmtHoras(l.total)}`}
                    onClick={() => escolher(l.chave)}
                    className={cx("grid w-full gap-1 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2", selecionada != null && selecionada !== l.chave && "opacity-40", selecionada === l.chave && "bg-primaria-suave")}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{l.nome}</span>
                      <span className="shrink-0 tabular-nums text-suave">
                        <b className="text-texto">{fmtHoras(l.destaque)}</b> de {fmtHoras(l.total)}
                      </span>
                    </span>
                    <span aria-hidden className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
                      {l.partes.map((p) => (
                        <span key={p.cod} title={`${p.rotulo}: ${fmtHoras(p.min)}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.min / l.total) * 100}%`, background: corDoStatus(p.cod) }} />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-suave">
            {presentes.map((p) => (
              <span key={p.cod} className={cx("flex items-center gap-1", p.cod === destaque && "font-semibold text-texto")}>
                <i aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: corDoStatus(p.cod) }} />
                {p.rotulo}
              </span>
            ))}
          </p>
        </>
      )}
    </section>
  );
}

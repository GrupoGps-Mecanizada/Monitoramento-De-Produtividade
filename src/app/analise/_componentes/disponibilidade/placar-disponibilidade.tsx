import { fmtDf, fmtH, type VagaBoletim } from "@/lib/dominio/medicao";

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-suave">{rotulo}</dt>
      <dd className="truncate text-2xl font-bold tabular-nums text-texto">{valor}</dd>
      {nota && <p className="truncate text-[11px] text-suave">{nota}</p>}
    </div>
  );
}

/** DF da frota no ciclo, horas indisponíveis e a pior vaga. */
export function PlacarDisponibilidade({ df, horasIndisp, pior }: { df: number | null; horasIndisp: number; pior: VagaBoletim | null }) {
  return (
    <section aria-label="Placar da disponibilidade">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-3">
        <Numero rotulo="DF da frota" valor={df == null ? "—" : fmtDf(df)} nota="disponibilidade física no ciclo" />
        <Numero rotulo="Horas indisponíveis" valor={fmtH(horasIndisp)} />
        <Numero rotulo="Pior vaga" valor={pior ? fmtDf(pior.df) : "—"} nota={pior?.vaga} />
      </dl>
    </section>
  );
}

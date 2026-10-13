import { CORES_CALOR } from "./camada-analise";

/** Legenda do mapa de calor (só no computador): pouco → muito tempo parado. */
export function LegendaCalor() {
  return (
    <div aria-label="Legenda do mapa de calor" className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden items-center gap-2 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      <span>pouco</span>
      <span aria-hidden className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${CORES_CALOR.map(([, cor]) => cor).join(", ")})` }} />
      <span>muito tempo parado</span>
    </div>
  );
}

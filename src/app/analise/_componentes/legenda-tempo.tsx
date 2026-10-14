import { corDaFaixa, rotulosDasFaixas } from "./cores-analise";

/** Legenda do modo "Tempo parado": um quadradinho por faixa com o intervalo de horas (só no computador). */
export function LegendaTempo({ limites }: { limites: number[] }) {
  const rotulos = rotulosDasFaixas(limites);
  if (!rotulos.length) return null;
  return (
    <div aria-label="Legenda do tempo parado" className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      <span className="font-semibold text-texto">Tempo parado</span>
      {rotulos.map((r, i) => (
        <span key={r} className="flex items-center gap-1.5">
          <i aria-hidden className="h-3 w-3 rounded-sm" style={{ background: corDaFaixa(i, rotulos.length) }} />
          {r}
        </span>
      ))}
    </div>
  );
}

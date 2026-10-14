import { opacidadeDaFaixa, rotulosDasFaixas } from "./cores-analise";

/** Legenda do modo "Pelo tempo": o nome do que se mede e um quadradinho por faixa, na cor da medida (só no computador). */
export function LegendaTempo({ limites, cor, rotulo }: { limites: number[]; cor: string; rotulo: string }) {
  const rotulos = rotulosDasFaixas(limites);
  if (!rotulos.length) return null;
  return (
    <div aria-label="Legenda do mapa" className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      <span className="font-semibold text-texto">{rotulo}</span>
      {rotulos.map((r, i) => (
        <span key={`${i}-${r}`} className="flex items-center gap-1.5">
          <i aria-hidden className="h-3 w-3 rounded-sm" style={{ background: cor, opacity: opacidadeDaFaixa(i, rotulos.length) }} />
          {r}
        </span>
      ))}
    </div>
  );
}

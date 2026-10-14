import { rampaDaCor, rotulosDasFaixas, tomDaFaixa } from "./cores-analise";

const quadradinho = (cor: string, opacidade = 1) => <i aria-hidden className="h-3 w-3 shrink-0 rounded-sm" style={{ background: cor, opacity: opacidade }} />;

/**
 * Legenda do mapa (só no computador). "Quanto parou": o nome da medida e um tom por faixa de horas.
 * "O que parou": as categorias que venceram em alguma área e o cinza do misto.
 */
export function LegendaTempo({ limites, cor, rotulo, categorias }: { limites: number[]; cor: string; rotulo: string; categorias: { nome: string; cor: string }[] | null }) {
  const caixa = "pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex";
  if (categorias) {
    if (!categorias.length) return null;
    return (
      <div aria-label="Legenda do mapa" className={caixa}>
        <span className="font-semibold text-texto">O que mais pesa</span>
        {categorias.map((c) => (
          <span key={c.nome} className="flex items-center gap-1.5">
            {quadradinho(c.cor)}
            {c.nome}
          </span>
        ))}
        <span className="mt-0.5 text-[10px]">tom fraco = venceu por pouco</span>
      </div>
    );
  }
  const rotulos = rotulosDasFaixas(limites);
  if (!rotulos.length) return null;
  const rampa = rampaDaCor(cor);
  return (
    <div aria-label="Legenda do mapa" className={caixa}>
      <span className="font-semibold text-texto">{rotulo}</span>
      {rotulos.map((r, i) => (
        <span key={`${i}-${r}`} className="flex items-center gap-1.5">
          {quadradinho(rampa[tomDaFaixa(i, rotulos.length)])}
          {r}
        </span>
      ))}
    </div>
  );
}

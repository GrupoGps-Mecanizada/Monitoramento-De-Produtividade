/** Porcentagem arredondada, ou "—" sem dado (nunca 0% inventado). */
export const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

/** Três números-chave lado a lado. */
export function Numeros({ itens }: { itens: { rotulo: string; valor: string; sub?: string }[] }) {
  return (
    <section aria-label="Números" className="grid grid-cols-3 gap-2">
      {itens.map((i) => (
        <div key={i.rotulo} className="min-w-0 rounded-xl border border-borda bg-superficie p-3">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-suave">{i.rotulo}</p>
          <p title={i.valor} className="mt-1 line-clamp-2 text-xl font-bold leading-tight tabular-nums text-texto">{i.valor}</p>
          {i.sub && <p className="truncate text-[11px] text-suave">{i.sub}</p>}
        </div>
      ))}
    </section>
  );
}

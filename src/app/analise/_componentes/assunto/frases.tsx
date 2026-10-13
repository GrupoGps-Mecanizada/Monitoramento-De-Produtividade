/** "O que os dados dizem": as frases automáticas, ou o aviso de vazio. */
export function Frases({ textos, vazio }: { textos: string[]; vazio: string }) {
  return (
    <section aria-label="O que os dados dizem" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">O que os dados dizem</h2>
      {textos.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <ul aria-label="Frases automáticas" className="mt-2 grid gap-1 text-[13px] text-texto">
          {textos.map((t) => (
            <li key={t} className="flex gap-1.5">
              <span aria-hidden className="text-primaria">•</span>
              {t}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

import { cx } from "../ui";

/** Legenda no canto do mapa (só no computador). */
export function Legenda({ itens }: { itens: { rotulo: string; cor: string; tracejado?: boolean }[] }) {
  return (
    <div className="pointer-events-none absolute bottom-6 left-2.5 z-[500] hidden flex-col gap-1 rounded-lg border border-borda bg-superficie/95 px-2.5 py-2 text-[11px] text-suave shadow-md md:flex">
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-1.5">
          <i className={cx("h-[9px] w-[9px] rounded-full", i.tracejado && "opacity-70 outline-1 outline-dashed outline-texto/60")} style={{ background: i.cor }} />
          {i.rotulo}
        </div>
      ))}
    </div>
  );
}

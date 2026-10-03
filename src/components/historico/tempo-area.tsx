import { fmtMin } from "@/lib/dominio/formato";

/** Barras com o tempo em cada área (as 8 maiores). */
export function TempoPorArea({ areas }: { areas: { area: string; min: number }[] }) {
  if (!areas.length) return null;
  const max = areas[0].min || 1;
  return (
    <div className="flex flex-col gap-2 px-4 pb-3">
      {areas.slice(0, 8).map((a) => (
        <div key={a.area} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 text-xs">
          <span className="truncate">{a.area}</span>
          <b className="tabular-nums">{fmtMin(a.min)}</b>
          <span className="col-span-2 h-1 overflow-hidden rounded-full bg-superficie-2">
            <span className="block h-full rounded-full bg-primaria" style={{ width: `${(a.min / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}

import { emPct, marcasRegua, type Janela } from "@/lib/dominio/trilhas";
import { cx } from "../ui";

/** Horas cheias da janela, alinhadas com as trilhas abaixo. */
export function Regua({ janela, className }: { janela: Janela; className?: string }) {
  return (
    <div aria-hidden className={cx("relative h-4 text-[10px] tabular-nums text-suave", className)}>
      {marcasRegua(janela).map((s) => (
        <span key={s} className={cx("absolute top-0", s === janela[0] ? "" : s === janela[1] ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${emPct(s, janela)}%` }}>
          {s / 3600}h
        </span>
      ))}
    </div>
  );
}

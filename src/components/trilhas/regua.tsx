import { emPct, marcasRegua, rotuloMarca, type Janela } from "@/lib/dominio/trilhas";
import { cx } from "../ui";

/** Horas cheias da janela, alinhadas com as trilhas abaixo. */
export function Regua({ janela, grande = false, className }: { janela: Janela; grande?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cx("relative tabular-nums text-suave", grande ? "h-6 text-[13px] font-semibold" : "h-4 text-[10px]", className)}>
      {marcasRegua(janela, grande).map((s) => (
        <span key={s} className={cx("absolute top-0", s === janela[0] ? "" : s === janela[1] ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${emPct(s, janela)}%` }}>
          {rotuloMarca(s)}
        </span>
      ))}
    </div>
  );
}

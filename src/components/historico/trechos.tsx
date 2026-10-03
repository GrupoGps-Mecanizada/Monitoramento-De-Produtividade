import { CLASSE_TOM } from "@/lib/cores";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import type { Trecho } from "@/lib/tipos";
import { cx } from "../ui";

/** Apontamento: um item por trecho (clicar foca no mapa). */
export function ListaTrechos({ trechos, sel, aoEscolher }: { trechos: Trecho[]; sel: number | null; aoEscolher: (i: number) => void }) {
  return (
    <div>
      {trechos.map((t, i) => {
        const e = ESTADOS_TRECHO[t.estado];
        return (
          <button
            key={`${t.inicio}-${i}`}
            type="button"
            data-trecho={i}
            onClick={() => aoEscolher(i)}
            aria-current={sel === i ? "true" : undefined}
            className={cx("grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-4 py-2.5 text-left hover:bg-superficie-2", sel === i && "bg-primaria-suave")}
          >
            <span className={cx("grid h-7 w-7 place-items-center rounded-md text-xs font-bold", CLASSE_TOM[e.tom])}>{e.icone}</span>
            <span className="min-w-0 text-[13px] leading-snug">
              <b>{e.rotulo}</b>
              {t.estado === "movimento" ? (
                <>
                  {" "}· {t.km} km · máx {t.vel_max} km/h
                  <span className="block text-suave">{t.percurso.length ? t.percurso.join(" → ") : "sem cercas no caminho"}</span>
                </>
              ) : t.estado === "sem_sinal" ? (
                " · nenhuma posição recebida"
              ) : (
                ` em ${t.local}`
              )}
              {!!t.motor2_min && <span className="block font-semibold text-motor2">⚙ motor 2º ligado {fmtMin(t.motor2_min)}</span>}
            </span>
            <span className="text-right text-xs tabular-nums text-suave">
              {hhmm(t.inicio)}–{hhmm(t.fim)}
              <br />
              <span className="font-medium text-texto">{fmtMin(t.duracao_min)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

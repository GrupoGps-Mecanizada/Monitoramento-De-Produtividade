"use client";

import { corDoTom } from "@/lib/cores";
import { MIN_CAPITULO, segCap, type Capitulo, type Destaques as TDestaques } from "@/lib/dominio/capitulos";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { Vazio, cx } from "../ui";

/** Frases neutras do dia (nada de "trabalhou": a regra ainda vai ser definida). */
export function Destaques({ d }: { d: TDestaques }) {
  const itens = [
    d.primeiraSaidaBase && `Primeira saída do pátio ${hhmm(d.primeiraSaidaBase)}`,
    d.ultimaVoltaBase && `Voltou ao pátio ${hhmm(d.ultimaVoltaBase)}`,
    d.areasServico > 0 && `${d.areasServico} área${d.areasServico > 1 ? "s" : ""} de serviço`,
    d.maiorParadoLigado && `Parado ligado mais longo: ${d.maiorParadoLigado.lugar} (${fmtMin(d.maiorParadoLigado.min)})`,
  ].filter((x): x is string => !!x);
  if (!itens.length) return null;
  return (
    <ul aria-label="Destaques do dia" className="flex flex-wrap gap-1.5">
      {itens.map((t) => (
        <li key={t} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs">
          {t}
        </li>
      ))}
    </ul>
  );
}

function BarraCapitulo({ c }: { c: Capitulo }) {
  const total = Math.max(c.duracao_min, 1);
  const partes: [number, string, string][] = [
    [c.ligado_min, corDoTom("warn"), "parado ligado"],
    [c.desligado_min, corDoTom("bad"), "desligado"],
    [c.outro_min, corDoTom("reg"), "sem sinal"],
  ];
  return (
    <span className="my-1 flex h-1.5 overflow-hidden rounded bg-superficie-2" title={partes.filter(([m]) => m).map(([m, , r]) => `${fmtMin(m)} ${r}`).join(" · ")}>
      {partes.map(([m, cor, r]) => (m ? <span key={r} style={{ width: `${(m / total) * 100}%`, background: cor }} /> : null))}
    </span>
  );
}

interface Props {
  capitulos: Capitulo[];
  atual: number | null;
  foco: [number, number] | null;
  escolher: (c: Capitulo) => void;
}

/** A história do dia: paradas longas numeradas (o mesmo número do mapa) e o caminho entre elas. */
export function ListaCapitulos({ capitulos, atual, foco, escolher }: Props) {
  if (!capitulos.length) {
    return <Vazio titulo="Nenhuma parada longa">Neste dia não houve parada de {MIN_CAPITULO} min ou mais no mesmo lugar. A faixa acima e o apontamento completo mostram tudo.</Vazio>;
  }
  const lista = foco ? capitulos.filter((c) => segCap(c.fim) >= foco[0] && segCap(c.inicio) <= foco[1]) : capitulos;
  if (!lista.length) return <p className="px-4 py-3 text-sm text-suave">Nenhum capítulo no período em foco.</p>;
  return (
    <ol aria-label="Capítulos do dia">
      {lista.map((c) => (
        <li key={c.n} data-capitulo={c.n}>
          <button
            type="button"
            onClick={() => escolher(c)}
            aria-current={atual === c.n ? "step" : undefined}
            className={cx("grid w-full grid-cols-[22px_1fr] gap-x-2.5 border-b border-borda px-4 py-2.5 text-left hover:bg-superficie-2", atual === c.n && "bg-primaria-suave")}
          >
            <span className={cx("grid h-[22px] w-[22px] place-items-center rounded-full text-[11px] font-bold text-white", c.tipoLugar === "base" ? "bg-slate-500" : "bg-primaria")}>{c.n}</span>
            <span className="min-w-0">
              <span className="flex justify-between gap-2 text-[13px]">
                <b className="truncate font-semibold">{c.lugar}</b>
                <span className="shrink-0 tabular-nums text-suave">
                  {hhmm(c.inicio)}–{hhmm(c.fim)} · {fmtMin(c.duracao_min)}
                </span>
              </span>
              <BarraCapitulo c={c} />
              {c.ate && (
                <span className="block truncate text-xs text-link">
                  → {c.ate.km.toLocaleString("pt-BR")} km até {c.ate.destino}
                  {c.ate.passou.length ? ` · passou por ${c.ate.passou.join(", ")}` : ""}
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

"use client";

import { Fragment, useMemo, useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Alca } from "@/components/trilhas/alca";
import { Balao } from "@/components/trilhas/balao";
import { Regua } from "@/components/trilhas/regua";
import { Selecao } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { GRUPOS, TODOS_GRUPOS, doTipo, textoEvento, textoPlano, veiculoDoEvento } from "@/lib/dominio/eventos";
import { diaBR, diaLocal, hora, rotuloDia } from "@/lib/dominio/formato";
import { agruparEventos, emPct, janelaDosEventos, type Bolinha } from "@/lib/dominio/trilhas";
import { useOpcao } from "@/lib/hooks";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";

const ESTADOS = ["recolhida", "aberta"] as const;

interface Props {
  /** alertas do dia (sem a abertura) */
  eventos: Evento[];
  dia: string;
  dias: string[];
  setDia: (d: string) => void;
  /** filtro de tipo do topo (null = todos) */
  tipo: TipoEquip | null;
  veiculos: Veiculo[];
  abrir: (id: string) => void;
}

const rotuloBolinha = (b: Bolinha) => `${hora(b.eventos[0].t)} · ${b.eventos.length === 1 ? textoPlano(textoEvento(b.eventos[0])) : `${b.eventos.length} acontecimentos`}`;

/** Os alertas do dia numa linha do tempo por grupo (entradas, saídas, status, sinal), embaixo do mapa. */
export function FaixaAcontecimentos({ eventos, dia, dias, setDia, tipo, veiculos, abrir }: Props) {
  const [estado, setEstado] = useOpcao("mon-faixa-acontecimentos", ESTADOS, "aberta");
  const [dica, setDica] = useState<{ el: HTMLElement; b: Bolinha; fixa: boolean } | null>(null);
  const tipoDe = useMemo(() => new Map(veiculos.flatMap((v): [string, TipoEquip][] => (v.equip ? [[v.id, v.equip.tipo]] : []))), [veiculos]);
  const doFiltro = useMemo(() => doTipo(eventos, tipo, tipoDe), [eventos, tipo, tipoDe]);
  const janela = useMemo(() => janelaDosEventos(doFiltro, dia), [doFiltro, dia]);
  const trilhas = useMemo(() => agruparEventos(doFiltro, dia, janela), [doFiltro, dia, janela]);
  const opcoesDia = dias.includes(dia) ? dias : [dia, ...dias];
  const titulo = dia === diaLocal() ? "Acontecimentos de hoje" : `Acontecimentos de ${diaBR(dia)}`;

  return (
    <section aria-label={titulo} className="shrink-0 rounded-xl border border-borda bg-superficie shadow-md">
      <Alca opcoes={ESTADOS} valor={estado} mudar={setEstado} rotulo="Mostrar ou recolher os acontecimentos" />
      <div className="flex items-center gap-2 px-3 pb-2">
        <b className="text-sm">{titulo}</b>
        <span className="text-xs text-suave">
          {doFiltro.length} {doFiltro.length === 1 ? "acontecimento" : "acontecimentos"}
        </span>
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia dos acontecimentos" className="ml-auto w-36">
          {opcoesDia.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d)}
            </option>
          ))}
        </Selecao>
      </div>
      {estado === "aberta" &&
        (doFiltro.length ? (
          <div className="grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-1 px-3 pb-3" onPointerLeave={() => setDica((d) => (d?.fixa ? d : null))}>
            <span />
            <Regua janela={janela} />
            {TODOS_GRUPOS.map((g) => (
              <Fragment key={g}>
                <span className="text-[11px] text-suave">{GRUPOS[g].rotulo}</span>
                <div className="relative h-5 rounded bg-superficie-2">
                  {trilhas[g].map((b) => (
                    <button
                      key={b.s}
                      type="button"
                      aria-label={rotuloBolinha(b)}
                      onPointerEnter={(e) => {
                        const el = e.currentTarget;
                        setDica((d) => (d?.fixa ? d : { el, b, fixa: false }));
                      }}
                      onClick={(e) => (b.eventos.length === 1 ? abrir(veiculoDoEvento(b.eventos[0])) : setDica({ el: e.currentTarget, b, fixa: true }))}
                      className="absolute top-1/2 grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full px-1 text-[10px] font-bold text-white ring-2 ring-superficie"
                      style={{ left: `${emPct(b.s, janela)}%`, background: corDoTom(GRUPOS[g].tom) }}
                    >
                      {b.eventos.length > 1 ? b.eventos.length : ""}
                    </button>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        ) : (
          <p className="px-3 pb-3 text-sm text-suave">Nenhum acontecimento {tipo ? "deste tipo " : ""}neste dia.</p>
        ))}
      <Balao ancora={dica?.el ?? null} rotulo="Acontecimentos" fechar={dica?.fixa ? () => setDica(null) : undefined} className="max-h-[50vh] w-[320px] overflow-y-auto py-1">
        {dica?.b.eventos.map((e) =>
          dica.fixa ? (
            <button
              key={`${e.t}|${e.id}|${e.tipo}`}
              type="button"
              onClick={() => {
                abrir(veiculoDoEvento(e));
                setDica(null);
              }}
              className="flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left hover:bg-superficie-2"
            >
              <span className="min-w-0 leading-snug">
                <EventoTexto e={e} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-suave">{hora(e.t)}</span>
            </button>
          ) : (
            <p key={`${e.t}|${e.id}|${e.tipo}`} className="flex items-start justify-between gap-3 px-3 py-1.5 leading-snug">
              <span className="min-w-0">
                <EventoTexto e={e} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-suave">{hora(e.t)}</span>
            </p>
          ),
        )}
      </Balao>
    </section>
  );
}

"use client";

import { useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Chip, Contador, Entrada, Ponto, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { GRUPOS, TODOS_GRUPOS, contarPorGrupo, filtrarEventos, grupoDoEvento, veiculoDoEvento, chaveEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { fmtMin, hora, idadeCurta, minutosDesde, rotuloDia } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, INDICADORES, agruparPorArea, categoria, frescor, motor2Ligado, nomeArea, resumoAreas, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, Veiculo } from "@/lib/tipos";

export type Aba = "veiculos" | "areas" | "eventos";

interface Props {
  aba: Aba;
  setAba: (a: Aba) => void;
  veiculos: Veiculo[];
  visiveis: Veiculo[];
  filtro: FiltroVeiculos;
  setFiltro: (f: FiltroVeiculos) => void;
  eventos: Evento[];
  dias: string[];
  diaEventos: string;
  setDiaEventos: (d: string) => void;
  semSinalMin: number;
  agora: number;
  abrir: (id: string) => void;
  escolherArea: (area: string) => void;
}

export function Painel(p: Props) {
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [buscaEv, setBuscaEv] = useState("");
  const nAreas = new Set(p.veiculos.map((v) => v.area).filter(Boolean)).size;
  const conta = contarPorGrupo(p.eventos);
  const dias = p.dias.includes(p.diaEventos) ? p.dias : [p.diaEventos, ...p.dias];
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <Segmentado
          rotulo="O que listar"
          valor={p.aba}
          mudar={p.setAba}
          opcoes={[
            { id: "veiculos", rotulo: <>Veículos <Contador n={p.visiveis.length} /></> },
            { id: "areas", rotulo: <>Áreas <Contador n={nAreas} /></> },
            { id: "eventos", rotulo: <>Eventos <Contador n={p.eventos.length} /></> },
          ]}
        />
        {p.aba === "veiculos" && (
          <>
            <Entrada type="search" value={p.filtro.busca} onChange={(e) => p.setFiltro({ ...p.filtro, busca: e.target.value })} placeholder="Buscar placa, vaga, área, motorista…" aria-label="Buscar veículo" autoComplete="off" className="w-full" />
            {(p.filtro.indicador || p.filtro.area) && (
              <div className="flex flex-wrap gap-1.5">
                {p.filtro.indicador && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, indicador: null })}>
                    {INDICADORES.find((i) => i.id === p.filtro.indicador)?.rotulo} ✕
                  </Chip>
                )}
                {p.filtro.area && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, area: null })}>
                    {nomeArea(p.filtro.area)} ✕
                  </Chip>
                )}
              </div>
            )}
          </>
        )}
        {p.aba === "eventos" && (
          <>
            <div className="flex gap-2">
              <Selecao value={p.diaEventos} onChange={(e) => p.setDiaEventos(e.target.value)} aria-label="Dia dos eventos" className="w-36">
                {dias.map((d) => (
                  <option key={d} value={d}>
                    {rotuloDia(d)}
                  </option>
                ))}
              </Selecao>
              <Entrada type="search" value={buscaEv} onChange={(e) => setBuscaEv(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar evento" autoComplete="off" className="flex-1" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TODOS_GRUPOS.map((g) => (
                <Chip key={g} ativo={grupos.has(g)} tom={GRUPOS[g].tom} onClick={() => alternarGrupo(g)}>
                  {GRUPOS[g].rotulo} <Contador n={conta[g]} />
                </Chip>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {p.aba === "veiculos" && <ListaVeiculos lista={p.visiveis} semSinalMin={p.semSinalMin} agora={p.agora} abrir={p.abrir} />}
        {p.aba === "areas" && <ListaAreas veiculos={p.veiculos} escolher={p.escolherArea} />}
        {p.aba === "eventos" && <ListaEventos eventos={filtrarEventos(p.eventos, grupos, buscaEv)} abrir={p.abrir} />}
      </div>
    </div>
  );
}

function ListaVeiculos({ lista, semSinalMin, agora, abrir }: { lista: Veiculo[]; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  if (!lista.length) return <Vazio titulo="Nenhum veículo">Ajuste a busca ou os filtros.</Vazio>;
  return (
    <>
      {agruparPorArea(lista).map((g) => (
        <section key={g.area || "fora"}>
          <h3 className="sticky top-0 z-10 flex items-center justify-between border-b border-borda bg-superficie-2 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave">
            <span className="truncate">{nomeArea(g.area)}</span>
            <Contador n={g.veiculos.length} />
          </h3>
          {g.veiculos.map((v) => (
            <ItemVeiculo key={v.id} v={v} semSinalMin={semSinalMin} agora={agora} abrir={abrir} />
          ))}
        </section>
      ))}
    </>
  );
}

function ItemVeiculo({ v, semSinalMin, agora, abrir }: { v: Veiculo; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const fr = frescor(v, semSinalMin, agora);
  const onde = v.area ? (v.area_desde ? `há ${fmtMin(minutosDesde(v.area_desde, agora))} na área` : "na área") : v.via || "fora de cerca";
  return (
    <button type="button" onClick={() => abrir(v.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-borda px-3.5 py-2.5 text-left hover:bg-superficie-2">
      <Ponto tom={CATEGORIAS[categoria(v)].tom} className="h-2.5 w-2.5" />
      <span className="truncate font-semibold">{v.placa}</span>
      <span className="flex items-center gap-1.5 text-xs tabular-nums text-suave" title={FRESCOR[fr].rotulo}>
        <Ponto tom={FRESCOR[fr].tom} className="h-1.5 w-1.5" />
        {idadeCurta(v.posicao_em, agora)}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {v.status} · {v.vaga || "sem vaga"}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {onde}
        {v.demora ? ` · ${v.demora}` : ""}
      </span>
      {v.motor2 && (
        <span className={cx("col-span-2 col-start-2 text-xs", motor2Ligado(v) ? "font-semibold text-motor2" : "text-suave")}>
          ⚙ Motor 2º: {v.motor2.status}
          {motor2Ligado(v) && v.motor2.status_desde ? ` há ${fmtMin(minutosDesde(v.motor2.status_desde, agora))}` : ""}
        </span>
      )}
    </button>
  );
}

function ListaAreas({ veiculos, escolher }: { veiculos: Veiculo[]; escolher: (area: string) => void }) {
  return (
    <>
      {resumoAreas(veiculos).map((a) => (
        <button key={a.area} type="button" onClick={() => escolher(a.area)} className="grid w-full grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-borda px-3.5 py-2.5 text-left hover:bg-superficie-2">
          <span className="truncate font-semibold">{nomeArea(a.area)}</span>
          <b className="tabular-nums">{a.total}</b>
          <span className="col-span-2 flex h-1.5 overflow-hidden rounded-full bg-superficie-2">
            {a.porCategoria.map(([c, n]) => (
              <span key={c} title={`${CATEGORIAS[c].rotulo}: ${n}`} style={{ width: `${(n / a.total) * 100}%`, background: corDoTom(CATEGORIAS[c].tom) }} />
            ))}
          </span>
          <span className="col-span-2 text-xs text-suave">{a.porCategoria.map(([c, n]) => `${n} ${CATEGORIAS[c].rotulo.toLowerCase()}`).join(" · ")}</span>
        </button>
      ))}
    </>
  );
}

function ListaEventos({ eventos, abrir }: { eventos: Evento[]; abrir: (id: string) => void }) {
  if (!eventos.length) {
    return (
      <Vazio titulo="Nenhum evento">Eventos são gerados a partir de quando o monitoramento está rodando. Para o dia completo de um veículo, abra-o e use “Ver histórico”.</Vazio>
    );
  }
  return (
    <>
      {eventos.slice(0, 400).map((e) => (
        <button key={chaveEvento(e)} type="button" onClick={() => abrir(veiculoDoEvento(e))} className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-3.5 py-2.5 text-left text-[13px] hover:bg-superficie-2">
          <span className="mt-0.5 text-base leading-none" style={{ color: corDoTom(GRUPOS[grupoDoEvento(e)].tom) }} aria-hidden>
            {GRUPOS[grupoDoEvento(e)].icone}
          </span>
          <span className="min-w-0 leading-snug">
            <EventoTexto e={e} />
          </span>
          <span className="text-xs tabular-nums text-suave">{hora(e.t)}</span>
        </button>
      ))}
    </>
  );
}

"use client";

import { useState } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Chip, Contador, Entrada, Ponto, Segmentado, Selecao, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { ORDEM_TIPOS, TIPOS_EQUIP, compararEquip, nomeEquip } from "@/lib/dominio/equipamentos";
import { GRUPOS, TODOS_GRUPOS, contarPorGrupo, filtrarEventos, grupoDoEvento, veiculoDoEvento, chaveEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { hora, idadeCurta, rotuloDia } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, INDICADORES, RESUMO_TOPO, categoria, fraseEstado, frescor, motor2Ligado, noIndicador, nomeArea, resumoAreas, vagaCurta, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";

export type Aba = "tipos" | "areas" | "alertas";

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
  const nAreas = new Set(p.veiculos.map((v) => v.area).filter(Boolean)).size;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <div className="grid grid-cols-4 gap-1.5">
          {RESUMO_TOPO.map((id) => {
            const i = INDICADORES.find((x) => x.id === id)!;
            const n = p.veiculos.filter((v) => noIndicador(id, v, p.semSinalMin, p.agora)).length;
            const ativo = p.filtro.indicador === id;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={ativo}
                onClick={() => p.setFiltro({ ...p.filtro, indicador: ativo ? null : id })}
                className={cx("rounded-lg border px-1 py-1.5 text-center text-[11px] text-suave", ativo ? "border-primaria bg-primaria-suave" : "border-borda hover:bg-superficie-2")}
              >
                <b className="block text-base tabular-nums" style={{ color: corDoTom(i.tom) }}>
                  {n}
                </b>
                {i.curto}
              </button>
            );
          })}
        </div>
        <Segmentado
          rotulo="O que listar"
          valor={p.aba}
          mudar={p.setAba}
          opcoes={[
            { id: "tipos", rotulo: <>Tipos <Contador n={p.visiveis.length} /></> },
            { id: "areas", rotulo: <>Áreas <Contador n={nAreas} /></> },
            { id: "alertas", rotulo: <>Alertas <Contador n={p.eventos.length} /></> },
          ]}
        />
        {p.aba === "tipos" && (
          <>
            <Entrada type="search" value={p.filtro.busca} onChange={(e) => p.setFiltro({ ...p.filtro, busca: e.target.value })} placeholder="Buscar placa, vaga, área, motorista…" aria-label="Buscar veículo" autoComplete="off" className="w-full" />
            {(p.filtro.indicador || p.filtro.area || p.filtro.tipo) && (
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
                {p.filtro.tipo && (
                  <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, tipo: null })}>
                    {TIPOS_EQUIP[p.filtro.tipo].rotulo} ✕
                  </Chip>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {p.aba === "alertas" ? (
        <PainelAlertas eventos={p.eventos} dias={p.dias} diaEventos={p.diaEventos} setDiaEventos={p.setDiaEventos} abrir={p.abrir} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {p.aba === "tipos" && <ListaTipos lista={p.visiveis} semSinalMin={p.semSinalMin} agora={p.agora} abrir={p.abrir} />}
          {p.aba === "areas" && <ListaAreas veiculos={p.veiculos} escolher={p.escolherArea} />}
        </div>
      )}
    </div>
  );
}

function ListaTipos({ lista, semSinalMin, agora, abrir }: { lista: Veiculo[]; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const [fechados, setFechados] = useState<Set<TipoEquip>>(() => new Set());
  if (!lista.length) return <Vazio titulo="Nenhum equipamento">Ajuste a busca ou os filtros.</Vazio>;
  const alternar = (t: TipoEquip) =>
    setFechados((f) => {
      const n = new Set(f);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return n;
    });
  return (
    <>
      {ORDEM_TIPOS.map((tipo) => {
        const vs = lista.filter((v) => v.equip?.tipo === tipo).sort(compararEquip);
        if (!vs.length) return null;
        const aberto = !fechados.has(tipo);
        const n = (id: "ligado" | "desligado" | "semsinal") => vs.filter((v) => noIndicador(id, v, semSinalMin, agora)).length;
        return (
          <section key={tipo}>
            <h3 className="sticky top-0 z-10 border-b border-borda bg-superficie-2">
              <button type="button" aria-expanded={aberto} onClick={() => alternar(tipo)} className="flex w-full items-center gap-2 px-3.5 py-1.5 text-left text-xs font-semibold">
                <span aria-hidden>{aberto ? "▾" : "▸"}</span>
                <span className="min-w-0 flex-1 truncate">{TIPOS_EQUIP[tipo].rotulo}</span>
                <span className="font-normal tabular-nums text-suave">
                  {n("ligado")} lig. · {n("desligado")} desl.{n("semsinal") ? ` · ${n("semsinal")} sem sinal` : ""} · {vs.length}
                </span>
              </button>
            </h3>
            {aberto && vs.map((v) => <ItemVeiculo key={v.id} v={v} semSinalMin={semSinalMin} agora={agora} abrir={abrir} />)}
          </section>
        );
      })}
    </>
  );
}

export function ItemVeiculo({ v, semSinalMin, agora, abrir }: { v: Veiculo; semSinalMin: number; agora: number; abrir: (id: string) => void }) {
  const fr = frescor(v, semSinalMin, agora);
  const vaga = v.equip?.tipo === "as" ? "" : vagaCurta(v.vaga);
  return (
    <button type="button" onClick={() => abrir(v.id)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-borda px-3.5 py-2 text-left hover:bg-superficie-2">
      <Ponto tom={CATEGORIAS[categoria(v)].tom} className="h-2.5 w-2.5" />
      <span className="truncate font-semibold">
        {nomeEquip(v)}
        {vaga && <span className="ml-1.5 text-xs font-normal text-suave">{vaga}</span>}
      </span>
      <span className="flex items-center gap-1.5 text-xs tabular-nums text-suave" title={FRESCOR[fr].rotulo}>
        <Ponto tom={FRESCOR[fr].tom} className="h-1.5 w-1.5" />
        {idadeCurta(v.posicao_em, agora)}
      </span>
      <span className="col-span-2 col-start-2 truncate text-xs text-suave">
        {fraseEstado(v, semSinalMin, agora)}
        {v.motor2 && <span className={cx("ml-1.5", motor2Ligado(v) && "font-semibold text-motor2")}>⚙ bomba {motor2Ligado(v) ? "ligada" : "desligada"}</span>}
      </span>
    </button>
  );
}

export function ListaAreas({ veiculos, escolher }: { veiculos: Veiculo[]; escolher: (area: string) => void }) {
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
    return <Vazio titulo="Nenhum alerta">Alertas são gerados a partir de quando o monitoramento está rodando. Para o dia completo de um equipamento, abra-o e use “Ver o dia”.</Vazio>;
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

/** Alertas do dia com filtro por grupo e busca (aba do celular e balão do sino no computador). */
export function PainelAlertas({ eventos, dias, diaEventos, setDiaEventos, abrir }: { eventos: Evento[]; dias: string[]; diaEventos: string; setDiaEventos: (d: string) => void; abrir: (id: string) => void }) {
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [buscaEv, setBuscaEv] = useState("");
  const conta = contarPorGrupo(eventos);
  const opcoesDia = dias.includes(diaEventos) ? dias : [diaEventos, ...dias];
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <div className="flex gap-2">
          <Selecao value={diaEventos} onChange={(e) => setDiaEventos(e.target.value)} aria-label="Dia dos alertas" className="w-36">
            {opcoesDia.map((d) => (
              <option key={d} value={d}>
                {rotuloDia(d)}
              </option>
            ))}
          </Selecao>
          <Entrada type="search" value={buscaEv} onChange={(e) => setBuscaEv(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar alerta" autoComplete="off" className="flex-1" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TODOS_GRUPOS.map((g) => (
            <Chip key={g} ativo={grupos.has(g)} tom={GRUPOS[g].tom} onClick={() => alternarGrupo(g)}>
              {GRUPOS[g].rotulo} <Contador n={conta[g]} />
            </Chip>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ListaEventos eventos={filtrarEventos(eventos, grupos, buscaEv)} abrir={abrir} />
      </div>
    </div>
  );
}

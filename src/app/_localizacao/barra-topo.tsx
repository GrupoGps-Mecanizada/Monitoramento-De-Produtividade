"use client";

import { useCallback, useState } from "react";
import { Icone } from "@/components/icones";
import { Balao } from "@/components/trilhas/balao";
import { Botao, Chip, Contador, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { ORDEM_TIPOS, TIPOS_EQUIP, compararEquip } from "@/lib/dominio/equipamentos";
import { INDICADORES, RESUMO_TOPO, noIndicador, nomeArea, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import type { Evento, TipoEquip, Veiculo } from "@/lib/tipos";
import { ItemVeiculo, ListaAreas, PainelAlertas } from "./painel";

interface Props {
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
type Aberto = { qual: "tipo" | "areas" | "alertas"; el: HTMLElement } | null;

/** Topo da Localização no computador: tipos (filtram e abrem a lista num balão), contadores, áreas e o sino de alertas. */
export function BarraTopo(p: Props) {
  const [aberto, setAberto] = useState<Aberto>(null);
  const fechar = useCallback(() => setAberto(null), []);
  const alternar = (qual: "areas" | "alertas", el: HTMLElement) => setAberto((a) => (a?.qual === qual ? null : { qual, el }));
  const escolherTipo = (t: TipoEquip, el: HTMLElement) => {
    if (p.filtro.tipo === t) {
      p.setFiltro({ ...p.filtro, tipo: null });
      fechar();
    } else {
      p.setFiltro({ ...p.filtro, tipo: t });
      setAberto({ qual: "tipo", el });
    }
  };
  const abrirEFechar = (id: string) => {
    p.abrir(id);
    fechar();
  };
  const nAreas = new Set(p.veiculos.map((v) => v.area).filter(Boolean)).size;
  const doTipo = p.filtro.tipo ? p.visiveis.filter((v) => v.equip?.tipo === p.filtro.tipo).sort(compararEquip) : [];
  const rotulo = aberto?.qual === "tipo" && p.filtro.tipo ? TIPOS_EQUIP[p.filtro.tipo].rotulo : aberto?.qual === "areas" ? "Áreas" : "Alertas";

  return (
    <nav aria-label="Filtros do mapa" className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border border-borda bg-superficie px-2.5 py-2 shadow-md">
      {ORDEM_TIPOS.map((t) => {
        const vs = p.veiculos.filter((v) => v.equip?.tipo === t);
        if (!vs.length) return null;
        const lig = vs.filter((v) => noIndicador("ligado", v, p.semSinalMin, p.agora)).length;
        const ativo = p.filtro.tipo === t;
        return (
          <button
            key={t}
            type="button"
            aria-pressed={ativo}
            title={`${TIPOS_EQUIP[t].rotulo}: ${lig} ligados de ${vs.length}`}
            onClick={(e) => escolherTipo(t, e.currentTarget)}
            className={cx("rounded-lg px-2.5 py-1 text-[12px] tabular-nums", ativo ? "bg-primaria text-white" : "bg-superficie-2 text-suave hover:text-texto")}
          >
            <b className="mr-1 text-[13px]">{TIPOS_EQUIP[t].sigla}</b>
            {vs.length}
          </button>
        );
      })}
      <span aria-hidden className="mx-1 h-6 w-px bg-borda" />
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
            className={cx("flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px] text-suave", ativo ? "border-primaria bg-primaria-suave" : "border-transparent hover:bg-superficie-2")}
          >
            <b className="text-[13px] tabular-nums" style={{ color: corDoTom(i.tom) }}>
              {n}
            </b>
            {i.curto}
          </button>
        );
      })}
      {p.filtro.area && (
        <Chip ativo onClick={() => p.setFiltro({ ...p.filtro, area: null })}>
          {nomeArea(p.filtro.area)} ✕
        </Chip>
      )}
      <span className="ml-auto flex items-center gap-1.5">
        <Botao variante="secundaria" tamanho="mini" aria-expanded={aberto?.qual === "areas"} onClick={(e) => alternar("areas", e.currentTarget)}>
          Áreas <Contador n={nAreas} />
        </Botao>
        <Botao variante="secundaria" tamanho="mini" aria-expanded={aberto?.qual === "alertas"} onClick={(e) => alternar("alertas", e.currentTarget)}>
          <Icone nome="alertas" className="h-4 w-4" />
          Alertas <Contador n={p.eventos.length} />
        </Botao>
      </span>
      <Balao ancora={aberto?.el ?? null} lado="baixo" rotulo={rotulo} fechar={fechar} className={cx("flex w-[360px] flex-col overflow-hidden", aberto?.qual === "alertas" ? "h-[60vh]" : "max-h-[60vh]")}>
        {aberto?.qual === "tipo" && p.filtro.tipo && (
          <>
            <p className="border-b border-borda px-3.5 py-2 text-xs font-semibold">
              {TIPOS_EQUIP[p.filtro.tipo].rotulo} · {doTipo.length} no mapa
            </p>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {doTipo.length ? doTipo.map((v) => <ItemVeiculo key={v.id} v={v} semSinalMin={p.semSinalMin} agora={p.agora} abrir={abrirEFechar} />) : <Vazio titulo="Nenhum equipamento">Ajuste os contadores do topo.</Vazio>}
            </div>
          </>
        )}
        {aberto?.qual === "areas" && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ListaAreas
              veiculos={p.veiculos}
              escolher={(a) => {
                p.escolherArea(a);
                fechar();
              }}
            />
          </div>
        )}
        {aberto?.qual === "alertas" && <PainelAlertas eventos={p.eventos} dias={p.dias} diaEventos={p.diaEventos} setDiaEventos={p.setDiaEventos} abrir={abrirEFechar} />}
      </Balao>
    </nav>
  );
}

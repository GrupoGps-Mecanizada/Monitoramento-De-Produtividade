"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Andamento } from "@/components/historico/andamento";
import { HistoricoDia } from "@/components/historico/historico-dia";
import { Icone } from "@/components/icones";
import { Aviso, Botao, Campos, Entrada, Selo } from "@/components/ui";
import { pedirHistorico, type EtapaPedido } from "@/lib/dados/historico";
import { diaLocal, fmtMin, hora, horaSeg, idadeCurta, minutosDesde } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, categoria, frescor } from "@/lib/dominio/veiculo";
import type { Historico, Veiculo } from "@/lib/tipos";

interface Props {
  v: Veiculo;
  agora: number;
  semSinalMin: number;
  hist: Historico | null;
  aoCarregarHist: (h: Historico | null) => void;
  /** dia pedido pelo link #hist= (carrega ao abrir) */
  diaInicial: string | null;
  trechoSel: number | null;
  focarTrecho: (i: number) => void;
  voltar: () => void;
  centralizar: () => void;
}
type Busca = { etapa: EtapaPedido | "buscando"; desde: number } | null;

/** Detalhe do veículo no painel (use com key = id do veículo). */
export function Detalhe(p: Props) {
  const { v, agora, aoCarregarHist, diaInicial } = p;
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(diaInicial ?? hoje);
  const [busca, setBusca] = useState<Busca>(() => (diaInicial ? { etapa: "buscando", desde: 0 } : null));
  const [erro, setErro] = useState<string | null>(null);
  // cada clique em "Ver histórico" (ou o link #hist=) é um pedido; o efeito busca e só mexe no estado quando chega
  const [pedido, setPedido] = useState<{ dia: string; n: number } | null>(() => (diaInicial ? { dia: diaInicial, n: 0 } : null));

  useEffect(() => {
    if (!pedido) return;
    const c = new AbortController();
    const desde = Date.now();
    pedirHistorico(v.id, pedido.dia, { sinal: c.signal, aoAndar: (etapa) => setBusca({ etapa, desde }) }).then(
      (h) => {
        if (c.signal.aborted) return;
        aoCarregarHist(h);
        setBusca(null);
      },
      (e: unknown) => {
        if (c.signal.aborted) return;
        setErro(e instanceof Error ? e.message : String(e));
        setBusca(null);
      },
    );
    // trocar de pedido ou sair do detalhe cancela a espera
    return () => c.abort();
  }, [pedido, v.id, aoCarregarHist]);

  const verHistorico = () => {
    setErro(null);
    aoCarregarHist(null);
    setBusca({ etapa: "buscando", desde: Date.now() });
    setPedido((atual) => ({ dia, n: (atual?.n ?? 0) + 1 }));
  };

  const cat = categoria(v);
  const fr = frescor(v, p.semSinalMin, agora);
  const campos: [string, ReactNode][] = [
    ["Última posição", `${horaSeg(v.posicao_em)} (há ${idadeCurta(v.posicao_em, agora)})`],
    ["Status desde", v.status_desde ? `${hora(v.status_desde)} · ${fmtMin(minutosDesde(v.status_desde, agora))}` : "antes do início do monitoramento"],
    ["Área", v.area ? `${v.area}${v.area_desde ? ` · desde ${hora(v.area_desde)} (${fmtMin(minutosDesde(v.area_desde, agora))})` : ""}` : "Fora de área"],
    ["Via", v.via || "—"],
    ["Endereço", v.endereco || "—"],
    ...(v.motor2 ? ([["Motor secundário", `${v.motor2.status} · ${v.motor2.placa}${v.motor2.status_desde ? ` · desde ${hora(v.motor2.status_desde)}` : ""}`]] as [string, ReactNode][]) : []),
    ["Motorista", v.motorista || "Não identificado"],
    ["Demora", v.demora || "—"],
    ["Coordenadas", v.lat != null && v.lng != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}` : "—"],
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-2.5 border-b border-borda p-3">
        <div className="flex items-center gap-2">
          <Botao variante="secundaria" tamanho="mini" onClick={p.voltar}>
            <Icone nome="voltar" className="h-4 w-4" />
            Voltar
          </Botao>
          <Botao variante="secundaria" tamanho="mini" onClick={p.centralizar}>
            <Icone nome="alvo" className="h-4 w-4" />
            Centralizar no mapa
          </Botao>
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{v.placa}</span>
            <Selo tom={CATEGORIAS[cat].tom}>{v.status}</Selo>
            <Selo tom={FRESCOR[fr].tom}>{FRESCOR[fr].rotulo}</Selo>
          </div>
          <p className="text-[13px] text-suave">
            {v.vaga || "Sem vaga"}
            {v.grupo ? ` · ${v.grupo}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Entrada type="date" value={dia} max={hoje} onChange={(e) => setDia(e.target.value || hoje)} aria-label="Dia do histórico" className="flex-1" />
          <Botao onClick={verHistorico} disabled={!!busca}>
            Ver histórico
          </Botao>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-4">
          <Campos itens={campos} />
        </div>
        {busca && <Andamento etapa={busca.etapa} desde={busca.desde} />}
        {erro && (
          <div className="px-4 pb-4">
            <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
          </div>
        )}
        {p.hist && <HistoricoDia h={p.hist} placa={v.placa} trechoSel={p.trechoSel} focarTrecho={p.focarTrecho} />}
      </div>
    </div>
  );
}

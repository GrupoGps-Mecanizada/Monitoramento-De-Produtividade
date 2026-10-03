"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { Andamento } from "@/components/historico/andamento";
import { Icone } from "@/components/icones";
import { Legenda } from "@/components/mapa/legenda";
import { desenharRota } from "@/components/mapa/rota";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Botao, Selecao, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { pedirHistorico, type EtapaPedido } from "@/lib/dados/historico";
import { useRetrato } from "@/lib/dados/use-retrato";
import { diaBR, diaLocal, fmtMin, hhmm, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO, resolverVeiculo, semMotor2 } from "@/lib/dominio/veiculo";
import { useCelular } from "@/lib/hooks";
import { pontosDoTrecho } from "@/lib/mapa/rota";
import type { EstadoTrecho, Historico } from "@/lib/tipos";
import { ConteudoHistorico } from "./conteudo";
import { SeletorVeiculo } from "./seletor-veiculo";

const LEGENDA = (Object.keys(ESTADOS_TRECHO) as EstadoTrecho[]).map((e) => ({ rotulo: ESTADOS_TRECHO[e].rotulo, cor: corDoTom(ESTADOS_TRECHO[e].tom) }));
type Carga = { etapa: EtapaPedido | "buscando"; desde: number } | null;

/** Timeline: trajeto de um veículo num dia, com player. Endereço: /timeline/?v=<id ou placa>&dia=AAAA-MM-DD */
export function Timeline() {
  const params = useSearchParams();
  const { retrato } = useRetrato();
  const celular = useCelular();
  const { ref, pronto } = useMapa(13);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [sobreMapa, setSobreMapa] = useState<HTMLDivElement | null>(null);
  const [hoje] = useState(() => diaLocal());
  const [chave, setChave] = useState<string | null>(() => params.get("v"));
  const [dia, setDia] = useState(() => params.get("dia") || hoje);
  const [pedido, setPedido] = useState<{ chave: string; dia: string; n: number } | null>(() => {
    const v = params.get("v");
    return v ? { chave: v, dia: params.get("dia") || hoje, n: 0 } : null;
  });
  const [carga, setCarga] = useState<Carga>(() => (params.get("v") ? { etapa: "buscando", desde: 0 } : null));
  const [hist, setHist] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trechoSel, setTrechoSel] = useState<{ i: number; vez: number } | null>(null);
  // celular: opções (veículo e dia) abertas quando não veio veículo no endereço
  const [opcoes, setOpcoes] = useState(() => !params.get("v"));

  const todos = retrato?.veiculos;
  const lista = useMemo(() => semMotor2(todos ?? []).sort((a, b) => a.placa.localeCompare(b.placa)), [todos]);
  const escolhido = useMemo(() => (chave && todos ? resolverVeiculo(todos, chave) : null), [chave, todos]);
  const alvo = useMemo(() => (pedido && todos ? resolverVeiculo(todos, pedido.chave) : null), [pedido, todos]);
  const alvoId = alvo?.id ?? null;
  // a rota do GAUSS existe para qualquer dia: oferece os últimos 30
  const dias = useMemo(() => {
    const d = ultimosDias(30);
    return d.includes(dia) ? d : [dia, ...d];
  }, [dia]);

  // pede o histórico (o coletor atende se o dia ainda não está no banco)
  useEffect(() => {
    if (!pedido || !alvoId) return;
    const c = new AbortController();
    const desde = Date.now();
    pedirHistorico(alvoId, pedido.dia, { sinal: c.signal, aoAndar: (etapa) => setCarga({ etapa, desde }) }).then(
      (h) => {
        if (c.signal.aborted) return;
        setHist(h);
        setCarga(null);
      },
      (e: unknown) => {
        if (c.signal.aborted) return;
        setErro(e instanceof Error ? e.message : String(e));
        setCarga(null);
      },
    );
    return () => c.abort();
  }, [pedido, alvoId]);

  const ver = () => {
    if (!escolhido) return;
    setHist(null);
    setErro(null);
    setTrechoSel(null);
    setOpcoes(false);
    setCarga({ etapa: "buscando", desde: Date.now() });
    setPedido((p) => ({ chave: escolhido.id, dia, n: (p?.n ?? 0) + 1 }));
  };
  const focarTrecho = useCallback((i: number) => setTrechoSel((t) => ({ i, vez: (t?.vez ?? 0) + 1 })), []);

  useEffect(() => {
    if (!pronto) return;
    camada.current = pronto.L.layerGroup().addTo(pronto.mapa);
    pronto.L.control.layers(pronto.camadasBase).addTo(pronto.mapa);
  }, [pronto]);
  useEffect(() => {
    if (!pronto || !camada.current) return;
    if (!hist) {
      camada.current.clearLayers();
      return;
    }
    const limites = desenharRota(pronto.L, camada.current, hist, focarTrecho);
    if (limites) pronto.mapa.fitBounds(limites.pad(0.06));
  }, [pronto, hist, focarTrecho]);
  useEffect(() => {
    if (!pronto || !hist || !trechoSel) return;
    const pts = pontosDoTrecho(hist, trechoSel.i);
    const t = hist.trechos[trechoSel.i];
    if (pts.length > 1) pronto.mapa.fitBounds(pronto.L.latLngBounds(pts).pad(0.2), { maxZoom: 18 });
    else if (t && t.estado !== "movimento" && t.lat != null && t.lng != null) pronto.mapa.flyTo([t.lat, t.lng], 17);
  }, [pronto, hist, trechoSel]);

  const naoAchado = !!pedido && !!todos && !alvo;
  const placa = alvo?.placa ?? hist?.id ?? "";
  const situacao = naoAchado ? (
    <Vazio titulo="Veículo não encontrado">O endereço aponta para um veículo que não está mais na frota.</Vazio>
  ) : carga ? (
    <Andamento etapa={carga.etapa} desde={carga.desde} />
  ) : erro ? (
    <div className="p-4">
      <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
    </div>
  ) : !hist ? (
    <Vazio titulo="Selecione um veículo">Escolha a placa e o dia para ver a rota e o apontamento completo.</Vazio>
  ) : !hist.trechos.length ? (
    <Vazio titulo="Sem dados neste dia">
      O GAUSS não tem posições para {placa} em {diaBR(hist.dia)}.
    </Vazio>
  ) : null;

  const formulario = (
    <div className="space-y-2.5 p-3">
      <div className="flex gap-2">
        <SeletorVeiculo veiculos={lista} escolhido={escolhido} escolher={(v) => setChave(v.id)} paraCima={celular} />
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36 shrink-0">
          {dias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
      </div>
      <Botao onClick={ver} disabled={!escolhido || !!carga} className="w-full">
        Ver timeline
      </Botao>
    </div>
  );
  const conteudo =
    hist && hist.trechos.length > 0 && !carga ? (
      <ConteudoHistorico
        key={`${hist.id}|${hist.dia}|${hist.baixado_em}`}
        h={hist}
        placa={placa}
        vaga={alvo?.vaga ?? ""}
        pronto={pronto}
        celular={celular}
        sobreMapa={sobreMapa}
        trechoSel={trechoSel?.i ?? null}
        focarTrecho={focarTrecho}
      />
    ) : null;
  const tSel = hist && trechoSel ? hist.trechos[trechoSel.i] : null;

  return (
    <div className="altura-tela relative flex md:gap-3 md:p-3">
      {!celular && (
        <section aria-label="Seleção e timeline do veículo" className="flex w-[400px] shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-md">
          <div className="border-b border-borda">{formulario}</div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {situacao}
            {conteudo}
          </div>
        </section>
      )}
      <div className="relative min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md" onPointerDown={() => setOpcoes(false)}>
        <div ref={ref} className="absolute inset-0" />
        <Legenda itens={LEGENDA} />
        <div ref={setSobreMapa} className="pointer-events-none absolute inset-0 z-[500] [&>*]:pointer-events-auto" />
        {!celular && tSel && (
          <div className="absolute bottom-6 right-3 z-[500] w-64 rounded-xl border border-borda bg-superficie/95 p-3 text-[13px] shadow-lg">
            <p className="font-semibold">{placa}</p>
            <p>
              <b>{ESTADOS_TRECHO[tSel.estado].rotulo}</b>
            </p>
            <p>
              {hhmm(tSel.inicio)} – {hhmm(tSel.fim)} · <b>{fmtMin(tSel.duracao_min)}</b>
            </p>
            {tSel.estado === "movimento" ? (
              <p>
                {tSel.km} km · máx {tSel.vel_max} km/h
              </p>
            ) : (
              tSel.local && <p className="mt-1 text-suave">{tSel.local}</p>
            )}
          </div>
        )}
        {celular && (
          <button
            type="button"
            onClick={() => setOpcoes(true)}
            className="absolute left-1/2 top-2.5 z-[600] flex max-w-[calc(100%-110px)] -translate-x-1/2 items-center gap-2 rounded-full border border-borda bg-superficie/95 px-3.5 py-2 text-[13px] shadow-md"
          >
            <span className="truncate">{escolhido ? <><b>{escolhido.placa}</b> · {rotuloDia(dia, hoje)}</> : "Escolher veículo"}</span>
            <Icone nome="opcoes" className="h-4 w-4 text-suave" />
          </button>
        )}
        {celular && situacao && (
          <div className="absolute inset-x-2 bottom-2 z-[600] rounded-2xl border border-borda bg-superficie/95 shadow-xl">
            {situacao}
            {!carga && (
              <div className="px-3 pb-3">
                <Botao variante="secundaria" className="w-full" onClick={() => setOpcoes(true)}>
                  Escolher veículo e dia
                </Botao>
              </div>
            )}
          </div>
        )}
        {celular && conteudo}
      </div>
      {celular && opcoes && (
        <div className="fixed inset-0 z-[1100]" role="dialog" aria-label="Veículo e dia">
          <button type="button" aria-label="Fechar" className="absolute inset-0 bg-black/40" onClick={() => setOpcoes(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-3">
              <b>Veículo e dia</b>
              <button type="button" aria-label="Fechar" onClick={() => setOpcoes(false)} className="grid h-9 w-9 place-items-center rounded-lg text-suave">
                <Icone nome="fechar" className="h-4 w-4" />
              </button>
            </div>
            {formulario}
            <p className="px-4 pb-4 text-xs text-suave">No celular o foco é o mapa. Resumo completo, tempo por área e CSV ficam no computador.</p>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folha, type EstadoFolha } from "@/components/folha";
import { FaixaLeitura } from "@/components/indicador-vivo";
import { Legenda } from "@/components/mapa/legenda";
import { useMapa } from "@/components/mapa/use-mapa";
import { corDoTom } from "@/lib/cores";
import { lerCercas, lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { ehAlerta } from "@/lib/dominio/eventos";
import { diaLocal } from "@/lib/dominio/formato";
import { CATEGORIAS, areaInicial, filtrarVeiculos, semMotor2, type FiltroVeiculos } from "@/lib/dominio/veiculo";
import { useAgora, useCelular, usePreferencia } from "@/lib/hooks";
import { ouvirNavegacao } from "@/lib/navegacao";
import type { Cerca, LatLng } from "@/lib/tipos";
import { BarraTipos } from "./barra-tipos";
import { Detalhe } from "./detalhe";
import { criarCamadas, desenharCercas, destacarCerca, sincronizarMarcadores, type Camadas } from "./mapa-frota";
import { Painel, type Aba } from "./painel";
import { ResumoCelular } from "./resumo-celular";

const LEGENDA = [
  ...(["ligado", "parado", "desligado", "manut", "semcom"] as const).map((c) => ({ rotulo: CATEGORIAS[c].rotulo, cor: corDoTom(CATEGORIAS[c].tom) })),
  { rotulo: "Tracejado = sem sinal", cor: corDoTom("neu"), tracejado: true },
];

/** Localização: lista/áreas/eventos à esquerda e mapa ao vivo; no celular, o mapa com uma gaveta embaixo. */
export function Localizacao() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const celular = useCelular();
  const { ref, pronto } = useMapa(14);
  const camadas = useRef<Camadas | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [dias, setDias] = useState<string[]>([]);
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("tipos");
  const [filtro, setFiltro] = useState<FiltroVeiculos>({ indicador: null, busca: "", area: null, tipo: null });
  const [recolhido, setRecolhido] = usePreferencia("mon-painel-recolhido");
  const [sel, setSel] = useState<string | null>(null);
  const [folha, setFolha] = useState<EstadoFolha>("fechada");
  const [diaEventos, setDiaEventos] = useState(() => diaLocal());
  const { eventos: doDia } = useEventos(diaEventos);
  const eventos = useMemo(() => doDia.filter(ehAlerta), [doDia]);

  const semSinalMin = retrato?.sem_sinal_min ?? 30;
  const veiculos = useMemo(() => semMotor2(retrato?.veiculos ?? []), [retrato]);
  const visiveis = useMemo(() => filtrarVeiculos(veiculos, filtro, semSinalMin, agora || undefined), [veiculos, filtro, semSinalMin, agora]);
  const poligonos = useMemo(() => {
    const p: Record<string, LatLng[]> = {};
    for (const c of cercas) if (c.tipo === "area" && !p[c.name]) p[c.name] = c.polygon;
    return p;
  }, [cercas]);
  const vSel = sel ? (veiculos.find((v) => v.id === sel) ?? null) : null;

  // cercas: leitura única por aba; tenta de novo quando chega a 1ª leitura do coletor
  const lido = retrato?.lido_em;
  useEffect(() => {
    if (!cercas.length) lerCercas().then(setCercas, () => undefined);
  }, [lido, cercas.length]);
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);

  const fechar = useCallback(() => setSel(null), []);
  const abrir = useCallback(
    (id: string) => {
      setSel(id);
      // escolher um equipamento no mapa com o painel recolhido: o detalhe precisa do painel
      if (!celular) setRecolhido(false);
      const v = veiculos.find((x) => x.id === id);
      const m = pronto?.mapa;
      if (!m || v?.lat == null || v.lng == null) return;
      if (celular) {
        // zoom 19: acima do limite de agrupamento; centro deslocado para o caminhão ficar acima do cartão
        setFolha("fechada");
        const z = Math.max(m.getZoom(), 19);
        m.flyTo(m.unproject(m.project([v.lat, v.lng], z).add([0, 70]), z), z, { duration: 0.8 });
      } else m.flyTo([v.lat, v.lng], Math.max(m.getZoom(), 17));
    },
    [veiculos, pronto, celular, setRecolhido],
  );
  const focarCerca = useCallback(
    (nome: string) => {
      const c = cercas.find((x) => x.name === nome);
      if (!c || !pronto) return;
      fechar();
      destacarCerca(pronto.L, pronto.mapa, c.polygon);
      if (veiculos.some((v) => v.area === nome)) {
        setFiltro((f) => ({ ...f, area: nome }));
        setAba("tipos");
      }
      if (celular) setFolha("fechada");
      pronto.mapa.fitBounds(pronto.L.latLngBounds(c.polygon), { paddingTopLeft: [20, 20], paddingBottomRight: [20, celular ? 160 : 20], maxZoom: 18 });
    },
    [cercas, pronto, veiculos, celular, fechar],
  );
  // marcadores, links e a busca chamam a versão mais recente
  const abrirRef = useRef(abrir);
  const focarCercaRef = useRef(focarCerca);
  useEffect(() => {
    abrirRef.current = abrir;
    focarCercaRef.current = focarCerca;
  });

  const escolherArea = (area: string) => {
    setFiltro((f) => ({ ...f, area }));
    setAba("tipos");
    const p = poligonos[area];
    if (p && pronto) pronto.mapa.fitBounds(pronto.L.latLngBounds(p).pad(0.08));
  };
  const centralizar = () => {
    if (vSel?.lat != null && vSel.lng != null) pronto?.mapa.flyTo([vSel.lat, vSel.lng], 18);
  };

  // camadas (uma vez)
  useEffect(() => {
    if (!pronto) return;
    camadas.current = criarCamadas(pronto);
    // no toque, a dica da cerca abre e não fecha mais (não há "mouse saindo"): some sozinha
    pronto.mapa.on("tooltipopen", (e) => {
      if (window.matchMedia("(max-width: 767px)").matches) setTimeout(() => pronto.mapa.closeTooltip(e.tooltip), 2500);
    });
  }, [pronto]);
  useEffect(() => {
    if (pronto && camadas.current) desenharCercas(pronto.L, camadas.current.cercas, cercas);
  }, [pronto, cercas]);
  useEffect(() => {
    if (!pronto || !camadas.current) return;
    sincronizarMarcadores(pronto.L, camadas.current, veiculos, new Set(visiveis.map((v) => v.id)), sel, semSinalMin, agora || Date.now(), (id) => abrirRef.current(id));
  }, [pronto, veiculos, visiveis, sel, semSinalMin, agora]);

  // zoom inicial (área com mais veículos) e links diretos #v=<id>[&hist=AAAA-MM-DD] e #cerca=<nome>
  const zoomFeito = useRef(false);
  useEffect(() => {
    if (!pronto || zoomFeito.current || !veiculos.length || !cercas.length) return;
    zoomFeito.current = true;
    const { L, mapa } = pronto;
    const area = areaInicial(veiculos, poligonos, semSinalMin);
    if (area) mapa.fitBounds(L.latLngBounds(poligonos[area]).pad(0.08));
    else {
      const pts = veiculos.flatMap((v): LatLng[] => (v.lat != null && v.lng != null ? [[v.lat, v.lng]] : []));
      if (pts.length) mapa.fitBounds(L.latLngBounds(pts).pad(0.1));
    }
    const h = new URLSearchParams(window.location.hash.slice(1));
    const v = h.get("v");
    const cerca = h.get("cerca");
    const diaHist = h.get("hist");
    // link antigo com histórico (#v=&hist=): o histórico agora fica só na Timeline
    if (v && diaHist) router.push(`/timeline/?v=${encodeURIComponent(v)}&dia=${diaHist}`);
    else if (v && veiculos.some((x) => x.id === v)) abrirRef.current(v);
    else if (cerca) setTimeout(() => focarCercaRef.current(cerca), 400);
  }, [pronto, veiculos, cercas, poligonos, semSinalMin, router]);

  // busca Ctrl K e cartões: atende aqui mesmo, sem recarregar
  useEffect(
    () =>
      ouvirNavegacao((p) => {
        if (p.tipo === "veiculo") abrirRef.current(p.id);
        else focarCercaRef.current(p.nome);
        return true;
      }),
    [],
  );

  const conteudo = vSel ? (
    <Detalhe key={vSel.id} v={vSel} agora={agora} semSinalMin={semSinalMin} voltar={fechar} centralizar={centralizar} />
  ) : (
    <Painel
      aba={aba}
      setAba={setAba}
      veiculos={veiculos}
      visiveis={visiveis}
      filtro={filtro}
      setFiltro={setFiltro}
      eventos={eventos}
      dias={dias}
      diaEventos={diaEventos}
      setDiaEventos={setDiaEventos}
      semSinalMin={semSinalMin}
      agora={agora}
      abrir={abrir}
      escolherArea={escolherArea}
      recolher={() => setRecolhido(true)}
    />
  );

  return (
    <div className="altura-tela flex flex-col">
      <FaixaLeitura />
      <div className="relative flex min-h-0 flex-1 md:gap-3 md:p-3">
        {!celular &&
          (recolhido ? (
            <BarraTipos veiculos={veiculos} tipo={filtro.tipo} escolher={(t) => setFiltro((f) => ({ ...f, tipo: t }))} abrir={() => setRecolhido(false)} semSinalMin={semSinalMin} agora={agora} />
          ) : (
            <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden rounded-xl border border-borda bg-superficie shadow-md">{conteudo}</aside>
          ))}
        <div
          className="relative min-w-0 flex-1 overflow-hidden md:rounded-xl md:border md:border-borda md:shadow-md"
          onPointerDown={() => {
            // tocar no mapa = foco no mapa: recolhe a gaveta
            if (celular && folha !== "fechada") setFolha("fechada");
          }}
        >
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={LEGENDA} />
        </div>
        {celular && (
          <Folha
            estado={folha}
            mudar={setFolha}
            resumo={
              <ResumoCelular
                veiculos={veiculos}
                filtro={filtro}
                vSel={vSel}
                agora={agora}
                semSinalMin={semSinalMin}
                mudarFiltro={(f) => {
                  setFiltro(f);
                  setAba("tipos");
                  setFolha("meio");
                }}
                abrirFolha={() => setFolha("meio")}
                fechar={() => {
                  fechar();
                  setFolha("fechada");
                }}
              />
            }
          >
            {conteudo}
          </Folha>
        )}
      </div>
    </div>
  );
}

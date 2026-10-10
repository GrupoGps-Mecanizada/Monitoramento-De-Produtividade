"use client";

import type * as Leaflet from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gaveta } from "@/components/gaveta";
import { Legenda } from "@/components/mapa/legenda";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Segmentado, Vazio, cx } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import {
  CATEGORIAS_LOCAL, CHAVE_FORA, MEDIDAS, PERIODOS, areasDaRegiao, contornoDaUsina, plantasDaRegiao, equipDaFrota, filtrar, montarLocais, porDia, porTipo, resumir, separarFora, temRegra, totais, valorDe,
  type Medida, type Periodo, type ResumoLocal,
} from "@/lib/dominio/analise";
import { diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { dentroDoPoligono } from "@/lib/dominio/geo";
import { useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { BotaoFunil, CartaoTopo, Secao } from "../../timeline/_componentes/opcoes";
import { desenharAnalise } from "./camada-analise";
import { COR_CATEGORIA, ESCALAS, ROTULO_MEDIDA, corDoApontamento, numerica } from "./cores-analise";
import { DetalheLocal } from "./detalhe-local";
import { FILTROS_VAZIOS, Filtros, filtrosAtivos, type EstadoFiltros } from "./filtros";
import { Ranking } from "./ranking";
import { ResumoPeriodo } from "./resumo-periodo";

/** "PLANTA POÇO REDONDO" → "POÇO REDONDO" */
const nomePlanta = (n: string) => n.replace(/^PLANTA (DAS |DA |DO |DE )?/i, "");
type Aba = "areas" | "resumo";
const FUNDOS = ["preto", "branco"] as const;
type Fundo = (typeof FUNDOS)[number];

/** Segundo botão redondo (embaixo do funil): abre as áreas e o resumo do período. */
function BotaoLista({ abrir }: { abrir: () => void }) {
  return (
    <button
      type="button"
      onClick={abrir}
      aria-label="Áreas e resumo"
      title="Áreas e resumo"
      className="absolute right-3 top-[60px] z-[600] grid h-10 w-10 place-items-center rounded-full bg-[#0b1220]/80 text-white shadow-lg backdrop-blur-sm transition hover:bg-[#0b1220]"
    >
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
        <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
      </svg>
    </button>
  );
}

/**
 * Mapa de análise, no mesmo jeito da Timeline: o mapa (fundo preto, só as cercas da região) ocupa a tela toda.
 * Em cima, à esquerda, o cartão com a medida e o período; à direita, o funil (medida, período, filtros e "Ir para")
 * e, embaixo dele, a lista (áreas e resumo). O fundo do mapa (preto ou branco) também se troca no funil. Clicar numa área do mapa abre a lista já no detalhe dela.
 */
export function Analise() {
  const { retrato } = useRetrato();
  const { paradas, carregando, erro } = useParadasAnalise();
  const { ref, pronto } = useMapa(14, false);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [hoje] = useState(() => diaLocal());
  const [medida, setMedida] = useOpcao<Medida>("mon-analise-medida", MEDIDAS, "produtivo");
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  const [fundo, setFundo] = useOpcao<Fundo>("mon-analise-fundo", FUNDOS, "preto");
  const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_VAZIOS);
  const [opcoes, setOpcoes] = useState(false);
  const [lista, setLista] = useState(false);
  const [aba, setAba] = useState<Aba>("areas");
  const [sel, setSel] = useState<string | null>(null);
  // o zoom muda quais nomes cabem no mapa
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const usina = useMemo(() => contornoDaUsina(cercas), [cercas]);
  const areas = useMemo(() => areasDaRegiao(cercas.filter((c) => c.tipo === "area"), usina), [cercas, usina]);
  const equip = useMemo(() => equipDaFrota(retrato?.veiculos ?? []), [retrato]);
  const base = useMemo(() => montarLocais(paradas, cercas.filter((c) => c.tipo === "area"), equip, usina), [paradas, cercas, equip, usina]);
  const doFiltro = useMemo(() => filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros }), [base, hoje, periodo, filtros]);
  const todos = useMemo(() => resumir(doFiltro, base.locais), [doFiltro, base]);
  const { dentro, fora } = useMemo(() => separarFora(todos), [todos]);
  const t = useMemo(() => ({ ...totais(todos), areas: dentro.length }), [todos, dentro]);
  // plantas para o "Ir para": a Usiminas primeiro, depois as com mais tempo parado no filtro, depois as outras
  const plantas = useMemo(() => {
    const parado = (pl: Cerca) => dentro.reduce((n, r) => n + (dentroDoPoligono(r.local.lat, r.local.lng, pl.polygon) ? r.parado : 0), 0);
    return plantasDaRegiao(cercas)
      .map((pl) => ({ pl, parado: pl.name === "PLANTA USIMINAS" ? Infinity : parado(pl) }))
      .sort((a, b) => b.parado - a.parado || a.pl.name.localeCompare(b.pl.name))
      .map((x) => x.pl);
  }, [cercas, dentro]);
  // tempo parado na região mas fora do contorno da usina (Poço Redondo, Aterro, oficinas de fora...)
  const foraDaUsina = useMemo(() => (usina ? dentro.reduce((n, r) => n + (dentroDoPoligono(r.local.lat, r.local.lng, usina) ? 0 : r.parado), 0) : 0), [dentro, usina]);
  // funil e lista ocupam o mesmo lado da tela: abrir um fecha o outro
  const abrirOpcoes = () => {
    setLista(false);
    setOpcoes(true);
  };
  const abrirLista = useCallback(() => {
    setOpcoes(false);
    setLista(true);
  }, []);
  const clicarNoMapa = useCallback(
    (chave: string) => {
      setSel(chave);
      setAba("areas");
      abrirLista();
    },
    [abrirLista],
  );
  const dias = useMemo(() => porDia(doFiltro, base.locais, hoje, Number(periodo)), [doFiltro, base, hoje, periodo]);
  const tipos = useMemo(() => porTipo(doFiltro, base.locais), [doFiltro, base]);
  const rSel = sel === CHAVE_FORA ? fora : sel ? (dentro.find((r) => r.local.chave === sel) ?? null) : null;
  // área que o filtro escondeu: some do mapa e a lista volta
  const selVisivel = rSel ? sel : null;

  // mapa limpo como o da Timeline (zoom pela roda ou pinça); abre na usina e não deixa sair da região
  useEffect(() => {
    if (!pronto) return;
    pronto.mapa.getContainer().classList.add("mapa-analise");
    pronto.mapa.zoomControl.remove();
    const g = pronto.L.layerGroup().addTo(pronto.mapa);
    camada.current = g;
    const aoZoom = () => setZoom(pronto.mapa.getZoom());
    pronto.mapa.on("zoomend", aoZoom);
    return () => {
      pronto.mapa.off("zoomend", aoZoom);
      g.remove();
    };
  }, [pronto]);
  useEffect(() => {
    pronto?.mapa.getContainer().classList.toggle("mapa-claro", fundo === "branco");
  }, [pronto, fundo]);
  useEffect(() => {
    if (!pronto || !usina) return;
    const regiao = pronto.L.latLngBounds(plantasDaRegiao(cercas).flatMap((pl) => pl.polygon));
    pronto.mapa.setMaxBounds(regiao.pad(0.15));
    pronto.mapa.setMinZoom(Math.max(0, pronto.mapa.getBoundsZoom(regiao) - 1));
    pronto.mapa.fitBounds(pronto.L.polygon(usina).getBounds(), { padding: [12, 12] });
  }, [pronto, usina, cercas]);
  useEffect(() => {
    if (pronto && camada.current) desenharAnalise(pronto.L, camada.current, pronto.mapa, { plantas, areas, resumos: dentro, medida, sel: selVisivel, aoClicar: clicarNoMapa });
  }, [pronto, plantas, areas, dentro, medida, selVisivel, zoom, clicarNoMapa]);

  const irPara = (pl: Cerca) => {
    setOpcoes(false);
    pronto?.mapa.flyToBounds(pronto.L.polygon(pl.polygon).getBounds(), { padding: [16, 16], duration: 0.6 });
  };
  const abrir = (r: ResumoLocal) => {
    setSel(r.local.chave);
    if (r.local.chave !== CHAVE_FORA) pronto?.mapa.flyTo([r.local.lat, r.local.lng], Math.max(pronto.mapa.getZoom(), 16), { duration: 0.6 });
  };

  const legenda = useMemo(() => {
    if (medida === "categoria") return CATEGORIAS_LOCAL.map((c) => ({ rotulo: c, cor: COR_CATEGORIA[c] }));
    if (medida === "apontamento") {
      const nomes = [...new Set(dentro.map((r) => r.apont[0]?.nome).filter((x): x is string => !!x))].slice(0, 8);
      return nomes.map((n) => ({ rotulo: n, cor: corDoApontamento(n) }));
    }
    if (!numerica(medida)) return [];
    const max = Math.max(0, ...dentro.map((r) => valorDe(r, medida)));
    if (max <= 0) return [];
    const fmt = (v: number) => (medida === "visitas" ? String(Math.round(v)) : fmtHoras(v));
    return ESCALAS[medida].map((cor, i) => ({ rotulo: `até ${fmt((max * (i + 1)) / 5)}`, cor }));
  }, [medida, dentro]);

  // tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
  const aviso = erro
    ? /could not find the table|does not exist|PGRST205|42P01/i.test(erro)
      ? "A tabela da análise ainda não foi criada: rode supabase/analise.sql no Supabase."
      : `Não foi possível carregar: ${erro}`
    : null;
  const vazio = !carregando && !erro && !paradas.length;
  const nFiltros = filtrosAtivos(filtros);

  return (
    <div className="altura-tela relative overflow-hidden">
      <div ref={ref} className="absolute inset-0" />
      <Legenda itens={legenda} />
      <CartaoTopo abrir={abrirOpcoes} rotulo="Medida, período e filtros">
        <b className="text-[14px]">{ROTULO_MEDIDA[medida]}</b> {periodo} dias
        {nFiltros > 0 && <span className="text-white/70">· {nFiltros} filtro{nFiltros > 1 ? "s" : ""}</span>}
      </CartaoTopo>
      <BotaoFunil abrir={abrirOpcoes} rotulo="Filtros da análise" />
      <BotaoLista abrir={abrirLista} />

      {(aviso || vazio) && (
        <div className="absolute left-1/2 top-1/2 z-[600] w-[min(380px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 p-1 shadow-xl">
          {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : <Vazio titulo="O histórico ainda não foi enviado">Rode o “Enviar Historico ao Site.bat” no PC.</Vazio>}
        </div>
      )}

      {opcoes && (
        <Gaveta titulo="Análise" sub="Medida, período e filtros" fechar={() => setOpcoes(false)} largura="min(420px, 100vw)">
          <Secao titulo="Medida">
            <div role="tablist" aria-label="Medida" className="grid gap-1">
              {MEDIDAS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={m === medida}
                  onClick={() => setMedida(m)}
                  className={cx("rounded-lg px-3 py-2 text-left text-[13px] font-semibold", m === medida ? "bg-primaria text-white" : "text-suave hover:bg-superficie-2 hover:text-texto")}
                >
                  {ROTULO_MEDIDA[m]}
                </button>
              ))}
            </div>
          </Secao>
          <Secao titulo="Período">
            <Segmentado rotulo="Período" valor={periodo} mudar={setPeriodo} opcoes={PERIODOS.map((p) => ({ id: p, rotulo: <span className="whitespace-nowrap">{p} dias</span> }))} />
          </Secao>
          <Secao titulo="Filtros">
            <Filtros f={filtros} mudar={(p) => setFiltros((f) => ({ ...f, ...p }))} equip={[...equip.values()]} />
          </Secao>
          <Secao titulo="Fundo do mapa">
            <Segmentado<Fundo> rotulo="Fundo do mapa" valor={fundo} mudar={setFundo} opcoes={[{ id: "preto", rotulo: "Preto" }, { id: "branco", rotulo: "Branco" }]} />
          </Secao>
          <Secao titulo="Ir para">
            <div role="group" aria-label="Ir para" className="flex flex-wrap gap-1.5">
              {plantas.map((pl) => (
                <button key={pl.name} type="button" onClick={() => irPara(pl)} className="rounded-full border border-borda px-2.5 py-1 text-xs font-semibold hover:bg-superficie-2">
                  {nomePlanta(pl.name)}
                </button>
              ))}
            </div>
          </Secao>
        </Gaveta>
      )}

      {lista && (
        // sem bloquear: o mapa continua clicável com a lista aberta
        <Gaveta titulo={ROTULO_MEDIDA[medida]} sub={`Últimos ${periodo} dias`} fechar={() => setLista(false)} modal={false} largura="min(400px, 100vw)">
          <div className="mb-3">
            <Segmentado<Aba> rotulo="Áreas ou resumo" valor={aba} mudar={setAba} opcoes={[{ id: "areas", rotulo: "Áreas" }, { id: "resumo", rotulo: "Resumo" }]} />
          </div>
          {aba === "resumo" ? (
            carregando ? (
              <p className="text-xs text-suave">Carregando o histórico…</p>
            ) : (
              <ResumoPeriodo t={t} dias={dias} tipos={tipos} periodo={Number(periodo)} foraDaUsina={foraDaUsina} />
            )
          ) : rSel ? (
            <DetalheLocal key={rSel.local.chave} r={rSel} voltar={() => setSel(null)} />
          ) : (
            <Ranking resumos={dentro} fora={fora} medida={medida} abrir={abrir} semRegra={!!filtros.tipo && !temRegra(filtros.tipo)} />
          )}
        </Gaveta>
      )}
    </div>
  );
}

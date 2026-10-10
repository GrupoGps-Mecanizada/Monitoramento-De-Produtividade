"use client";

import type * as Leaflet from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Legenda } from "@/components/mapa/legenda";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Vazio } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import {
  CHAVE_FORA, OUTROS, PERIODOS, SELECAO_VAZIA, areasDaRegiao, contornoDaUsina, equipDaFrota, filtrar, filtrarSelecao, montarLocais, placar, plantasDaRegiao,
  porHora, porServico, ranking, resumir, separarFora, servicosPrincipais,
  type DimensaoSelecao, type Periodo, type SelecaoCruzada,
} from "@/lib/dominio/analise";
import { diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { BarraFiltros, FILTROS_TOPO_VAZIOS, type Etiqueta, type FiltrosTopo } from "./barra-filtros";
import { desenharBolhas } from "./camada-analise";
import { COR_OUTROS, corDoServico } from "./cores-analise";
import { GraficoBarras, type ItemBarra } from "./grafico-barras";
import { GraficoHoras } from "./grafico-horas";
import { PlacarAnalise } from "./placar";

/**
 * Painel da Análise (desenho: docs/superpowers/specs/2026-10-10-painel-analise-design.md): filtros e placar em cima,
 * mapa de bolhas à esquerda e os gráficos à direita. Clicar numa bolha, num lugar, num serviço ou numa hora filtra o resto;
 * o placar aplica tudo, cada gráfico aplica as escolhas dos outros e marca a sua.
 */
export function Analise() {
  const { retrato } = useRetrato();
  const { paradas, carregando, erro } = useParadasAnalise();
  const { ref, pronto } = useMapa(14, false);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [hoje] = useState(() => diaLocal());
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  const [filtros, setFiltros] = useState<FiltrosTopo>(FILTROS_TOPO_VAZIOS);
  const [sel, setSel] = useState<SelecaoCruzada>(SELECAO_VAZIA);
  // o zoom muda quais nomes de planta cabem no mapa
  const [zoom, setZoom] = useState(0);

  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const usina = useMemo(() => contornoDaUsina(cercas), [cercas]);
  const areas = useMemo(() => areasDaRegiao(cercas.filter((c) => c.tipo === "area"), usina), [cercas, usina]);
  const plantas = useMemo(() => plantasDaRegiao(cercas), [cercas]);
  const equip = useMemo(() => equipDaFrota(retrato?.veiculos ?? []), [retrato]);
  const base = useMemo(() => montarLocais(paradas, cercas.filter((c) => c.tipo === "area"), equip, usina), [paradas, cercas, equip, usina]);
  // cor fixa por serviço: os 3 principais dos 30 dias inteiros (não trocam ao filtrar)
  const principais = useMemo(() => servicosPrincipais(base.paradas), [base]);
  const doFiltro = useMemo(() => filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros, faixas: [], diasSemana: [] }), [base, hoje, periodo, filtros]);
  const recorte = useCallback((ignorar?: DimensaoSelecao) => filtrarSelecao(doFiltro, sel, base.locais, ignorar), [doFiltro, sel, base]);
  const numeros = useMemo(() => placar(recorte(), base.locais), [recorte, base]);
  const { dentro, fora } = useMemo(() => separarFora(resumir(recorte("local"), base.locais)), [recorte, base]);
  const servicos = useMemo(() => porServico(recorte("servico")), [recorte]);
  const horas = useMemo(() => porHora(recorte("hora")), [recorte]);

  const alternar = useCallback(<K extends DimensaoSelecao,>(k: K, v: SelecaoCruzada[K]) => setSel((s) => ({ ...s, [k]: s[k] === v ? null : v })), []);
  const clicarBolha = useCallback((chave: string) => alternar("local", chave), [alternar]);
  // pelo ranking: aproxima o mapa só quando o lugar tem bolha ("Longe da região" não tem coordenada)
  const escolherLugar = (chave: string) => {
    const r = dentro.find((x) => x.local.chave === chave);
    if (sel.local !== chave && r && pronto) pronto.mapa.flyTo([r.local.lat, r.local.lng], Math.max(pronto.mapa.getZoom(), 16), { duration: 0.6 });
    alternar("local", chave);
  };

  // mapa limpo (zoom pela roda ou pinça); abre na usina e não deixa sair da região
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
    if (!pronto || !usina) return;
    const regiao = pronto.L.latLngBounds(plantas.flatMap((pl) => pl.polygon));
    pronto.mapa.setMaxBounds(regiao.pad(0.15));
    pronto.mapa.setMinZoom(Math.max(0, pronto.mapa.getBoundsZoom(regiao) - 1));
    pronto.mapa.fitBounds(pronto.L.polygon(usina).getBounds(), { padding: [12, 12] });
  }, [pronto, usina, plantas]);
  useEffect(() => {
    if (pronto && camada.current) desenharBolhas(pronto.L, camada.current, pronto.mapa, { plantas, areas, resumos: dentro, principais, sel: sel.local, aoClicar: clicarBolha });
  }, [pronto, plantas, areas, dentro, principais, sel.local, zoom, clicarBolha]);

  const lugares: ItemBarra[] = [...ranking(dentro, "parado", 10), ...(fora ? [fora] : [])].map((r) => ({
    chave: r.local.chave,
    rotulo: r.local.nome,
    valor: r.parado,
    texto: fmtHoras(r.parado),
    dica: `${r.local.nome}, ${fmtHoras(r.parado)} parado`,
  }));
  const itensServico: ItemBarra[] = servicos.map((s) => ({
    chave: s.nome,
    rotulo: s.nome,
    valor: s.n,
    texto: s.n.toLocaleString("pt-BR"),
    dica: `${s.nome}, ${s.n} ${s.n === 1 ? "parada" : "paradas"}, ${fmtHoras(s.min)}`,
    marca: s.nome === OUTROS ? undefined : corDoServico(s.nome, principais),
    clicavel: s.nome !== OUTROS,
  }));
  const etiquetas: Etiqueta[] = [];
  if (sel.local) etiquetas.push({ dim: "local", texto: sel.local === CHAVE_FORA ? "Longe da região" : (base.locais.get(sel.local)?.nome ?? sel.local) });
  if (sel.servico) etiquetas.push({ dim: "servico", texto: sel.servico });
  if (sel.hora != null) etiquetas.push({ dim: "hora", texto: `${sel.hora}h` });
  const legenda = principais.length ? [...principais.map((n) => ({ rotulo: n, cor: corDoServico(n, principais) })), { rotulo: "Outros / sem apontamento", cor: COR_OUTROS }] : [];

  // tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
  const aviso = erro
    ? /could not find the table|does not exist|PGRST205|42P01/i.test(erro)
      ? "A tabela da análise ainda não foi criada: rode supabase/analise.sql no Supabase."
      : `Não foi possível carregar: ${erro}`
    : null;
  const semHistorico = !carregando && !erro && !paradas.length;
  const vazio = carregando ? "Carregando o histórico…" : "Nada neste filtro.";

  return (
    <div className="altura-tela flex flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
      <BarraFiltros
        periodo={periodo}
        mudarPeriodo={setPeriodo}
        filtros={filtros}
        mudarFiltros={(p) => setFiltros((f) => ({ ...f, ...p }))}
        equip={[...equip.values()]}
        etiquetas={etiquetas}
        tirar={(d) => setSel((s) => ({ ...s, [d]: null }))}
        limpar={() => setSel(SELECAO_VAZIA)}
      />
      <PlacarAnalise p={numeros} />
      <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)] lg:grid-rows-[minmax(0,1fr)]">
        <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-xl border border-borda lg:h-full">
          <div ref={ref} className="absolute inset-0" />
          <Legenda itens={legenda} />
          {(aviso || semHistorico) && (
            <div className="absolute left-1/2 top-1/2 z-[600] w-[min(380px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 p-1 shadow-xl">
              {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : <Vazio titulo="O histórico ainda não foi enviado">Rode o “Enviar Historico ao Site.bat” no PC.</Vazio>}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
          <GraficoBarras titulo="Lugares" sub="mais tempo parado" itens={lugares} selecionada={sel.local} escolher={escolherLugar} vazio={vazio} />
          <GraficoBarras titulo="Por serviço" sub="paradas com o apontamento" itens={itensServico} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />
          <GraficoHoras minutos={horas} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
        </div>
      </div>
    </div>
  );
}

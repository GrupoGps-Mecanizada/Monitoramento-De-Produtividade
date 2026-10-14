"use client";

import type * as Leaflet from "leaflet";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Botao, Segmentado, Vazio, cx } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import {
  CHAVE_FORA, OUTROS, SELECAO_VAZIA, areasDaRegiao, contornoDaUsina, diaMenos, equipDaFrota, filtrar, filtrarSelecao, lugaresDoGrafico, montarLocais, plantasDaRegiao, plantasExcluidas,
  DIAS_CURTOS, porServico, resumir, semExcluidas, separarFora, ultimoDiaVelho,
  type DimensaoSelecao, type Periodo, type SelecaoCruzada,
} from "@/lib/dominio/analise";
import { ASSUNTOS, faixasDe, gradeHoraDia, pesoParado, type Assunto } from "@/lib/dominio/assuntos";
import { ABAS_FAMILIA, DIAS_GUARDADOS, apontNovos, paradasDaFamilia, type AbaFamilia } from "@/lib/dominio/familias";
import { diaBR, diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { BarraFiltros, FILTROS_TOPO_VAZIOS, type Etiqueta, type FiltrosTopo } from "./barra-filtros";
import { AbasAssunto } from "./assunto/abas-assunto";
import { PainelMotor2 } from "./assunto/painel-motor2";
import { PainelStatus } from "./assunto/painel-status";
import { desenharCercas } from "./camada-analise";
import { corDoApontamento } from "./cores-analise";
import { PainelFamilia } from "./familia/painel-familia";
import { SubabasFamilia } from "./familia/subabas-familia";
import { GraficoBarras, type ItemBarra } from "./grafico-barras";
import { GradeQuando } from "./grade-quando";
import { LegendaTempo } from "./legenda-tempo";

/**
 * Painel da Análise (desenhos: docs/superpowers/specs/2026-10-10-painel-analise-design.md e 2026-10-13-analise-satelite-calor-design.md):
 * abas, período e filtros numa linha; mapa de satélite com as cercas nas cores do GAUSS à esquerda e, à direita,
 * a Visão geral ou o painel da família de apontamento escolhida.
 * Clicar numa área, num lugar, num serviço, numa hora ou numa placa filtra o resto; cada gráfico aplica as escolhas dos outros e marca a sua.
 */
export function Analise({ periodo, topo }: { periodo: Periodo; topo: ReactNode }) {
  const { retrato } = useRetrato();
  const { paradas, carregando, erro } = useParadasAnalise();
  const { ref, pronto } = useMapa(14, true);
  const camada = useRef<Leaflet.LayerGroup | null>(null);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  const [hoje] = useState(() => diaLocal());
  const [filtros, setFiltros] = useState<FiltrosTopo>(FILTROS_TOPO_VAZIOS);
  const [sel, setSel] = useState<SelecaoCruzada>(SELECAO_VAZIA);
  // o zoom muda quais nomes de planta cabem no mapa
  const [zoom, setZoom] = useState(0);
  const [assunto, setAssunto] = useOpcao<Assunto>("mon-analise-assunto", ASSUNTOS, "status");
  // os gráficos podem sair da tela: o mapa ocupa tudo (a escolha fica neste navegador)
  const [graficos, setGraficos] = useOpcao<"mostrar" | "ocultar">("mon-analise-graficos", ["mostrar", "ocultar"], "mostrar");
  const comGraficos = graficos === "mostrar";
  // cor das cercas: a do GAUSS (padrão, pedido do dono) ou 5 tons de azul pelo tempo parado
  const [cor, setCor] = useOpcao<"cerca" | "tempo">("mon-analise-cor", ["cerca", "tempo"], "cerca");
  const [familia, setFamilia] = useOpcao<AbaFamilia>("mon-analise-familia", ABAS_FAMILIA, "geral");

  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  // Mata CDP e USIPA saem do mapa e das contas
  const validas = useMemo(() => semExcluidas(cercas), [cercas]);
  const excluidas = useMemo(() => plantasExcluidas(cercas), [cercas]);
  const usina = useMemo(() => contornoDaUsina(validas), [validas]);
  const areas = useMemo(() => areasDaRegiao(validas.filter((c) => c.tipo === "area"), usina), [validas, usina]);
  const plantas = useMemo(() => plantasDaRegiao(validas), [validas]);
  const equip = useMemo(() => equipDaFrota(retrato?.veiculos ?? []), [retrato]);
  const base = useMemo(() => montarLocais(paradas, validas.filter((c) => c.tipo === "area"), equip, usina, excluidas), [paradas, validas, equip, usina, excluidas]);
  const doFiltro = useMemo(() => filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros, faixas: [], diasSemana: [] }), [base, hoje, periodo, filtros]);
  // a família só filtra dentro de Apontamentos
  const doFamilia = useMemo(() => (assunto !== "apontamentos" || familia === "geral" ? doFiltro : paradasDaFamilia(doFiltro, familia)), [doFiltro, familia, assunto]);
  const recorte = useCallback((ignorar?: DimensaoSelecao | DimensaoSelecao[]) => filtrarSelecao(doFamilia, sel, base.locais, ignorar), [doFamilia, sel, base]);
  // mesmo recorte no período anterior de mesmo tamanho (só cabe nos 30 dias guardados: 7 e 15)
  const velho = useMemo(() => ultimoDiaVelho(paradas, hoje), [paradas, hoje]);
  const anterior = useMemo(() => {
    const n = Number(periodo);
    // com o histórico parado, o período atual tem dias faltando: comparar inventaria uma queda
    if (velho || assunto !== "apontamentos" || familia === "geral" || n * 2 > DIAS_GUARDADOS) return null;
    const ps = filtrar(base.paradas, { hoje: diaMenos(hoje, n), periodo: n, ...filtros, faixas: [], diasSemana: [] });
    return filtrarSelecao(paradasDaFamilia(ps, familia), sel, base.locais);
  }, [base, hoje, periodo, filtros, familia, sel, assunto, velho]);
  // ranking de supervisores: sem o filtro de supervisor, para o escolhido aparecer marcado entre os outros
  const recorteSupervisores = useCallback(() => {
    if (assunto !== "apontamentos" || familia === "geral") return [];
    const ps = filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros, supervisor: null, faixas: [], diasSemana: [] });
    return filtrarSelecao(paradasDaFamilia(ps, familia), sel, base.locais);
  }, [base, hoje, periodo, filtros, familia, sel, assunto]);
  const novos = useMemo(() => (assunto === "apontamentos" && familia === "manutencao" ? apontNovos(doFiltro) : []), [doFiltro, familia, assunto]);
  const { dentro, fora } = useMemo(() => separarFora(resumir(recorte("local"), base.locais)), [recorte, base]);
  const servicos = useMemo(() => porServico(recorte("servico")), [recorte]);
  const limitesTempo = useMemo(() => faixasDe(dentro.map((r) => r.parado)), [dentro]);

  const alternar = useCallback(<K extends DimensaoSelecao,>(k: K, v: SelecaoCruzada[K]) => setSel((s) => ({ ...s, [k]: s[k] === v ? null : v })), []);
  // o serviço escolhido é de uma família: trocar de subaba tira a etiqueta
  const trocarFamilia = (f: AbaFamilia) => {
    setFamilia(f);
    setSel((s) => ({ ...s, servico: null }));
  };
  // o serviço só existe em Apontamentos: trocar de assunto tira a etiqueta
  const trocarAssunto = (a: Assunto) => {
    setAssunto(a);
    setSel((s) => ({ ...s, servico: null }));
  };
  const escolherSupervisor = (s: string) => setFiltros((f) => ({ ...f, supervisor: f.supervisor === s ? null : s }));
  // grade "Quando para": hora e dia juntos; o mesmo quadradinho de novo desfaz
  const escolherQuando = (dia: number, hora: number) => setSel((s) => (s.dia === dia && s.hora === hora ? { ...s, dia: null, hora: null } : { ...s, dia, hora }));
  const clicarArea = useCallback((chave: string) => alternar("local", chave), [alternar]);
  // pelo ranking: aproxima o mapa só quando o lugar tem coordenada ("Longe da região" não tem)
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
    if (pronto && camada.current) desenharCercas(pronto.L, camada.current, pronto.mapa, { plantas, areas, resumos: dentro, sel: sel.local, modo: cor, aoClicar: clicarArea });
  }, [pronto, plantas, areas, dentro, sel.local, cor, zoom, clicarArea]);

  const lugares: ItemBarra[] = lugaresDoGrafico(dentro, fora, sel.local).map((r) => ({
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
    // cada apontamento na cor da família dele
    marca: s.nome === OUTROS ? undefined : corDoApontamento(s.nome),
    cor: s.nome === OUTROS ? "var(--neu-dot)" : corDoApontamento(s.nome),
    clicavel: s.nome !== OUTROS,
  }));
  const etiquetas: Etiqueta[] = [];
  if (sel.local) etiquetas.push({ dim: "local", texto: sel.local === CHAVE_FORA ? "Longe da região" : (base.locais.get(sel.local)?.nome ?? sel.local) });
  if (sel.servico) etiquetas.push({ dim: "servico", texto: sel.servico });
  if (sel.hora != null) etiquetas.push({ dim: "hora", texto: `${sel.hora}h` });
  if (sel.placa) etiquetas.push({ dim: "placa", texto: sel.placa });
  if (sel.dia != null) etiquetas.push({ dim: "dia", texto: DIAS_CURTOS[sel.dia] });

  // tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
  const aviso = erro
    ? /could not find the table|does not exist|PGRST205|42P01/i.test(erro)
      ? "A tabela da análise ainda não foi criada: rode supabase/analise.sql no Supabase."
      : `Não foi possível carregar: ${erro}`
    : null;
  const semHistorico = !carregando && !erro && !paradas.length;
  const vazio = carregando ? "Carregando o histórico…" : "Nada neste filtro.";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
      <BarraFiltros
        topo={topo}
        fim={
          <Botao variante="secundaria" aria-pressed={!comGraficos} onClick={() => setGraficos(comGraficos ? "ocultar" : "mostrar")}>
            {comGraficos ? "Ocultar gráficos" : "Mostrar gráficos"}
          </Botao>
        }
        filtros={filtros}
        mudarFiltros={(p) => setFiltros((f) => ({ ...f, ...p }))}
        equip={[...equip.values()]}
        etiquetas={etiquetas}
        tirar={(d) => setSel((s) => ({ ...s, [d]: null }))}
        limpar={() => setSel(SELECAO_VAZIA)}
      />
      <div className={cx("grid min-h-0 flex-1 gap-2 lg:grid-rows-[minmax(0,1fr)]", comGraficos && "lg:grid-cols-[minmax(0,3fr)_minmax(340px,2fr)]")}>
        <div className="relative h-[55vh] min-h-[320px] overflow-hidden rounded-xl border border-borda lg:h-full">
          <div ref={ref} className="absolute inset-0" />
          <div className="absolute left-2 top-2 z-[500] w-[230px]">
            <Segmentado<"cerca" | "tempo"> rotulo="Cor do mapa" valor={cor} mudar={setCor} opcoes={[{ id: "cerca", rotulo: "Da cerca" }, { id: "tempo", rotulo: "Tempo parado" }]} />
          </div>
          {cor === "tempo" && <LegendaTempo limites={limitesTempo} />}
          {(aviso || semHistorico) && (
            <div className="absolute left-1/2 top-1/2 z-[600] w-[min(380px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 p-1 shadow-xl">
              {aviso ? <Aviso tipo="erro">{aviso}</Aviso> : <Vazio titulo="O histórico ainda não foi enviado">Rode o “Enviar Historico ao Site.bat” no PC.</Vazio>}
            </div>
          )}
        </div>
        {comGraficos && (
          <div className="flex flex-col gap-2 lg:min-h-0 lg:overflow-y-auto">
            <AbasAssunto valor={assunto} mudar={trocarAssunto} />
            {velho && (
              <p role="status" className="px-1 text-xs font-medium text-suave">
                Último dia com dados: {diaBR(velho)}
              </p>
            )}
            {assunto === "status" ? (
              <PainelStatus recorte={recorte} locais={base.locais} sel={sel} alternar={alternar} escolherQuando={escolherQuando} vazio={vazio} />
            ) : assunto === "motor2" ? (
              <PainelMotor2 recorte={recorte} locais={base.locais} sel={sel} alternar={alternar} escolherQuando={escolherQuando} vazio={vazio} />
            ) : (
              <>
                <SubabasFamilia valor={familia} mudar={trocarFamilia} />
              {familia === "geral" ? (
                <>
                  <GraficoBarras titulo="Lugares" sub="mais tempo parado" itens={lugares} selecionada={sel.local} escolher={escolherLugar} vazio={vazio} />
                  <GraficoBarras titulo="Por serviço" sub="paradas com o apontamento" itens={itensServico} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />
                  <GradeQuando grade={gradeHoraDia(recorte(["hora", "dia"]), pesoParado)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} />
                </>
              ) : (
                <PainelFamilia
                  familia={familia}
                  recorte={recorte}
                  recorteSupervisores={recorteSupervisores}
                  escolherQuando={escolherQuando}
                  anterior={anterior}
                  dias={Number(periodo)}
                  hoje={hoje}
                  locais={base.locais}
                  novos={novos}
                  sel={sel}
                  alternar={alternar}
                  supervisor={filtros.supervisor}
                  escolherSupervisor={escolherSupervisor}
                  vazio={vazio}
                />
              )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

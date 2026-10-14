"use client";

import type * as Leaflet from "leaflet";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Botao, Segmentado, Vazio, cx } from "@/components/ui";
import { useParadasAnalise } from "@/lib/dados/analise";
import { lerCercas } from "@/lib/dados/leituras";
import { useRetrato } from "@/lib/dados/use-retrato";
import {
  CHAVE_FORA, OUTROS, SELECAO_VAZIA, areasDaRegiao, contornoDaUsina, equipDaFrota, filtrar, filtrarSelecao, lugaresDoGrafico, montarLocais, plantasDaRegiao, plantasExcluidas,
  DIAS_CURTOS, porServico, resumir, semExcluidas, separarFora, ultimoDiaVelho,
  type DimensaoSelecao, type ParadaNoLocal, type Periodo, type SelecaoCruzada,
} from "@/lib/dominio/analise";
import { porApontamentoDa, porFamilia, porStatus, predominioPorLugar, type Categorizar } from "@/lib/dominio/predominio";
import { ASSUNTOS, MOTOR2, faixasDe, gradeHoraDia, lugaresPorPeso, paradasMotor2, pesoParado, pesoStatus, rotuloStatus, somarStatus, type Assunto, type Peso } from "@/lib/dominio/assuntos";
import { ABAS_FAMILIA, ROTULO_FAMILIA, apontNovos, paradasDaFamilia, type AbaFamilia } from "@/lib/dominio/familias";
import { diaBR, diaLocal, fmtHoras } from "@/lib/dominio/formato";
import { useOpcao } from "@/lib/hooks";
import type { Cerca } from "@/lib/tipos";
import { BarraFiltros, FILTROS_TOPO_VAZIOS, type Etiqueta, type FiltrosTopo } from "./barra-filtros";
import { AbasAssunto } from "./assunto/abas-assunto";
import { PainelMotor2 } from "./assunto/painel-motor2";
import { PainelStatus } from "./assunto/painel-status";
import { desenharCercas } from "./camada-analise";
import { CATEGORIAS_FAMILIA, CATEGORIAS_STATUS, COR_PARADO, categoriasDaFamilia, corDaFamilia, corDoApontamento, corDoStatus, resolverCor, type Categorias } from "./cores-analise";
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
/** Cor do mapa: a do GAUSS, quanto parou (5 tons) ou o que mais pesou em cada área. */
const MODOS_MAPA = ["cerca", "quanto", "oque"] as const;
type ModoMapa = (typeof MODOS_MAPA)[number];

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
  const [cor, setCor] = useOpcao<ModoMapa>("mon-analise-cor", MODOS_MAPA, "cerca");
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
  const velho = useMemo(() => ultimoDiaVelho(paradas, hoje), [paradas, hoje]);
  // ranking de supervisores: sem o filtro de supervisor, para o escolhido aparecer marcado entre os outros
  const recorteSupervisores = useCallback(() => {
    if (assunto !== "apontamentos" || familia === "geral") return [];
    const ps = filtrar(base.paradas, { hoje, periodo: Number(periodo), ...filtros, supervisor: null, faixas: [], diasSemana: [] });
    return filtrarSelecao(paradasDaFamilia(ps, familia), sel, base.locais);
  }, [base, hoje, periodo, filtros, familia, sel, assunto]);
  const novos = useMemo(() => (assunto === "apontamentos" && familia === "manutencao" ? apontNovos(doFiltro) : []), [doFiltro, familia, assunto]);
  const { dentro, fora } = useMemo(() => separarFora(resumir(recorte("local"), base.locais)), [recorte, base]);
  const servicos = useMemo(() => porServico(recorte("servico")), [recorte]);
  // status escolhido no gráfico "Por status": vale até sumir com um filtro (senão ficaria preso, sem barra para desmarcar)
  const [statusEscolhido, setStatus] = useState<string | null>(null);
  const statusAtivo = useMemo(() => (statusEscolhido && somarStatus(recorte()).some((s) => s.cod === statusEscolhido) ? statusEscolhido : null), [statusEscolhido, recorte]);
  // o que o mapa mede no modo "Pelo tempo": o mesmo dado e a mesma cor da aba aberta
  const medida = useMemo((): { peso: Peso; cor: string; rotulo: string; so?: (ps: ParadaNoLocal[]) => ParadaNoLocal[] } => {
    if (assunto === "motor2") return { peso: pesoStatus(MOTOR2), cor: corDoStatus(MOTOR2), rotulo: "Bomba ligada", so: paradasMotor2 };
    if (assunto === "status" && statusAtivo) return { peso: pesoStatus(statusAtivo), cor: corDoStatus(statusAtivo), rotulo: rotuloStatus(statusAtivo) };
    if (assunto === "apontamentos" && familia !== "geral") return { peso: pesoParado, cor: corDaFamilia(familia), rotulo: ROTULO_FAMILIA[familia] };
    return { peso: pesoParado, cor: COR_PARADO, rotulo: "Tempo parado" };
  }, [assunto, statusAtivo, familia]);
  const valoresMapa = useMemo(() => {
    const ps = recorte("local");
    return lugaresPorPeso(medida.so ? medida.so(ps) : ps, base.locais, medida.peso, Infinity);
  }, [recorte, medida, base]);
  const limitesTempo = useMemo(() => faixasDe(valoresMapa.map((l) => l.min)), [valoresMapa]);
  // mapa "O que parou": as categorias da aba aberta (status, famílias ou os apontamentos da família); com uma medida só, não há
  const categorias = useMemo((): (Categorias & { cat: Categorizar }) | null => {
    if (assunto === "status" && !statusAtivo) return { ...CATEGORIAS_STATUS, cat: porStatus };
    if (assunto === "apontamentos") return familia === "geral" ? { ...CATEGORIAS_FAMILIA, cat: porFamilia } : { ...categoriasDaFamilia(familia), cat: porApontamentoDa(familia) };
    return null;
  }, [assunto, statusAtivo, familia]);
  const modoMapa: ModoMapa = cor === "oque" && !categorias ? "quanto" : cor;
  const porLugar = useMemo(() => (categorias && modoMapa === "oque" ? predominioPorLugar(recorte("local"), base.locais, categorias.cat) : null), [categorias, modoMapa, recorte, base]);
  // legenda do "O que parou": só as categorias que venceram em alguma área, na ordem fixa; e o cinza do misto
  const legendaCategorias = useMemo(() => {
    if (!categorias || !porLugar) return null;
    const venceram = new Set([...porLugar.values()].filter((p) => p.nivel !== "misto").map((p) => p.cat));
    const lista = categorias.ordem.filter((c) => venceram.has(c)).map((c) => ({ nome: categorias.nome(c), cor: categorias.cor(c) }));
    const novos = [...venceram].filter((c) => !categorias.ordem.includes(c)).map((c) => ({ nome: categorias.nome(c), cor: categorias.cor(c) }));
    const misto = [...porLugar.values()].some((p) => p.nivel === "misto") ? [{ nome: "Misto (ninguém chega a 40%)", cor: "#9aa3ad" }] : [];
    return [...lista, ...novos, ...misto];
  }, [categorias, porLugar]);

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
    if (pronto && camada.current) desenharCercas(pronto.L, camada.current, pronto.mapa, {
        plantas,
        areas,
        resumos: dentro,
        sel: sel.local,
        modo: modoMapa,
        medida: { valores: valoresMapa, cor: resolverCor(medida.cor), rotulo: medida.rotulo },
        predominio: categorias && porLugar ? { porLugar, nome: categorias.nome, cor: (c) => resolverCor(categorias.cor(c)) } : null,
        aoClicar: clicarArea,
      });
    // modos de dados: o satélite fica cinza e escuro para as cores aparecerem
    pronto?.mapa.getContainer().classList.toggle("fundo-apagado", modoMapa !== "cerca");
  }, [pronto, plantas, areas, dentro, sel.local, modoMapa, valoresMapa, medida, categorias, porLugar, zoom, clicarArea]);

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
          <div className="absolute left-2 top-2 z-[500] w-[340px] max-w-[calc(100%-16px)]">
            <Segmentado<ModoMapa>
              rotulo="Cor do mapa"
              valor={modoMapa}
              mudar={setCor}
              opcoes={[{ id: "cerca", rotulo: "Da cerca" }, { id: "quanto", rotulo: "Quanto parou" }, ...(categorias ? [{ id: "oque" as const, rotulo: "O que parou" }] : [])]}
            />
          </div>
          {modoMapa !== "cerca" && <LegendaTempo limites={limitesTempo} cor={resolverCor(medida.cor)} rotulo={medida.rotulo} categorias={modoMapa === "oque" ? legendaCategorias : null} />}
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
              <PainelStatus recorte={recorte} locais={base.locais} sel={sel} alternar={alternar} escolherQuando={escolherQuando} vazio={vazio} status={statusAtivo} setStatus={setStatus} />
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

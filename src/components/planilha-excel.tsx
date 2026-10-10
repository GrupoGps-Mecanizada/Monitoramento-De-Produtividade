"use client";

import "@univerjs/preset-sheets-core/lib/index.css";
import "@univerjs/preset-sheets-filter/lib/index.css";
import "@univerjs/preset-sheets-find-replace/lib/index.css";
import { useEffect, useImperativeHandle, useRef, useState, type Ref, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { diaLocal } from "@/lib/dominio/formato";
import { baixar, htmlImpressao, imprimirHtml, planilhaVisivel, type EstiloCelula, type RetratoPlanilha } from "@/lib/exportacao/planilha-visivel";
import { avisar } from "./avisos";
import { cx } from "./ui";

/*
 * Planilha para NAVEGAR (Univer, código aberto Apache-2.0), igual ao Excel: seleciona células, linhas, colunas e
 * o cabeçalho; filtro no cabeçalho; Ctrl+F pesquisa; cores, negrito e bordas; Ctrl+C cola no Excel formatado.
 * NADA aqui altera os dados: digitar, colar, apagar ou substituir numa célula não vale (a célula volta).
 * Para mudar um dado: dois cliques na célula/linha (quem usa decide o que abre) ou a seleção + botões da tela.
 *
 * Veio do SST - Mecanizada (mesmo formato de tabela nos dois sistemas); candidato ao núcleo comum sge-core.
 *
 * Sem "piscar": a planilha (com a faixa de ferramentas) é criada UMA vez. Se mudam as linhas ou a ordem das
 * colunas (filtros, layout), só a pasta de trabalho é trocada, na hora; se mudam só valores (dados salvos,
 * Datas/Status), só as células que mudaram são reescritas, mantendo a formatação feita à mão.
 */
export type ValorCelula = string | number | null;
export interface ColunaPlanilha<T> {
  id: string;
  rotulo: string;
  /** largura em pixels */
  largura: number;
  /** numero: só dígitos viram número */
  tipo?: "texto" | "numero";
  valor: (l: T) => ValorCelula;
  /** cor de fundo (#rrggbb) */
  cor?: (l: T) => string | undefined;
}

type Celula = {
  v?: string | number | null;
  t?: number;
  s?: Record<string, unknown>;
};
const TEXTO = 1;
const NUMERO = 2;
const ESQUERDA = 1;
const CENTRO = 2;
const DUPLO_CLIQUE = 3;
const FINA = 1; // borda fina (como a "Todas as bordas" do Excel)
const borda = (rgb: string) => ({ t: { s: FINA, cl: { rgb } }, b: { s: FINA, cl: { rgb } }, l: { s: FINA, cl: { rgb } }, r: { s: FINA, cl: { rgb } } });
/** bordas de todas as células (vêm por padrão, e vão junto no Ctrl+C para o Excel) */
const BORDA = borda("#BFBFBF");
const CABECALHO = {
  bd: borda("#8EA9DB"),
  bg: { rgb: "#1F3864" },
  cl: { rgb: "#FFFFFF" },
  bl: 1,
  ht: ESQUERDA,
  vt: CENTRO,
  tb: 3,
  fs: 10,
};
/** linhas vazias depois dos dados (como no Excel) */
const FOLGA = 30;

/** Conteúdo da célula como o Univer guarda (datas viram número de série do Excel). */
function celula<T>(col: ColunaPlanilha<T>, l: T, limparCor = false): Celula {
  const v = col.valor(l);
  const cor = col.cor?.(l);
  // tudo alinhado à esquerda (texto, números e datas)
  const s: Record<string, unknown> = { ht: ESQUERDA, bd: BORDA };
  if (cor) s.bg = { rgb: cor };
  else if (limparCor) s.bg = null;
  const estilo = { s };
  // vazio de verdade (v: null): só o estilo deixaria o valor antigo na célula
  if (v == null || v === "") return { v: null, ...estilo };
  // coluna de número (chapa, dias) entra como número, como na planilha; zero à esquerda fica texto
  if (
    typeof v === "number" ||
    (col.tipo === "numero" && /^[1-9]\d{0,14}$/.test(v))
  )
    return { v: Number(v), t: NUMERO, ...estilo };
  return { v, t: TEXTO, ...estilo };
}
const bruto = (v: unknown): string | number | null =>
  v == null || (typeof v === "string" && v.trim() === "")
    ? null
    : typeof v === "number"
      ? v
      : String(v).trim();
const iguais = (a: string | number | null, b: string | number | null) =>
  a == null || b == null
    ? a == b
    : typeof a === "number" || typeof b === "number"
      ? Number(a) === Number(b)
      : a === b;

/**
 * Pacotes do Univer (a maior parte do peso da planilha), baixados uma única vez.
 * `precarregarPlanilha` (planilha-excel-sob-demanda) chama isto antes da planilha aparecer, junto com os
 * dados, para ela abrir na hora.
 */
const importarUniver = () =>
  Promise.all([
    import("@univerjs/presets"),
    import("@univerjs/preset-sheets-core"),
    import("@univerjs/preset-sheets-core/locales/pt-BR"),
    import("@univerjs/preset-sheets-filter"),
    import("@univerjs/preset-sheets-filter/locales/pt-BR"),
    import("@univerjs/preset-sheets-find-replace"),
    import("@univerjs/preset-sheets-find-replace/locales/pt-BR"),
  ]);
let univer: ReturnType<typeof importarUniver> | null = null;
export const carregarUniver = () => {
  univer ??= importarUniver().catch((e) => {
    univer = null; // falhou (rede): tenta de novo na próxima
    throw e;
  });
  return univer;
};

/** Exportar/imprimir a planilha como está (para a tela chamar de outro botão, ex.: janela de ferramentas). */
export interface ControlePlanilha {
  exportar: () => Promise<void>;
  imprimir: () => void;
}

/** Estado vivo da planilha (lido pelos eventos do Univer, que são registrados uma vez). */
interface Vivo<T> {
  cols: ColunaPlanilha<T>[];
  mapa: Map<number, T>;
  colId: number;
  totalLinhas: number;
  estrutura: string;
}

export function PlanilhaExcel<T>({
  nome,
  linhas,
  colunas,
  chave,
  aoAbrir,
  aoSelecionar,
  acoes,
  faixa = true,
  dica = "dois cliques numa linha para editar",
  altura = "calc(100dvh - 250px)",
  ferramentas,
  controle,
}: {
  nome: string;
  linhas: T[];
  colunas: ColunaPlanilha<T>[];
  chave: (l: T) => number;
  /** dois cliques numa célula (coluna = id da coluna clicada) */
  aoAbrir?: (l: T, coluna: string) => void;
  /** linhas selecionadas na planilha (as escondidas pelo filtro não contam) */
  aoSelecionar?: (ls: T[]) => void;
  /** botões na faixa de cima da planilha (ex.: editar a seleção); ficam no lugar, sem empurrar a planilha */
  acoes?: ReactNode;
  /** false = sem a faixa de cima (a tela mostra essas informações em outro lugar) */
  faixa?: boolean;
  /** o que os dois cliques fazem (texto da faixa de cima) */
  dica?: string;
  /** altura CSS da planilha; "preencher" = ocupa o espaço que sobrar no contêiner (flex) */
  altura?: string;
  /** botões da tela no começo da barra da planilha, antes do "desfazer" (ex.: ferramentas da Matriz) */
  ferramentas?: ReactNode;
  /** a tela recebe aqui exportar/imprimir "como está" (para usar em outros botões) */
  controle?: Ref<ControlePlanilha>;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  // sem login no Monitoramento: o arquivo não diz quem exportou
  const quem = "Monitoramento";
  // retrato da planilha como está na tela (linhas filtradas, colunas visíveis, estilos)
  const retratar = useRef<(() => RetratoPlanilha | null) | null>(null);
  const [gerando, setGerando] = useState(false);
  const props = useRef({
    linhas,
    colunas,
    chave,
    nome,
    aoAbrir,
    aoSelecionar,
    dica,
  });
  useEffect(() => {
    props.current = {
      linhas,
      colunas,
      chave,
      nome,
      aoAbrir,
      aoSelecionar,
      dica,
    };
  });
  /** aplica linhas/colunas novas: troca a pasta (estrutura mudou) ou reescreve só as células que mudaram */
  const aplicar = useRef<((ls: T[], cs: ColunaPlanilha<T>[]) => void) | null>(
    null,
  );
  const [estado, setEstado] = useState<"abrindo" | "pronto" | "erro">(
    "abrindo",
  );
  // mexeu na planilha (pesquisa, filtro, seleção, rolagem, cores…): aparece o "Resetar"
  const [alterada, setAlterada] = useState(false);
  const resetar = useRef<(() => void) | null>(null);
  // lugar na barra da planilha (antes do "desfazer") onde entram os botões da tela
  const [barra, setBarra] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let ativo = true;
    let descartar: (() => void) | null = null;
    (async () => {
      try {
        const [
          presets,
          { UniverSheetsCorePreset },
          nucleoPt,
          { UniverSheetsFilterPreset },
          filtroPt,
          { UniverSheetsFindReplacePreset },
          buscaPt,
        ] = await carregarUniver();
        if (!ativo || !caixa.current) return;
        const { createUniver, LocaleType, mergeLocales } = presets;
        const { univer, univerAPI: api } = createUniver({
          locale: LocaleType.PT_BR,
          locales: {
            [LocaleType.PT_BR]: mergeLocales(
              nucleoPt.default,
              filtroPt.default,
              buscaPt.default,
            ),
          },
          presets: [
            // abas (Início, Fórmulas…) na mesma linha dos botões de desfazer/refazer
            UniverSheetsCorePreset({ container: caixa.current, ribbonType: "simple" }),
            UniverSheetsFilterPreset(),
            UniverSheetsFindReplacePreset(),
          ],
        });
        descartar = () => univer.dispose();

        const vivo: Vivo<T> = {
          cols: [],
          mapa: new Map(),
          colId: 0,
          totalLinhas: 0,
          estrutura: "",
        };
        let unidade: string | null = null;
        let versao = 0;
        let selecao: { dispose(): void } | null = null;
        let comandos: { dispose(): void } | null = null;
        // operações do próprio sistema (montar, atualizar, desfazer edição) não contam como "mexeu"
        let interno = false;
        let quietoAte = 0;
        const folha = () => api.getActiveWorkbook()?.getActiveSheet();
        const idDaLinha = (r: number) =>
          Number(folha()?.getRange(r, vivo.colId).getRawValue());
        const assinatura = (ls: T[], cs: ColunaPlanilha<T>[]) =>
          `${cs.map((c) => `${c.id}:${c.largura}`).join(",")}|${ls.map((l) => props.current.chave(l)).join(",")}`;

        const aoMudarSelecao = (
          selections: { startRow: number; endRow: number }[],
        ) => {
          const ws = folha();
          if (!ws || !props.current.aoSelecionar) return;
          let escondidas = new Set<number>();
          try {
            escondidas = new Set(ws.getFilter()?.getFilteredOutRows() ?? []);
          } catch {
            // sem filtro ativo
          }
          const ids = new Set<number>();
          for (const f of selections) {
            const fim = Math.min(f.endRow, vivo.totalLinhas - 1);
            for (let r = Math.max(f.startRow, 1); r <= fim; r++)
              if (!escondidas.has(r) && vivo.mapa.has(idDaLinha(r)))
                ids.add(idDaLinha(r));
          }
          props.current.aoSelecionar([...ids].map((x) => vivo.mapa.get(x)!));
        };

        /** cria (ou troca) a pasta de trabalho com estas linhas e colunas */
        const montar = (dados: T[], cols: ColunaPlanilha<T>[], manterRolagem = true) => {
          const id = props.current.chave;
          const colId = cols.length; // coluna escondida com o id da linha (identifica a linha mesmo com filtro)
          const cellData: Record<number, Record<number, Celula>> = { 0: {} };
          cols.forEach(
            (c, i) =>
              (cellData[0][i] = {
                v: c.rotulo.toUpperCase(),
                t: TEXTO,
                s: CABECALHO,
              }),
          );
          cellData[0][colId] = { v: "ID", t: TEXTO, s: CABECALHO };
          dados.forEach((l, r) => {
            const linha: Record<number, Celula> = {};
            cols.forEach((c, i) => (linha[i] = celula(c, l)));
            linha[colId] = { v: id(l), t: NUMERO };
            cellData[r + 1] = linha;
          });
          const columnData: Record<number, { w?: number; hd?: number }> = {};
          cols.forEach((c, i) => (columnData[i] = { w: c.largura }));
          columnData[colId] = { w: 60, hd: 1 };

          // mantém a rolagem ao trocar a pasta (quem filtrou continua olhando o mesmo lugar)
          let rolagem: { r: number; c: number } | null = null;
          try {
            const s = (
              folha() as unknown as {
                getScrollState?: () => {
                  sheetViewStartRow: number;
                  sheetViewStartColumn: number;
                };
              }
            )?.getScrollState?.();
            if (s)
              rolagem = { r: s.sheetViewStartRow, c: s.sheetViewStartColumn };
          } catch {
            // primeira montagem
          }
          selecao?.dispose();
          comandos?.dispose();
          quietoAte = Date.now() + 1200;
          setAlterada(false);
          const antiga = unidade;
          unidade = `planilha-${++versao}`;
          vivo.cols = cols;
          vivo.colId = colId;
          vivo.totalLinhas = dados.length + 1 + FOLGA;
          vivo.mapa = new Map(dados.map((l) => [id(l), l]));
          vivo.estrutura = assinatura(dados, cols);
          api.createWorkbook({
            id: unidade,
            name: props.current.nome,
            sheetOrder: ["folha"],
            sheets: {
              folha: {
                id: "folha",
                name: props.current.nome,
                rowCount: vivo.totalLinhas,
                columnCount: colId + 1,
                cellData,
                columnData,
                rowData: { 0: { h: 46 } },
                defaultRowHeight: 24,
                freeze: { xSplit: 1, ySplit: 1, startRow: 1, startColumn: 1 },
              },
            },
          } as Parameters<typeof api.createWorkbook>[0]);
          if (antiga) api.disposeUnit(antiga);
          const ws = folha();
          ws?.getRange(0, 0, dados.length + 1, colId).createFilter();
          if (manterRolagem && rolagem && (rolagem.r > 1 || rolagem.c > 1)) {
            try {
              (
                ws as unknown as {
                  scrollToCell?: (r: number, c: number) => void;
                }
              )?.scrollToCell?.(
                Math.min(rolagem.r, vivo.totalLinhas - 1),
                Math.min(rolagem.c, colId - 1),
              );
            } catch {
              // sem rolagem
            }
          }
          selecao =
            api
              .getActiveWorkbook()
              ?.onSelectionChange((s) => aoMudarSelecao(s)) ?? null;
          comandos =
            api.getActiveWorkbook()?.onCommandExecuted((c) => {
              // "cell-edit" é interno do editor (roda sozinho ao abrir); o resto é ação de quem usa
              if (!interno && Date.now() > quietoAte && !c.id.includes("cell-edit")) setAlterada(true);
            }) ?? null;
          props.current.aoSelecionar?.([]);
        };

        /** mesmas linhas e colunas: reescreve só as células cujo valor ou cor mudou */
        const atualizarCelulas = (novas: T[], cols: ColunaPlanilha<T>[]) => {
          const ws = folha();
          if (!ws) return;
          const id = props.current.chave;
          const antigas = vivo.cols;
          const linhaDe = new Map<number, number>();
          for (let r = 1; r < vivo.totalLinhas; r++) {
            const x = idDaLinha(r);
            if (x) linhaDe.set(x, r);
          }
          vivo.cols = cols; // antes de mudar as células: assim a mudança não é "desfeita"
          interno = true;
          try {
          for (const l of novas) {
            const r = linhaDe.get(id(l));
            const antes = vivo.mapa.get(id(l));
            if (!r || !antes) continue;
            vivo.mapa.set(id(l), l);
            cols.forEach((c, i) => {
              const a = antigas[i] ? celula(antigas[i], antes) : {};
              const b = celula(c, l);
              if (
                !iguais(bruto(a.v), bruto(b.v)) ||
                antigas[i]?.cor?.(antes) !== c.cor?.(l)
              )
                ws.getRange(r, i).setValue(celula(c, l, true) as never);
            });
          }
          } finally {
            interno = false;
          }
        };

        aplicar.current = (ls, cs) =>
          assinatura(ls, cs) !== vivo.estrutura
            ? montar(ls, cs)
            : atualizarCelulas(ls, cs);

        let ultimoAviso = 0;
        const avisarSoLeitura = () => {
          if (Date.now() - ultimoAviso < 4000) return;
          ultimoAviso = Date.now();
          avisar(
            `A planilha é só para ver e pesquisar: nada aqui muda os dados (${props.current.dica}).`,
            { tipo: "erro" },
          );
        };

        // edição de célula nunca abre; dois cliques abrem o que a tela decidir
        api.addEvent(api.Event.BeforeSheetEditStart, (p) => {
          p.cancel = true;
          if (p.row === 0) return;
          const l = vivo.mapa.get(idDaLinha(p.row));
          if (p.eventType === DUPLO_CLIQUE && l && props.current.aoAbrir)
            props.current.aoAbrir(l, vivo.cols[p.column]?.id ?? "");
          else avisarSoLeitura();
        });

        // colou, apagou, recortou, substituiu, arrastou: o valor volta ao que é no sistema
        let corrigindo = false;
        api.addEvent(api.Event.SheetValueChanged, (p) => {
          const ws = folha();
          if (!ws || corrigindo) return;
          corrigindo = true;
          interno = true;
          try {
            const { cols, colId, totalLinhas } = vivo;
            let voltou = false;
            for (const f of p.effectedRanges) {
              const r0 = f.getRow();
              const c0 = f.getColumn();
              const r1 = Math.min(r0 + f.getHeight(), totalLinhas);
              const c1 = Math.min(c0 + f.getWidth(), colId + 1);
              for (let r = r0; r < r1; r++)
                for (let c = c0; c < c1; c++) {
                  const celulaAtual = ws.getRange(r, c);
                  const atual = bruto(celulaAtual.getRawValue());
                  if (r === 0) {
                    const certo =
                      c === colId ? "ID" : cols[c]?.rotulo.toUpperCase();
                    if (certo && atual !== certo) {
                      celulaAtual.setValue({
                        v: certo,
                        t: TEXTO,
                        s: CABECALHO,
                      } as never);
                      voltou = true;
                    }
                    continue;
                  }
                  if (c === colId) continue;
                  const l = vivo.mapa.get(idDaLinha(r));
                  const esperado = l ? bruto(celula(cols[c], l).v) : null;
                  if (!iguais(atual, esperado)) {
                    celulaAtual.setValue(
                      (l ? celula(cols[c], l, true) : { v: "" }) as never,
                    );
                    voltou = true;
                  }
                }
            }
            if (voltou) avisarSoLeitura();
          } finally {
            corrigindo = false;
            interno = false;
          }
        });

        montar(props.current.linhas, props.current.colunas);
        // retrato da planilha como está: o que o filtro deixou, colunas visíveis, larguras, cores e formatação
        retratar.current = () => {
          const wb = api.getActiveWorkbook();
          const ws = wb?.getActiveSheet();
          if (!wb || !ws) return null;
          const foto = wb.save() as unknown as {
            styles?: Record<string, EstiloCelula | null>;
            sheets: Record<string, { cellData?: Record<number, Record<number, { v?: string | number | null; s?: string | EstiloCelula | null }>>; rowData?: Record<number, { h?: number; hd?: number; s?: string | EstiloCelula | null }>; columnData?: Record<number, { w?: number; hd?: number; s?: string | EstiloCelula | null }> }>;
          };
          const folhaFoto = foto.sheets[ws.getSheetId()];
          if (!folhaFoto) return null;
          const estilo = (s: string | EstiloCelula | null | undefined): EstiloCelula => (typeof s === "string" ? (foto.styles?.[s] ?? {}) : (s ?? {}));
          const cel = folhaFoto.cellData ?? {};
          const lin = folhaFoto.rowData ?? {};
          const col = folhaFoto.columnData ?? {};
          let escondidas = new Set<number>();
          try {
            escondidas = new Set(ws.getFilter()?.getFilteredOutRows() ?? []);
          } catch {
            // sem filtro
          }
          let ultima = 0;
          for (const r of Object.keys(cel).map(Number)) if (Object.values(cel[r] ?? {}).some((c) => c?.v != null && c.v !== "")) ultima = Math.max(ultima, r);
          const linhas: number[] = [];
          for (let r = 0; r <= ultima; r++) if (!escondidas.has(r) && !lin[r]?.hd) linhas.push(r);
          const colunasVis: number[] = [];
          for (let c = 0; c < vivo.colId; c++) if (!col[c]?.hd) colunasVis.push(c);
          return {
            nome: props.current.nome,
            larguras: colunasVis.map((c) => col[c]?.w ?? 88),
            linhas: linhas.map((r) => ({
              altura: lin[r]?.h ?? (r === 0 ? 46 : 24),
              celulas: colunasVis.map((c) => {
                const d = cel[r]?.[c];
                return { v: d?.v ?? null, s: { ...estilo(col[c]?.s), ...estilo(lin[r]?.s), ...estilo(d?.s) } };
              }),
            })),
            visiveis: linhas.filter((r) => r > 0).length,
            total: vivo.mapa.size,
          };
        };
        // "Resetar": planilha de volta ao original (sem filtros, cores, seleção, pesquisa e rolagem)
        resetar.current = () => montar(props.current.linhas, props.current.colunas, false);
        // espaço para os botões da tela no começo da barra da planilha (antes do "desfazer")
        const acharBarra = () => {
          if (!ativo) return;
          const cab = caixa.current?.querySelector<HTMLElement>('header[data-u-comp="headerbar"]');
          if (!cab) return void requestAnimationFrame(acharBarra);
          const lugar = document.createElement("div");
          lugar.className = "planilha-barra-extra";
          cab.prepend(lugar);
          // a barra da planilha começa depois dos nossos botões (a largura muda quando o "Resetar" aparece)
          new ResizeObserver(() => (cab.style.paddingLeft = lugar.offsetWidth ? `${lugar.offsetWidth + 10}px` : "")).observe(lugar);
          setBarra(lugar);
        };
        acharBarra();
        setEstado("pronto");
      } catch (e) {
        console.error(e);
        if (ativo) setEstado("erro");
      }
    })();
    return () => {
      ativo = false;
      aplicar.current = null;
      resetar.current = null;
      retratar.current = null;
      // descarta depois do React terminar de desenhar (o Univer desmonta a própria árvore React)
      const d = descartar;
      setTimeout(() => d?.(), 0);
    };
  }, []);

  const exportar = async () => {
    const r = retratar.current?.();
    if (!r) return;
    setGerando(true);
    try {
      const filtrada = r.visiveis < r.total;
      baixar(await planilhaVisivel(r, quem), `${r.nome.replace(/[^\w.-]+/g, "-").toLowerCase()}-${diaLocal()}${filtrada ? "-filtrada" : ""}.xlsx`);
      avisar(filtrada ? `Exportada filtrada: ${r.visiveis} de ${r.total} linhas.` : `Exportada completa: ${r.total} linhas.`, { tipo: "ok" });
    } finally {
      setGerando(false);
    }
  };
  const imprimir = () => {
    const r = retratar.current?.();
    if (r) imprimirHtml(htmlImpressao(r, diaLocal()));
  };
  // a tela chama exportar/imprimir por outros botões (ex.: janela de ferramentas)
  useImperativeHandle(controle, () => ({ exportar, imprimir }));

  // linhas ou colunas novas (filtros, layout, dados salvos, Datas/Status): sem recriar a planilha
  useEffect(() => {
    if (estado === "pronto") aplicar.current?.(linhas, colunas);
  }, [linhas, colunas, estado]);

  const preencher = altura === "preencher";
  return (
    <div
      className={cx(
        "overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm",
        preencher && "flex min-h-0 flex-1 flex-col",
      )}
    >
      {faixa && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda px-4 py-2 text-xs text-suave">
          <span className="font-semibold text-texto">
            {linhas.length} linhas
          </span>
          <span>
            <b className="text-texto">Só para ver e pesquisar</b> (Ctrl+F) ·
            nada aqui altera os dados · {dica} · cores são temporárias
          </span>
          <span className="ml-auto flex min-h-8 items-center gap-2">
            {estado === "abrindo" ? (
              <span className="font-medium">Abrindo planilha…</span>
            ) : (
              acoes
            )}
          </span>
        </div>
      )}
      {estado === "erro" ? (
        <p className="p-8 text-center text-sm text-perigo">
          Não foi possível abrir a planilha. Recarregue a página (F5).
        </p>
      ) : (
        <div
          className={cx("relative", preencher && "min-h-0 flex-1")}
          style={preencher ? undefined : { height: altura }}
        >
          <div ref={caixa} className="absolute inset-0" />
          {barra &&
            createPortal(
              <>
                {ferramentas}
                <button
                  type="button"
                  onClick={exportar}
                  disabled={gerando}
                  title="Exportar para o Excel como está na tela: filtrada (só o que aparece) ou completa, com cores e formatação"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-borda bg-superficie px-2 text-xs font-semibold text-texto shadow-sm hover:bg-superficie-2 disabled:opacity-60"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#1D6F42]" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 4v11m0 0-4-4m4 4 4-4M4 19h16" />
                  </svg>
                  {gerando ? "Gerando…" : "Excel"}
                </button>
                <button
                  type="button"
                  onClick={imprimir}
                  title="Imprimir como está na tela: filtrada ou completa, com cores (folha em paisagem)"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-borda bg-superficie px-2 text-xs font-semibold text-texto shadow-sm hover:bg-superficie-2"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z" />
                  </svg>
                  Imprimir
                </button>
                {alterada && (
                  <button
                    type="button"
                    onClick={() => resetar.current?.()}
                    title="Voltar a planilha ao original: tira filtros, pesquisa, cores, seleção e rolagem (os dados não mudam)"
                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-red-600 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
                    </svg>
                    Resetar
                  </button>
                )}
              </>,
              barra,
            )}
          {estado === "abrindo" && (
            <div className="absolute inset-0 grid place-items-center bg-superficie text-sm text-suave">
              Abrindo planilha…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

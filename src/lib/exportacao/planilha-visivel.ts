import type ExcelJS from "exceljs";
import { diaBR } from "../dominio/formato";
import { NOME_SISTEMA } from "../marca";

/*
 * Exportar / imprimir a planilha EXATAMENTE como está na tela: só as linhas que o filtro deixou (sem filtro,
 * todas), só as colunas visíveis, com as larguras, cores, negrito, bordas e alinhamentos do momento
 * (inclusive o que foi pintado à mão). Recebe o "retrato" da planilha montado por PlanilhaExcel.
 * Veio do SST - Mecanizada (mesmo formato de planilha); candidato ao núcleo comum sge-core.
 */

/** ExcelJS só é baixado quando alguém exporta (não pesa na abertura do sistema). */
async function novaPasta(): Promise<ExcelJS.Workbook> {
  const { default: Excel } = await import("exceljs");
  return new Excel.Workbook();
}

/** Entrega o arquivo ao navegador para download. */
export function baixar(conteudo: ArrayBuffer, nome: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Sem login no Monitoramento: diz quando foi exportado, não quem. */
function marcaDagua(): string {
  const agora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date());
  return `${NOME_SISTEMA} · Exportado em ${agora} · USO INTERNO`;
}

/** Estilo de célula no formato do Univer (só o que usamos). */
export interface EstiloCelula {
  bg?: { rgb?: string | null } | null;
  cl?: { rgb?: string | null } | null;
  bl?: number;
  it?: number;
  ul?: { s?: number } | null;
  st?: { s?: number } | null;
  fs?: number;
  ff?: string | null;
  ht?: number;
  vt?: number;
  tb?: number;
  n?: { pattern?: string } | null;
  bd?: Partial<Record<"t" | "b" | "l" | "r", { s?: number; cl?: { rgb?: string | null } } | null>> | null;
}
export interface RetratoPlanilha {
  nome: string;
  /** linhas visíveis (a 1ª é o cabeçalho), cada célula com valor e estilo */
  linhas: { altura: number; celulas: { v: string | number | null; s: EstiloCelula }[] }[];
  larguras: number[];
  /** linhas de dados visíveis / total (para dizer se está filtrado) */
  visiveis: number;
  total: number;
}

/** "#1f3864", "rgb(31,56,100)" → "1F3864" */
function hex(cor: string | null | undefined): string | null {
  if (!cor) return null;
  const c = cor.trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(c) ?? /^#?([0-9a-f]{3})$/i.exec(c);
  if (m) return (m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1]).toUpperCase();
  const r = /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  return r ? [r[1], r[2], r[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase() : null;
}
/** Texto como aparece na tela (esta planilha não tem colunas de data). */
export const textoCelula = (v: string | number | null): string => (v == null ? "" : String(v));
const estiloBorda = (s?: number): ExcelJS.BorderStyle => (s === 13 ? "thick" : s && s >= 8 && s <= 12 ? "medium" : s === 7 ? "double" : s === 3 ? "dotted" : s === 4 ? "dashed" : "thin");
const HORIZ = { 1: "left", 2: "center", 3: "right" } as const;
const VERT = { 1: "top", 2: "middle", 3: "bottom" } as const;

/** Arquivo .xlsx com a planilha como está (abre no Excel com as mesmas cores e filtros aplicados). */
export async function planilhaVisivel(r: RetratoPlanilha, quem: string): Promise<ArrayBuffer> {
  const wb = await novaPasta();
  wb.creator = quem;
  const ws = wb.addWorksheet(r.nome.slice(0, 31));
  const marca = marcaDagua();
  ws.headerFooter.oddHeader = `&L&8${marca.replace(/&/g, "&&")}`;
  ws.headerFooter.oddFooter = "&R&8Página &P de &N";
  // impressão pelo Excel: paisagem, cabe na largura, cabeçalho repetido em todas as páginas
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
  r.larguras.forEach((px, i) => (ws.getColumn(i + 1).width = Math.max(4, Math.round((px / 7) * 10) / 10)));
  r.linhas.forEach((linha, ri) => {
    const row = ws.getRow(ri + 1);
    row.height = Math.round(linha.altura * 0.75);
    linha.celulas.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const s = c.s;
      if (c.v != null && c.v !== "") cell.value = c.v;
      const bg = hex(s.bg?.rgb);
      if (bg) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${bg}` } };
      const cor = hex(s.cl?.rgb);
      cell.font = {
        name: s.ff ?? "Arial",
        size: s.fs ?? 10,
        bold: s.bl === 1,
        italic: s.it === 1,
        underline: !!s.ul?.s,
        strike: !!s.st?.s,
        ...(cor ? { color: { argb: `FF${cor}` } } : {}),
      };
      cell.alignment = {
        horizontal: s.ht ? HORIZ[s.ht as 1 | 2 | 3] : undefined,
        vertical: s.vt ? VERT[s.vt as 1 | 2 | 3] : "middle",
        wrapText: s.tb === 3,
      };
      if (s.bd) {
        const lado = (b?: { s?: number; cl?: { rgb?: string | null } } | null) =>
          b && b.s ? { style: estiloBorda(b.s), color: { argb: `FF${hex(b.cl?.rgb) ?? "BFBFBF"}` } } : undefined;
        cell.border = { top: lado(s.bd.t), bottom: lado(s.bd.b), left: lado(s.bd.l), right: lado(s.bd.r) };
      }
    });
  });
  ws.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, r.linhas.length), column: r.larguras.length } };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function css(s: EstiloCelula): string {
  const partes: string[] = [];
  const bg = hex(s.bg?.rgb);
  if (bg) partes.push(`background:#${bg}`);
  const cor = hex(s.cl?.rgb);
  if (cor) partes.push(`color:#${cor}`);
  if (s.bl === 1) partes.push("font-weight:700");
  if (s.it === 1) partes.push("font-style:italic");
  const deco = [s.ul?.s && "underline", s.st?.s && "line-through"].filter(Boolean).join(" ");
  if (deco) partes.push(`text-decoration:${deco}`);
  if (s.fs) partes.push(`font-size:${s.fs}pt`);
  // só letras, números, espaço, vírgula e hífen: nada que feche o atributo ou injete código na página de impressão
  if (s.ff) partes.push(`font-family:${s.ff.replace(/[^\p{L}\p{N} ,-]/gu, "")}`);
  if (s.ht) partes.push(`text-align:${HORIZ[s.ht as 1 | 2 | 3] ?? "left"}`);
  if (s.vt) partes.push(`vertical-align:${VERT[s.vt as 1 | 2 | 3] ?? "middle"}`);
  partes.push(s.tb === 3 ? "white-space:normal" : "white-space:nowrap");
  for (const [lado, nome] of [["t", "top"], ["b", "bottom"], ["l", "left"], ["r", "right"]] as const) {
    const b = s.bd?.[lado];
    if (b?.s) partes.push(`border-${nome}:${b.s >= 8 ? 2 : 1}px solid #${hex(b.cl?.rgb) ?? "BFBFBF"}`);
  }
  return partes.join(";");
}

/** Página pronta para imprimir (paisagem, cabeçalho repetido, reduzida para caber na largura). */
export function htmlImpressao(r: RetratoPlanilha, hoje: string): string {
  const largura = r.larguras.reduce((a, b) => a + b, 0);
  const util = 1060; // largura útil de uma folha A4 em paisagem (px, margens de 8 mm)
  const zoom = Math.min(1, util / Math.max(1, largura));
  const [cab, ...corpo] = r.linhas;
  const tr = (l: RetratoPlanilha["linhas"][number], tag: "th" | "td") =>
    `<tr style="height:${l.altura}px">${l.celulas.map((c) => `<${tag} style="${css(c.s)}">${esc(textoCelula(c.v))}</${tag}>`).join("")}</tr>`;
  const filtro = r.visiveis < r.total ? `filtrado: ${r.visiveis} de ${r.total} linhas` : `${r.total} linhas`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(r.nome)}</title><style>
@page { size: A4 landscape; margin: 8mm; }
* { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
body { margin: 0; font-family: Arial, sans-serif; font-size: 10pt; color: #111; }
.topo { display: flex; justify-content: space-between; font-size: 8pt; color: #555; margin-bottom: 4px; }
table { border-collapse: collapse; table-layout: fixed; zoom: ${zoom.toFixed(3)}; }
th, td { padding: 1px 4px; overflow: hidden; text-overflow: ellipsis; font-weight: normal; }
thead { display: table-header-group; }
tr { page-break-inside: avoid; }
</style></head><body>
<div class="topo"><b>${esc(r.nome)} · ${diaBR(hoje)} · ${filtro}</b><span>${esc(marcaDagua())}</span></div>
<table><colgroup>${r.larguras.map((w) => `<col style="width:${w}px">`).join("")}</colgroup>
<thead>${cab ? tr(cab, "th") : ""}</thead><tbody>${corpo.map((l) => tr(l, "td")).join("")}</tbody></table>
</body></html>`;
}

/** Imprime uma página HTML sem abrir outra janela (iframe escondido). */
export function imprimirHtml(html: string) {
  const f = document.createElement("iframe");
  f.setAttribute("aria-hidden", "true");
  Object.assign(f.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(f);
  const d = f.contentDocument!;
  d.open();
  d.write(html);
  d.close();
  setTimeout(() => {
    f.contentWindow?.focus();
    f.contentWindow?.print();
    setTimeout(() => f.remove(), 60_000);
  }, 250);
}

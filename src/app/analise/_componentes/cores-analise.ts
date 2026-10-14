import { corDoTom } from "@/lib/cores";
import { familiaDe, type Familia } from "@/lib/dominio/familias";
import { fmtHoras } from "@/lib/dominio/formato";
import { statusGauss } from "@/lib/dominio/gauss-dia";

/** Força do tom de cada faixa no mapa (a cor é a da medida; mais forte = mais tempo; uma faixa só fica no meio). */
const OPACIDADE = [0.25, 0.4, 0.55, 0.7, 0.85];
export const opacidadeDaFaixa = (i: number, n: number) => OPACIDADE[n <= 1 ? 2 : Math.round((i * (OPACIDADE.length - 1)) / (n - 1))];
/** O Leaflet desenha em SVG com cor fixa: troca "var(--x)" pelo valor atual do token (tema claro ou escuro). */
export function resolverCor(cor: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(cor);
  return m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#888888" : cor;
}
/** Rótulo de cada faixa a partir dos limites (minutos): "até 2h00", "2h00 a 5h00", ..., "mais de 20h00". */
export function rotulosDasFaixas(limites: number[]): string[] {
  if (!limites.length) return [];
  return [`até ${fmtHoras(limites[0])}`, ...limites.slice(1).map((l, i) => `${fmtHoras(limites[i])} a ${fmtHoras(l)}`), `mais de ${fmtHoras(limites[limites.length - 1])}`];
}
/** Cor de cada status do motor: a mesma da Timeline e do Dia da frota (o tom do GAUSS). */
export const corDoStatus = (cod: string) => corDoTom(statusGauss(cod).tom);

/** Cor fixa de cada família de apontamento (a cor segue a família, nunca a posição no gráfico). */
const COR_FAMILIA: Record<Familia, string> = {
  aguardando: "var(--serie-2)",
  pausas: "var(--serie-3)",
  logistica: "var(--serie-1)",
  preparacao: "var(--serie-4)",
  manutencao: "var(--serie-5)",
  sem: "var(--neu-dot)",
};
export const corDaFamilia = (f: Familia) => COR_FAMILIA[f];
/** O apontamento leva a cor da família dele. */
export const corDoApontamento = (apont: string) => COR_FAMILIA[familiaDe(apont)];
/** Cor do "tempo parado" geral (sem status, família ou bomba escolhidos). */
export const COR_PARADO = "var(--serie-1)";

/** Quanto da cor entra em cada faixa (o resto é o fundo do cartão): mais forte = mais tempo. */
const MISTURA = [22, 40, 60, 80, 100];
const misturaDaFaixa = (i: number, n: number) => MISTURA[n <= 1 ? 2 : Math.round((i * (MISTURA.length - 1)) / (n - 1))];
/** Fundo da faixa i de n na cor da medida (ex.: a grade "Quando para" no ciano da bomba). */
export const fundoDaFaixa = (i: number, n: number, cor: string) => `color-mix(in srgb, ${cor} ${misturaDaFaixa(i, n)}%, var(--superficie))`;
/** Cores claras demais para texto branco, mesmo no tom mais forte. */
const CLARAS = new Set(["var(--warn-dot)", "var(--neu-dot)", "var(--motor2)", "var(--serie-4)"]);
/** Texto legível sobre a faixa: branco nos tons fortes de cor escura; nas cores claras, azul quase preto; nos fracos, o texto normal. */
export const textoDaFaixa = (i: number, n: number, cor: string) => (misturaDaFaixa(i, n) < 60 ? "var(--texto)" : CLARAS.has(cor) ? "#0d1b2a" : "#fff");

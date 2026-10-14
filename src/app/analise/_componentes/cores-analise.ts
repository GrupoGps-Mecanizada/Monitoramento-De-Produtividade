import { corDoTom } from "@/lib/cores";
import { ROTULO_FAMILIA, apontamentosDa, familiaDe, normalizar, type Familia } from "@/lib/dominio/familias";
import { fmtHoras } from "@/lib/dominio/formato";
import { statusGauss } from "@/lib/dominio/gauss-dia";
import { rotuloStatus } from "@/lib/dominio/assuntos";

/** Força do tom de cada faixa no mapa (a cor é a da medida; mais forte = mais tempo; uma faixa só fica no meio). */
const OPACIDADE = [0.25, 0.4, 0.55, 0.7, 0.85];
export const opacidadeDaFaixa = (i: number, n: number) => OPACIDADE[n <= 1 ? 2 : Math.round((i * (OPACIDADE.length - 1)) / (n - 1))];
/** O Leaflet desenha em SVG com cor fixa: troca "var(--x)" pelo valor atual do token (tema claro ou escuro). */
export function resolverCor(cor: string): string {
  // na montagem estática (sem navegador) não há tema para ler
  if (typeof document === "undefined") return "#888888";
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

/** Mistura duas cores hex (t = quanto da segunda entra). */
function misturar(a: string, b: string, t: number): string {
  const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
/** 5 tons sólidos da cor, do bem claro ao escuro (mapa "Quanto parou": transparência sozinha some sobre o satélite). */
export const rampaDaCor = (hex: string) => [misturar(hex, "#ffffff", 0.7), misturar(hex, "#ffffff", 0.45), misturar(hex, "#ffffff", 0.2), hex, misturar(hex, "#000000", 0.3)];

/** Posição da faixa i de n na rampa de 5 tons (uma faixa só fica no meio). */
export const tomDaFaixa = (i: number, n: number) => (n <= 1 ? 2 : Math.round((i * 4) / (n - 1)));

/** Categorias do mapa "O que parou": nome e cor de cada uma (a cor segue a categoria, nunca a posição). */
export interface Categorias {
  ordem: string[];
  nome: (c: string) => string;
  cor: (c: string) => string;
}
const CINZA = "var(--neu-dot)";
/** Status do motor em grupos: as cores da Timeline; "outros" em cinza. */
export const CATEGORIAS_STATUS: Categorias = {
  ordem: ["on", "stopped", "secondary_motor_on", "off", "maintenance", "categorized_stop", "outros"],
  nome: (c) => (c === "outros" ? "Sem dado / outros" : c === "off" ? "Desligado" : rotuloStatus(c)),
  cor: (c) => (c === "outros" ? CINZA : corDoStatus(c)),
};
/** Famílias de apontamento, nas cores fixas delas. */
export const CATEGORIAS_FAMILIA: Categorias = {
  ordem: ["aguardando", "pausas", "logistica", "preparacao", "manutencao", "sem"],
  nome: (c) => ROTULO_FAMILIA[c as Familia] ?? c,
  cor: (c) => COR_FAMILIA[c as Familia] ?? CINZA,
};
const SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)", "var(--serie-5)"];
/** Os apontamentos de uma família: uma cor para cada, pela ordem fixa da tabela; apontamento novo em cinza. */
export function categoriasDaFamilia(f: Familia): Categorias {
  const nomes = apontamentosDa(f);
  const chaves = nomes.map(normalizar);
  return {
    ordem: chaves,
    nome: (c) => nomes[chaves.indexOf(c)] ?? c,
    cor: (c) => SERIES[chaves.indexOf(c)] ?? CINZA,
  };
}

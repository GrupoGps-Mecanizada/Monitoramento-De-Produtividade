import { corDoTom } from "@/lib/cores";
import { familiaDe, type Familia } from "@/lib/dominio/familias";
import { fmtHoras } from "@/lib/dominio/formato";
import { statusGauss } from "@/lib/dominio/gauss-dia";

/** Rampa sequencial azul (validada para daltonismo): claro = pouco, escuro = muito. */
export const RAMPA_AZUL = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#0d366b"];
/** Cor da faixa i de n faixas, espalhada pela rampa (uma faixa só fica no tom do meio). */
const indiceNaRampa = (i: number, n: number) => (n <= 1 ? 2 : Math.round((i * (RAMPA_AZUL.length - 1)) / (n - 1)));
export const corDaFaixa = (i: number, n: number) => RAMPA_AZUL[indiceNaRampa(i, n)];
/** Texto legível sobre a faixa, pela cor real: branco do 3º tom em diante, azul quase preto nos dois mais claros (nos dois temas). */
export const textoSobreFaixa = (i: number, n: number) => (indiceNaRampa(i, n) >= 2 ? "#fff" : "#0d1b2a");
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

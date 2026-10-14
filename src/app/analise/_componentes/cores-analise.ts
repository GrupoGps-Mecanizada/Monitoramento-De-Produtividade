import { fmtHoras } from "@/lib/dominio/formato";

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
/** Destaque das barras por status e os cinzas dos outros status. */
export const COR_DESTAQUE = "#2a78d6";
export const CINZAS = ["#8b95a7", "#b4bcc8"];

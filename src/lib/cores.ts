import type { Tom } from "./tipos";

const VARIAVEL: Record<Tom, string> = {
  ok: "--ok-dot", warn: "--warn-dot", bad: "--bad-dot", na: "--na-dot", neu: "--neu-dot", reg: "--reg-dot", mov: "--serie-1", motor2: "--motor2",
};

/** Cor de destaque de um tom (ponto, borda, marcador no mapa), como variável CSS. */
export const corDoTom = (t: Tom) => `var(${VARIAVEL[t]})`;

/** Fundo + texto do selo de um tom (classes de globals.css). */
export const CLASSE_TOM: Record<Tom, string> = {
  ok: "st-verde", warn: "st-amarelo", bad: "st-vermelho", na: "st-laranja", neu: "st-cinza", reg: "st-cinza-azulado", mov: "st-mov", motor2: "st-motor2",
};

/** O Leaflet desenha as linhas em SVG com cor fixa: lê o valor atual do token (tema claro ou escuro). */
export function corResolvida(t: Tom): string {
  return getComputedStyle(document.documentElement).getPropertyValue(VARIAVEL[t]).trim() || "#888888";
}

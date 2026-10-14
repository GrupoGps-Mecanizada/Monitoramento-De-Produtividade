import { CHAVE_FORA, minutos, type Local, type ParadaNoLocal } from "./analise";
import { familiaDe, normalizar, type Familia } from "./familias";

/** Em que categorias a parada se divide, com os minutos de cada uma. */
export type Categorizar = (p: ParadaNoLocal) => [string, number][];

/** Os status do motor em 6 grupos de cor + "outros" (sem dado, fora da planta, sem apropriação): no máximo 7 cores no mapa. */
export const GRUPOS_STATUS = ["on", "stopped", "secondary_motor_on", "off", "maintenance", "categorized_stop", "outros"] as const;
export const grupoDoStatus = (cod: string): string => (cod === "main_switch_off" ? "off" : (GRUPOS_STATUS as readonly string[]).includes(cod) ? cod : "outros");
/** Status do motor (em grupos) durante a parada. */
export const porStatus: Categorizar = (p) => Object.entries(p.motor).map(([cod, min]) => [grupoDoStatus(cod), min]);
/** Família de apontamento: a parada com 2 famílias conta nas duas; sem apontamento, "sem". */
export const porFamilia: Categorizar = (p) => (p.apont.length ? [...new Set(p.apont.map(familiaDe))].map((f): [string, number] => [f, minutos(p)]) : [["sem", minutos(p)]]);
/** Apontamentos de uma família (pelo nome normalizado; o mesmo na mesma parada conta uma vez). */
export const porApontamentoDa =
  (f: Familia): Categorizar =>
  (p) => [...new Set(p.apont.filter((a) => familiaDe(a) === f).map(normalizar))].map((k): [string, number] => [k, minutos(p)]);

export interface Predominio {
  /** a categoria que mais pesou */
  cat: string;
  /** fatia dela no total do lugar (0 a 1) */
  parte: number;
  total: number;
  /** forte: mais da metade; fraco: 40% ou mais; misto: ninguém chega a 40% */
  nivel: "forte" | "fraco" | "misto";
  /** todas as categorias do lugar, da maior para a menor */
  partes: [string, number][];
}
/** Para cada lugar (os longe da região juntos em "Longe da região"), a categoria que mais pesou e a força dela. */
export function predominioPorLugar(ps: ParadaNoLocal[], locais: Map<string, Local>, categorizar: Categorizar): Map<string, Predominio> {
  const porLugar = new Map<string, Map<string, number>>();
  for (const p of ps) {
    const cats = categorizar(p).filter(([, m]) => m > 0);
    if (!cats.length) continue;
    const lugar = locais.get(p.local)?.naRegiao === false ? CHAVE_FORA : p.local;
    const m = porLugar.get(lugar) ?? new Map<string, number>();
    for (const [c, min] of cats) m.set(c, (m.get(c) ?? 0) + min);
    porLugar.set(lugar, m);
  }
  const out = new Map<string, Predominio>();
  for (const [lugar, m] of porLugar) {
    const partes = [...m].sort((a, b) => b[1] - a[1]);
    const total = partes.reduce((s, [, x]) => s + x, 0);
    const parte = partes[0][1] / total;
    out.set(lugar, { cat: partes[0][0], parte, total, nivel: parte > 0.5 ? "forte" : parte >= 0.4 ? "fraco" : "misto", partes });
  }
  return out;
}

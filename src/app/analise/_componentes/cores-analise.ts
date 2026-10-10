import { fmtHoras } from "@/lib/dominio/formato";
import type { CategoriaLocal, Medida, MedidaNumerica, ResumoLocal } from "@/lib/dominio/analise";

/** Nome de cada medida no filtro e na legenda. */
export const ROTULO_MEDIDA: Record<Medida, string> = {
  produtivo: "Produtivo",
  sem_produzir: "Parado ligado sem produzir",
  parado: "Tempo parado",
  visitas: "Visitas",
  categoria: "Tipo de local",
  apontamento: "Apontamento do tablet",
};
/** 5 faixas do claro ao escuro por medida (a cor nunca vem sozinha: balão, ranking e legenda dão o número). */
export const ESCALAS: Record<MedidaNumerica, string[]> = {
  produtivo: ["#d9f2e3", "#a3dcb9", "#5fbf8a", "#2a9a62", "#0f6b40"],
  sem_produzir: ["#fde5cc", "#fbbd84", "#f48d45", "#d9621c", "#9a3f0c"],
  parado: ["#dbe9f8", "#a9c9ee", "#6ea3df", "#3a78c4", "#1d4f8f"],
  visitas: ["#ece2f7", "#cdb4ec", "#a685d8", "#7b57bb", "#523388"],
};
export const COR_CATEGORIA: Record<CategoriaLocal, string> = {
  "Serviço": "#16a34a",
  "Espera/passagem": "#f59e0b",
  Base: "#475569",
  "Base/pernoite": "#94a3b8",
  "Oficina/apoio": "#8b5cf6",
  Descarte: "#a16207",
  Abastecimento: "#0ea5e9",
};
const PALETA_APONT = ["#2563eb", "#db2777", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626", "#4d7c0f"];
/** Cor fixa por apontamento (o mesmo nome sempre na mesma cor). */
export function corDoApontamento(nome: string): string {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA_APONT[h % PALETA_APONT.length];
}
export const numerica = (m: Medida): m is MedidaNumerica => m !== "categoria" && m !== "apontamento";
/** Valor da medida em texto ("12h 30 produtivo", "8 visitas", "Serviço"). */
export function rotuloValor(r: ResumoLocal, m: Medida): string {
  if (m === "produtivo") return `${fmtHoras(r.produtivo)} produtivo`;
  if (m === "sem_produzir") return `${fmtHoras(r.semProduzir)} parado ligado sem produzir`;
  if (m === "parado") return `${fmtHoras(r.parado)} parado`;
  if (m === "visitas") return `${r.visitas} ${r.visitas === 1 ? "visita" : "visitas"}`;
  if (m === "categoria") return r.local.categoria;
  return r.apont[0] ? `${r.apont[0].nome} (${r.apont[0].n})` : "sem apontamento";
}

/** Séries do resumo (validadas para daltonismo e contraste no tema claro e no escuro). */
export const COR_PRODUTIVO = "#2a9a62";
export const COR_SEM_PRODUZIR = "#d9621c";

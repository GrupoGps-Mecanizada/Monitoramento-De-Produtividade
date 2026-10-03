import { textoEvento, textoPlano } from "./dominio/eventos";
import type { Cerca, Evento, Veiculo } from "./tipos";

/** Sem acento e em maiúsculas. */
export const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
/** Placa também sem hífen e espaço (EGC-2984 = egc2984). */
export const normPlacaBusca = (s: unknown) => norm(s).replace(/[^A-Z0-9]/g, "");

/** 3 = começo da placa (ou da placa do motor 2º), 2 = parte da placa, 1 = vaga/motorista/área/rua/grupo/status, 0 = não casa. */
export function pontuarVeiculo(v: Veiculo, q: string): number {
  const qn = norm(q.trim());
  const qp = normPlacaBusca(q);
  const p = normPlacaBusca(v.placa);
  const p2 = normPlacaBusca(v.motor2?.placa);
  if (qp.length >= 2 && (p.startsWith(qp) || (!!p2 && p2.startsWith(qp)))) return 3;
  if (qp.length >= 2 && (p.includes(qp) || (!!p2 && p2.includes(qp)))) return 2;
  if (qn && norm([v.vaga, v.motorista, v.area, v.via, v.grupo, v.status].join(" ")).includes(qn)) return 1;
  return 0;
}

export interface DadosBusca {
  veiculos: Veiculo[];
  cercas: Cerca[];
  eventos: Evento[];
}

export function ocupacaoPorArea(vs: Veiculo[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of vs) if (v.area) m.set(v.area, (m.get(v.area) ?? 0) + 1);
  return m;
}

/** Busca geral (Ctrl K): veículos, áreas/ruas/cercas e eventos de hoje. */
export function buscar(d: DadosBusca, q: string) {
  const qn = norm(q.trim());
  const ocupacao = ocupacaoPorArea(d.veiculos);
  const veiculos = d.veiculos
    .map((v) => [v, pontuarVeiculo(v, q)] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1] || a[0].placa.localeCompare(b[0].placa))
    .map(([v]) => v);
  const cercas = d.cercas
    .filter((c) => c.polygon.length >= 3 && norm(c.name).includes(qn))
    .sort((a, b) => (ocupacao.get(b.name) ?? 0) - (ocupacao.get(a.name) ?? 0) || a.name.localeCompare(b.name));
  const eventos = d.eventos.filter((e) => norm(`${textoPlano(textoEvento(e))} ${e.area}`).includes(qn)).sort((a, b) => b.t.localeCompare(a.t));
  return { veiculos, cercas, eventos, ocupacao };
}

/** Sem texto: ligados agora (inclusive motor 2º) e as áreas com mais veículos. */
export function sugestoes(d: DadosBusca) {
  const ocupacao = ocupacaoPorArea(d.veiculos);
  const ligados = d.veiculos.filter((v) => v.status_cod === 1 || v.status_cod === 3 || v.motor2?.status_cod === 1);
  const areas = [...ocupacao.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([nome]) => d.cercas.find((c) => c.name === nome))
    .filter((c): c is Cerca => !!c);
  return { ligados, areas, ocupacao };
}

const CHAVE_RECENTES = "mon-buscas";
export function lerRecentes(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CHAVE_RECENTES) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
export function guardarRecente(t: string): void {
  const s = t.trim();
  if (s.length < 2) return;
  try {
    localStorage.setItem(CHAVE_RECENTES, JSON.stringify([s, ...lerRecentes().filter((x) => x !== s)].slice(0, 8)));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
}

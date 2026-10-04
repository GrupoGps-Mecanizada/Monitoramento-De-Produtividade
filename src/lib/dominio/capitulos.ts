// A história do dia na Timeline: os trechos do apontamento (dezenas por dia) viram poucos "capítulos" — paradas
// longas no mesmo lugar — ligados por deslocamentos ("→ 2,8 km até …", "passou por …"). Inspirado na Linha do tempo
// do Google Maps, no Arc Timeline e no Trips History da Geotab (spec 2026-10-04-historia-e-frota-design.md).
import type { EstadoTrecho, Trecho, TrechoMovimento, TrechoParado } from "../tipos";
import { tipoCerca } from "./cercas";
import { segDe } from "./formato";

/** Parada no mesmo lugar com pelo menos isto vira capítulo; menor vira "passou por". */
export const MIN_CAPITULO = 15;

export type TipoLugar = "base" | "servico" | "via";
export type ClasseTempo = "ligado" | "desligado" | "outro";

export interface Deslocamento {
  km: number;
  min: number;
  destino: string;
  passou: string[];
}
export interface Capitulo {
  n: number;
  lugar: string;
  tipoLugar: TipoLugar;
  inicio: string;
  fim: string;
  duracao_min: number;
  ligado_min: number;
  desligado_min: number;
  outro_min: number;
  lat: number | null;
  lng: number | null;
  /** caminho até o capítulo seguinte (null no último) */
  ate: Deslocamento | null;
}
export interface FaixaLugar {
  inicio: string;
  fim: string;
  tipoLugar: TipoLugar;
  lugar: string;
}
export interface FaixaMotor {
  inicio: string;
  fim: string;
  estado: EstadoTrecho;
}
export interface Destaques {
  primeiraSaidaBase: string | null;
  ultimaVoltaBase: string | null;
  areasServico: number;
  maiorParadoLigado: { lugar: string; min: number } | null;
}
export interface HistoriaDia {
  capitulos: Capitulo[];
  faixaLugar: FaixaLugar[];
  faixaMotor: FaixaMotor[];
  destaques: Destaques;
}

const BASE = /P[ÁA]TIO|ESTACIONAMENTO|OFICINA|GARAGEM/i;

export function tipoLugar(nome: string): TipoLugar {
  const n = nome.trim();
  if (!n || /^FORA DE CERCA$/i.test(n) || tipoCerca({ layer: 1, name: n }) === "via") return "via";
  return BASE.test(n) ? "base" : "servico";
}

/**
 * Como o tempo parado conta na barrinha e nos destaques. ÚNICO ponto da regra de "trabalhando": o dono vai definir
 * (03/10/2026) — até lá nada na tela afirma "trabalhou", só ligado/desligado.
 */
export function classeTempo(e: EstadoTrecho): ClasseTempo | null {
  if (e === "parado_ligado") return "ligado";
  if (e === "desligado" || e === "parado") return "desligado";
  if (e === "sem_sinal") return "outro";
  return null;
}

type Item = { tipo: "bloco"; lugar: string; trechos: TrechoParado[] } | { tipo: "mov"; trecho: TrechoMovimento };
type Bloco = Extract<Item, { tipo: "bloco" }>;

const soma = (ts: { duracao_min: number }[]) => ts.reduce((n, t) => n + t.duracao_min, 0);

/** Paradas seguidas no mesmo lugar formam um bloco (o motor pode ligar e desligar no meio). */
function itens(trechos: Trecho[]): Item[] {
  const r: Item[] = [];
  for (const t of trechos) {
    if (t.estado === "movimento") {
      r.push({ tipo: "mov", trecho: t });
      continue;
    }
    const lugar = (t.local ?? "").trim();
    const ult = r.at(-1);
    if (ult?.tipo === "bloco" && ult.lugar === lugar) ult.trechos.push(t);
    else r.push({ tipo: "bloco", lugar, trechos: [t] });
  }
  return r;
}

function capituloDe(b: Bloco, n: number): Capitulo {
  const min = (c: ClasseTempo) => soma(b.trechos.filter((t) => classeTempo(t.estado) === c));
  const comPos = b.trechos.find((t) => t.lat != null && t.lng != null);
  return {
    n,
    lugar: b.lugar || "Fora de área",
    tipoLugar: tipoLugar(b.lugar),
    inicio: b.trechos[0].inicio,
    fim: b.trechos[b.trechos.length - 1].fim,
    duracao_min: soma(b.trechos),
    ligado_min: min("ligado"),
    desligado_min: min("desligado"),
    outro_min: min("outro"),
    lat: comPos?.lat ?? null,
    lng: comPos?.lng ?? null,
    ate: null,
  };
}

function deslocamento(entre: Item[], destino: string): Deslocamento {
  let km = 0;
  let min = 0;
  const passou: string[] = [];
  for (const it of entre) {
    if (it.tipo === "mov") {
      km += it.trecho.km;
      min += it.trecho.duracao_min;
      continue;
    }
    min += soma(it.trechos);
    if (tipoLugar(it.lugar) !== "via" && !passou.includes(it.lugar)) passou.push(it.lugar);
  }
  return { km: Math.round(km * 10) / 10, min: Math.round(min), destino, passou };
}

function faixaLugar(trechos: Trecho[]): FaixaLugar[] {
  const r: FaixaLugar[] = [];
  for (const t of trechos) {
    const nome = t.estado === "movimento" ? "" : (t.local ?? "").trim();
    const tl = t.estado === "movimento" ? "via" : tipoLugar(nome);
    const lugar = tl === "via" ? "" : nome;
    const ult = r.at(-1);
    if (ult && ult.tipoLugar === tl && ult.lugar === lugar) ult.fim = t.fim;
    else r.push({ inicio: t.inicio, fim: t.fim, tipoLugar: tl, lugar });
  }
  return r;
}

function faixaMotor(trechos: Trecho[]): FaixaMotor[] {
  const r: FaixaMotor[] = [];
  for (const t of trechos) {
    const ult = r.at(-1);
    if (ult && ult.estado === t.estado) ult.fim = t.fim;
    else r.push({ inicio: t.inicio, fim: t.fim, estado: t.estado });
  }
  return r;
}

function destaques(cs: Capitulo[]): Destaques {
  const saida = cs.find((c, i) => c.tipoLugar === "base" && i < cs.length - 1 && cs[i + 1].lugar !== c.lugar);
  let volta: Capitulo | null = null;
  for (let i = cs.length - 1; i > 0; i--) {
    if (cs[i].tipoLugar === "base" && cs[i - 1].lugar !== cs[i].lugar) {
      volta = cs[i];
      break;
    }
  }
  const maior = cs.reduce<Capitulo | null>((m, c) => (c.ligado_min > (m?.ligado_min ?? 0) ? c : m), null);
  return {
    primeiraSaidaBase: saida?.fim ?? null,
    ultimaVoltaBase: volta?.inicio ?? null,
    areasServico: new Set(cs.filter((c) => c.tipoLugar === "servico").map((c) => c.lugar)).size,
    maiorParadoLigado: maior && maior.ligado_min >= MIN_CAPITULO ? { lugar: maior.lugar, min: maior.ligado_min } : null,
  };
}

/** Trechos do dia -> capítulos, as duas faixas (onde estava / motor) e os destaques. */
export function montarHistoria(trechos: Trecho[]): HistoriaDia {
  const capitulos: Capitulo[] = [];
  let entre: Item[] = [];
  for (const it of itens(trechos)) {
    if (it.tipo === "bloco" && soma(it.trechos) >= MIN_CAPITULO) {
      const c = capituloDe(it, capitulos.length + 1);
      const ant = capitulos.at(-1);
      if (ant) ant.ate = deslocamento(entre, c.lugar);
      capitulos.push(c);
      entre = [];
    } else entre.push(it);
  }
  return { capitulos, faixaLugar: faixaLugar(trechos), faixaMotor: faixaMotor(trechos), destaques: destaques(capitulos) };
}

/** Segundos do dia de "AAAA-MM-DD HH:MM:SS" (horário local, como os trechos). */
export const segCap = (t: string) => segDe(t.slice(11, 19));

/** Número do capítulo em que o instante s (segundos do dia) cai, ou null (em deslocamento). */
export function capituloEm(caps: Capitulo[], s: number): number | null {
  return caps.find((c) => segCap(c.inicio) <= s && s <= segCap(c.fim))?.n ?? null;
}

/** Primeiro capítulo que começa depois de s (botão "próximo capítulo"). */
export function proximoCapitulo(caps: Capitulo[], s: number): Capitulo | null {
  return caps.find((c) => segCap(c.inicio) > s + 1) ?? null;
}

// Trilhas horizontais da Timeline: a régua mostra uma "janela" do dia em segundos e
// cada bloco vira posição/largura em % dela (spec 2026-10-04-mapa-inteiro-trilhas-design.md).
import type { Trecho } from "../tipos";
import { pad, segDe } from "./formato";

export const DIA = 86400;
const HORA = 3600;
/** [início, fim] em segundos do dia (0–86400). */
export type Janela = readonly [number, number];

/** Janela que cobre os registros, em horas cheias (no mínimo 1 h); sem registros, o dia inteiro. */
export function janelaDosRegistros(primeiro: number | null, ultimo: number | null): Janela {
  if (primeiro == null || ultimo == null) return [0, DIA];
  const a = Math.max(0, Math.floor(Math.min(primeiro, ultimo) / HORA) * HORA);
  const b = Math.min(DIA, Math.max(Math.ceil(Math.max(primeiro, ultimo) / HORA) * HORA, a + HORA));
  return [a, b];
}

/** Janela dos trechos do apontamento ("AAAA-MM-DD HH:MM:SS"); fim no dia seguinte (00:00) = 24 h. */
export function janelaDosTrechos(trechos: Pick<Trecho, "inicio" | "fim">[]): Janela {
  if (!trechos.length) return [0, DIA];
  const ult = trechos[trechos.length - 1];
  return janelaDosRegistros(segDe(trechos[0].inicio.slice(11, 19)), segFim(ult.inicio, ult.fim));
}

/** Fim de um bloco ("AAAA-MM-DD HH:MM:SS") em segundos do dia; terminar no dia seguinte (00:00) = 24 h. */
export const segFim = (inicio: string, fim: string) => (fim.slice(0, 10) > inicio.slice(0, 10) ? DIA : segDe(fim.slice(11, 19)));

/** Posição de um instante na janela, em % (presa entre 0 e 100). */
export const emPct = (s: number, [a, b]: Janela) => Math.min(100, Math.max(0, ((s - a) / (b - a)) * 100));
/** Instante de uma fração (0–1) da largura da janela. */
export const segDaFracao = (f: number, [a, b]: Janela) => a + Math.min(1, Math.max(0, f)) * (b - a);

/** Esquerda e largura (%) de um bloco na janela; null quando fica todo fora. `minSeg` faz bloco curto aparecer. */
export function posBloco(ini: number, fim: number, j: Janela, minSeg = 60): { esq: number; larg: number } | null {
  const f = Math.max(fim, ini + minSeg);
  if (f <= j[0] || ini >= j[1]) return null;
  const esq = emPct(ini, j);
  return { esq, larg: emPct(f, j) - esq };
}

/** Marcas da régua: de 5 em 5 min até 30 min de janela, de 10 em 10 até 1 h, de hora em hora até 8 h, de 2 em 2 até 16 h, depois de 3 em 3. */
export function marcasRegua([a, b]: Janela): number[] {
  const horas = (b - a) / HORA;
  const passo = horas <= 0.5 ? 300 : horas <= 1 ? 600 : (horas <= 8 ? 1 : horas <= 16 ? 2 : 3) * HORA;
  const m: number[] = [];
  for (let s = Math.ceil(a / passo) * passo; s <= b; s += passo) m.push(s);
  return m;
}

/** Rótulo da marca: hora cheia "8h"; o resto "08:05". */
export const rotuloMarca = (s: number) => (s % HORA ? `${pad(Math.floor(s / HORA))}:${pad(Math.floor((s % HORA) / 60))}` : `${s / HORA}h`);

/** "Ampliar o foco": o período com 5% de folga de cada lado, no mínimo 30 min, sem sair do dia. */
export function ampliar([ini, fim]: Janela): Janela {
  const tam = Math.max((fim - ini) * 1.1, 1800);
  let a = (ini + fim) / 2 - tam / 2;
  let b = a + tam;
  if (a < 0) [a, b] = [0, Math.min(DIA, tam)];
  if (b > DIA) [a, b] = [Math.max(0, DIA - tam), DIA];
  return [Math.round(a), Math.round(b)];
}

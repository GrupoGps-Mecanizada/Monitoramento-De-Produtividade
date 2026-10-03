// Reprodução da trajetória: tempo virtual em segundos do dia. A cada quadro avança (tempo real × velocidade),
// acha o ponto do GAUSS daquele instante (busca binária) e interpola até o próximo. Buraco > 10 min entre
// pontos não é interpolado: o caminhão fica parado no último ponto conhecido em vez de "voar" em linha reta.
import { segDe } from "./dominio/formato";
import type { EstadoTrecho, PontoMapa, Trecho } from "./tipos";

export interface PontoPlayer {
  lat: number;
  lng: number;
  /** segundos do dia */
  s: number;
  vel: number;
  estado: EstadoTrecho;
  m2: 0 | 1 | null;
}

export const VELOCIDADES: [number, string][] = [[10, "10x"], [30, "30x"], [60, "1 min/s"], [120, "2 min/s"], [300, "5 min/s"], [900, "15 min/s"]];
const BURACO_S = 600;

export const prepararPontos = (pontos: PontoMapa[]): PontoPlayer[] => pontos.map((p) => ({ lat: p[0], lng: p[1], s: segDe(p[2]), vel: p[3], estado: p[4], m2: p[5] }));

/** Índice do último ponto com horário <= s. */
export function indiceEm(pts: PontoPlayer[], s: number): number {
  if (s <= pts[0].s) return 0;
  let lo = 0;
  let hi = pts.length - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (pts[m].s <= s) lo = m;
    else hi = m - 1;
  }
  return lo;
}

/** Rumo em graus (0 = norte, 90 = leste); null se praticamente não se moveu. */
export function rumoEntre(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number | null {
  const dy = b.lat - a.lat;
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  if (Math.abs(dy) + Math.abs(dx) < 2e-6) return null;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

/** Posição no instante s (com o rumo anterior mantido quando parado). */
export function posicaoEm(pts: PontoPlayer[], s: number, rumoAnterior: number) {
  const i = indiceEm(pts, s);
  const a = pts[i];
  const b = pts[i + 1];
  let lat = a.lat;
  let lng = a.lng;
  let rumo = rumoAnterior;
  if (b && b.s - a.s <= BURACO_S && s > a.s) {
    const f = Math.min(1, (s - a.s) / (b.s - a.s));
    lat = a.lat + (b.lat - a.lat) * f;
    lng = a.lng + (b.lng - a.lng) * f;
  }
  if (b && b.s - a.s <= BURACO_S) {
    const r = rumoEntre(a, b);
    if (r != null) rumo = r;
  }
  return { i, lat, lng, rumo, p: a };
}

/** Avança o relógio virtual (no máximo 0,25 s de tempo real por quadro); paradas 20x mais rápido se pedido. */
export function avancar(t: number, dtSeg: number, velocidade: number, parado: boolean, acelerarParadas: boolean, fim: number): number {
  return Math.min(fim, t + Math.min(0.25, dtSeg) * velocidade * (acelerarParadas && parado ? 20 : 1));
}

/** ⏮/⏭: início do deslocamento anterior/seguinte (sem assistir parada longa). */
export function deslocamentoVizinho(trechos: Trecho[], agora: number, direcao: 1 | -1): number | null {
  const inicios = trechos.filter((t) => t.estado === "movimento").map((t) => segDe(t.inicio.slice(11, 19)));
  const alvo = direcao > 0 ? inicios.find((s) => s > agora + 1) : [...inicios].reverse().find((s) => s < agora - 2);
  return alvo ?? null;
}

/** Índice do trecho em que o instante s cai (-1 fora do dia). */
export const trechoEm = (trechos: Trecho[], s: number) => trechos.findIndex((t) => s >= segDe(t.inicio.slice(11, 19)) && s < segDe(t.fim.slice(11, 19)));

/** Posição de 0 a 1 do instante t entre t0 e t1 (cursor da linha do tempo). */
export const fracao = (t: number, t0: number, t1: number) => (t - t0) / Math.max(t1 - t0, 1);

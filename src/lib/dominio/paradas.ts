// Paradas para a Análise (tabela analise_paradas), feitas pelo coletor: em tempo real a partir das posições de cada
// ciclo e, de madrugada, exatas a partir da rota completa; e os excessos de velocidade dentro da usina.
// Puro e sem pacotes externos (o coletor importa daqui). Desenho: docs/superpowers/specs/2026-10-08-puxador-tempo-real-design.md
import type { Cerca, LatLng, PontoRota } from "../tipos";
import type { ParadaAnalise } from "./analise";
import { segDe } from "./formato";
import { montarStatusGauss, segNoDia, type LinhaMotorGauss } from "./gauss-dia";
import { cercasNoPonto, dentroDoPoligono, distanciaM } from "./geo";
import { VELOCIDADE_MAX_USINA } from "./regras-frota";

/** Parada antes de saber onde e com qual motor: segundos do dia e posição. */
export interface ParadaBruta {
  ini: number;
  fim: number;
  lat: number;
  lng: number;
}
export interface Excesso {
  ini: number;
  fim: number;
  vel_max: number;
  lat: number;
  lng: number;
}

const VEL_PARADO = 5; // km/h: abaixo disso é parado (o GPS oscila 1-4 km/h parado)
const MIN_PARADA_S = 3 * 60;
const BURACO_S = 10 * 60; // sem ponto por mais que isso: corta a parada
const RAIO_POSICAO_M = 80; // tempo real: posições a menos disso da 1ª leitura são o mesmo lugar
const MIN_LEITURAS = 2;

const mediana = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

/** Paradas da rota completa: abaixo de 5 km/h por 3 min ou mais (a mesma regra do classificar.js). */
export function paradasDaRota(pontos: PontoRota[]): ParadaBruta[] {
  const out: ParadaBruta[] = [];
  let atual: { ini: number; fim: number; lats: number[]; lngs: number[] } | null = null;
  const fechar = () => {
    if (atual && atual.fim - atual.ini >= MIN_PARADA_S) out.push({ ini: atual.ini, fim: atual.fim, lat: mediana(atual.lats), lng: mediana(atual.lngs) });
    atual = null;
  };
  for (const p of pontos) {
    if (!p.lat || !p.lng) continue;
    const s = segDe(p.t.slice(11, 19));
    if (p.vel < VEL_PARADO) {
      if (atual && s - atual.fim > BURACO_S) fechar();
      atual ??= { ini: s, fim: s, lats: [], lngs: [] };
      atual.fim = s;
      atual.lats.push(p.lat);
      atual.lngs.push(p.lng);
    } else fechar();
  }
  fechar();
  return out;
}

/** Paradas das posições de cada ciclo (~5 min): leituras seguidas a menos de 80 m da 1ª leitura do lugar, 2 ou mais. */
export function paradasDasPosicoes(posicoes: { t: number; lat: number; lng: number }[]): ParadaBruta[] {
  const out: ParadaBruta[] = [];
  let grupo: { t: number; lat: number; lng: number }[] = [];
  const fechar = () => {
    if (grupo.length >= MIN_LEITURAS) out.push({ ini: grupo[0].t, fim: grupo[grupo.length - 1].t, lat: mediana(grupo.map((g) => g.lat)), lng: mediana(grupo.map((g) => g.lng)) });
    grupo = [];
  };
  for (const p of [...posicoes].sort((a, b) => a.t - b.t)) {
    if (grupo.length && distanciaM(grupo[0], p) > RAIO_POSICAO_M) fechar();
    grupo.push(p);
  }
  fechar();
  return out;
}

/** O que a parada precisa para virar linha de analise_paradas. */
export interface ContextoDia {
  dia: string;
  /** cercas do tipo área */
  areas: Cerca[];
  /** timeline de motor do GAUSS do veículo no dia */
  motor: LinhaMotorGauss[];
  /** apontamentos do tablet do veículo no dia */
  tablet: { inicio: string; fim: string | null; categoria_demora: string }[];
  /** onde termina um apontamento ainda aberto (agora, ou o fim do dia) */
  fimDia: number;
}

/** Uma linha de analise_paradas por parada: a menor cerca, minutos de cada status do motor e os apontamentos. */
export function enriquecerParadas(paradas: ParadaBruta[], veiculo: { id: string; placa: string }, ctx: ContextoDia): ParadaAnalise[] {
  const blocos = montarStatusGauss(ctx.motor, ctx.dia);
  const ap = ctx.tablet.map((t) => ({ a: segNoDia(t.inicio, ctx.dia), b: t.fim ? segNoDia(t.fim, ctx.dia) : ctx.fimDia, c: t.categoria_demora.trim() }));
  return paradas.map((p) => {
    const seg: Record<string, number> = {};
    for (const b of blocos) {
      const x = Math.min(b.b, p.fim) - Math.max(b.a, p.ini);
      if (x > 0) seg[b.cod] = (seg[b.cod] ?? 0) + x;
    }
    const motor = Object.fromEntries(Object.entries(seg).map(([k, s]) => [k, Math.round((s / 60) * 10) / 10]));
    return {
      dia: ctx.dia,
      veiculo_id: veiculo.id,
      placa: veiculo.placa,
      ini: Math.round(p.ini),
      fim: Math.round(p.fim),
      lat: p.lat,
      lng: p.lng,
      area: cercasNoPonto(p.lat, p.lng, ctx.areas)[0]?.name ?? null,
      motor,
      apont: [...new Set(ap.filter((x) => x.a < p.fim && x.b > p.ini).map((x) => x.c))],
    };
  });
}

/**
 * Excessos de velocidade dentro da usina: 2 ou mais pontos seguidos acima do limite viram um excesso (posição = o
 * pico). Um ponto sozinho é tratado como pulo do GPS.
 */
export function excessosDaRota(pontos: PontoRota[], usina: LatLng[] | null, limite = VELOCIDADE_MAX_USINA): Excesso[] {
  if (!usina) return [];
  const out: Excesso[] = [];
  let atual: Excesso | null = null;
  let n = 0;
  const fechar = () => {
    if (atual && n >= 2) out.push(atual);
    atual = null;
    n = 0;
  };
  for (const p of pontos) {
    const s = segDe(p.t.slice(11, 19));
    if (p.vel > limite && dentroDoPoligono(p.lat, p.lng, usina)) {
      n++;
      if (!atual) atual = { ini: s, fim: s, vel_max: p.vel, lat: p.lat, lng: p.lng };
      else {
        atual.fim = s;
        if (p.vel > atual.vel_max) Object.assign(atual, { vel_max: p.vel, lat: p.lat, lng: p.lng });
      }
    } else fechar();
  }
  fechar();
  return out;
}

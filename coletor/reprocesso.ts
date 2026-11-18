// Reprocessamento (pedido do dono, 15/10/2026): refaz os dias de `de` a `ate` depois da correção do caminhão de cada
// trecho da timeline de motor. Liga com a linha "reprocesso" no loc_kv (supabase/2026-10-15_timeline-por-vaga.sql).
//
// Aos poucos, para não pesar no GAUSS (é o mesmo usuário consultando, como uma pessoa faria):
//   1. timeline: todas as vagas da GPS, um dia por vez do mais novo para o mais velho, no máximo VAGAS_POR_CICLO
//      requisições por ciclo (na fila serial do gauss.ts);
//   2. tablet: apontamentos do dia inteiro, TABLET_POR_CICLO dias por ciclo (uma requisição por dia);
//   3. paradas da Análise: recalculadas com o motor e o tablet corretos (só Supabase), PARADAS_POR_CICLO dias por ciclo.
// Vaga que falha 3 vezes num dia é pulada e fica anotada em "falhas" (para conferir depois).
import type { Cerca, Veiculo } from "../src/lib/tipos";
import type { GaussFleetClient } from "./gauss";
import { daGps, diaAnterior, listaDeVagas, refazerDiaDaVaga, refazerTabletDoDia, type Vaga } from "./motor-vaga";
import { kvGet, kvSet } from "./supabase";
import { refazerParadasDoDia } from "./tempo-real";

export const VAGAS_POR_CICLO = 12;
const TABLET_POR_CICLO = 3;
const PARADAS_POR_CICLO = 3;
const MAX_TENTATIVAS = 3;

export type Fase = "timeline" | "tablet" | "paradas" | "pronto";
export interface Reprocesso {
  de: string;
  ate: string;
  fase?: Fase;
  /** dia em andamento na fase */
  dia?: string;
  /** vagas já refeitas no dia em andamento (fase timeline) */
  feitas?: number[];
  tentativas?: Record<string, number>;
  /** "dia|vaga" que falharam MAX_TENTATIVAS vezes */
  falhas?: string[];
  trechos?: number;
  apontamentos?: number;
  paradas?: number;
  iniciado_em?: string;
  terminado_em?: string;
}

/** As próximas vagas do dia em andamento (na ordem da lista), sem as já feitas e as que esgotaram as tentativas. */
export function proximasVagas(r: Reprocesso, vagas: Vaga[], limite = VAGAS_POR_CICLO): Vaga[] {
  const feitas = new Set(r.feitas ?? []);
  const falhas = new Set(r.falhas ?? []);
  return vagas.filter((v) => daGps(v) && !feitas.has(v.id) && !falhas.has(`${r.dia}|${v.id}`)).slice(0, limite);
}

/** Dias da fase a partir do em andamento, do mais novo para o mais velho, sem passar de `de`. */
export function diasDaVez(r: Reprocesso, n: number): string[] {
  const out: string[] = [];
  for (let d = r.dia ?? r.ate; d >= r.de && out.length < n; d = diaAnterior(d)) out.push(d);
  return out;
}

const seguinte: Record<Exclude<Fase, "pronto">, Fase> = {
  timeline: "tablet",
  tablet: "paradas",
  paradas: "pronto",
};

/** Depois de terminar `dia` na fase: o próximo dia, ou a próxima fase (que recomeça em `ate`). */
export function avancar(r: Reprocesso, dia: string): Reprocesso {
  const fase = r.fase ?? "timeline";
  const ant = diaAnterior(dia);
  if (fase !== "pronto" && ant >= r.de) return { ...r, dia: ant, feitas: [] };
  return {
    ...r,
    fase: fase === "pronto" ? "pronto" : seguinte[fase],
    dia: r.ate,
    feitas: [],
  };
}

/** Um ciclo do reprocessamento. null = nada a fazer (sem pedido ou já pronto). */
export async function reprocessar(client: GaussFleetClient, frota: Veiculo[], cercas: Cerca[], agora: Date): Promise<string | null> {
  let r = await kvGet<Reprocesso>("reprocesso");
  if (!r?.de || !r.ate || r.fase === "pronto") return null;
  r = {
    fase: "timeline",
    dia: r.ate,
    feitas: [],
    tentativas: {},
    falhas: [],
    trechos: 0,
    apontamentos: 0,
    paradas: 0,
    iniciado_em: agora.toISOString(),
    ...r,
  };
  const fase = r.fase!;
  let feito = "";
  if (fase === "timeline") {
    const vagas = await listaDeVagas(client, agora);
    const dia = r.dia!;
    const vez = proximasVagas(r, vagas);
    for (const vaga of vez) {
      const chave = `${dia}|${vaga.id}`;
      try {
        r.trechos! += (await refazerDiaDaVaga(client, vaga, vagas, dia)).linhas;
        r.feitas = [...(r.feitas ?? []), vaga.id];
      } catch (e) {
        const n = (r.tentativas![chave] ?? 0) + 1;
        r.tentativas![chave] = n;
        if (n >= MAX_TENTATIVAS) r.falhas = [...(r.falhas ?? []), chave];
        console.warn(`⚠ reprocesso ${chave} (tentativa ${n}): ${e instanceof Error ? e.message : String(e)}`);
      }
      await kvSet("reprocesso", r);
    }
    feito = `timeline ${dia}: ${vez.length} vaga(s)`;
    if (!proximasVagas(r, vagas).length) r = avancar(r, dia);
  } else if (fase === "tablet" || fase === "paradas") {
    const dias = diasDaVez(r, fase === "tablet" ? TABLET_POR_CICLO : PARADAS_POR_CICLO);
    for (const dia of dias) {
      const chave = `${fase}|${dia}`;
      try {
        if (fase === "tablet") r.apontamentos! += await refazerTabletDoDia(client, frota, dia);
        else r.paradas! += await refazerParadasDoDia(frota, cercas, dia);
      } catch (e) {
        const n = (r.tentativas![chave] ?? 0) + 1;
        r.tentativas![chave] = n;
        console.warn(`⚠ reprocesso ${chave} (tentativa ${n}): ${e instanceof Error ? e.message : String(e)}`);
        // tenta de novo no próximo ciclo; na 3ª falha, anota e segue para o dia seguinte
        if (n < MAX_TENTATIVAS) break;
        r.falhas = [...(r.falhas ?? []), chave];
      }
      r = avancar(r, dia);
      await kvSet("reprocesso", r);
    }
    feito = `${fase} ${dias.join(", ")}`;
  }
  if (r.fase === "pronto") r.terminado_em = agora.toISOString();
  await kvSet("reprocesso", r);
  return `${feito} → ${r.fase === "pronto" ? "pronto" : `${r.fase} ${r.dia}`} (${r.trechos} trechos, ${r.apontamentos} apontamentos, ${r.paradas} paradas${r.falhas?.length ? `, ${r.falhas.length} falha(s)` : ""})`;
}

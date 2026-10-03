// Rota de um veículo num dia (um ponto a cada ~30 s com velocidade e RPM). O cache fica no Supabase
// (loc_historico) e é o run.ts quem lê/grava; o apontamento sai de src/lib/dominio/apontamento.ts.
import { paraData } from "../src/lib/dominio/apontamento";
import { diaLocal } from "../src/lib/dominio/formato";
import type { PontoRota } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";

export const HOJE_TTL_MS = 5 * 60 * 1000;
const MAX_PAGINAS = 6;
// o rastreador pode descarregar dados atrasados - só considera o dia "fechado" depois disso
const FECHAR_DIA_APOS_MS = 2 * 60 * 60 * 1000;

interface RespostaRota {
  error?: boolean;
  no_data?: boolean;
  board_data?: { datetime: string; location?: { lat: string | number; lng: string | number }; speed_?: string | number; rpm?: string | number }[];
  filter?: Record<string, string>;
}

/** Busca no GAUSS os pontos do veículo no dia a partir de horaInicio (HH:MM). */
export async function baixarRota(client: GaussFleetClient, id: string, dia: string, horaInicio: string): Promise<PontoRota[]> {
  const hoje = dia === diaLocal();
  const fimJanela = hoje ? new Date(Date.now() - 2 * 60000) : paraData(`${dia} 23:58:00`);
  let filtro: Campo[] = [
    ["action", "latlong"], ["vehicle", id],
    ["start_day", dia], ["start_hour", horaInicio],
    ["end_day", dia], ["end_hour", "23:59"],
  ];
  const pontos: PontoRota[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const r = await client.post<RespostaRota>("/data/vehicle/routes/", filtro);
    if (r.error || r.no_data || !r.board_data?.length) break;
    for (const p of r.board_data) {
      pontos.push({ t: p.datetime, lat: Number(p.location?.lat), lng: Number(p.location?.lng), vel: Number(p.speed_) || 0, rpm: Number(p.rpm) || 0 });
    }
    // o GAUSS pagina devolvendo o filtro da próxima página (como o maps.js faz); se o último ponto já cobre a
    // janela, não gasta uma requisição à toa
    const control = r.filter?.control;
    if (!control || paraData(control) >= fimJanela) break;
    filtro = Object.entries(r.filter ?? {});
  }
  return pontos;
}

/** Junta pontos já guardados com os novos (sem duplicar) e ordena por horário. */
export function mesclarPontos(anteriores: PontoRota[], novos: PontoRota[]): PontoRota[] {
  const porHora = new Map(anteriores.map((p) => [p.t, p]));
  for (const p of novos) porHora.set(p.t, p);
  return [...porHora.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export const diaFechado = (dia: string, agora = Date.now()) => agora - paraData(`${dia} 23:59:59`).getTime() > FECHAR_DIA_APOS_MS;

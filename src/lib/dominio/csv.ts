import type { Historico } from "../tipos";
import { ESTADOS_TRECHO } from "./veiculo";

/** Apontamento em CSV (Excel em português: separador ";"). Mesmo arquivo na Localização e na Timeline. */
export function csvApontamento(h: Pick<Historico, "dia" | "trechos">, placa: string): string {
  const cab = ["placa", "dia", "inicio", "fim", "duracao_min", "situacao", "local_ou_percurso", "km", "vel_max", "motor2_ligado_min"];
  const linhas = h.trechos.map((t) => [
    placa, h.dia, t.inicio.slice(11, 19), t.fim.slice(11, 19), t.duracao_min, ESTADOS_TRECHO[t.estado].rotulo,
    t.estado === "movimento" ? t.percurso.join(" > ") : t.local,
    t.estado === "movimento" ? t.km : "", t.estado === "movimento" ? t.vel_max : "", t.motor2_min ?? "",
  ]);
  return [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}

export const nomeCsv = (placa: string, dia: string) => `apontamento-${placa}-${dia}.csv`;

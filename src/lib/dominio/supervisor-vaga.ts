// Supervisor pela VAGA do GAUSS, nunca pela placa: os caminhões rodam entre as vagas (regra do dono, 15/10/2026).
// Tabela oficial no segundo cérebro: "Regimes, turnos e supervisores" (14/10/2026).
//   24 h (AP/AV 01 e 08): o supervisor da letra do 4x4 no horário · 16 h (AP/AV 07): sem supervisor
//   Junior Pereira: AP 02–06, 09, 10 · Donizete: AV 02–06, Hipervácuo 01 e 02 · Genésio: aspiradores, Brooks, Hipervácuo 03 e 04
import type { TipoEquip } from "../tipos";
import { letraDaEscala, SUPERVISOR_DA_LETRA } from "./filtros-crono";

const H = 3600;
/** Turnos do 4x4: dia 06:40–18:40; antes das 06:40 ainda é a noite que começou no dia anterior. */
const INICIO_DIA = 6 * H + 40 * 60;
const INICIO_NOITE = 18 * H + 40 * 60;

const diaAnterior = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** Supervisor do 4x4 no momento: `seg` = segundos desde 00:00 de `dia`. */
export function supervisorDoTurno(dia: string, seg: number): string | null {
  const letra = seg < INICIO_DIA ? letraDaEscala(diaAnterior(dia), "noite") : letraDaEscala(dia, seg < INICIO_NOITE ? "dia" : "noite");
  return SUPERVISOR_DA_LETRA[letra] ?? null;
}

/** "ALTA PRESSÃO - GPS - 08 - 24 HS" → { tipo: "ap", num: 8 }; vaga sem número → null. */
export function lerVaga(nome: string): { tipo: TipoEquip | null; num: number } | null {
  const num = /GPS\s*-\s*(\d{1,2})(?!\d)/i.exec(nome)?.[1];
  if (!num) return null;
  const n = nome.toUpperCase();
  const tipo: TipoEquip | null = n.startsWith("ALTA PRESS") ? "ap" : /^(AUTO|ALTO) V/.test(n) ? "av" : n.startsWith("HIPER") ? "hv" : null;
  return { tipo, num: Number(num) };
}

/** Supervisor de quem estava na vaga `vaga` em `dia`, `seg` segundos depois da meia-noite; null = a vaga não tem supervisor. */
export function supervisorDaVaga(vaga: string, dia: string, seg: number): string | null {
  if (/ASPIRADOR|BROOK|POLIGUINDASTE/i.test(vaga)) return "Genésio";
  const v = lerVaga(vaga);
  if (!v || !v.tipo) return null;
  const { tipo, num } = v;
  if (/24\s*HS/i.test(vaga) || ((tipo === "ap" || tipo === "av") && (num === 1 || num === 8))) return supervisorDoTurno(dia, seg);
  if (/16\s*HS/i.test(vaga) || num === 7) return null;
  if (tipo === "ap" && [2, 3, 4, 5, 6, 9, 10].includes(num)) return "Junior Pereira";
  if (tipo === "av" && num >= 2 && num <= 6) return "Donizete";
  if (tipo === "hv") return num <= 2 ? "Donizete" : num <= 4 ? "Genésio" : null;
  return null;
}

/**
 * Supervisor de uma parada: aspirador e Brook são do Genésio; caminhão, pela vaga em que estava no dia; sem vaga
 * conhecida (dia sem timeline), fica o da matriz.
 */
export function supervisorDaParada(tipo: TipoEquip, vaga: string | undefined, dia: string, seg: number, daMatriz: string | null): string | null {
  if (tipo === "as" || tipo === "pg") return "Genésio";
  return vaga ? supervisorDaVaga(vaga, dia, seg) : daMatriz;
}

/** Linha da view vaga_do_dia: quanto tempo cada veículo passou em cada vaga num dia. */
export interface VagaDoDia {
  dia: string;
  veiculo_id: string;
  vaga_nome: string;
  minutos: number;
}
/** "dia|veículo" → a vaga em que ele passou mais tempo naquele dia. */
export function mapaVagaDoDia(linhas: VagaDoDia[]): Map<string, string> {
  const melhor = new Map<string, VagaDoDia>();
  for (const l of linhas) {
    const k = `${l.dia}|${l.veiculo_id}`;
    const atual = melhor.get(k);
    if (!atual || l.minutos > atual.minutos) melhor.set(k, l);
  }
  return new Map([...melhor].map(([k, l]) => [k, l.vaga_nome]));
}

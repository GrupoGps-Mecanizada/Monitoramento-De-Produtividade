import type { TurnoCrono } from "./cronoanalise";

// Regra oficial da Mecanizada (segundo cérebro: "Regimes, turnos e supervisores", 14/10/2026):
// 4x4 com 2 dias + 2 noites + 4 folgas; 13/10/2026 é o 1º dia da letra A no turno do dia.
const REFERENCIA = Date.UTC(2026, 9, 13);
const LETRA_DIA = ["A", "D", "B", "C"];
const LETRA_NOITE = ["C", "A", "D", "B"];
/** Supervisor de cada letra do 4x4. */
export const SUPERVISOR_DA_LETRA: Record<string, string> = { A: "Ozias", B: "Matusalem", C: "Israel", D: "Fabio" };

/** Letra que trabalha naquela data e período pela escala (a noite pertence ao dia em que começou). */
export function letraDaEscala(data: string, periodo: "dia" | "noite"): string {
  const [a, m, d] = data.split("-").map(Number);
  const dias = Math.round((Date.UTC(a, m - 1, d) - REFERENCIA) / 86400000);
  const bloco = (((Math.floor(dias / 2) % 4) + 4) % 4);
  return (periodo === "dia" ? LETRA_DIA : LETRA_NOITE)[bloco];
}

const semLetra = (l: string) => !l || l === "?";
/** Preenche o que a folha não trouxe: a letra pela escala e o supervisor pela letra. O que foi lançado não muda. */
export function completarTurno(t: TurnoCrono): TurnoCrono {
  const letra = semLetra(t.letra) ? letraDaEscala(t.data, t.periodo) : t.letra;
  return { ...t, letra, supervisor: t.supervisor ?? SUPERVISOR_DA_LETRA[letra] ?? null };
}

export type TipoCrono = "AP" | "AV" | "HV" | "AS";
const TIPO_DO_EQUIP: Record<string, TipoCrono> = { "alta pressão": "AP", vácuo: "AV", "hiper vácuo": "HV", "aspirador de pó": "AS" };
/** Tipo do equipamento: pelo começo da vaga (AP-01, AV 03...) ou, sem vaga, pelo equipamento da folha. */
export function tipoDoTurno(t: TurnoCrono): TipoCrono | null {
  const pela = /^(AP|AV|HV|AS)\b/i.exec((t.vaga ?? "").trim());
  if (pela) return pela[1].toUpperCase() as TipoCrono;
  return t.equip ? (TIPO_DO_EQUIP[t.equip.trim().toLowerCase()] ?? null) : null;
}

/** Filtros da Cronoanálise (null = todas). */
export interface FiltroCrono {
  data: string | null;
  letra: string | null;
  periodo: "dia" | "noite" | null;
  vaga: string | null;
  tipo: TipoCrono | null;
  supervisor: string | null;
}
export const FILTRO_CRONO_VAZIO: FiltroCrono = { data: null, letra: null, periodo: null, vaga: null, tipo: null, supervisor: null };
type Campo = keyof FiltroCrono;
const valorDe = (t: TurnoCrono, c: Campo): string | null => (c === "tipo" ? tipoDoTurno(t) : (t[c] ?? null));

/** Turnos que passam em todos os filtros escolhidos. */
export const filtrarTurnos = (turnos: TurnoCrono[], f: FiltroCrono) =>
  turnos.filter((t) => (Object.keys(f) as Campo[]).every((c) => f[c] == null || valorDe(t, c) === f[c]));

/** Opções de um filtro: os valores que existem com os outros filtros escolhidos (datas da mais recente para a mais antiga). */
export function opcoesDoFiltro(turnos: TurnoCrono[], f: FiltroCrono, campo: Campo): string[] {
  const valores = new Set(filtrarTurnos(turnos, { ...f, [campo]: null }).flatMap((t) => valorDe(t, campo) ?? []));
  const lista = [...valores];
  return campo === "data" ? lista.sort((a, b) => b.localeCompare(a)) : lista.sort((a, b) => a.localeCompare(b));
}

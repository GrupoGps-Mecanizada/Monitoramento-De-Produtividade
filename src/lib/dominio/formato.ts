/** Formatação de datas, horas e durações (horário local da usina: America/Sao_Paulo). */

export const pad = (n: number) => String(n).padStart(2, "0");
export const diaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const diaBR = (dia: string) => dia.split("-").reverse().join("/");
export const hora = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—");
export const horaSeg = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("pt-BR") : "—");
export const dataHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const minutosDesde = (iso: string, agora = Date.now()) => (agora - new Date(iso).getTime()) / 60000;

/** 45 min · 1h05 · 2d 3h */
export function fmtMin(min: number | null | undefined): string {
  if (min == null || Number.isNaN(min)) return "—";
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)}h${pad(m % 60)}`;
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`;
}

/** Idade curta de uma posição: 40s · 12m · 3h · 2d */
export function idadeCurta(iso: string | null | undefined, agora = Date.now()): string {
  if (!iso) return "?";
  const s = Math.max(0, (agora - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** "HH:MM[:SS]" → segundos do dia */
export function segDe(hms: string): number {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}
/** segundos do dia → "HH:MM:SS" */
export const fmtHora = (s: number) => `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
/** "AAAA-MM-DD HH:MM:SS" (horário do GAUSS) → "HH:MM" */
export const hhmm = (t: string) => t.slice(11, 16);

/** Últimos n dias, de hoje para trás (seletores de dia). */
export function ultimosDias(n: number, agora = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => diaLocal(new Date(agora.getTime() - i * 86400000)));
}
export function rotuloDia(dia: string, hoje = diaLocal()): string {
  if (dia === hoje) return "Hoje";
  const ontem = diaLocal(new Date(new Date(`${hoje}T12:00:00`).getTime() - 86400000));
  return dia === ontem ? "Ontem" : diaBR(dia);
}

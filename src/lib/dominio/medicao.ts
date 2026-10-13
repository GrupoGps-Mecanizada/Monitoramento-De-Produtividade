// Medição do GAUSS, Fase 1 (boletim oficial): converte o boletim nas linhas das tabelas medicao_* e faz as contas da
// aba Disponibilidade. Puro (sem rede): roda no coletor e na página.
// Desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md · plano: docs/superpowers/plans/2026-10-13-medicao-oficial.md
import { diaLocal, fmtHoras } from "./formato";

/** Uma linha da lista do Dashboard Medição (o GAUSS manda mais campos; só estes são usados). */
export interface LinhaListaBoletim {
  cod: string;
  identification: string;
  initial_date: string;
  final_date: string;
  [campo: string]: unknown;
}
export interface Boletim {
  cod: string;
  identificacao: string;
  inicio: string;
  fim: string;
}

/** Os motivos de indisponibilidade, na ordem em que o tipo do evento é conferido (o último pega o que sobrar). */
export const MOTIVOS = [
  { chave: "ausencia_operador", nome: "Ausência de operador", padrao: /aus[eê]ncia/i },
  { chave: "area_manutencao", nome: "Área de manutenção", padrao: /manuten/i },
  { chave: "fora_planta", nome: "Fora da planta / chave geral", padrao: /fora da planta|chave geral/i },
  { chave: "trajeto", nome: "Trajeto / movimentação", padrao: /moviment|trajeto/i },
  { chave: "cartao_rfid", nome: "Cartão RFID", padrao: /rfid|cart[aã]o/i },
  { chave: "lancada", nome: "Indisponibilidade lançada", padrao: /lan[cç]ad/i },
  { chave: "motor_desligado", nome: "Motor desligado", padrao: /desligad/i },
  { chave: "parado_ligado", nome: "Parado ligado", padrao: /parado ligado/i },
  { chave: "outros", nome: "Outros", padrao: /[\s\S]*/ },
] as const;
export type Motivo = (typeof MOTIVOS)[number]["chave"];
export type HorasPorMotivo = Record<Motivo, number>;

export interface VagaBoletim extends HorasPorMotivo {
  boletim_cod: string;
  vaga_id: number;
  vaga: string;
  regime: string | null;
  horas_regime: number;
  horas_indisp: number;
  df: number;
}
export interface EventoIndisp {
  boletim_cod: string;
  vaga_id: number;
  placa: string;
  inicio: string;
  fim: string;
  tipo: string;
  horas: number;
}
export interface VagaDia {
  boletim_cod: string;
  vaga_id: number;
  dia: string;
  placas: string;
  horas_regime: number;
  horas_indisp: number;
}
export interface BoletimLido {
  boletim: Boletim;
  vagas: VagaBoletim[];
  eventos: EventoIndisp[];
  dias: VagaDia[];
}
/** Trecho da timeline de motor (timeline_motor_vaga). */
export interface TrechoMotor {
  inicio: string;
  fim: string;
  status: string;
}

/** "551:37", "23:55:00", "95,66", "0.25" ou número -> horas (número). Vazio ou ilegível = 0. */
export function horasDe(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  if (s.includes(":")) {
    const [h, m = 0, seg = 0] = s.split(":").map(Number);
    const r = h + m / 60 + seg / 3600;
    return Number.isFinite(r) ? r : 0;
  }
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export const motivoDe = (tipo: string): Motivo => MOTIVOS.find((m) => m.padrao.test(tipo))!.chave;

const texto = (v: unknown) => (v == null ? "" : String(v).trim());
/** "16/09/2026" -> "2026-09-16" */
function diaIso(br: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(br.trim());
  if (!m) throw new Error(`data fora do formato dd/mm/aaaa: ${br}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// o GAUSS fala na hora de Ipatinga (sem horário de verão desde 2019)
const FUSO = "-03:00";
/** "2026-09-16 06:55" ou "2026-09-16 07:00:00" -> "2026-09-16T06:55:00-03:00"; ilegível -> null */
function isoLocal(s: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2})?/.exec(s);
  return m ? `${m[1]}T${m[2]}${m[3] ?? ":00"}${FUSO}` : null;
}
/** Os JSONs de detalhe chegam como texto; quebrado ou vazio vira lista vazia. */
function lista(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v as Record<string, unknown>[];
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const r: unknown = JSON.parse(v);
    return Array.isArray(r) ? (r as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}
// "S/ Apropriação" e "BDVE [...]" não são placas
const NAO_PLACA = /^S\/|BDVE/i;
const zerado = (): HorasPorMotivo => Object.fromEntries(MOTIVOS.map((m) => [m.chave, 0])) as HorasPorMotivo;

/** Linha da lista + vagas do get_data -> linhas das 4 tabelas. Só os campos usados: nada de R$ nem nomes de pessoas. */
export function lerBoletim(linha: LinhaListaBoletim, vagasGauss: Record<string, unknown>[]): BoletimLido {
  const boletim: Boletim = { cod: linha.cod, identificacao: linha.identification.replace(/\s+/g, " ").trim(), inicio: diaIso(linha.initial_date), fim: diaIso(linha.final_date) };
  const vagas: VagaBoletim[] = [];
  const eventos: EventoIndisp[] = [];
  const dias: VagaDia[] = [];
  const vistos = new Set<string>();
  for (const g of vagasGauss) {
    const vaga_id = Number(g.vacancy_code);
    if (!Number.isInteger(vaga_id)) continue;
    const motivos = zerado();
    for (const e of lista(g.json_data_indisponibility)) {
      const tipo = texto(e.type_indisp).split("#")[0].trim();
      const inicio = isoLocal(texto(e.start_sql));
      const fim = isoLocal(texto(e.end_sql));
      if (!tipo || !inicio || !fim) continue;
      const placa = texto(e.vehicle_name) || "sem placa";
      const chave = `${vaga_id}|${placa}|${inicio}|${tipo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      const horas = horasDe(e.approved_time_);
      motivos[motivoDe(tipo)] += horas;
      eventos.push({ boletim_cod: boletim.cod, vaga_id, placa, inicio, fim, tipo, horas });
    }
    vagas.push({
      boletim_cod: boletim.cod,
      vaga_id,
      vaga: texto(g.vaga),
      regime: texto(g.regime_name) || null,
      horas_regime: horasDe(g.CHM),
      horas_indisp: horasDe(g.total_indisponibilidade),
      df: horasDe(g.DF),
      ...motivos,
    });
    const porDia = new Map<string, { regime: number; indisp: number; placas: Set<string> }>();
    for (const j of lista(g.availability_json_data)) {
      const d = texto(j.day);
      if (!/^\d{2}\/\d{2}\/\d{4}/.test(d)) continue;
      const dia = diaIso(d);
      const x = porDia.get(dia) ?? { regime: 0, indisp: 0, placas: new Set<string>() };
      x.regime += horasDe(j.regime_util_);
      x.indisp += horasDe(j.indip_total_);
      const placa = texto(j.vehicle_name);
      if (placa && !NAO_PLACA.test(placa)) x.placas.add(placa);
      porDia.set(dia, x);
    }
    for (const [dia, x] of [...porDia].sort(([a], [b]) => a.localeCompare(b))) {
      dias.push({ boletim_cod: boletim.cod, vaga_id, dia, placas: [...x.placas].join(" / "), horas_regime: x.regime, horas_indisp: x.indisp });
    }
  }
  return { boletim, vagas, eventos, dias };
}

/** DF da frota no ciclo = (Σ horas do regime − Σ horas indisponíveis) ÷ Σ horas do regime, em %. */
export function dfDaFrota(vagas: Pick<VagaBoletim, "horas_regime" | "horas_indisp">[]): number | null {
  const regime = vagas.reduce((s, v) => s + v.horas_regime, 0);
  const indisp = vagas.reduce((s, v) => s + v.horas_indisp, 0);
  return regime > 0 ? ((regime - indisp) / regime) * 100 : null;
}

/** Da pior DF para a melhor; empate: mais horas indisponíveis primeiro. */
export const ordenarVagas = <T extends Pick<VagaBoletim, "df" | "horas_indisp" | "vaga">>(vagas: T[]): T[] =>
  [...vagas].sort((a, b) => a.df - b.df || b.horas_indisp - a.horas_indisp || a.vaga.localeCompare(b.vaga, "pt-BR"));

/** Motivos com valor, do maior para o menor. */
export const porMotivo = (v: HorasPorMotivo) =>
  MOTIVOS.filter((m) => v[m.chave] > 0)
    .map((m) => ({ chave: m.chave as Motivo, nome: m.nome as string, horas: v[m.chave] }))
    .sort((a, b) => b.horas - a.horas);

/** O motivo que mais pesou (null se não houve indisponibilidade). */
export const motivoPrincipal = (v: HorasPorMotivo) => porMotivo(v)[0] ?? null;

// até 1 min de diferença é arredondamento do GAUSS
const TOLERANCIA_H = 1 / 60 + 1e-9;
/** Soma das horas dos eventos × total oficial da vaga. */
export function conferencia(eventos: { horas: number }[], total: number) {
  const soma = eventos.reduce((s, e) => s + e.horas, 0);
  const diferenca = total - soma;
  return { soma, total, diferenca, confere: Math.abs(diferenca) <= TOLERANCIA_H };
}

export function diaSeguinte(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return diaLocal(d);
}

const MOTOR2 = "secondary_motor_on";
// "2026-10-07 09:26:39" (hora local) ou ISO com fuso
const dataDe = (s: string) => new Date(s.includes("T") ? s : s.replace(" ", "T"));

/** Horas de motor secundário ligado por dia, só dentro do ciclo [inicio 00:00, fim 24:00). */
export function motor2PorDia(trechos: TrechoMotor[], inicio: string, fim: string): { total: number; dias: { dia: string; horas: number }[] } {
  const ini = new Date(`${inicio}T00:00:00`).getTime();
  const lim = new Date(`${diaSeguinte(fim)}T00:00:00`).getTime();
  const porDia = new Map<string, number>();
  for (const t of trechos) {
    if (t.status !== MOTOR2) continue;
    let a = Math.max(dataDe(t.inicio).getTime(), ini);
    const b = Math.min(dataDe(t.fim).getTime(), lim);
    // data ilegível vira NaN e o laço não roda
    while (a < b) {
      const dia = diaLocal(new Date(a));
      const corte = Math.min(b, new Date(`${diaSeguinte(dia)}T00:00:00`).getTime());
      porDia.set(dia, (porDia.get(dia) ?? 0) + (corte - a) / 3_600_000);
      a = corte;
    }
  }
  const dias = [...porDia].sort(([x], [y]) => x.localeCompare(y)).map(([dia, horas]) => ({ dia, horas }));
  return { total: dias.reduce((s, d) => s + d.horas, 0), dias };
}

export const dfDoDia = (d: Pick<VagaDia, "horas_regime" | "horas_indisp">): number | null =>
  d.horas_regime > 0 ? ((d.horas_regime - d.horas_indisp) / d.horas_regime) * 100 : null;

/** Placas que passaram pela vaga no ciclo, sem repetir. */
export const placasDoCiclo = (dias: Pick<VagaDia, "placas">[]): string[] =>
  [...new Set(dias.flatMap((d) => d.placas.split(" / ").map((p) => p.trim()).filter(Boolean)))];

export const fmtH = (horas: number) => fmtHoras(horas * 60);
export const fmtDf = (df: number) => `${df.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
/** "2026-09-16" -> "16/09" */
export const dataBr = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const FMT_EVENTO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
/** Instante do evento -> "16/09 06:55" na hora de Ipatinga. */
export function horaEvento(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(FMT_EVENTO.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}
export const rotuloBoletim = (b: Boletim) => `${b.identificacao} · ${dataBr(b.inicio)} a ${dataBr(b.fim)}`;

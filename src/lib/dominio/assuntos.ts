import { CHAVE_FORA, horaDe, minutos, type Local, type ParadaNoLocal } from "./analise";
import { fmtHoras } from "./formato";
import { STATUS_GAUSS } from "./gauss-dia";

/** Abas de assunto da coluna da direita (a Disponibilidade entra na Parte D). */
export const ASSUNTOS = ["status", "motor2", "apontamentos"] as const;
export type Assunto = (typeof ASSUNTOS)[number];
export const ROTULO_ASSUNTO: Record<Assunto, string> = { status: "Status do motor", motor2: "Motor secundário", apontamentos: "Apontamentos" };

/** Quanto cada parada pesa no assunto, em minutos. */
export type Peso = (p: ParadaNoLocal) => number;
export const pesoParado: Peso = minutos;
export const pesoStatus =
  (cod: string): Peso =>
  (p) =>
    p.motor[cod] ?? 0;
export const MOTOR2 = "secondary_motor_on";
const LIGADOS = ["on", "stopped", MOTOR2];
export const rotuloStatus = (cod: string) => STATUS_GAUSS[cod]?.rotulo ?? cod;

export interface Linha {
  chave: string;
  nome: string;
  n: number;
  /** minutos */
  min: number;
}
const somaPeso = (ps: ParadaNoLocal[], peso: Peso) => ps.reduce((s, p) => s + peso(p), 0);
/** "Sem dados de bordo" não é dado de motor: fica fora da base dos %. */
const SEM_DADO = "no_data";
const somaMotor = (p: ParadaNoLocal) => Object.entries(p.motor).reduce((s, [cod, m]) => (cod === SEM_DADO ? s : s + m), 0);

/** Soma o peso por chave (só paradas com peso), do maior ao menor, top n. */
function somarPorPeso(ps: ParadaNoLocal[], chave: (p: ParadaNoLocal) => string, nome: (k: string) => string, peso: Peso, n: number): Linha[] {
  const m = new Map<string, Linha>();
  for (const p of ps) {
    const w = peso(p);
    if (w <= 0) continue;
    const k = chave(p);
    const l = m.get(k) ?? { chave: k, nome: nome(k), n: 0, min: 0 };
    l.n++;
    l.min += w;
    m.set(k, l);
  }
  return [...m.values()].sort((a, b) => b.min - a.min || a.nome.localeCompare(b.nome)).slice(0, n);
}
/** Placas com mais peso. */
export const placasPorPeso = (ps: ParadaNoLocal[], peso: Peso, n = 10) => somarPorPeso(ps, (p) => p.placa, (k) => k, peso, n);
/** Lugares com mais peso; os longe da região somam juntos em "Longe da região" (chave CHAVE_FORA, que a seleção entende). */
export const lugaresPorPeso = (ps: ParadaNoLocal[], locais: Map<string, Local>, peso: Peso, n = 10) =>
  somarPorPeso(
    ps,
    (p) => (locais.get(p.local)?.naRegiao === false ? CHAVE_FORA : p.local),
    (k) => (k === CHAVE_FORA ? "Longe da região" : (locais.get(k)?.nome ?? k)),
    peso,
    n,
  );

/** Peso pela hora de início (0–23). */
export function porHoraPeso(ps: ParadaNoLocal[], peso: Peso): number[] {
  const h = Array<number>(24).fill(0);
  for (const p of ps) h[horaDe(p.ini)] += peso(p);
  return h;
}
/** Hora de início da janela de 2 horas com mais minutos; no empate, a que começa na hora mais cheia (parada só às 8h = 8). */
export function picoDuasHoras(h: number[]): number {
  const janela = (i: number) => h[i] + h[i + 1];
  let pico = 0;
  for (let i = 1; i < 23; i++) if (janela(i) > janela(pico) || (janela(i) === janela(pico) && h[i] > h[pico])) pico = i;
  return pico;
}

export interface StatusSoma {
  cod: string;
  rotulo: string;
  min: number;
}
/** Minutos de cada status do GAUSS nas paradas, do maior ao menor. */
export function somarStatus(ps: ParadaNoLocal[]): StatusSoma[] {
  const m = new Map<string, number>();
  for (const p of ps) for (const [cod, min] of Object.entries(p.motor)) m.set(cod, (m.get(cod) ?? 0) + min);
  return [...m]
    .filter(([, min]) => min > 0)
    .map(([cod, min]) => ({ cod, rotulo: rotuloStatus(cod), min }))
    .sort((a, b) => b.min - a.min);
}
/** Os 3 números do Status: horas paradas (todas), % com motor ligado (sobre o tempo com dado de motor) e o status que mais pesa. */
export function numerosStatus(ps: ParadaNoLocal[]) {
  const comMotor = ps.reduce((s, p) => s + somaMotor(p), 0);
  const ligado = ps.reduce((s, p) => s + LIGADOS.reduce((n, c) => n + (p.motor[c] ?? 0), 0), 0);
  return { parado: somaPeso(ps, pesoParado), comMotor, ligadoPct: comMotor > 0 ? ligado / comMotor : null, maior: somarStatus(ps)[0] ?? null };
}

/** Paradas dos equipamentos que produzem com a bomba (motor 2º): Alta Pressão. */
export const paradasMotor2 = (ps: ParadaNoLocal[]) => ps.filter((p) => p.equip.produtivo === MOTOR2);
/** Os 3 números do Motor 2º: horas de bomba ligada, % do tempo com dado de motor e a placa campeã (só Alta Pressão). */
export function numerosMotor2(ps: ParadaNoLocal[]) {
  const base = paradasMotor2(ps);
  const comMotor = base.reduce((s, p) => s + somaMotor(p), 0);
  const bomba = somaPeso(base, pesoStatus(MOTOR2));
  return { bomba, pct: comMotor > 0 ? bomba / comMotor : null, campea: placasPorPeso(base, pesoStatus(MOTOR2), 1)[0] ?? null };
}

const CONCENTRACAO = 0.2;
/** Conclusões curtas pelo peso (só as que têm dado): total, placa que concentra, pico de 2 horas e lugar. */
export function frasesAssunto({ rotulo, paradas, peso, locais }: { rotulo: string; paradas: ParadaNoLocal[]; peso: Peso; locais: Map<string, Local> }): string[] {
  const com = paradas.filter((p) => peso(p) > 0);
  const total = somaPeso(com, peso);
  if (total <= 0) return [];
  const out = [`${rotulo}: ${fmtHoras(total)} em ${com.length} ${com.length === 1 ? "parada" : "paradas"}.`];
  const [top] = placasPorPeso(com, peso, 1);
  if (top && top.min / total > CONCENTRACAO) out.push(`A placa ${top.nome} sozinha soma ${Math.round((top.min / total) * 100)}% desse tempo.`);
  const pico = picoDuasHoras(porHoraPeso(com, peso));
  out.push(`O pico é das ${pico}h às ${pico + 2}h.`);
  const [lugar] = lugaresPorPeso(com, locais, peso, 1);
  if (lugar) out.push(`Onde mais acontece: ${lugar.nome}, ${fmtHoras(lugar.min)}.`);
  return out;
}

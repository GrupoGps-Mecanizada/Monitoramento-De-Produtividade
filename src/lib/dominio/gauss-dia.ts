import type { Tom } from "../tipos";
import type { Capitulo } from "./capitulos";

const DIA = 86400;

/** Status da "Timeline de Tempo de Motor por Vaga" do GAUSS (tabela timeline_motor_vaga, gravada pelo coletor). */
export const STATUS_GAUSS: Record<string, { rotulo: string; tom: Tom }> = {
  on: { rotulo: "Motor ligado", tom: "ok" },
  stopped: { rotulo: "Parado ligado", tom: "warn" },
  off: { rotulo: "Motor desligado", tom: "bad" },
  secondary_motor_on: { rotulo: "Motor 2º ligado", tom: "motor2" },
  categorized_stop: { rotulo: "Parada apontada", tom: "reg" },
  maintenance: { rotulo: "Em manutenção", tom: "na" },
  main_switch_off: { rotulo: "Chave geral desligada", tom: "bad" },
  out_of_plant: { rotulo: "Fora da planta", tom: "neu" },
  not_appropriated: { rotulo: "Sem apropriação", tom: "neu" },
  no_data: { rotulo: "Sem dados de bordo", tom: "neu" },
};
export const statusGauss = (cod: string, rotulo = cod) => STATUS_GAUSS[cod] ?? { rotulo, tom: "neu" as Tom };

/** Linha crua de timeline_motor_vaga (só o que a Timeline usa). */
export interface LinhaMotorGauss {
  inicio: string;
  fim: string;
  status: string;
  status_label: string | null;
  /** quando a extração gravou a linha pela última vez (updated_at) */
  gravado?: string | null;
}
/** Linha crua de demoras_categorizadas: o apontamento feito no tablet do caminhão. */
export interface LinhaTablet {
  demora_cod: number | string;
  inicio: string;
  fim: string | null;
  categoria_demora: string;
  motorista: string | null;
  concluido: string | null;
}

/** Um pedaço do dia em segundos (a, b) com o status do GAUSS. */
export interface BlocoGauss {
  a: number;
  b: number;
  cod: string;
  rotulo: string;
  tom: Tom;
}
export interface ApontamentoTablet {
  cod: string;
  a: number;
  b: number;
  categoria: string;
  motorista: string | null;
  /** o apontamento ainda estava aberto quando foi lido */
  aberto: boolean;
}
export interface GaussDia {
  status: BlocoGauss[];
  tablet: ApontamentoTablet[];
}

/** "2026-10-07 06:10:08" ou "2026-10-07T06:10:08" → segundos dentro do dia (antes do dia = 0, depois = 24h). */
export function segNoDia(ts: string, dia: string): number {
  const d = ts.slice(0, 10);
  if (d < dia) return 0;
  if (d > dia) return DIA;
  const [h, m, s] = ts.slice(11, 19).split(":").map(Number);
  return h * 3600 + m * 60 + (s || 0);
}

/**
 * Faixa de status do GAUSS sem sobreposição. A extração grava o mesmo período mais de uma vez e a captura mais nova
 * corrige a anterior (ex.: às 09:38 a bomba "parou" às 09:32; às 19:28 o GAUSS já sabia que ficou ligada até 09:36).
 * Em cada instante vale a linha gravada por último; empate: a que começou depois, depois a que termina depois.
 * Trechos vizinhos iguais viram um só. `paraSeg` troca a régua (padrão: segundos do dia; a Cronoanálise usa o turno).
 */
export function montarStatusGauss(linhas: LinhaMotorGauss[], dia: string, paraSeg: (ts: string) => number = (ts) => segNoDia(ts, dia)): BlocoGauss[] {
  const crus = linhas
    .map((l) => ({ a: paraSeg(l.inicio), b: paraSeg(l.fim), chave: `${l.gravado ?? ""}|${l.inicio.replace("T", " ")}|${l.fim.replace("T", " ")}`, l }))
    .filter((x) => x.b > x.a);
  const cortes = [...new Set(crus.flatMap((x) => [x.a, x.b]))].sort((p, q) => p - q);
  const blocos: BlocoGauss[] = [];
  for (let i = 0; i + 1 < cortes.length; i++) {
    const [a, b] = [cortes[i], cortes[i + 1]];
    let vence: (typeof crus)[number] | null = null;
    for (const x of crus) {
      if (x.a > a || x.b < b) continue;
      if (!vence || x.chave > vence.chave) vence = x;
    }
    if (!vence) continue;
    const st = statusGauss(vence.l.status, vence.l.status_label ?? vence.l.status);
    const ult = blocos[blocos.length - 1];
    if (ult && ult.cod === vence.l.status && ult.b === a) ult.b = b;
    else blocos.push({ a, b, cod: vence.l.status, rotulo: st.rotulo, tom: st.tom });
  }
  return blocos;
}

/** Apontamentos do tablet no dia, do mais cedo para o mais tarde, sem repetir (a extração pode gravar duas vezes). */
export function montarTablet(linhas: LinhaTablet[], dia: string, agoraSeg = DIA, paraSeg: (ts: string) => number = (ts) => segNoDia(ts, dia)): ApontamentoTablet[] {
  const vistos = new Map<string, ApontamentoTablet>();
  for (const l of linhas) {
    const cod = String(l.demora_cod);
    const a = paraSeg(l.inicio);
    // sem fim = ainda aberto: vai até agora (ou o fim do dia, se o dia já passou)
    const b = l.fim ? paraSeg(l.fim) : agoraSeg;
    if (b <= a && l.fim) continue;
    vistos.set(cod, { cod, a, b: Math.max(b, a), categoria: l.categoria_demora.trim(), motorista: l.motorista && l.motorista !== "--" ? l.motorista : null, aberto: !l.fim });
  }
  return [...vistos.values()].sort((p, q) => p.a - q.a);
}

/** O bloco que cobre o segundo t (ou null). */
export function blocoEm<T extends { a: number; b: number }>(blocos: T[], t: number): T | null {
  for (const x of blocos) if (x.a <= t && t < x.b) return x;
  return null;
}

/** Minutos por status no dia (para a legenda), do maior para o menor. */
export function totaisGauss(blocos: BlocoGauss[]): { cod: string; rotulo: string; tom: Tom; min: number }[] {
  const t = new Map<string, { cod: string; rotulo: string; tom: Tom; min: number }>();
  for (const x of blocos) {
    const r = t.get(x.cod) ?? { cod: x.cod, rotulo: x.rotulo, tom: x.tom, min: 0 };
    r.min += (x.b - x.a) / 60;
    t.set(x.cod, r);
  }
  return [...t.values()].sort((p, q) => q.min - p.min);
}

/**
 * O que o GAUSS afirma sobre o motor: ligado (andando, parado ligado ou com o motor 2º) ou desligado. null = o GAUSS
 * não diz (manutenção, parada apontada, fora da planta, sem apropriação, sem dados).
 */
export function motorDoGauss(cod: string): "ligado" | "desligado" | null {
  if (cod === "on" || cod === "stopped" || cod === "secondary_motor_on") return "ligado";
  if (cod === "off" || cod === "main_switch_off") return "desligado";
  return null;
}

/** Minutos de cada status do GAUSS entre a e b (segundos do dia). */
export function minutosEntre(blocos: BlocoGauss[], a: number, b: number): Map<string, number> {
  const r = new Map<string, number>();
  for (const x of blocos) {
    const ini = Math.max(a, x.a);
    const fim = Math.min(b, x.b);
    if (fim > ini) r.set(x.cod, (r.get(x.cod) ?? 0) + (fim - ini) / 60);
  }
  return r;
}

/**
 * Capítulos com o motor pelo GAUSS: ligado_min = motor ligado (inclui parado ligado e motor 2º), desligado_min =
 * desligado, outro_min = o resto (manutenção, parada apontada, sem dados do GAUSS...).
 */
export function capitulosComGauss(capitulos: Capitulo[], blocos: BlocoGauss[], dia: string): Capitulo[] {
  return capitulos.map((c) => {
    const a = segNoDia(c.inicio, dia);
    const b = c.fim.slice(0, 10) > dia ? DIA : segNoDia(c.fim, dia);
    let ligado = 0;
    let desligado = 0;
    for (const [cod, min] of minutosEntre(blocos, a, b)) {
      const m = motorDoGauss(cod);
      if (m === "ligado") ligado += min;
      else if (m === "desligado") desligado += min;
    }
    return { ...c, ligado_min: Math.round(ligado), desligado_min: Math.round(desligado), outro_min: Math.max(0, Math.round(c.duracao_min - ligado - desligado)) };
  });
}

/** Placas do GAUSS às vezes vêm com hífen (EAM-3253) e às vezes sem: procura as duas formas. */
export function formasDaPlaca(placa: string): string[] {
  const limpa = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const comHifen = limpa.length === 7 ? `${limpa.slice(0, 3)}-${limpa.slice(3)}` : limpa;
  return [...new Set([placa, limpa, comHifen])];
}

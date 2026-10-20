// Exceções do dia: só o que fugiu das regras da frota (gestão por exceção). Tudo puro; a tela só mostra.
// Eixo do tempo: segundos desde 00:00 da VÉSPERA (0 a 2 dias), porque o turno da noite atravessa a meia-noite.
// O dia pedido vai de DIA a 2*DIA no eixo; cada exceção sai com o horário dentro do dia pedido.
// Desenho: docs/superpowers/specs/2026-10-08-excecoes-do-dia-design.md
import type { Evento, Veiculo } from "../tipos";
import { diaDaSemana, diaMenos } from "./analise";
import type { LinhaMotorFrota } from "./dia-frota";
import { fmtHora, fmtMin, segDe } from "./formato";
import { formasDaPlaca, montarStatusGauss, type LinhaTablet } from "./gauss-dia";
import { statusProdutivo } from "./produtividade";
import {
  BICAS, DESLIGADO_MIN, EXPEDIENTES, OCIOSO_MIN, OFICINAS_FORA, PATIO, RESTAURANTES, RESTAURANTE_MIN, SERVITEC, TOLERANCIA_MIN, VELOCIDADE_MAX_USINA, ehDaLista, regimeDoEquip, type Regime,
} from "./regras-frota";
import { DIA } from "./trilhas";

export const REGRAS = ["saida_tarde", "chegada_cedo", "patio", "servitec", "oficina_fora", "bica_vacuo", "restaurante", "ocioso", "desligado", "velocidade"] as const;
export type RegraExcecao = (typeof REGRAS)[number];
export const ROTULO_REGRA: Record<RegraExcecao, string> = {
  saida_tarde: "Saída tarde do Pátio",
  chegada_cedo: "Chegada cedo ao Pátio",
  patio: "Ida ao Pátio no expediente",
  servitec: "Oficina da Servitec",
  oficina_fora: "Oficina de fora",
  bica_vacuo: "Vácuo na bica",
  restaurante: "Restaurante acima de 1 h",
  ocioso: "Ociosidade",
  desligado: "Motor desligado 1 h",
  velocidade: "Velocidade acima de 30 km/h",
};
/** alerta = fugiu da regra; atenção = só para saber (oficinas). */
export type Gravidade = "alerta" | "atencao";
const GRAVIDADE: Record<RegraExcecao, Gravidade> = {
  saida_tarde: "alerta", chegada_cedo: "alerta", patio: "alerta", servitec: "atencao", oficina_fora: "atencao", bica_vacuo: "alerta", restaurante: "alerta", ocioso: "alerta", desligado: "alerta", velocidade: "alerta",
};

export interface Excecao {
  regra: RegraExcecao;
  /** id do veículo no GAUSS */
  veiculo: string;
  /** segundos do dia pedido (início e fim; fim null = um instante, como a hora de saída) */
  ini: number;
  fim: number | null;
  /** horário estável da ocorrência (segundos do dia): o limite na saída tarde e na chegada cedo, o início nas outras. A chave do alerta usa este. */
  ref: number;
  local: string | null;
  /** texto curto: "saiu 08:10 · limite 07:45", "43 min" */
  detalhe: string;
  gravidade: Gravidade;
  /** vaga em que o caminhão estava no trecho (regras do motor, pela timeline do GAUSS); ausente = a vaga de agora */
  vaga?: string;
}
export interface EntradaExcecoes {
  dia: string;
  /** segundos do dia pedido agora (só hoje); null = dia fechado */
  agoraSeg: number | null;
  veiculos: Veiculo[];
  /** eventos de área da véspera e do dia */
  eventos: Evento[];
  /** timeline de motor da véspera e do dia */
  motor: LinhaMotorFrota[];
  /** apontamentos do tablet da véspera e do dia, com a placa */
  tablet: (LinhaTablet & { placa: string })[];
  /** excessos de velocidade dentro da usina (analise_excessos; rota completa, só a partir do dia seguinte) */
  excessos?: { dia: string; veiculo_id: string; ini: number; fim: number; vel_max: number; lat: number; lng: number }[];
}
export interface IntervaloArea {
  area: string;
  a: number;
  b: number;
}

function agrupar<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}
// eventos guardam o instante (ISO); o eixo começa às 00:00 de Brasília (sem horário de verão desde 2019)
const segDoIso = (iso: string, base: string) => (Date.parse(iso) - Date.parse(`${base}T00:00:00-03:00`)) / 1000;
// o GAUSS grava "AAAA-MM-DD HH:MM:SS" no horário local
const segDoLocal = (ts: string, base: string) => Math.round((Date.parse(`${ts.slice(0, 10)}T00:00:00Z`) - Date.parse(`${base}T00:00:00Z`)) / 1000) + segDe(ts.slice(11, 19));
const hhmm = (t: number) => fmtHora(((t % DIA) + DIA) % DIA).slice(0, 5);
const dur = (seg: number) => fmtMin(seg / 60);

/** Onde o veículo esteve: intervalos por área a partir da abertura, entradas e saídas (eixo desde 00:00 de `base`, até `fim`). */
export function intervalosDeArea(eventos: Evento[], base: string, fim: number): IntervaloArea[] {
  const out: IntervaloArea[] = [];
  let area: string | null = null;
  let desde = 0;
  const mudar = (nova: string, t: number) => {
    const x = Math.min(Math.max(t, 0), fim);
    if (area && x > desde) out.push({ area, a: desde, b: x });
    area = nova;
    desde = x;
  };
  for (const e of [...eventos].sort((p, q) => p.t.localeCompare(q.t))) {
    const t = segDoIso(e.t, base);
    if (e.tipo === "abertura") {
      if (area === null) {
        area = e.area;
        desde = 0;
      } else if (e.area !== area) mudar(e.area, t);
    } else if (e.tipo === "entrada") mudar(e.area, t);
    else if (e.tipo === "saida") {
      if (area === null) area = e.area; // estava na área desde o começo do eixo
      if (area === e.area) mudar("", t);
    }
  }
  mudar("", fim);
  return out;
}

/** Uma ida à base: Pátio e Servitec juntos (as cercas são vizinhas) e, dentro dela, o trecho na Servitec. */
interface IdaBase {
  a: number;
  b: number;
  servitec: { a: number; b: number } | null;
}
/**
 * Junta Pátio e Servitec numa ida só: as duas cercas se encostam e o GPS de um caminhão parado na divisa pula de
 * uma para a outra (e às vezes para fora por um ciclo). Intervalos separados por até `folga` viram uma ida.
 */
function idasBase(areas: IntervaloArea[], folga: number): IdaBase[] {
  const out: IdaBase[] = [];
  for (const i of areas.filter((x) => ehDaLista(x.area, [...PATIO, ...SERVITEC])).sort((p, q) => p.a - q.a)) {
    const s = ehDaLista(i.area, SERVITEC) ? { a: i.a, b: i.b } : null;
    const ult = out.at(-1);
    if (ult && i.a - ult.b <= folga) {
      ult.b = Math.max(ult.b, i.b);
      if (s) ult.servitec = ult.servitec ? { a: ult.servitec.a, b: s.b } : s;
    } else out.push({ a: i.a, b: i.b, servitec: s });
  }
  return out;
}

/** Expedientes do regime que começam na véspera e no dia pedido, no eixo. */
function expedientes(regime: Regime, base: string): { s: number; c: number }[] {
  const out: { s: number; c: number }[] = [];
  const cfg = EXPEDIENTES[regime];
  [base, diaMenos(base, -1)].forEach((dia, k) => {
    if (!cfg.dias.includes(diaDaSemana(dia))) return;
    for (const t of cfg.turnos) {
      const s = k * DIA + segDe(t.saida);
      let c = k * DIA + segDe(t.chegada);
      if (c <= s) c += DIA;
      out.push({ s, c });
    }
  });
  return out;
}

/** Timeline de motor da véspera e do dia num eixo só, juntando o mesmo status que atravessa a meia-noite. */
function motorNoEixo(linhas: LinhaMotorFrota[], base: string, dia: string): { a: number; b: number; cod: string }[] {
  const blocos = [...montarStatusGauss(linhas, base), ...montarStatusGauss(linhas, dia).map((x) => ({ ...x, a: x.a + DIA, b: x.b + DIA }))];
  const out: { a: number; b: number; cod: string }[] = [];
  for (const x of blocos) {
    const ult = out.at(-1);
    if (ult && ult.cod === x.cod && ult.b === x.a) ult.b = x.b;
    else out.push({ a: x.a, b: x.b, cod: x.cod });
  }
  return out;
}

type BlocoMotor = { a: number; b: number; cod: string };

/**
 * O coletor só busca de novo a timeline de uma vaga desligada a cada 1 h (MAX_QUIETA_MS): o ao vivo (a cada ~5 min)
 * completa o desligado depois do último trecho do GAUSS, até a última posição. Onde o GAUSS já tem dado vale o GAUSS
 * (minuto a minuto; o ao vivo perde um liga-desliga curto). Como no GAUSS, o que passa da meia-noite vira dois trechos.
 * `ate` = agora no eixo (só hoje; null = dia fechado, nada a completar).
 */
export function completarAoVivo(blocos: BlocoMotor[], v: Pick<Veiculo, "status" | "status_desde" | "posicao_em" | "sem_sinal">, base: string, ate: number | null): BlocoMotor[] {
  if (ate == null || v.sem_sinal || !/desligad/i.test(v.status) || !v.status_desde || !v.posicao_em) return blocos;
  const fimGauss = blocos.reduce((m, x) => Math.max(m, x.b), -Infinity);
  const visto = Math.min(segDoIso(v.posicao_em, base), ate);
  const desde = Math.max(segDoIso(v.status_desde, base), fimGauss);
  // NaN (data ilegível) também para aqui
  if (!(visto > desde)) return blocos;
  const ult = blocos.at(-1);
  const out = ult && ult.cod === "off" && ult.b === desde ? [...blocos.slice(0, -1), { ...ult, b: visto }] : [...blocos, { a: desde, b: visto, cod: "off" }];
  const novo = out.at(-1)!;
  if (novo.a < DIA && novo.b > DIA) out.splice(-1, 1, { ...novo, b: DIA }, { ...novo, a: DIA });
  return out;
}

/**
 * Em que vaga o caminhão estava (o GAUSS manda a timeline por vaga) e os blocos cortados onde a vaga muda: cada
 * pedaço é julgado pelo regime da sua vaga. Trecho sem a vaga na linha fica com a vaga de agora.
 */
function cortarPorVaga(blocos: BlocoMotor[], linhas: LinhaMotorFrota[], base: string, vagaAgora: string): (BlocoMotor & { vaga: string })[] {
  const trechos = linhas
    .filter((l) => l.vaga_nome)
    .map((l) => ({ a: segDoLocal(l.inicio, base), b: segDoLocal(l.fim, base), vaga: l.vaga_nome as string }))
    // o trecho mais novo vence onde dois se encostam
    .sort((p, q) => q.a - p.a);
  const vagaEm = (t: number) => trechos.find((x) => x.a <= t && t < x.b)?.vaga ?? vagaAgora;
  const cortes = [...new Set(trechos.flatMap((x) => [x.a, x.b]))];
  const out: (BlocoMotor & { vaga: string })[] = [];
  for (const bl of blocos) {
    const pontos = [bl.a, ...cortes.filter((t) => t > bl.a && t < bl.b).sort((p, q) => p - q), bl.b];
    // junta só dentro do mesmo bloco (o corte da meia-noite fica)
    const pedacos: (BlocoMotor & { vaga: string })[] = [];
    for (let i = 0; i + 1 < pontos.length; i++) {
      const vaga = vagaEm(pontos[i]);
      const ult = pedacos.at(-1);
      if (ult && ult.vaga === vaga) ult.b = pontos[i + 1];
      else pedacos.push({ a: pontos[i], b: pontos[i + 1], cod: bl.cod, vaga });
    }
    out.push(...pedacos);
  }
  return out;
}

/** O que fugiu das regras no dia pedido, do mais cedo para o mais tarde. */
export function excecoesDoDia(x: EntradaExcecoes): Excecao[] {
  const base = diaMenos(x.dia, 1);
  const fim = x.agoraSeg == null ? 2 * DIA : DIA + x.agoraSeg;
  const tol = TOLERANCIA_MIN * 60;
  const noDia = (t: number) => t >= DIA && t < 2 * DIA;
  const evPorId = agrupar(
    x.eventos.filter((e) => !e.motor2),
    (e) => e.id,
  );
  const motorPorId = agrupar(x.motor, (l) => l.placa_ou_codigo);
  const out: Excecao[] = [];

  for (const v of x.veiculos) {
    if (v.motor2_de || !v.equip) continue;
    const { regime } = regimeDoEquip(v.equip.regime, v.vaga);
    const manut = v.equip.status === "EM_MANUTENCAO";
    const areas = intervalosDeArea(evPorId.get(v.id) ?? [], base, fim);
    const em = (lista: string[]) => areas.filter((i) => ehDaLista(i.area, lista));
    const naLista = (lista: string[], t: number) => em(lista).some((i) => i.a <= t && t < i.b);
    const localEm = (t: number) => areas.find((i) => i.a <= t && t < i.b)?.area ?? null;
    const idas = idasBase(areas, tol);
    const LOCAL_BASE = PATIO[0];
    const exps = expedientes(regime, base);
    const sobreposto = (es: { s: number; c: number }[], a: number, b: number) => Math.max(0, ...es.map((e) => Math.min(b, e.c) - Math.max(a, e.s)));
    const noExp = (a: number, b: number) => sobreposto(exps, a, b);
    // regras do motor: o expediente é o da vaga em que o caminhão estava no trecho
    const expsDaVaga = new Map<string, { s: number; c: number }[]>();
    const noExpDa = (vaga: string, a: number, b: number) => {
      let es = expsDaVaga.get(vaga);
      if (!es) expsDaVaga.set(vaga, (es = expedientes(regimeDoEquip(v.equip?.regime, vaga).regime, base)));
      return sobreposto(es, a, b);
    };
    const add = (regra: RegraExcecao, ini: number, fimX: number | null, local: string | null, detalhe: string, ref = ini, vaga?: string) =>
      out.push({ regra, veiculo: v.id, ini: ini - DIA, fim: fimX == null ? null : fimX - DIA, ref: ref - DIA, local, detalhe, gravidade: GRAVIDADE[regra], ...(vaga ? { vaga } : {}) });

    if (!manut)
      for (const e of exps) {
        // 1. saída tarde: ainda no Pátio depois do horário (+ folga)
        if (noDia(e.s) && e.s + tol <= fim) {
          const p = idas.find((i) => i.a <= e.s + tol && e.s + tol < i.b);
          if (p && p.b < Math.min(e.c, fim)) add("saida_tarde", p.b, null, LOCAL_BASE, `saiu ${hhmm(p.b)} · limite ${hhmm(e.s)}`, e.s);
          else if (p) add("saida_tarde", e.s, null, LOCAL_BASE, `não saiu do Pátio · limite ${hhmm(e.s)}`, e.s);
        }
        // 2. chegada cedo: já de volta ao Pátio antes do horário (− folga), depois de ter saído no expediente
        if (noDia(e.c) && e.c <= fim) {
          const p = idas.find((i) => i.a < e.c - tol && e.c - tol < i.b);
          if (p && p.a > e.s + tol) add("chegada_cedo", p.a, null, LOCAL_BASE, `chegou ${hhmm(p.a)} · limite ${hhmm(e.c)}`, e.c);
        }
        // 3. ida ao Pátio no meio do expediente (entrou e saiu antes do horário de volta); se passou pela Servitec, conta lá (regra 4)
        for (const p of idas) if (!p.servitec && noDia(p.a) && p.a > e.s + tol && p.b < e.c - tol && p.b < fim) add("patio", p.a, p.b, LOCAL_BASE, dur(p.b - p.a));
      }
    // 4 e 5. oficinas (a da Servitec só no expediente, uma por ida à base; a de fora, sempre)
    for (const p of idas) {
      const s = p.servitec;
      if (s && noDia(s.a) && noExp(s.a, s.b) > 0) add("servitec", s.a, s.b, SERVITEC[0], dur(s.b - s.a));
    }
    for (const i of em(OFICINAS_FORA)) if (noDia(i.a)) add("oficina_fora", i.a, i.b, i.area, dur(i.b - i.a));
    // 6. Auto Vácuo e Hiper Vácuo não enchem água: parar na bica é alerta
    if (v.equip.tipo === "av" || v.equip.tipo === "hv") for (const i of em(BICAS)) if (noDia(i.a)) add("bica_vacuo", i.a, i.b, i.area, dur(i.b - i.a));
    // 7. restaurante acima do limite, no expediente
    for (const i of em(RESTAURANTES)) if (noDia(i.a) && i.b - i.a > RESTAURANTE_MIN * 60 && noExp(i.a, i.b) > 0) add("restaurante", i.a, i.b, i.area, dur(i.b - i.a));

    // 10. velocidade acima do limite dentro da usina (rota completa: só a partir do dia seguinte)
    for (const e of x.excessos ?? []) if (e.veiculo_id === v.id && e.dia === x.dia) add("velocidade", DIA + e.ini, DIA + e.fim, localEm(DIA + e.ini), `${Math.round(e.vel_max)} km/h · limite ${VELOCIDADE_MAX_USINA} km/h`);

    if (manut) continue;
    const linhasMotor = motorPorId.get(v.id) ?? [];
    const blocos = cortarPorVaga(completarAoVivo(motorNoEixo(linhasMotor, base, x.dia), v, base, x.agoraSeg == null ? null : fim), linhasMotor, base, v.vaga);
    // 8. ociosidade: parado ligado seguido, quando parado ligado não é o produtivo do equipamento (fora do Pátio)
    if (statusProdutivo(v.equip.tipo, v.placa) !== "stopped")
      for (const b of blocos)
        if (b.cod === "stopped" && noDia(b.a) && noExpDa(b.vaga, b.a, b.b) >= OCIOSO_MIN * 60 && !naLista(PATIO, b.a)) add("ocioso", b.a, b.b, localEm(b.a), dur(b.b - b.a), b.a, b.vaga);
    // 9. motor desligado no expediente, fora do Pátio e das oficinas, sem refeição apontada no tablet
    const placas = new Set(formasDaPlaca(v.placa));
    const refeicoes = x.tablet
      .filter((t) => placas.has(t.placa) && /REFEI/i.test(t.categoria_demora))
      .map((t) => ({ a: segDoLocal(t.inicio, base), b: t.fim ? segDoLocal(t.fim, base) : fim }));
    for (const b of blocos) {
      if ((b.cod !== "off" && b.cod !== "main_switch_off") || !noDia(b.a) || noExpDa(b.vaga, b.a, b.b) < DESLIGADO_MIN * 60) continue;
      if (naLista([...PATIO, ...SERVITEC, ...OFICINAS_FORA], b.a) || refeicoes.some((r) => r.a < b.b && r.b > b.a)) continue;
      add("desligado", b.a, b.b, localEm(b.a), dur(b.b - b.a), b.a, b.vaga);
    }
  }
  return out.sort((p, q) => p.ini - q.ini || p.veiculo.localeCompare(q.veiculo));
}

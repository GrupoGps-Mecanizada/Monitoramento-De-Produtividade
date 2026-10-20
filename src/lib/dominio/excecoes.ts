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
import { vagaOficial } from "./vagas-oficiais";

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
  ocioso: "Ligado sem produzir",
  desligado: "Ocioso (motor desligado) 1 h",
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
  /** vaga em que o caminhão estava na hora (timeline do GAUSS, senão a leitura dos eventos); ausente = a vaga de agora */
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
  /** ids dos caminhões com motor secundário (a timeline do GAUSS mostrou "Motor Secundário Ligado" nos últimos dias) */
  motorSecundario?: string[];
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

const DESLIGADOS = new Set(["off", "main_switch_off"]);
/**
 * O coletor só busca de novo a timeline de uma vaga desligada a cada 1 h (MAX_QUIETA_MS): o ao vivo (a cada ~5 min)
 * continua, até a última posição, o desligado que o próprio GAUSS mostrou na última busca. Só quando é seguro:
 * - o último trecho do GAUSS é desligado e o ao vivo não mudou depois dele (mudou: o coletor busca de novo em 10 min);
 * - o caminhão não tem motor secundário (`temMotorSecundario`, ou o motor 2º do ao vivo ligado/sem sinal): a bomba
 *   trabalha com o principal desligado, e o ao vivo do principal diria "Desligado" (EAM-3253, 17/10/2026);
 * - fora do apontamento do tablet que começou depois da busca (`apontados`, aberto = até agora): o GAUSS mostra
 *   "Parada Apontada" e o ao vivo não vê.
 * Onde o GAUSS tem dado vale o GAUSS. Como no GAUSS, o que passa da meia-noite vira dois trechos.
 * `ate` = agora no eixo (só hoje; null = dia fechado).
 */
export function completarAoVivo(
  blocos: BlocoMotor[],
  v: Pick<Veiculo, "status" | "status_desde" | "posicao_em" | "sem_sinal" | "motor2">,
  base: string,
  ate: number | null,
  apontados: { a: number; b: number }[] = [],
  temMotorSecundario = false,
): BlocoMotor[] {
  if (ate == null || v.sem_sinal || !/desligad/i.test(v.status) || !v.status_desde || !v.posicao_em) return blocos;
  const ultGauss = blocos.at(-1);
  if (!ultGauss || !DESLIGADOS.has(ultGauss.cod)) return blocos;
  const fimGauss = blocos.reduce((m, x) => Math.max(m, x.b), -Infinity);
  // a bomba: o motor 2º do ao vivo (com sinal) diz se está desligada desde antes da busca; sem ele, vale o histórico
  const m2 = v.motor2 && !v.motor2.sem_sinal ? v.motor2 : null;
  if (m2 ? !/desligad/i.test(m2.status) || (m2.status_desde != null && !(segDoIso(m2.status_desde, base) <= fimGauss)) : temMotorSecundario) return blocos;
  const visto = Math.min(segDoIso(v.posicao_em, base), ate);
  const desde = fimGauss;
  // NaN (data ilegível) também para aqui
  if (!(segDoIso(v.status_desde, base) <= fimGauss) || !(visto > desde)) return blocos;
  let pedacos = [{ a: desde, b: visto }];
  for (const ap of apontados.filter((x) => x.a >= fimGauss))
    pedacos = pedacos.flatMap((p) => (ap.b <= p.a || ap.a >= p.b ? [p] : [...(ap.a > p.a ? [{ a: p.a, b: ap.a }] : []), ...(ap.b < p.b ? [{ a: ap.b, b: p.b }] : [])]));
  pedacos = pedacos.flatMap((p) => (p.a < DIA && p.b > DIA ? [{ a: p.a, b: DIA }, { a: DIA, b: p.b }] : [p]));
  const out = [...blocos];
  for (const p of pedacos) {
    const ult = out.at(-1);
    // emenda no desligado do GAUSS que acaba onde o completar começa (nunca na meia-noite)
    if (ult && DESLIGADOS.has(ult.cod) && ult.b === p.a && p.a !== DIA) out[out.length - 1] = { ...ult, b: p.b };
    else out.push({ a: p.a, b: p.b, cod: "off" });
  }
  return out;
}

/** "Sem vaga" até isto, entre duas leituras da mesma vaga, é a troca de turno do GAUSS. */
const PISCADA_S = 30 * 60;
interface VagaNoTempo {
  em: (t: number) => string;
  /** instantes em que a vaga pode mudar */
  cortes: number[];
  /** todas as vagas que o caminhão teve */
  todas: Set<string>;
}
/**
 * Em que vaga o caminhão estava a cada instante: a timeline do GAUSS (vem por vaga, minuto a minuto) vale onde tem
 * trecho; no resto (fora das 22 vagas não há timeline), a vaga que o GAUSS dava na leitura de cada evento; antes do
 * primeiro evento, a de agora.
 */
function vagaNoTempo(linhas: LinhaMotorFrota[], eventos: Evento[], base: string, vagaAgora: string): VagaNoTempo {
  const trechos = linhas
    .filter((l) => l.vaga_nome)
    .map((l) => ({ a: segDoLocal(l.inicio, base), b: segDoLocal(l.fim, base), vaga: l.vaga_nome as string }))
    // o trecho mais novo vence onde dois se encostam
    .sort((p, q) => q.a - p.a);
  const lidas: { t: number; vaga: string }[] = [];
  for (const e of [...eventos].sort((p, q) => p.t.localeCompare(q.t))) if (e.vaga && lidas.at(-1)?.vaga !== e.vaga) lidas.push({ t: segDoIso(e.t, base), vaga: e.vaga });
  // na troca de turno o GAUSS dá [S/ VAGA] por uns minutos e volta à mesma vaga: isso não é troca de vaga
  const marcas: { t: number; vaga: string }[] = [];
  lidas.forEach((m, i) => {
    const piscada = i > 0 && i + 1 < lidas.length && !vagaOficial(m.vaga) && lidas[i - 1].vaga === lidas[i + 1].vaga && lidas[i + 1].t - m.t <= PISCADA_S;
    if (!piscada && marcas.at(-1)?.vaga !== m.vaga) marcas.push(m);
  });
  const pelaLeitura = (t: number) => {
    let vaga: string | null = null;
    for (const m of marcas) {
      if (m.t > t) break;
      vaga = m.vaga;
    }
    return vaga;
  };
  return {
    em: (t) => trechos.find((x) => x.a <= t && t < x.b)?.vaga ?? pelaLeitura(t) ?? vagaAgora,
    cortes: [...new Set([...trechos.flatMap((x) => [x.a, x.b]), ...marcas.map((m) => m.t)])],
    todas: new Set([vagaAgora, ...trechos.map((x) => x.vaga), ...marcas.map((m) => m.vaga)]),
  };
}

/** Blocos cortados onde a vaga muda: cada pedaço é julgado pelo regime da sua vaga. */
function cortarPorVaga(blocos: BlocoMotor[], vagas: VagaNoTempo): (BlocoMotor & { vaga: string })[] {
  const out: (BlocoMotor & { vaga: string })[] = [];
  for (const bl of blocos) {
    const pontos = [bl.a, ...vagas.cortes.filter((t) => t > bl.a && t < bl.b).sort((p, q) => p - q), bl.b];
    // junta só dentro do mesmo bloco (o corte da meia-noite fica)
    const pedacos: (BlocoMotor & { vaga: string })[] = [];
    for (let i = 0; i + 1 < pontos.length; i++) {
      const vaga = vagas.em(pontos[i]);
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
  const comSecundario = new Set([...(x.motorSecundario ?? []), ...x.motor.filter((l) => l.status === "secondary_motor_on").map((l) => l.placa_ou_codigo)]);
  const out: Excecao[] = [];

  for (const v of x.veiculos) {
    const equip = v.equip;
    if (v.motor2_de || !equip) continue;
    const manut = equip.status === "EM_MANUTENCAO";
    const evs = evPorId.get(v.id) ?? [];
    const linhasMotor = motorPorId.get(v.id) ?? [];
    const areas = intervalosDeArea(evs, base, fim);
    const em = (lista: string[]) => areas.filter((i) => ehDaLista(i.area, lista));
    const naLista = (lista: string[], t: number) => em(lista).some((i) => i.a <= t && t < i.b);
    const localEm = (t: number) => areas.find((i) => i.a <= t && t < i.b)?.area ?? null;
    const idas = idasBase(areas, tol);
    const LOCAL_BASE = PATIO[0];
    // a vaga (e com ela o regime e o expediente) é a do momento: caminhão trocado de vaga não leva a nova para o que fez antes
    const vagas = vagaNoTempo(linhasMotor, evs, base, v.vaga);
    const regimeDa = (vaga: string) => regimeDoEquip(equip.regime, vaga).regime;
    const expsDoRegime = new Map<Regime, { s: number; c: number }[]>();
    const expsDe = (r: Regime) => {
      let es = expsDoRegime.get(r);
      if (!es) expsDoRegime.set(r, (es = expedientes(r, base)));
      return es;
    };
    // expedientes de todos os regimes que o caminhão teve; cada regra usa os do regime da vaga na hora que importa para ela
    const exps = [...new Set([...vagas.todas].map(regimeDa))].flatMap((r) => expsDe(r).map((e) => ({ ...e, r }))).sort((p, q) => p.s - q.s);
    const doRegimeEm = (e: { r: Regime }, t: number) => regimeDa(vagas.em(t)) === e.r;
    const sobreposto = (es: { s: number; c: number }[], a: number, b: number) => Math.max(0, ...es.map((e) => Math.min(b, e.c) - Math.max(a, e.s)));
    const noExpDa = (vaga: string, a: number, b: number) => sobreposto(expsDe(regimeDa(vaga)), a, b);
    const noExpEm = (a: number, b: number) => noExpDa(vagas.em(a), a, b);
    const add = (regra: RegraExcecao, ini: number, fimX: number | null, local: string | null, detalhe: string, ref = ini, vaga = vagas.em(ref)) =>
      out.push({ regra, veiculo: v.id, ini: ini - DIA, fim: fimX == null ? null : fimX - DIA, ref: ref - DIA, local, detalhe, gravidade: GRAVIDADE[regra], vaga });

    if (!manut)
      for (const e of exps) {
        // 1. saída tarde: ainda no Pátio depois do horário (+ folga). Vale o regime da vaga que o caminhão foi atender (a
        //    da saída; ainda no Pátio, a de agora): o trocado de vaga no Pátio atrasou o serviço da vaga nova
        if (noDia(e.s) && e.s + tol <= fim) {
          const p = idas.find((i) => i.a <= e.s + tol && e.s + tol < i.b);
          const saida = p ? Math.min(p.b, fim) : null;
          if (p && saida != null && doRegimeEm(e, saida)) {
            if (p.b < Math.min(e.c, fim)) add("saida_tarde", p.b, null, LOCAL_BASE, `saiu ${hhmm(p.b)} · limite ${hhmm(e.s)}`, e.s, vagas.em(saida));
            else add("saida_tarde", e.s, null, LOCAL_BASE, `não saiu do Pátio · limite ${hhmm(e.s)}`, e.s, vagas.em(saida));
          }
        }
        // 2. chegada cedo: já de volta ao Pátio antes do horário (− folga), depois de ter saído no expediente; o regime da vaga na chegada
        if (noDia(e.c) && e.c <= fim) {
          const p = idas.find((i) => i.a < e.c - tol && e.c - tol < i.b);
          if (p && p.a > e.s + tol && doRegimeEm(e, p.a)) add("chegada_cedo", p.a, null, LOCAL_BASE, `chegou ${hhmm(p.a)} · limite ${hhmm(e.c)}`, e.c, vagas.em(p.a));
        }
        // 3. ida ao Pátio no meio do expediente (entrou e saiu antes do horário de volta); se passou pela Servitec, conta lá (regra 4)
        for (const p of idas)
          if (!p.servitec && noDia(p.a) && p.a > e.s + tol && p.b < e.c - tol && p.b < fim && doRegimeEm(e, p.a)) add("patio", p.a, p.b, LOCAL_BASE, dur(p.b - p.a));
      }
    // 4 e 5. oficinas (a da Servitec só no expediente, uma por ida à base; a de fora, sempre)
    for (const p of idas) {
      const s = p.servitec;
      if (s && noDia(s.a) && noExpEm(s.a, s.b) > 0) add("servitec", s.a, s.b, SERVITEC[0], dur(s.b - s.a));
    }
    for (const i of em(OFICINAS_FORA)) if (noDia(i.a)) add("oficina_fora", i.a, i.b, i.area, dur(i.b - i.a));
    // 6. Auto Vácuo e Hiper Vácuo não enchem água: parar na bica é alerta
    if (equip.tipo === "av" || equip.tipo === "hv") for (const i of em(BICAS)) if (noDia(i.a)) add("bica_vacuo", i.a, i.b, i.area, dur(i.b - i.a));
    // 7. restaurante acima do limite, no expediente
    for (const i of em(RESTAURANTES)) if (noDia(i.a) && i.b - i.a > RESTAURANTE_MIN * 60 && noExpEm(i.a, i.b) > 0) add("restaurante", i.a, i.b, i.area, dur(i.b - i.a));

    // 10. velocidade acima do limite dentro da usina (rota completa: só a partir do dia seguinte)
    for (const e of x.excessos ?? []) if (e.veiculo_id === v.id && e.dia === x.dia) add("velocidade", DIA + e.ini, DIA + e.fim, localEm(DIA + e.ini), `${Math.round(e.vel_max)} km/h · limite ${VELOCIDADE_MAX_USINA} km/h`);

    if (manut) continue;
    const placas = new Set(formasDaPlaca(v.placa));
    // apontamentos do tablet do caminhão (aberto = até agora)
    const apontados = x.tablet.filter((t) => placas.has(t.placa)).map((t) => ({ a: segDoLocal(t.inicio, base), b: t.fim ? segDoLocal(t.fim, base) : fim, categoria: t.categoria_demora }));
    const aoVivo = completarAoVivo(motorNoEixo(linhasMotor, base, x.dia), v, base, x.agoraSeg == null ? null : fim, apontados, comSecundario.has(v.id));
    const blocos = cortarPorVaga(aoVivo, vagas);
    // 8. ligado sem produzir: parado ligado seguido, quando parado ligado não é o produtivo do equipamento (fora do Pátio)
    if (statusProdutivo(equip.tipo, v.placa) !== "stopped")
      for (const b of blocos)
        if (b.cod === "stopped" && noDia(b.a) && noExpDa(b.vaga, b.a, b.b) >= OCIOSO_MIN * 60 && !naLista(PATIO, b.a)) add("ocioso", b.a, b.b, localEm(b.a), dur(b.b - b.a), b.a, b.vaga);
    // 9. ocioso (motor desligado) no expediente, fora do Pátio e das oficinas, sem refeição apontada no tablet
    const refeicoes = apontados.filter((t) => /REFEI/i.test(t.categoria));
    for (const b of blocos) {
      if ((b.cod !== "off" && b.cod !== "main_switch_off") || !noDia(b.a) || noExpDa(b.vaga, b.a, b.b) < DESLIGADO_MIN * 60) continue;
      if (naLista([...PATIO, ...SERVITEC, ...OFICINAS_FORA], b.a) || refeicoes.some((r) => r.a < b.b && r.b > b.a)) continue;
      add("desligado", b.a, b.b, localEm(b.a), dur(b.b - b.a), b.a, b.vaga);
    }
  }
  return out.sort((p, q) => p.ini - q.ini || p.veiculo.localeCompare(q.veiculo));
}

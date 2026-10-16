// Timeline de motor por vaga e apontamentos do tablet (demoras categorizadas), a cada 10 min (pedido do dono,
// 07/10/2026: o site mostra o motor só pelo GAUSS, sem RPM). Substitui a extração do PC (automation/): NÃO rodar as
// duas juntas, o GAUSS seria consultado em dobro.
//
// Carga mínima no GAUSS (é o mesmo usuário consultando pouco, como uma pessoa faria):
//   - uma vaga por requisição (é assim que a tela do GAUSS faz), na fila serial do gauss.ts (2–3 s entre elas);
//   - as vagas que a Mecanizada opera (regra do segundo cérebro, vagas-oficiais.ts), da lista do GAUSS (a tela do
//     GAUSS é por vaga; 15/10/2026: a planilha não decide mais quais vagas buscar, o caminhão roda entre as vagas);
//   - vaga cujo caminhão (o que o GAUSS diz estar nela) está desligado ou sem sinal desde antes da última busca é
//     pulada por até 1 h: nada mudou lá; vaga sem caminhão da frota também; a cada hora é buscada de novo mesmo assim;
//   - na 1ª busca do dia de cada vaga, o dia anterior é buscado uma vez para fechar o fim do dia;
//   - o tablet é UMA requisição para a frota inteira por ciclo;
//   - a lista de vagas do GAUSS (para achar as dos Brook e Aspiradores) é lida 1 vez por dia.
import { diaLocal } from "../src/lib/dominio/formato";
import { formasDaPlaca } from "../src/lib/dominio/gauss-dia";
import { vagaOficial } from "../src/lib/dominio/vagas-oficiais";
import type { Veiculo } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const CICLO_MS = 10 * 60 * 1000;
/** vaga quieta (desligada) é buscada de novo depois disto, mesmo sem mudança */
export const MAX_QUIETA_MS = 60 * 60 * 1000;
/**
 * Tempo do ciclo para a timeline (a execução tem 8 min no Actions). Na virada do dia toda vaga busca ontem e hoje e
 * não cabe numa execução só: passou disso, para de pegar vaga nova, grava o que fez e a próxima execução continua.
 * (16/10/2026: sem este limite a execução morria no meio, perdia o feito e recomeçava do zero a cada 5 min.)
 */
export const ORCAMENTO_MOTOR_MS = 3 * 60 * 1000;
// o disparo não é pontual (5 em 5 min com atraso): 1 min de folga para não pular um ciclo de 10 min
const FOLGA_MS = 60 * 1000;

export interface Vaga {
  id: number;
  nome: string;
}
/** Vagas conhecidas (as da extração do PC): valem até a lista do GAUSS ser lida e se a leitura falhar. */
export const VAGAS: Vaga[] = [
  { id: 530, nome: "ALTA PRESSÃO - GPS - 01 - 24 HS" },
  { id: 536, nome: "ALTA PRESSÃO - GPS - 02" },
  { id: 535, nome: "ALTA PRESSÃO - GPS - 03" },
  { id: 526, nome: "ALTA PRESSÃO - GPS - 04" },
  { id: 527, nome: "ALTA PRESSÃO - GPS - 05" },
  { id: 529, nome: "ALTA PRESSÃO - GPS - 06" },
  { id: 532, nome: "ALTA PRESSÃO - GPS - 07 - 16 HS" },
  { id: 545, nome: "ALTA PRESSÃO - GPS - 08 - 24 HS" },
  { id: 826, nome: "ALTA PRESSÃO - GPS - 09" },
  { id: 531, nome: "ALTA PRESSÃO - GPS - 10" },
  { id: 311, nome: "AUTO VÁCUO - GPS - 01 - 24 HS" },
  { id: 1109, nome: "AUTO VÁCUO - GPS - 02" },
  { id: 312, nome: "AUTO VÁCUO - GPS - 03" },
  { id: 317, nome: "AUTO VÁCUO - GPS - 04" },
  { id: 316, nome: "AUTO VÁCUO - GPS - 05" },
  { id: 308, nome: "AUTO VÁCUO - GPS - 06" },
  { id: 825, nome: "AUTO VÁCUO - GPS - 07 - 16 HS" },
  { id: 573, nome: "AUTO VÁCUO - GPS - 08 - 24 HS" },
  { id: 416, nome: "HIPER VÁCUO - GPS - 01" },
  { id: 546, nome: "HIPER VÁCUO - GPS - 02" },
  { id: 415, nome: "HIPER VÁCUO - GPS - 03" },
];
const TAGS_TABLET = ["#ALTA PRESSAO", "#AUTO VACUO", "#HIPER VACUO", "#BROOK"];
/** a lista de vagas do GAUSS muda pouco: relida 1 vez por dia (1 requisição) */
const LISTA_TTL_MS = 24 * 60 * 60 * 1000;

/** O que o coletor lembra entre execuções (loc_kv "motor"): quando foi o último ciclo e a última busca de cada vaga. */
export interface ControleMotor {
  ciclo: string | null;
  /** veiculo: o caminhão que o GAUSS diz estar na vaga na última busca (vacancy_info) */
  vagas: Record<string, { dia: string; em: string; veiculo?: string }>;
  /** 2 = trecho com o caminhão do próprio trecho e troca do dia inteiro (15/10/2026); sem ele, tudo é buscado de novo */
  versao?: number;
  /** último dia em que o tablet foi buscado (para fechar o dia anterior uma vez) */
  tabletDia?: string;
}

export interface Busca {
  vaga: Vaga;
  /** buscar também o dia anterior inteiro (1ª busca do dia desta vaga) */
  ontem: string | null;
}

export const VERSAO_MOTOR = 2;
const normal = (s: string) => s.trim().toUpperCase();
const quieto = (v: Pick<Veiculo, "status" | "sem_sinal">) => v.sem_sinal || /desligad/i.test(v.status);
/** Vaga que a Mecanizada opera (vagas-oficiais.ts); a lista do GAUSS traz 58 da GPS e as das outras empresas. */
export const daGps = (v: Vaga) => vagaOficial(v.nome);

type VeiculoEscolha = Pick<Veiculo, "id" | "vaga" | "status" | "status_desde" | "sem_sinal" | "motor2_de">;

/** Vagas a buscar neste ciclo; null = ainda não deu 10 min desde o último ciclo. */
export function escolherVagas(frota: VeiculoEscolha[], controle: ControleMotor, agora: Date, vagas: Vaga[] = VAGAS): Busca[] | null {
  if (controle.ciclo && agora.getTime() - new Date(controle.ciclo).getTime() < CICLO_MS - FOLGA_MS) return null;
  const hoje = diaLocal(agora);
  const principais = frota.filter((v) => !v.motor2_de);
  const porId = new Map(principais.map((v) => [v.id, v]));
  const porVaga = new Map(principais.map((v) => [normal(v.vaga), v]));
  // controle de antes da versão 2: as linhas de hoje estão com o caminhão errado e todas as vagas são buscadas de novo
  // (os dias anteriores ficam com o reprocessamento, reprocesso.ts)
  const antigo = (controle.versao ?? 1) < VERSAO_MOTOR;
  const r: Busca[] = [];
  for (const vaga of vagas.filter(daGps)) {
    const ult = controle.vagas[vaga.id];
    // o caminhão que o GAUSS disse estar na vaga vale mais que a planilha
    const v = (ult?.veiculo ? porId.get(ult.veiculo) : undefined) ?? porVaga.get(normal(vaga.nome));
    if (antigo) {
      r.push({ vaga, ontem: null });
      continue;
    }
    const hojeJa = ult?.dia === hoje;
    if (hojeJa && ult) {
      const desde = agora.getTime() - new Date(ult.em).getTime();
      // sem mudança desde a última busca (desligado/sem sinal antes dela, ou vaga sem caminhão da frota): pula por até 1 h
      const parada = !v || (quieto(v) && !!v.status_desde && new Date(v.status_desde).getTime() < new Date(ult.em).getTime());
      if (parada && desde < MAX_QUIETA_MS) continue;
    }
    r.push({ vaga, ontem: ult && ult.dia < hoje ? ult.dia : null });
  }
  return r;
}

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return diaLocal(d);
};
export const diaAnterior = (dia: string) => somarDias(dia, -1);
export const diaSeguinte = (dia: string) => somarDias(dia, 1);

/**
 * Vagas da lista do filtro do GAUSS (o mesmo /filter/dynamic que a tela usa; action "vacancy"): "value='530'" e o nome
 * no <label>. Aceita aspas simples ou duplas.
 */
export function lerVagasDoHtml(html: string): Vaga[] {
  const r = [...html.matchAll(/value=['"](\d+)['"][^>]*>[\s\S]*?<label[^>]*>([^<]+)<\/label>/g)].map(([, id, nome]) => ({ id: Number(id), nome: nome.trim() }));
  return r.filter((v) => v.nome && !/^\[S\/ VAGA\]$/i.test(v.nome));
}

/** Junta as vagas conhecidas com as lidas do GAUSS (sem repetir id); as do GAUSS trazem as dos Brook e Aspiradores. */
export const juntarVagas = (lidas: Vaga[]): Vaga[] => [...new Map([...VAGAS, ...lidas].map((v) => [v.id, v])).values()];

export async function listaDeVagas(client: GaussFleetClient, agora: Date): Promise<Vaga[]> {
  const guardada = await kvGet<{ em: string; vagas: Vaga[] }>("motor_vagas");
  if (guardada && agora.getTime() - new Date(guardada.em).getTime() < LISTA_TTL_MS) return juntarVagas(guardada.vagas);
  try {
    const data = await client.post<{ html?: string }>("/filter/dynamic", [
      ["action", "vacancy"],
      ["page_id", "timeline-engine-by-vacancy"],
      ["contract_job_checked", 0],
    ]);
    const lidas = lerVagasDoHtml(data.html ?? "");
    // lista vazia (formato mudou?): não guarda, usa as conhecidas e tenta amanhã de novo pela guardada antiga
    if (lidas.length) await kvSet("motor_vagas", { em: agora.toISOString(), vagas: lidas });
    else console.warn("⚠ lista de vagas do GAUSS veio vazia: usando as vagas conhecidas");
    return juntarVagas(lidas.length ? lidas : (guardada?.vagas ?? []));
  } catch (e) {
    console.warn(`⚠ lista de vagas: ${e instanceof Error ? e.message : String(e)}`);
    return juntarVagas(guardada?.vagas ?? []);
  }
}

export interface SegmentoGauss {
  start: string;
  end: string;
  status: string;
  status_?: string;
  total_time?: number | string;
  bgColor?: string;
  /** getModalInfosTimelineEngine('<veículo do trecho>', status, início, fim, ...) */
  callback?: string;
  vehicle_name?: string | null;
  /** o caminhão DESTE trecho (vazio em "sem apropriação") */
  vehicle_data?: { vehicle_cs_code?: string | number; vehicle_name?: string } | [] | null;
  /** a vaga e o caminhão que está nela AGORA (igual em todos os trechos da resposta: não serve para o trecho) */
  vacancy_info?: { vehicle_cs_code?: string | number };
}
export interface LinhaMotor {
  vaga_id: number;
  vaga_nome: string;
  inicio: string;
  fim: string;
  status: string;
  status_label: string;
  tempo_total_horas: number | string | null;
  /** id do veículo do trecho no GAUSS; "" = sem caminhão (sem apropriação) */
  placa_ou_codigo: string;
  placa: string | null;
  cor: string | null;
}

/**
 * O caminhão do trecho: vehicle_data (e, se faltar, o 1º argumento do callback do balão, que a tela do GAUSS usa).
 * Nunca o vacancy_info, que é o caminhão da vaga na hora da busca (captura de 15/10/2026: AP-01 teve EAM-3253 e
 * PUB2F80 no dia, e o vacancy_info dizia um só).
 */
export function veiculoDoTrecho(s: SegmentoGauss): string {
  if (s.status === "not_appropriated") return "";
  const vd = s.vehicle_data && !Array.isArray(s.vehicle_data) ? s.vehicle_data : null;
  const cod = vd?.vehicle_cs_code ?? s.callback?.match(/getModalInfosTimelineEngine\(\s*'(\d*)'/)?.[1] ?? "";
  return String(cod);
}

/** Converte a resposta do GAUSS em linhas de timeline_motor_vaga, cada trecho com o seu caminhão. */
export function linhasDaVaga(vaga: Vaga, msg: SegmentoGauss[]): LinhaMotor[] {
  return msg.map((s) => {
    const veiculo = veiculoDoTrecho(s);
    const vd = s.vehicle_data && !Array.isArray(s.vehicle_data) ? s.vehicle_data : null;
    return {
      vaga_id: vaga.id,
      vaga_nome: vaga.nome,
      inicio: s.start,
      fim: s.end,
      status: s.status,
      status_label: s.status_ ?? s.status,
      tempo_total_horas: s.total_time ?? null,
      placa_ou_codigo: veiculo,
      placa: veiculo ? (s.vehicle_name ?? vd?.vehicle_name ?? null) : null,
      cor: s.bgColor ?? null,
    };
  });
}

/** O caminhão que o GAUSS diz estar na vaga agora (para saber se a vaga está quieta no próximo ciclo). */
export const veiculoDaVaga = (msg: SegmentoGauss[]): string | undefined => {
  const c = msg.find((s) => s.vacancy_info?.vehicle_cs_code)?.vacancy_info?.vehicle_cs_code;
  return c ? String(c) : undefined;
};

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Timeline de uma vaga num intervalo, como a tela do GAUSS pede (uma vaga por requisição). */
export async function buscarVaga(client: GaussFleetClient, vaga: Vaga, vagas: Vaga[], de: string, ate: string): Promise<SegmentoGauss[]> {
  const campos: Campo[] = [
    ["action", "timeline-engine-by-vacancy"],
    ["vacancy", vaga.id],
    ["initial_date_time", de],
    ["final_date_time", ate],
    ["control_ajax_number_unavailability_dash_by_vacancy", 1],
    // a tela do GAUSS manda a posição de cada vaga na grade; igual à extração do PC
    ...vagas.map((v, i): Campo => [`rowsReference[${v.id}]`, i + 1]),
  ];
  const data = await client.post<{ error?: boolean; msg?: SegmentoGauss[] }>("/data/hard-vehicle/analytics/timeline-engine-by-vacancy/", campos);
  if (data.error) throw new Error(`timeline de motor da vaga ${vaga.nome} respondeu error`);
  if (!Array.isArray(data.msg)) throw new Error(`timeline de motor da vaga ${vaga.nome}: resposta sem a lista de trechos`);
  return data.msg;
}

/** Trechos cortados no dia (o GAUSS já corta no intervalo pedido; isto só garante que nada passa da meia-noite). */
export function cortarNoDia(linhas: LinhaMotor[], dia: string): LinhaMotor[] {
  const ini = `${dia} 00:00:00`;
  const fim = `${diaSeguinte(dia)} 00:00:00`;
  const n = (t: string) => (t.length === 16 ? `${t}:00` : t).replace("T", " ");
  return linhas
    .map((l) => ({
      ...l,
      inicio: n(l.inicio) < ini ? ini : l.inicio,
      fim: n(l.fim) > fim ? fim : l.fim,
    }))
    .filter((l) => n(l.fim) > n(l.inicio));
}

/**
 * Troca o dia inteiro da vaga pelo que o GAUSS mandou, numa transação só (supabase/2026-10-15_timeline-por-vaga.sql):
 * trecho que o GAUSS corrigiu ou dividiu depois não sobra, e uma falha não deixa o dia pela metade.
 */
export async function gravarDiaDaVaga(vaga: Vaga, dia: string, linhas: LinhaMotor[]): Promise<number> {
  const rows = unicos(cortarNoDia(linhas, dia), (r) => `${r.vaga_id}|${r.inicio}|${r.fim}`);
  const n = await ok(
    db().rpc("substituir_timeline_vaga", {
      p_vaga: String(vaga.id),
      p_dia: dia,
      p_vaga_nome: vaga.nome,
      p_linhas: rows,
    }),
  );
  return Number(n ?? rows.length);
}

/** Busca o dia (de 00:00 até `ate`) de uma vaga e troca no banco. Devolve as linhas e o caminhão da vaga agora. */
export async function refazerDiaDaVaga(client: GaussFleetClient, vaga: Vaga, vagas: Vaga[], dia: string, ate = "23:59") {
  const msg = await buscarVaga(client, vaga, vagas, `${dia} 00:00`, `${dia} ${ate}`);
  const n = await gravarDiaDaVaga(vaga, dia, linhasDaVaga(vaga, msg));
  return { linhas: n, veiculo: veiculoDaVaga(msg) };
}

interface DemoraGauss {
  cod: number | string;
  vehicle_name: string;
  contract_position?: string;
  delay_name: string;
  unformatted_start: string;
  unformatted_end: string | null;
  unavailability_time?: string | number;
  concluded?: string;
  justify_date?: string;
  justifier_name?: string;
  driver_name?: string;
}

async function buscarTablet(client: GaussFleetClient, ids: string[], dia: string) {
  const campos: Campo[] = [
    ["filtered", "0"],
    ["start_day", dia],
    ["start_hour", "00:00"],
    ["end_day", dia],
    ["end_hour", "23:59"],
    ...TAGS_TABLET.map((t): Campo => ["hashtags[]", t]),
    ...ids.map((id): Campo => ["vehicle[]", id]),
  ];
  const data = await client.post<{ error?: boolean; msg?: DemoraGauss[] }>("/data/hard-driver/telemetry/delays-categorized/", campos);
  if (data.error) throw new Error("apontamentos do tablet responderam error");
  return (data.msg ?? [])
    .filter((r) => !/SERVITEC|^TROCA/i.test(r.contract_position ?? ""))
    .map((r) => ({
      demora_cod: r.cod,
      placa: r.vehicle_name,
      vaga: r.contract_position ?? "",
      categoria_demora: r.delay_name,
      inicio: r.unformatted_start,
      fim: r.unformatted_end,
      tempo_indisponivel: r.unavailability_time ?? null,
      concluido: r.concluded ?? null,
      justificativa: r.justify_date ?? null,
      justificador: r.justifier_name ?? null,
      motorista: r.driver_name ?? null,
    }));
}

/** A mesma chave aparecer duas vezes no lote faz o Postgres recusar o upsert: fica a última. */
const unicos = <T>(rows: T[], chave: (r: T) => string) => [...new Map(rows.map((r) => [chave(r), r])).values()];

/** Apontamentos do banco que o GAUSS não manda mais (apagados lá): do dia, das placas buscadas, fora da resposta. */
export function apontamentosSumidos(banco: { demora_cod: number | string; placa: string }[], placas: string[], novos: (number | string)[]): string[] {
  const formas = new Set(placas.flatMap(formasDaPlaca));
  const vivos = new Set(novos.map(String));
  return banco.filter((r) => formas.has(r.placa) && !vivos.has(String(r.demora_cod))).map((r) => String(r.demora_cod));
}

/**
 * Apontamentos do tablet de um dia inteiro para os caminhões da frota: grava os que vieram e apaga os que o GAUSS
 * não manda mais (só desses caminhões e desse dia; os demais ficam como estão).
 */
export async function refazerTabletDoDia(client: GaussFleetClient, frota: Veiculo[], dia: string): Promise<number> {
  const principais = frota.filter((v) => !v.motor2_de && v.equip);
  if (!principais.length) return 0;
  const rows = unicos(
    await buscarTablet(
      client,
      principais.map((v) => v.id),
      dia,
    ),
    (r) => String(r.demora_cod),
  );
  if (rows.length) await ok(db().from("demoras_categorizadas").upsert(rows, { onConflict: "demora_cod" }));
  const banco = ((await ok(db().from("demoras_categorizadas").select("demora_cod, placa").gte("inicio", dia).lt("inicio", diaSeguinte(dia)).limit(5000))) ?? []) as {
    demora_cod: number | string;
    placa: string;
  }[];
  const sumidos = apontamentosSumidos(
    banco,
    principais.map((v) => v.placa),
    rows.map((r) => r.demora_cod),
  );
  if (sumidos.length) await ok(db().from("demoras_categorizadas").delete().in("demora_cod", sumidos));
  return rows.length;
}

/**
 * Ciclo de 10 min: timeline de motor das vagas escolhidas e o tablet da frota → Supabase. Falha aqui não derruba o
 * coletor (posições e pedidos de histórico seguem); a vaga que falhou é buscada de novo no próximo ciclo.
 */
export async function coletarMotor(client: GaussFleetClient, frota: Veiculo[], agora: Date): Promise<string | null> {
  const controle: ControleMotor = (await kvGet<ControleMotor>("motor")) ?? {
    ciclo: null,
    vagas: {},
  };
  // ainda não deu 10 min: nem a lista de vagas é lida
  if (!escolherVagas([], controle, agora, [])) return null;
  const vagas = await listaDeVagas(client, agora);
  const buscas = escolherVagas(frota, controle, agora, vagas) ?? [];
  const hoje = diaLocal(agora);
  let linhas = 0;
  let falhas = 0;
  let feitas = 0;
  for (const b of buscas) {
    if (Date.now() - agora.getTime() > ORCAMENTO_MOTOR_MS) break;
    feitas++;
    try {
      if (b.ontem) linhas += (await refazerDiaDaVaga(client, b.vaga, vagas, b.ontem)).linhas;
      const r = await refazerDiaDaVaga(client, b.vaga, vagas, hoje, hm(agora));
      controle.vagas[b.vaga.id] = {
        dia: hoje,
        em: agora.toISOString(),
        veiculo: r.veiculo,
      };
      linhas += r.linhas;
    } catch (e) {
      falhas++;
      // esquecida: no próximo ciclo é buscada de novo (não cai na regra da vaga quieta)
      delete controle.vagas[b.vaga.id];
      console.warn(`⚠ vaga ${b.vaga.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // versão nova só quando todas as vagas foram refeitas (senão as que ficaram para trás não seriam buscadas de novo)
  if (feitas === buscas.length) controle.versao = VERSAO_MOTOR;
  // tablet: uma requisição para a frota inteira (e o dia anterior uma vez, no 1º ciclo do dia)
  let apontamentos = 0;
  try {
    const dias = controle.tabletDia && controle.tabletDia < hoje ? [controle.tabletDia, hoje] : [hoje];
    for (const d of dias) apontamentos += await refazerTabletDoDia(client, frota, d);
    controle.tabletDia = hoje;
  } catch (e) {
    falhas++;
    console.warn(`⚠ tablet: ${e instanceof Error ? e.message : String(e)}`);
  }
  // ficou vaga para trás (tempo do ciclo): não marca o ciclo, para a próxima execução continuar sem esperar 10 min
  const resta = buscas.length - feitas;
  if (!resta) controle.ciclo = agora.toISOString();
  await kvSet("motor", controle);
  return `${feitas} vaga(s)${resta ? ` (${resta} para a próxima execução)` : ""}, ${linhas} trecho(s) de motor, ${apontamentos} apontamento(s) do tablet${falhas ? `, ${falhas} falha(s)` : ""}`;
}

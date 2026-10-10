// Timeline de motor por vaga e apontamentos do tablet (demoras categorizadas), a cada 10 min (pedido do dono,
// 07/10/2026: o site mostra o motor só pelo GAUSS, sem RPM). Substitui a extração do PC (automation/): NÃO rodar as
// duas juntas, o GAUSS seria consultado em dobro.
//
// Carga mínima no GAUSS (é o mesmo usuário consultando pouco, como uma pessoa faria):
//   - uma vaga por requisição (é assim que a tela do GAUSS faz), na fila serial do gauss.ts (2–3 s entre elas);
//   - só as vagas com equipamento da frota da Mecanizada (a matriz), mais as que já foram buscadas hoje;
//   - vaga cujo caminhão está desligado (ou sem sinal) desde antes da última busca é pulada por até 1 h:
//     nada mudou lá; a cada hora ela é buscada de novo mesmo assim;
//   - na 1ª busca do dia de cada vaga, o dia anterior é buscado uma vez para fechar o fim do dia;
//   - o tablet é UMA requisição para a frota inteira por ciclo;
//   - a lista de vagas do GAUSS (para achar as dos Brook e Aspiradores) é lida 1 vez por dia.
import { diaLocal } from "../src/lib/dominio/formato";
import type { Veiculo } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const CICLO_MS = 10 * 60 * 1000;
/** vaga quieta (desligada) é buscada de novo depois disto, mesmo sem mudança */
export const MAX_QUIETA_MS = 60 * 60 * 1000;
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
  vagas: Record<string, { dia: string; em: string }>;
  /** último dia em que o tablet foi buscado (para fechar o dia anterior uma vez) */
  tabletDia?: string;
}

export interface Busca {
  vaga: Vaga;
  /** buscar também o dia anterior inteiro (1ª busca do dia desta vaga) */
  ontem: string | null;
}

const normal = (s: string) => s.trim().toUpperCase();
const quieto = (v: Pick<Veiculo, "status" | "sem_sinal">) => v.sem_sinal || /desligad/i.test(v.status);

/** Vagas a buscar neste ciclo; null = ainda não deu 10 min desde o último ciclo. */
export function escolherVagas(frota: Pick<Veiculo, "vaga" | "status" | "status_desde" | "sem_sinal" | "motor2_de">[], controle: ControleMotor, agora: Date, vagas: Vaga[] = VAGAS): Busca[] | null {
  if (controle.ciclo && agora.getTime() - new Date(controle.ciclo).getTime() < CICLO_MS - FOLGA_MS) return null;
  const hoje = diaLocal(agora);
  const porVaga = new Map(frota.filter((v) => !v.motor2_de).map((v) => [normal(v.vaga), v]));
  const r: Busca[] = [];
  for (const vaga of vagas) {
    const v = porVaga.get(normal(vaga.nome));
    const ult = controle.vagas[vaga.id];
    const hojeJa = ult?.dia === hoje;
    // fora da frota agora e ainda não buscada hoje: não interessa
    if (!v && !hojeJa) continue;
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

async function listaDeVagas(client: GaussFleetClient, agora: Date): Promise<Vaga[]> {
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

interface SegmentoGauss {
  start: string;
  end: string;
  status: string;
  status_?: string;
  total_time?: number | string;
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
  placa_ou_codigo: string;
}

/** Converte a resposta do GAUSS em linhas de timeline_motor_vaga (o mesmo formato da extração do PC). */
export function linhasDaVaga(vaga: Vaga, msg: SegmentoGauss[]): LinhaMotor[] {
  return msg.map((s) => ({
    vaga_id: vaga.id,
    vaga_nome: vaga.nome,
    inicio: s.start,
    fim: s.end,
    status: s.status,
    status_label: s.status_ ?? s.status,
    tempo_total_horas: s.total_time ?? null,
    placa_ou_codigo: String(s.vacancy_info?.vehicle_cs_code ?? ""),
  }));
}

const hm = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

async function buscarVaga(client: GaussFleetClient, vaga: Vaga, vagas: Vaga[], de: string, ate: string): Promise<LinhaMotor[]> {
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
  return linhasDaVaga(vaga, data.msg ?? []);
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

/**
 * Ciclo de 10 min: timeline de motor das vagas escolhidas e o tablet da frota → Supabase. Falha aqui não derruba o
 * coletor (posições e pedidos de histórico seguem); a vaga que falhou é tentada no próximo ciclo.
 */
export async function coletarMotor(client: GaussFleetClient, frota: Veiculo[], agora: Date): Promise<string | null> {
  const controle: ControleMotor = (await kvGet<ControleMotor>("motor")) ?? { ciclo: null, vagas: {} };
  // ainda não deu 10 min: nem a lista de vagas é lida
  if (!escolherVagas([], controle, agora, [])) return null;
  const vagas = await listaDeVagas(client, agora);
  const buscas = escolherVagas(frota, controle, agora, vagas) ?? [];
  const hoje = diaLocal(agora);
  let linhas = 0;
  let falhas = 0;
  for (const b of buscas) {
    try {
      const rows = [...(b.ontem ? await buscarVaga(client, b.vaga, vagas, `${b.ontem} 00:00`, `${b.ontem} 23:59`) : []), ...(await buscarVaga(client, b.vaga, vagas, `${hoje} 00:00`, `${hoje} ${hm(agora)}`))];
      if (rows.length) await ok(db().from("timeline_motor_vaga").upsert(unicos(rows, (r) => `${r.vaga_id}|${r.inicio}|${r.fim}`), { onConflict: "vaga_id,inicio,fim" }));
      controle.vagas[b.vaga.id] = { dia: hoje, em: agora.toISOString() };
      linhas += rows.length;
    } catch (e) {
      falhas++;
      console.warn(`⚠ vaga ${b.vaga.nome}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  // tablet: uma requisição para a frota inteira (e o dia anterior uma vez, no 1º ciclo do dia)
  let apontamentos = 0;
  const ids = frota.filter((v) => !v.motor2_de && v.equip).map((v) => v.id);
  if (ids.length) {
    try {
      const dias = controle.tabletDia && controle.tabletDia < hoje ? [controle.tabletDia, hoje] : [hoje];
      for (const d of dias) {
        const rows = await buscarTablet(client, ids, d);
        if (rows.length) await ok(db().from("demoras_categorizadas").upsert(unicos(rows, (r) => String(r.demora_cod)), { onConflict: "demora_cod" }));
        apontamentos += rows.length;
      }
      controle.tabletDia = hoje;
    } catch (e) {
      falhas++;
      console.warn(`⚠ tablet: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  controle.ciclo = agora.toISOString();
  await kvSet("motor", controle);
  return `${buscas.length} vaga(s), ${linhas} trecho(s) de motor, ${apontamentos} apontamento(s) do tablet${falhas ? `, ${falhas} falha(s)` : ""}`;
}

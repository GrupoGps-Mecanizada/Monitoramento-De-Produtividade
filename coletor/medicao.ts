// Medição oficial do GAUSS, Fase 1 (desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md).
// Uma vez por dia, a partir das 07:00: lista os boletins GPS dos últimos 90 dias no Dashboard Medição e baixa
// (get_data) os que ainda não estão no banco, no máximo 1 por ciclo e até 3 tentativas por boletim no dia.
// Boletim fechado não muda: baixado uma vez, fica guardado.
//
// CUIDADO: a tela Medição Mensal (/data/measurement/...) GRAVA registro no GAUSS só de listar (incidente
// SAVED192881, 08/10/2026). Toda chamada daqui passa por conferirChamada, que só deixa passar a lista do
// Dashboard e o get_data. Rota completa: automation/medicao/README.md (fora deste repositório).
import { lerBoletim, type BoletimLido, type LinhaListaBoletim } from "../src/lib/dominio/medicao";
import { diaLocal } from "../src/lib/dominio/formato";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const LISTA = "/data/hard-vehicle/measurements-usiminas/dashboard/";
export const DETALHE = "/operations/measurement-usiminas/dashboard/";
const PRESTADOR_GPS = 13;
export const HORA_INICIO = 7;
export const MAX_TENTATIVAS = 3;
const DIAS_LISTA = 90;
// o get_data devolve todas as vagas de uma vez (~16 MB): mais tempo e uma tentativa só
const OPCOES_GET_DATA = { timeoutMs: 180_000, tentativas: 1 };
const LOTE = 500;

const CAMPOS_LISTA = new Set(["filtered", "logistic_providers[]", "start_day", "start_hour", "end_day", "end_hour"]);
const PROIBIDO = /reprocess|consolidate|delete|close_|send_|save/i;

/** Só a lista do Dashboard (campos do filtro) e o get_data passam; o resto lança erro antes de sair para o GAUSS. */
export function conferirChamada(path: string, campos: Campo[]): void {
  if (path.includes("/data/measurement/")) throw new Error(`medição: endereço proibido (${path}): grava registro no GAUSS`);
  for (const [chave, valor] of campos) {
    if (PROIBIDO.test(chave)) throw new Error(`medição: campo proibido (${chave})`);
    // rowData é a linha do boletim devolvida de volta (nome, datas, ícone): texto livre do próprio GAUSS
    if (!chave.startsWith("rowData[") && PROIBIDO.test(String(valor))) throw new Error(`medição: valor proibido em ${chave}`);
  }
  const chaves = campos.map(([k]) => k);
  if (path === LISTA) {
    if (chaves.every((k) => CAMPOS_LISTA.has(k))) return;
    throw new Error("medição: a lista do Dashboard só aceita os campos do filtro");
  }
  if (path === DETALHE) {
    const acoes = campos.filter(([k]) => k === "action").map(([, v]) => String(v));
    const camposOk = chaves.every((k) => k === "action" || k === "cod" || k === "contract_code" || /^rowData\[[^\]]+\]$/.test(k));
    if (acoes.length === 1 && acoes[0] === "get_data" && camposOk) return;
    throw new Error("medição: no Dashboard só o get_data é permitido");
  }
  throw new Error(`medição: endereço não permitido (${path})`);
}

/** Filtro da lista do Dashboard (sem "view-all-measurements": esse campo quer dizer "só consolidadas"). */
export const camposLista = (de: string, ate: string): Campo[] => [
  ["filtered", 0],
  ["logistic_providers[]", PRESTADOR_GPS],
  ["start_day", de],
  ["start_hour", "00:00"],
  ["end_day", ate],
  ["end_hour", "23:59"],
];

/** O mesmo que o duplo clique na linha do boletim: a linha inteira vai de volta em rowData[...]. */
export function camposGetData(linha: LinhaListaBoletim): Campo[] {
  const campos: Campo[] = [["action", "get_data"], ["cod", linha.cod], ["contract_code", ""]];
  for (const [k, v] of Object.entries(linha)) campos.push([`rowData[${k}]`, v == null ? "" : typeof v === "object" ? JSON.stringify(v) : (v as string | number)]);
  return campos;
}

/** Guardado em loc_kv "medicao": o dia da última lista, os boletins que faltam baixar e as tentativas do dia. */
export interface ControleMedicao {
  dia: string;
  pendentes: LinhaListaBoletim[];
  tentativas: Record<string, number>;
}
export interface DepsMedicao {
  lerControle(): Promise<ControleMedicao | null>;
  gravarControle(c: ControleMedicao): Promise<void>;
  /** Códigos dos boletins já gravados por inteiro (completo = true). */
  completos(): Promise<Set<string>>;
  listar(de: string, ate: string): Promise<LinhaListaBoletim[]>;
  getData(linha: LinhaListaBoletim): Promise<Record<string, unknown>[]>;
  gravar(lido: BoletimLido): Promise<void>;
}

const ehGps = (l: LinhaListaBoletim) => /^GPS\b/i.test(String(l.identification ?? "").trim());

/** Um passo do ciclo. Devolve o que fez (para o log) ou null se não havia nada a fazer. */
export async function coletarMedicao(deps: DepsMedicao, agora: Date): Promise<string | null> {
  if (agora.getHours() < HORA_INICIO) return null;
  const hoje = diaLocal(agora);
  let c = await deps.lerControle();
  let listou: string | null = null;
  if (c?.dia !== hoje) {
    // o banco antes do GAUSS: sem as tabelas (SQL não rodado), nem chama o GAUSS
    const feitos = await deps.completos();
    const de = diaLocal(new Date(agora.getTime() - DIAS_LISTA * 86_400_000));
    let linhas: LinhaListaBoletim[];
    try {
      linhas = await deps.listar(de, hoje);
    } catch (e) {
      // não insiste a cada 5 min: tenta de novo amanhã
      await deps.gravarControle({ dia: hoje, pendentes: [], tentativas: {} });
      throw e;
    }
    c = { dia: hoje, pendentes: linhas.filter((l) => ehGps(l) && !feitos.has(l.cod)), tentativas: {} };
    await deps.gravarControle(c);
    listou = `lista: ${c.pendentes.length} boletim(ns) novo(s)`;
  }
  const atual = c;
  const alvo = atual.pendentes.find((p) => (atual.tentativas[p.cod] ?? 0) < MAX_TENTATIVAS);
  if (!alvo) return listou;
  try {
    const lido = lerBoletim(alvo, await deps.getData(alvo));
    if (!lido.vagas.length) throw new Error(`boletim ${alvo.cod} sem vagas`);
    await deps.gravar(lido);
    await deps.gravarControle({ ...atual, pendentes: atual.pendentes.filter((p) => p.cod !== alvo.cod) });
    return `boletim ${lido.boletim.identificacao}: ${lido.vagas.length} vagas, ${lido.eventos.length} indisponibilidades`;
  } catch (e) {
    await deps.gravarControle({ ...atual, tentativas: { ...atual.tentativas, [alvo.cod]: (atual.tentativas[alvo.cod] ?? 0) + 1 } });
    throw e;
  }
}

async function emLotes<T>(linhas: T[], gravar: (lote: T[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += LOTE) await ok(gravar(linhas.slice(i, i + LOTE)));
}

/** O boletim entra primeiro (as outras tabelas apontam para ele) como incompleto; só no fim vira completo. */
async function gravarBoletim({ boletim, vagas, eventos, dias }: BoletimLido): Promise<void> {
  await ok(db().from("medicao_boletim").upsert({ ...boletim, completo: false, baixado_em: new Date().toISOString() }));
  await emLotes(vagas, (l) => db().from("medicao_boletim_vaga").upsert(l, { onConflict: "boletim_cod,vaga_id" }));
  await emLotes(eventos, (l) => db().from("medicao_indisp_evento").upsert(l, { onConflict: "boletim_cod,vaga_id,placa,inicio,tipo", ignoreDuplicates: true }));
  await emLotes(dias, (l) => db().from("medicao_vaga_dia").upsert(l, { onConflict: "boletim_cod,vaga_id,dia" }));
  await ok(db().from("medicao_boletim").update({ completo: true }).eq("cod", boletim.cod));
}

export function depsReais(client: GaussFleetClient): DepsMedicao {
  const chamar = <T>(path: string, campos: Campo[], opcoes?: { timeoutMs?: number; tentativas?: number }) => {
    conferirChamada(path, campos);
    return client.post<T>(path, campos, opcoes);
  };
  return {
    lerControle: () => kvGet<ControleMedicao>("medicao"),
    gravarControle: async (c) => {
      await kvSet("medicao", c);
    },
    completos: async () => new Set(((await ok(db().from("medicao_boletim").select("cod").eq("completo", true))) as { cod: string }[]).map((r) => r.cod)),
    listar: async (de, ate) => {
      // sem boletins no período o GAUSS responde error=true e msg=null
      const r = await chamar<{ msg?: unknown }>(LISTA, camposLista(de, ate));
      return Array.isArray(r.msg) ? (r.msg as LinhaListaBoletim[]) : [];
    },
    getData: async (linha) => {
      const r = await chamar<{ error?: boolean; msg?: unknown }>(DETALHE, camposGetData(linha), OPCOES_GET_DATA);
      if (r.error || !Array.isArray(r.msg)) throw new Error(`get_data do boletim ${linha.cod} não devolveu as vagas`);
      return r.msg as Record<string, unknown>[];
    },
    gravar: gravarBoletim,
  };
}

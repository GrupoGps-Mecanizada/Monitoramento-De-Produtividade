// Parte Diária (P-047): a "Impressão de Detalhes do Atendimento" do GAUSS (Logística Inbound > Imp. Detalhes
// Solicitação), que diz onde cada vaga estava programada para atender: horário, local, endereço, atividade e destino.
// Mesmo caminho da tela (código dela em 18/10/2026): 1 POST com o filtro devolve uma linha por solicitação; depois
// 1 POST por solicitação (action=list-by-request_number) devolve as programações. A tela faz 10 em paralelo; aqui
// é uma por vez, pela fila do gauss.ts.
//
// Sem nomes e sem telefones: a resposta traz solicitante, beneficiário e contatos, que NÃO são gravados. O texto
// livre "details" também fica de fora (às vezes cita pessoas). Da "obs" ficam só os campos da operação.
//
// Ritmo: hoje a cada 30 min (a programação muda ao longo do dia); ontem uma vez depois da virada (fecha o dia);
// e, na primeira vez, os últimos DIAS_INICIAIS dias, um por execução.
import { diaLocal } from "../src/lib/dominio/formato";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const ENDERECO = "/data/hard-vehicle/logistic-inbound/service-printing/";
const PRESTADOR_GPS = 13;
// Aspirador, Caminhão Alta Pressão, Auto Vácuo, Brook, Hiper Vácuo (os grupos marcados na tela)
const GRUPOS = [2, 1, 131, 4, 16];
export const INTERVALO_HOJE_MS = 30 * 60 * 1000;
export const DIAS_INICIAIS = 10;
// a execução tem 8 min no GitHub: com mais que isso já gasto, fica para a próxima
export const ORCAMENTO_INICIO_MS = 4 * 60 * 1000;

/** Só o endereço da tela, sem ação (a lista) ou com action=list-by-request_number; o resto nem sai para o GAUSS. */
export function conferirChamada(path: string, campos: Campo[]): void {
  if (path !== ENDERECO) throw new Error(`parte diária: endereço não permitido (${path})`);
  const acoes = campos.filter(([k]) => k === "action").map(([, v]) => String(v));
  if (acoes.length > 1 || (acoes.length === 1 && acoes[0] !== "list-by-request_number")) throw new Error(`parte diária: ação não permitida (${acoes.join(", ")})`);
}

/** O filtro da tela (form_filter_service-printing) para um dia, por data de atendimento. */
export function camposFiltro(dia: string): Campo[] {
  return [
    ["filtered", 0],
    ["logistic_providers[]", PRESTADOR_GPS],
    ...GRUPOS.map((g): Campo => ["vehicle_group[]", g]),
    ["show-programming-dispatcher", 0],
    ["request_number", ""],
    ["filter-period", 1],
    ["extra-hour", 0],
    ["pdf-file-type", "programming"],
    ["filter-patio", 0],
    ["start_day", dia],
    ["start_hour", "00:00"],
    ["end_day", dia],
    ["end_hour", "23:59"],
  ];
}

/** Como o $.post do jQuery manda um objeto: lista vira chave[], objeto vira chave[sub]. */
export function camposDoObjeto(obj: Record<string, unknown>, prefixo = ""): Campo[] {
  const campos: Campo[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const chave = prefixo ? `${prefixo}[${k}]` : k;
    if (v == null) campos.push([chave, ""]);
    else if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item != null && typeof item === "object") campos.push(...camposDoObjeto(item as Record<string, unknown>, `${chave}[${i}]`));
        else campos.push([`${chave}[]`, item == null ? "" : String(item)]);
      });
    } else if (typeof v === "object") campos.push(...camposDoObjeto(v as Record<string, unknown>, chave));
    else campos.push([chave, typeof v === "boolean" ? String(v) : (v as string | number)]);
  }
  return campos;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const textoLimpo = (s: string) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Os itens "<li><b>PERGUNTA:</b> resposta</li>" da obs, pergunta sem acento e em maiúsculas. */
export function lerObs(obs: string): Map<string, string> {
  const itens = new Map<string, string>();
  for (const m of String(obs ?? "").matchAll(/<b>([\s\S]*?)<\/b>([\s\S]*?)<\/li>/gi)) {
    const pergunta = semAcento(textoLimpo(m[1])).replace(/[\s:?]+$/, "");
    itens.set(pergunta, textoLimpo(m[2]));
  }
  return itens;
}

const sim = (v: string | undefined) => (v == null || v === "" ? null : /^sim/i.test(v));

export interface LinhaParteDiaria {
  chave: string;
  dia: string;
  inicio: string;
  fim: string;
  solicitacao: string;
  vaga_id: number | null;
  vaga: string;
  regime: string | null;
  grupo: string | null;
  equipamento: string | null;
  servico: string | null;
  area: string | null;
  local_origem: string | null;
  endereco: string | null;
  apresentar: string | null;
  atividade: string | null;
  material: string | null;
  classificacao: string | null;
  destino: string | null;
  gerencia: string | null;
  seguranca: { altura: boolean | null; andaime: boolean | null; confinado: boolean | null; gas: boolean | null };
  aprovado: boolean;
  coletado_em: string;
}

const txt = (v: unknown) => {
  const s = v == null ? "" : textoLimpo(String(v));
  return s || null;
};
/** "18/10/2026" -> "2026-10-18" */
const diaIso = (v: unknown) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(v ?? ""));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};

/** Uma programação do GAUSS -> linha da parte_diaria, só com os campos da operação. */
export function lerLinha(g: Record<string, unknown>, coletadoEm: string): LinhaParteDiaria | null {
  const dia = diaIso(g.programmed_date_day);
  const solicitacao = txt(g.request_number);
  const vaga = txt(g.vacancy_name);
  if (!dia || !solicitacao || !vaga) return null;
  const inicio = txt(g.initial_date_time) ?? "";
  const fim = txt(g.final_date_time) ?? "";
  const vagaId = Number(g.vacancy_cod);
  const obs = lerObs(String(g.obs ?? ""));
  const pega = (...comeco: string[]) => {
    for (const [p, v] of obs) if (comeco.some((c) => p.startsWith(c))) return v || null;
    return null;
  };
  return {
    chave: `${solicitacao}|${Number.isFinite(vagaId) ? vagaId : vaga}|${dia}|${inicio}`,
    dia,
    inicio,
    fim,
    solicitacao,
    vaga_id: Number.isFinite(vagaId) && g.vacancy_cod != null && g.vacancy_cod !== "" ? vagaId : null,
    vaga,
    regime: txt(g.vacancy_regime),
    grupo: txt(g.group_name_programmed),
    equipamento: txt(g.vehicle_name),
    servico: txt(g.service_description),
    area: txt(g.geofence),
    local_origem: pega("LOCAL/ORIGEM"),
    endereco: pega("ENDERECO DA ATIVIDADE"),
    apresentar: pega("LOCAL ONDE O OPERADOR"),
    atividade: pega("ATIVIDADE A SER EXECUTADA"),
    material: pega("MATERIAL A SER COLETADO") ?? txt(g.material_details),
    classificacao: pega("CLASSIFICACAO DO MATERIAL"),
    destino: pega("DESTINO DO MATERIAL") ?? txt(g.destiny),
    gerencia: pega("SIGLA / GERENCIA", "SIGLA/GERENCIA"),
    seguranca: {
      altura: sim(pega("SERA TRABALHO EM ALTURA") ?? undefined),
      andaime: sim(pega("ATIVIDADE SERA EXECUTADA EM ANDAIME") ?? undefined),
      confinado: sim(pega("ATIVIDADE EM ESPACO CONFINADO") ?? undefined),
      gas: sim(pega("HA PRESENCA DE GAS") ?? undefined),
    },
    aprovado: g.readonly === true || g.readonly === "true" || g.readonly === 1 || g.readonly === "1",
    coletado_em: coletadoEm,
  };
}

/** Guardado em loc_kv "parte_diaria". */
export interface ControleParteDiaria {
  /** última coleta de hoje (ISO) */
  hoje_em: string | null;
  /** último "ontem" fechado */
  ontem: string | null;
  /** dias antigos que faltam (os mais novos primeiro) */
  atrasados: string[];
  /** depois de uma falha, não tenta de novo antes disso (ISO) */
  espera_ate?: string | null;
}

export interface DepsParteDiaria {
  lerControle(): Promise<ControleParteDiaria | null>;
  gravarControle(c: ControleParteDiaria): Promise<void>;
  /** As solicitações do dia (a primeira chamada da tela). */
  listar(dia: string): Promise<Record<string, unknown>[]>;
  /** As programações de uma solicitação. */
  programacoes(solicitacao: Record<string, unknown>): Promise<Record<string, unknown>[]>;
  /** Grava as linhas do dia e apaga as que sumiram do GAUSS (coletadas antes de coletadoEm). */
  gravar(dia: string, linhas: LinhaParteDiaria[], coletadoEm: string): Promise<void>;
}

const diaAntes = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() - n);
  return diaLocal(d);
};

/** Qual dia buscar agora: ontem (uma vez), hoje (a cada 30 min) ou um dia atrasado. */
export function escolherDia(c: ControleParteDiaria, agora: Date): { dia: string; tipo: "ontem" | "hoje" | "atrasado" } | null {
  const hoje = diaLocal(agora);
  const ontem = diaAntes(hoje, 1);
  if (c.espera_ate && agora.getTime() < new Date(c.espera_ate).getTime()) return null;
  if (c.ontem !== ontem) return { dia: ontem, tipo: "ontem" };
  if (!c.hoje_em || agora.getTime() - new Date(c.hoje_em).getTime() >= INTERVALO_HOJE_MS || diaLocal(new Date(c.hoje_em)) !== hoje) return { dia: hoje, tipo: "hoje" };
  if (c.atrasados.length) return { dia: c.atrasados[0], tipo: "atrasado" };
  return null;
}

/** Um passo do ciclo (no máximo um dia). Devolve o que fez (para o log) ou null. */
export async function coletarParteDiaria(deps: DepsParteDiaria, agora: Date, inicioExecucao: Date = agora): Promise<string | null> {
  if (agora.getTime() - inicioExecucao.getTime() > ORCAMENTO_INICIO_MS) return null;
  const hoje = diaLocal(agora);
  const c: ControleParteDiaria = (await deps.lerControle()) ?? {
    hoje_em: null,
    ontem: null,
    // ontem já entra pelo "ontem"; os atrasados são os dias antes dele
    atrasados: Array.from({ length: DIAS_INICIAIS - 1 }, (_, i) => diaAntes(hoje, i + 2)),
  };
  const alvo = escolherDia(c, agora);
  if (!alvo) return null;
  const coletadoEm = new Date().toISOString();
  let solicitacoes: Record<string, unknown>[];
  let unicas: LinhaParteDiaria[];
  try {
    solicitacoes = await deps.listar(alvo.dia);
    const linhas: LinhaParteDiaria[] = [];
    for (const s of solicitacoes) {
      for (const g of await deps.programacoes(s)) {
        const l = lerLinha(g, coletadoEm);
        if (l && l.dia === alvo.dia) linhas.push(l);
      }
    }
    // a mesma programação pode vir em duas solicitações da lista: fica uma
    unicas = [...new Map(linhas.map((l) => [l.chave, l])).values()];
    // dia sem nada no GAUSS (ou resposta vazia por engano): não apaga o que já estava gravado
    if (unicas.length) await deps.gravar(alvo.dia, unicas, coletadoEm);
  } catch (e) {
    // não insiste a cada 5 min
    await deps.gravarControle({ ...c, espera_ate: new Date(agora.getTime() + INTERVALO_HOJE_MS).toISOString() });
    throw e;
  }
  await deps.gravarControle({
    hoje_em: alvo.tipo === "hoje" ? agora.toISOString() : c.hoje_em,
    ontem: alvo.tipo === "ontem" ? alvo.dia : c.ontem,
    atrasados: c.atrasados.filter((d) => d !== alvo.dia),
    espera_ate: null,
  });
  return `${alvo.dia} (${alvo.tipo}): ${solicitacoes.length} solicitação(ões), ${unicas.length} programação(ões)`;
}

export function depsReais(client: GaussFleetClient): DepsParteDiaria {
  const chamar = async (campos: Campo[]) => {
    conferirChamada(ENDERECO, campos);
    // sem dados o GAUSS responde error=true
    const r = await client.post<{ error?: boolean; msg?: unknown }>(ENDERECO, campos);
    return !r.error && Array.isArray(r.msg) ? (r.msg as Record<string, unknown>[]) : [];
  };
  return {
    lerControle: () => kvGet<ControleParteDiaria>("parte_diaria"),
    gravarControle: async (c) => {
      await kvSet("parte_diaria", c);
    },
    listar: (dia) => chamar(camposFiltro(dia)),
    programacoes: (s) => chamar([...camposDoObjeto(s).filter(([k]) => k !== "action"), ["action", "list-by-request_number"]]),
    gravar: async (dia, linhas, coletadoEm) => {
      await ok(db().from("parte_diaria").upsert(linhas, { onConflict: "chave" }));
      await ok(db().from("parte_diaria").delete().eq("dia", dia).lt("coletado_em", coletadoEm));
    },
  };
}

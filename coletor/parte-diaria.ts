// Parte Diária (P-047): a "Impressão de Detalhes do Atendimento" do GAUSS (Logística Inbound > Imp. Detalhes
// Solicitação), que diz onde cada vaga estava programada para atender: horário, local, endereço, atividade e destino.
// Mesmo caminho da tela (código dela em 18/10/2026): 1 POST com o filtro devolve uma linha por solicitação; depois
// 1 POST por solicitação (action=list-by-request_number) devolve as programações. A tela faz 10 em paralelo; aqui
// é uma por vez, pela fila do gauss.ts.
//
// Sem nomes e sem telefones: a resposta traz solicitante, beneficiário e contatos, que NÃO são gravados. O texto
// livre "details" também fica de fora (às vezes cita pessoas). Da "obs" ficam só os campos da operação.
//
// Ritmo: horários fixos (HORARIOS): amanhã depois que a parte sai (~16:30), hoje e ontem
// depois da meia-noite, de 3 em 3 horas (cerca de 10 buscas por dia); na primeira vez, os últimos DIAS_INICIAIS dias,
// um por execução. Cada busca compara com a anterior: nova, cancelada, trocada de equipamento ou alterada.
import { diaLocal } from "../src/lib/dominio/formato";
import type { Campo, GaussFleetClient } from "./gauss";
import { db, kvGet, kvSet, ok } from "./supabase";

export const ENDERECO = "/data/hard-vehicle/logistic-inbound/service-printing/";
const PRESTADOR_GPS = 13;
// Aspirador, Caminhão Alta Pressão, Auto Vácuo, Brook, Hiper Vácuo (os grupos marcados na tela)
const GRUPOS = [2, 1, 131, 4, 16];
export const ESPERA_FALHA_MS = 30 * 60 * 1000;
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
  /** dia (local) a que se referem os horários feitos */
  dia: string;
  /** horários do dia já feitos ("06:00", "17:00"...) */
  feitos: string[];
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
  /** O que já está gravado do dia (para saber o que mudou). */
  atuais(dia: string): Promise<LinhaResumo[]>;
  /** Grava as linhas do dia e apaga as que sumiram do GAUSS (coletadas antes de coletadoEm). */
  gravar(dia: string, linhas: LinhaParteDiaria[], coletadoEm: string): Promise<void>;
}

/** O que basta para comparar duas buscas do mesmo dia. */
export type LinhaResumo = Pick<LinhaParteDiaria, "chave" | "solicitacao" | "vaga" | "inicio" | "fim" | "local_origem" | "endereco">;

export interface Mudancas {
  novas: number;
  canceladas: number;
  /** mesma solicitação e horário, outra vaga (outro equipamento) */
  trocadas: number;
  /** mesma programação com fim, local ou endereço diferente */
  alteradas: number;
}

/** O que mudou entre a busca anterior e a nova do mesmo dia. */
export function compararParte(antes: LinhaResumo[], depois: LinhaResumo[]): Mudancas {
  const porChave = new Map(antes.map((l) => [l.chave, l]));
  const novasChaves = new Set(depois.map((l) => l.chave));
  const sumiram = antes.filter((l) => !novasChaves.has(l.chave));
  const entraram = depois.filter((l) => !porChave.has(l.chave));
  const slot = (l: LinhaResumo) => `${l.solicitacao}|${l.inicio}`;
  const sumiuPorSlot = new Map(sumiram.map((l) => [slot(l), l]));
  let trocadas = 0;
  for (const l of entraram) {
    if (sumiuPorSlot.has(slot(l))) {
      trocadas++;
      sumiuPorSlot.delete(slot(l));
    }
  }
  let alteradas = 0;
  for (const l of depois) {
    const a = porChave.get(l.chave);
    if (a && (a.fim !== l.fim || a.local_origem !== l.local_origem || a.endereco !== l.endereco)) alteradas++;
  }
  return { novas: entraram.length - trocadas, canceladas: sumiuPorSlot.size, trocadas, alteradas };
}

const diaAntes = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() - n);
  return diaLocal(d);
};

type Tipo = "ontem" | "hoje" | "amanha" | "atrasado";

/** Horários do dia (local), de 3 em 3 horas. O controlador do transporte solta a parte de amanhã por volta das
 * 16:30 e ainda pode mudar (atualizar, cancelar, trocar o equipamento): cada busca compara com a anterior. Ontem é
 * fechado depois da meia-noite. */
export const HORARIOS: { hora: string; tipo: Exclude<Tipo, "atrasado"> }[] = [
  { hora: "00:30", tipo: "ontem" },
  { hora: "06:00", tipo: "hoje" },
  { hora: "09:00", tipo: "hoje" },
  { hora: "12:00", tipo: "hoje" },
  { hora: "15:00", tipo: "hoje" },
  { hora: "17:00", tipo: "amanha" },
  { hora: "18:00", tipo: "hoje" },
  { hora: "20:00", tipo: "amanha" },
  { hora: "21:00", tipo: "hoje" },
  { hora: "23:00", tipo: "amanha" },
];

const horaLocal = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** O que buscar agora: o horário vencido mais recente que falta (os anteriores do mesmo tipo ficam valendo como
 * feitos: a busca mais nova já traz a parte atualizada) ou, sem horário vencido, um dia atrasado. */
export function escolherDia(c: ControleParteDiaria, agora: Date): { dia: string; tipo: Tipo; horas: string[] } | null {
  if (c.espera_ate && agora.getTime() < new Date(c.espera_ate).getTime()) return null;
  const hoje = diaLocal(agora);
  const feitos = c.dia === hoje ? c.feitos : [];
  const vencidos = HORARIOS.filter((h) => h.hora <= horaLocal(agora) && !feitos.includes(h.hora));
  const ultimo = vencidos.at(-1);
  if (ultimo) {
    const dia = ultimo.tipo === "ontem" ? diaAntes(hoje, 1) : ultimo.tipo === "amanha" ? diaAntes(hoje, -1) : hoje;
    return { dia, tipo: ultimo.tipo, horas: vencidos.filter((h) => h.tipo === ultimo.tipo).map((h) => h.hora) };
  }
  if (c.atrasados.length) return { dia: c.atrasados[0], tipo: "atrasado", horas: [] };
  return null;
}

/** Um passo do ciclo (no máximo um dia). Devolve o que fez (para o log) ou null. */
export async function coletarParteDiaria(deps: DepsParteDiaria, agora: Date, inicioExecucao: Date = agora): Promise<string | null> {
  if (agora.getTime() - inicioExecucao.getTime() > ORCAMENTO_INICIO_MS) return null;
  const hoje = diaLocal(agora);
  const lido = await deps.lerControle();
  const c: ControleParteDiaria = lido?.feitos
    ? lido
    : {
        dia: hoje,
        feitos: [],
        // primeira vez: os últimos dias, um por execução (ontem entra pelo horário das 00:30 ou aqui)
        atrasados: lido?.atrasados ?? Array.from({ length: DIAS_INICIAIS }, (_, i) => diaAntes(hoje, i + 1)),
      };
  const alvo = escolherDia(c, agora);
  if (!alvo) return null;
  const coletadoEm = new Date().toISOString();
  let solicitacoes: Record<string, unknown>[];
  let unicas: LinhaParteDiaria[];
  let mudancas: Mudancas | null = null;
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
    // grava e apaga o que sumiu (cancelada ou trocada de equipamento). Dia sem nada no GAUSS (ou resposta vazia
    // por engano): não apaga o que já estava gravado
    if (unicas.length) {
      const antes = await deps.atuais(alvo.dia);
      if (antes.length) mudancas = compararParte(antes, unicas);
      await deps.gravar(alvo.dia, unicas, coletadoEm);
    }
  } catch (e) {
    // não insiste a cada 5 min
    await deps.gravarControle({ ...c, espera_ate: new Date(agora.getTime() + ESPERA_FALHA_MS).toISOString() });
    throw e;
  }
  const feitos = c.dia === hoje ? c.feitos : [];
  await deps.gravarControle({
    dia: hoje,
    feitos: [...feitos, ...alvo.horas],
    atrasados: c.atrasados.filter((d) => d !== alvo.dia),
    espera_ate: null,
  });
  const m = mudancas;
  const mudou = m ? (m.novas + m.canceladas + m.trocadas + m.alteradas ? `; mudou: ${m.novas} nova(s), ${m.canceladas} cancelada(s), ${m.trocadas} trocada(s) de equipamento, ${m.alteradas} alterada(s)` : "; sem mudança") : "";
  return `${alvo.dia} (${alvo.tipo}${alvo.horas.length ? ` ${alvo.horas.at(-1)}` : ""}): ${solicitacoes.length} solicitação(ões), ${unicas.length} programação(ões)${mudou}`;
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
    atuais: async (dia) => ((await ok(db().from("parte_diaria").select("chave, solicitacao, vaga, inicio, fim, local_origem, endereco").eq("dia", dia))) ?? []) as LinhaResumo[],
    gravar: async (dia, linhas, coletadoEm) => {
      await ok(db().from("parte_diaria").upsert(linhas, { onConflict: "chave" }));
      await ok(db().from("parte_diaria").delete().eq("dia", dia).lt("coletado_em", coletadoEm));
    },
  };
}

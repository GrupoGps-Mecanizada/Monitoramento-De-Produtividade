import type { Evento, Tom } from "../tipos";
import { fmtMin, hora, pad } from "./formato";

export type GrupoEvento = "entrada" | "saida" | "status" | "sinal";
export const GRUPOS: Record<GrupoEvento, { rotulo: string; icone: string; tom: Tom }> = {
  entrada: { rotulo: "Entradas", icone: "↘", tom: "ok" },
  saida: { rotulo: "Saídas", icone: "↗", tom: "reg" },
  status: { rotulo: "Status", icone: "●", tom: "warn" },
  sinal: { rotulo: "Sinal", icone: "⚠", tom: "bad" },
};
export const TODOS_GRUPOS: GrupoEvento[] = ["entrada", "saida", "status", "sinal"];
export const ROTULO_TIPO: Record<Evento["tipo"], string> = { entrada: "Entrada", saida: "Saída", status: "Status", sinal_perdido: "Sem sinal", sinal_retomado: "Sinal voltou", abertura: "Início do dia" };

export const grupoDoEvento = (e: Pick<Evento, "tipo">): GrupoEvento => (e.tipo === "sinal_perdido" || e.tipo === "sinal_retomado" ? "sinal" : e.tipo === "abertura" ? "status" : e.tipo);
/** Veículo a abrir ao clicar no evento: o do motor secundário abre o caminhão principal. */
export const veiculoDoEvento = (e: Evento) => e.principal_id ?? e.id;
/** Chave estável do evento na lista (lido / selecionado). */
export const chaveEvento = (e: Evento) => `${e.t}|${e.id}|${e.tipo}`;

/** A abertura do dia (coletor) é dado para o Dia da frota, não alerta. */
export const ehAlerta = (e: Pick<Evento, "tipo">) => e.tipo !== "abertura";

/** Partes do texto: a tela põe "quem" e "alvo" em negrito. */
export interface TextoEvento {
  quem: string;
  motor2: boolean;
  acao: string;
  alvo: string;
  extra: string;
}
export function textoEvento(e: Evento): TextoEvento {
  const base = { quem: e.motor2 ? (e.principal ?? e.placa) : e.placa, motor2: !!e.motor2 };
  switch (e.tipo) {
    case "entrada":
      return { ...base, acao: "entrou em", alvo: e.area, extra: "" };
    case "saida":
      return { ...base, acao: "saiu de", alvo: e.area, extra: e.permanencia_min != null ? ` · ficou ${fmtMin(e.permanencia_min)}` : "" };
    case "status":
      return { ...base, acao: `${e.de} →`, alvo: e.para, extra: (e.duracao_min != null ? ` · ${fmtMin(e.duracao_min)} no anterior` : "") + (e.area ? ` · ${e.area}` : "") };
    case "sinal_perdido":
      return { ...base, acao: "", alvo: "sem sinal", extra: ` desde ${hora(e.ultima_posicao)}${e.area ? ` · ${e.area}` : ""}` };
    case "sinal_retomado":
      return { ...base, acao: "", alvo: "voltou a comunicar", extra: e.sem_sinal_min != null ? ` após ${fmtMin(e.sem_sinal_min)}` : "" };
    case "abertura":
      return { ...base, acao: "início do dia:", alvo: e.status, extra: e.area ? ` · ${e.area}` : "" };
  }
}
/** Texto corrido (busca, título, leitores de tela). */
export const textoPlano = (t: TextoEvento) => [`${t.quem}${t.motor2 ? " ⚙ motor 2º" : ""}`, t.acao, t.alvo].filter(Boolean).join(" ") + t.extra;

/** Eventos dos grupos marcados que casam com a busca (placa ou área), do mais novo para o mais antigo. */
export function filtrarEventos(es: Evento[], grupos: ReadonlySet<GrupoEvento>, busca: string): Evento[] {
  const q = busca.trim().toUpperCase();
  return es
    .filter((e) => ehAlerta(e) && grupos.has(grupoDoEvento(e)) && (!q || `${e.placa} ${e.principal ?? ""} ${e.area}`.toUpperCase().includes(q)))
    .sort((a, b) => b.t.localeCompare(a.t));
}

export function contarPorGrupo(es: Evento[]): Record<GrupoEvento, number> {
  const c: Record<GrupoEvento, number> = { entrada: 0, saida: 0, status: 0, sinal: 0 };
  for (const e of es) if (ehAlerta(e)) c[grupoDoEvento(e)]++;
  return c;
}

/** Agrupa eventos já ordenados por hora LOCAL ("14:00 – 14:59"). O site antigo usava a hora UTC do registro. */
export function agruparPorHora(es: Evento[]): { rotulo: string; eventos: Evento[] }[] {
  const g = new Map<string, Evento[]>();
  for (const e of es) {
    const d = new Date(e.t);
    const k = `${d.toDateString()}|${pad(d.getHours())}`;
    g.set(k, [...(g.get(k) ?? []), e]);
  }
  return [...g.entries()].map(([k, eventos]) => {
    const h = k.split("|")[1];
    return { rotulo: `${h}:00 – ${h}:59`, eventos };
  });
}

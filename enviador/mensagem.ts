// Etapa 3 dos alertas (P-026): o que mandar e o texto da mensagem. Tudo puro (o enviar.ts só lê, manda e marca).
// Pedido do dono (19/10/2026): só importa mandar ou não no WhatsApp, numa mensagem só juntando os alertas novos.
import { ROTULO_REGRA, type RegraExcecao } from "../src/lib/dominio/excecoes";
import { lerVaga } from "../src/lib/dominio/supervisor-vaga";
import { vagaOficial } from "../src/lib/dominio/vagas-oficiais";

export interface AlertaEnvio {
  id: number;
  regra: string;
  placa: string;
  vaga: string;
  supervisor: string | null;
  dia: string;
  /** segundos do dia */
  ini: number;
  local: string | null;
  detalhe: string;
  destino: string;
  situacao: string;
  ultimo_aviso_em: string | null;
  /** horário de referência (o limite na saída tarde e na chegada cedo), em segundos do dia */
  ref: number;
  fim: number | null;
}

/** Mais que isso numa mensagem fica difícil de ler: o resto vai resumido. */
export const MAX_ITENS = 12;

/**
 * Os que vão para o WhatsApp, de hoje, ainda não avisados e que não acabaram (PC desligado: alerta velho não sai).
 * Só as 22 vagas que a Mecanizada opera: caminhão sem vaga ou Brook parado no Pátio não é alerta.
 */
export const paraEnviar = (alertas: AlertaEnvio[], hoje: string) =>
  alertas
    .filter((a) => a.destino === "whatsapp" && !a.ultimo_aviso_em && a.dia === hoje && a.situacao !== "resolvido" && a.situacao !== "silenciado" && vagaOficial(a.vaga))
    .sort((p, q) => p.ini - q.ini || p.id - q.id);

const SIGLA = { ap: "AP", av: "AV", hv: "HV" } as const;
/** "AUTO VÁCUO - GPS - 05" -> "AV 05" */
function vagaCurta(vaga: string): string {
  const v = lerVaga(vaga);
  return v?.tipo && v.tipo in SIGLA ? `${SIGLA[v.tipo as keyof typeof SIGLA]} ${String(v.num).padStart(2, "0")}` : vaga;
}
const hhmm = (seg: number) => `${String(Math.floor(seg / 3600)).padStart(2, "0")}:${String(Math.floor((seg % 3600) / 60)).padStart(2, "0")}`;
/** "Segunda, 19/10 · 12:35" no horário da usina */
const quando = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const dia = p.weekday.split("-")[0];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${p.day}/${p.month} · ${p.hour}:${p.minute}`;
};

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e"]);
/** "PÁTIOS PRIMÁRIOS" -> "Pátios Primários" */
const nomeLocal = (s: string) =>
  s
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1)))
    .join(" ");

/** Ordem e ícone dos grupos: o mais grave primeiro. */
const ORDEM: [string, string][] = [
  ["desligado", "🔴"],
  ["saida_tarde", "🟠"],
  ["chegada_cedo", "🟠"],
  ["ocioso", "🟡"],
  ["restaurante", "🟡"],
  ["patio", "🟡"],
  ["bica_vacuo", "🟡"],
  ["velocidade", "🟡"],
  ["servitec", "⚪"],
  ["oficina_fora", "⚪"],
];
/** Como começa a frase das regras que duram (o detalhe traz quanto tempo). */
const ACAO: Record<string, string> = {
  desligado: "Desligado há",
  ocioso: "Ligado sem produzir há",
  restaurante: "No restaurante há",
  patio: "No Pátio há",
  bica_vacuo: "Na bica há",
  servitec: "Na oficina há",
  oficina_fora: "Na oficina de fora há",
};
const sup = (a: AlertaEnvio) => (a.supervisor ? `Sup. ${a.supervisor}` : null);
const juntar = (...xs: (string | null)[]) => xs.filter(Boolean).join(" · ");

/** Saída tarde e chegada cedo: uma linha só. */
function linhaInstante(a: AlertaEnvio, cab: string): string {
  const quanto =
    a.regra === "saida_tarde"
      ? a.ini > a.ref
        ? `saiu ${hhmm(a.ini)}, +${Math.round((a.ini - a.ref) / 60)} min`
        : "ainda no Pátio"
      : `chegou ${hhmm(a.ini)}, ${Math.round((a.ref - a.ini) / 60)} min antes`;
  return `> ${cab} — ${juntar(quanto, sup(a))}`;
}

/** Regras que duram: três linhas (quem, o quê e onde, desde quando e o supervisor). */
function linhasDuracao(a: AlertaEnvio, cab: string): string[] {
  const onde = a.local ? ` em ${nomeLocal(a.local)}` : "";
  const oque = a.regra === "velocidade" ? `A ${a.detalhe}${onde}` : `${ACAO[a.regra] ?? `${ROTULO_REGRA[a.regra as RegraExcecao] ?? a.regra} ·`} ${a.detalhe}${onde}`;
  return [`> ${cab}`, `> ${oque}`, `> ${juntar(`desde ${hhmm(a.ini)}`, sup(a))}`];
}

/**
 * Uma mensagem só, agrupada por tipo (modelo A escolhido pelo dono, 19/10/2026): título com a quantidade e cada
 * caminhão em citação (a barra lateral do WhatsApp). *negrito*, _itálico_ e "> " são a formatação do próprio WhatsApp.
 */
export function montarMensagem(alertas: AlertaEnvio[], agora: Date): string {
  const mostrados = alertas.slice(0, MAX_ITENS);
  const blocos: string[] = [];
  const conhecidas = new Set(ORDEM.map(([r]) => r));
  const ordem = [...ORDEM, ...[...new Set(mostrados.map((a) => a.regra))].filter((r) => !conhecidas.has(r)).map((r): [string, string] => [r, "🟡"])];
  for (const [regra, icone] of ordem) {
    const doTipo = mostrados.filter((a) => a.regra === regra);
    if (!doTipo.length) continue;
    const total = alertas.filter((a) => a.regra === regra).length;
    const instante = regra === "saida_tarde" || regra === "chegada_cedo";
    const itens = doTipo.map((a) => {
      const cab = `*${a.placa}*${a.vaga ? ` · ${vagaCurta(a.vaga)}` : ""}`;
      return instante ? [linhaInstante(a, cab)] : linhasDuracao(a, cab);
    });
    // entre caminhões de várias linhas, uma linha de citação vazia separa sem quebrar a barra lateral
    const corpo = instante ? itens.flat() : itens.flatMap((l, i) => (i ? [">", ...l] : l));
    // título curto: o tempo de cada um já vem na linha ("Motor desligado 1 h" vira "Motor desligado")
    const titulo = (ROTULO_REGRA[regra as RegraExcecao] ?? regra).replace(/ acima de 1 h$| 1 h$/, "");
    blocos.push([`${icone} *${titulo}* · ${total}`, ...corpo].join("\n"));
  }
  const resto = alertas.length - MAX_ITENS;
  return [
    "🚛 *ALERTAS DA FROTA*",
    `_${quando(agora)}_`,
    "",
    blocos.join("\n\n"),
    ...(resto > 0 ? ["", `+${resto} outros: veja na Gestão de alertas`] : []),
    "",
    "_Gestão de alertas · Monitoramento_",
  ].join("\n");
}

/** Destino do WhatsApp: número só com dígitos (o arquivo aceita "+55 31 9...-..."); grupo (termina em @g.us) como veio. */
export const numeroDestino = (bruto: string) => (bruto.includes("@") ? bruto.trim() : bruto.replace(/\D/g, ""));

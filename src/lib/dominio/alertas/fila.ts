// Filtros inteligentes da aba Alertas (Gestão de alertas): cartões que filtram, filtros em cascata com contagem,
// atalhos, etiquetas e agrupamento. Tudo puro; a tela só mostra.
import { diaMenos } from "../analise";
import { ROTULO_REGRA, type RegraExcecao } from "../excecoes";
import type { AlertaGravado } from "./gestao";
import type { Destino } from "./nota";

export type Periodo = "hoje" | "ontem" | "7" | "30" | "90";
export const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "hoje", rotulo: "Hoje" },
  { id: "ontem", rotulo: "Ontem" },
  { id: "7", rotulo: "7 dias" },
  { id: "30", rotulo: "30 dias" },
  { id: "90", rotulo: "90 dias" },
];
export type Cartao = "fila" | "whatsapp" | "resumo" | "resolvidos" | "silenciados";
export const CARTOES: { id: Cartao; rotulo: string }[] = [
  { id: "fila", rotulo: "Na fila" },
  { id: "whatsapp", rotulo: "Vão para o WhatsApp" },
  { id: "resumo", rotulo: "Só no resumo" },
  { id: "resolvidos", rotulo: "Resolvidos" },
  { id: "silenciados", rotulo: "Silenciados" },
];
export type Atalho = "graves" | "sem_avaliacao" | "repetidos";
/** Nota a partir da qual o alerta também vai ao coordenador (padrão do filtro). */
export const NOTA_GRAVE = 85;
export const ATALHOS: { id: Atalho; rotulo: string }[] = [
  { id: "graves", rotulo: `Mais graves (${NOTA_GRAVE}+)` },
  { id: "sem_avaliacao", rotulo: "Sem avaliação" },
  { id: "repetidos", rotulo: "Repetidos na semana" },
];
export const ROTULO_DESTINO: Record<Destino, string> = { whatsapp: "WhatsApp", resumo: "Resumo diário", tela: "Só na tela" };
export const SEM_SUPERVISOR = "Sem supervisor";

export interface FiltrosAlertas {
  periodo: Periodo;
  /** null = todos os cartões */
  cartao: Cartao | null;
  regra: string | null;
  /** "" = sem supervisor */
  supervisor: string | null;
  destino: Destino | null;
  busca: string;
  atalho: Atalho | null;
}
export const FILTROS_PADRAO: FiltrosAlertas = { periodo: "hoje", cartao: "fila", regra: null, supervisor: null, destino: null, busca: "", atalho: null };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

function noPeriodo(a: AlertaGravado, p: Periodo, hoje: string): boolean {
  if (p === "hoje") return a.dia === hoje;
  if (p === "ontem") return a.dia === diaMenos(hoje, 1);
  return a.dia >= diaMenos(hoje, Number(p) - 1) && a.dia <= hoje;
}
function noCartao(a: AlertaGravado, c: Cartao): boolean {
  if (c === "fila") return a.situacao === "aberto" || a.situacao === "visto";
  if (c === "whatsapp") return a.destino === "whatsapp";
  if (c === "resumo") return a.destino === "resumo";
  if (c === "resolvidos") return a.situacao === "resolvido";
  return a.situacao === "silenciado";
}
function noAtalho(a: AlertaGravado, x: Atalho): boolean {
  if (x === "graves") return a.nota >= NOTA_GRAVE;
  if (x === "sem_avaliacao") return !a.avaliacao;
  return (a.contexto?.repeticoes ?? 0) >= 1;
}

type Dim = "periodo" | "cartao" | "regra" | "supervisor" | "destino" | "busca" | "atalho";
/** O alerta passa em todos os filtros, menos o `ignorar` (para contar as opções de um filtro sem ele mesmo). */
function passa(a: AlertaGravado, f: FiltrosAlertas, hoje: string, ignorar?: Dim): boolean {
  const busca = norm(f.busca);
  return (
    (ignorar === "periodo" || noPeriodo(a, f.periodo, hoje)) &&
    (ignorar === "cartao" || f.cartao == null || noCartao(a, f.cartao)) &&
    (ignorar === "regra" || f.regra == null || a.regra === f.regra) &&
    (ignorar === "supervisor" || f.supervisor == null || (a.supervisor ?? "") === f.supervisor) &&
    (ignorar === "destino" || f.destino == null || a.destino === f.destino) &&
    (ignorar === "atalho" || f.atalho == null || noAtalho(a, f.atalho)) &&
    (ignorar === "busca" || !busca || [a.placa, a.vaga, a.local ?? "", a.supervisor ?? ""].some((t) => norm(t).includes(busca)))
  );
}

export const filtrar = (alertas: AlertaGravado[], f: FiltrosAlertas, hoje: string) => alertas.filter((a) => passa(a, f, hoje));

/** Quantos alertas cada cartão teria com os outros filtros. */
export function contarCartoes(alertas: AlertaGravado[], f: FiltrosAlertas, hoje: string): Record<Cartao, number> {
  const base = alertas.filter((a) => passa(a, f, hoje, "cartao"));
  return Object.fromEntries(CARTOES.map((c) => [c.id, base.filter((a) => noCartao(a, c.id)).length])) as Record<Cartao, number>;
}

/** Opções de um filtro que existem com os outros filtros, com a contagem (maior primeiro; empate em ordem alfabética). */
export function opcoes(alertas: AlertaGravado[], f: FiltrosAlertas, hoje: string, dim: "regra" | "supervisor" | "destino"): { valor: string; n: number }[] {
  const m = new Map<string, number>();
  for (const a of alertas) {
    if (!passa(a, f, hoje, dim)) continue;
    const v = dim === "supervisor" ? (a.supervisor ?? "") : a[dim];
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m].map(([valor, n]) => ({ valor, n })).sort((p, q) => q.n - p.n || p.valor.localeCompare(q.valor));
}

export const rotuloRegra = (r: string) => ROTULO_REGRA[r as RegraExcecao] ?? r;

/** Etiquetas "Filtrando:" (período e cartão ficam visíveis nos próprios controles). */
export function etiquetas(f: FiltrosAlertas): { dim: "regra" | "supervisor" | "destino" | "busca" | "atalho"; texto: string }[] {
  const out: ReturnType<typeof etiquetas> = [];
  if (f.regra != null) out.push({ dim: "regra", texto: rotuloRegra(f.regra) });
  if (f.supervisor != null) out.push({ dim: "supervisor", texto: f.supervisor || SEM_SUPERVISOR });
  if (f.destino != null) out.push({ dim: "destino", texto: ROTULO_DESTINO[f.destino] });
  if (f.busca.trim()) out.push({ dim: "busca", texto: `“${f.busca.trim()}”` });
  if (f.atalho != null) out.push({ dim: "atalho", texto: ATALHOS.find((x) => x.id === f.atalho)?.rotulo ?? f.atalho });
  return out;
}

export type Agrupar = "supervisor" | "equipamento" | "regra" | "nenhum";
export type Ordem = "nota" | "hora";
export interface Grupo {
  chave: string;
  titulo: string;
  itens: AlertaGravado[];
  notaMax: number;
}

const porHora = (p: AlertaGravado, q: AlertaGravado) => q.dia.localeCompare(p.dia) || q.ini - p.ini || p.id - q.id;
const porNota = (p: AlertaGravado, q: AlertaGravado) => q.nota - p.nota || porHora(p, q);

/** Grupos da maior nota para a menor; dentro de cada um, pela ordem escolhida. */
export function agrupar(alertas: AlertaGravado[], por: Agrupar, ordem: Ordem): Grupo[] {
  const chave = (a: AlertaGravado) => (por === "supervisor" ? (a.supervisor ?? "") : por === "equipamento" ? a.placa : por === "regra" ? a.regra : "");
  const titulo = (k: string) => (por === "supervisor" ? k || SEM_SUPERVISOR : por === "regra" ? rotuloRegra(k) : k || "Todos");
  const m = new Map<string, AlertaGravado[]>();
  for (const a of alertas) m.set(chave(a), [...(m.get(chave(a)) ?? []), a]);
  return [...m]
    .map(([k, itens]) => ({ chave: k, titulo: titulo(k), itens: [...itens].sort(ordem === "nota" ? porNota : porHora), notaMax: Math.max(...itens.map((a) => a.nota)) }))
    .sort((p, q) => q.notaMax - p.notaMax || p.titulo.localeCompare(q.titulo));
}

/** Visões salvas (abas com contagem): cada uma é um cartão e/ou um atalho pronto. */
export type Visao = "fila" | "whatsapp" | "graves" | "sem_avaliacao" | "resolvidos" | "todos";
export const VISOES: { id: Visao; rotulo: string; filtro: Pick<FiltrosAlertas, "cartao" | "atalho"> }[] = [
  { id: "fila", rotulo: "Na fila", filtro: { cartao: "fila", atalho: null } },
  { id: "whatsapp", rotulo: "WhatsApp", filtro: { cartao: "whatsapp", atalho: null } },
  { id: "graves", rotulo: "Graves", filtro: { cartao: null, atalho: "graves" } },
  { id: "sem_avaliacao", rotulo: "Sem avaliação", filtro: { cartao: null, atalho: "sem_avaliacao" } },
  { id: "resolvidos", rotulo: "Resolvidos", filtro: { cartao: "resolvidos", atalho: null } },
  { id: "todos", rotulo: "Todos", filtro: { cartao: null, atalho: null } },
];

/** Quantos alertas cada visão teria com os outros filtros (período, regra, supervisor, destino, busca). */
export function contarVisoes(alertas: AlertaGravado[], f: FiltrosAlertas, hoje: string): Record<Visao, number> {
  return Object.fromEntries(VISOES.map((v) => [v.id, filtrar(alertas, { ...f, ...v.filtro }, hoje).length])) as Record<Visao, number>;
}
export const visaoAtual = (f: FiltrosAlertas): Visao | null => VISOES.find((v) => v.filtro.cartao === f.cartao && v.filtro.atalho === f.atalho)?.id ?? null;

export type Coluna = "nota" | "hora" | "placa" | "regra" | "supervisor";
/** Ordena pela coluna clicada na tabela; vazio sempre por último. */
export function ordenar(alertas: AlertaGravado[], col: Coluna, dir: "asc" | "desc"): AlertaGravado[] {
  const s = dir === "asc" ? 1 : -1;
  const texto = (a: AlertaGravado) => (col === "placa" ? a.placa : col === "regra" ? rotuloRegra(a.regra) : (a.supervisor ?? ""));
  const cmp = (p: AlertaGravado, q: AlertaGravado): number => {
    if (col === "nota") return s * (p.nota - q.nota) || porHora(p, q);
    if (col === "hora") return dir === "desc" ? porHora(p, q) : -porHora(p, q);
    const tp = texto(p);
    const tq = texto(q);
    if (!tp !== !tq) return tp ? -1 : 1;
    return s * tp.localeCompare(tq) || porNota(p, q);
  };
  return [...alertas].sort(cmp);
}

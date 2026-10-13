import { diaMenos, minutos, porHora, type Local, type ParadaNoLocal } from "./analise";
import { fmtHoras } from "./formato";

/** Famílias de apontamento do tablet (subabas da Análise). "sem" = paradas sem nenhum apontamento. */
export const FAMILIAS = ["aguardando", "pausas", "logistica", "preparacao", "manutencao", "sem"] as const;
export type Familia = (typeof FAMILIAS)[number];
export const ROTULO_FAMILIA: Record<Familia, string> = {
  aguardando: "Aguardando",
  pausas: "Pausas e pessoas",
  logistica: "Logística",
  preparacao: "Preparação e bloqueio",
  manutencao: "Manutenção e clima",
  sem: "Sem apontamento",
};
/** Subabas da coluna da direita: a Visão geral (o painel de sempre) e uma por família. */
export const ABAS_FAMILIA = ["geral", ...FAMILIAS] as const;
export type AbaFamilia = (typeof ABAS_FAMILIA)[number];
/** A tabela analise_paradas guarda só os últimos 30 dias: o período anterior só existe em 7 e 15 dias. */
export const DIAS_GUARDADOS = 30;

// nomes como o tablet manda (13/10/2026); apontamento fora daqui cai em "manutencao" e a tela avisa
const TABELA: Record<Exclude<Familia, "sem">, string[]> = {
  aguardando: ["Aguardando Área", "Aguardando semáforo/cancela", "Aguardando Auto Vácuo descarregar", "Aguardando carreta bascular"],
  pausas: ["Refeição Motorista", "Pausas Diversas (água, banheiro)", "Inicio de turno", "DDS/Check-List - LM", "Abordagem de Segurança"],
  logistica: ["Abastecimento (Água) - LM", "Abastecimento (Combustível)", "Descarregando equipamento", "Troca de Equipamento"],
  preparacao: ["Documentação", "Preparação - LM", "Bloqueio - LM"],
  manutencao: ["Pequenas manutenções", "Condições Climáticas (chuva, etc)"],
};

/** Nome sem acento, minúsculo, com espaços simples e sem o " - LM" do fim (o tablet varia). */
export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim().replace(/ - lm$/, "");

const FAMILIA_DO_NOME = new Map<string, Familia>(
  (Object.entries(TABELA) as [Familia, string[]][]).flatMap(([f, nomes]) => nomes.map((n) => [normalizar(n), f] as const)),
);
export const familiaDe = (apont: string): Familia => FAMILIA_DO_NOME.get(normalizar(apont)) ?? "manutencao";

/** Paradas com algum apontamento da família (cada parada entra uma vez); "sem" = as sem apontamento. */
export function paradasDaFamilia(paradas: ParadaNoLocal[], f: Familia): ParadaNoLocal[] {
  return f === "sem" ? paradas.filter((p) => !p.apont.length) : paradas.filter((p) => p.apont.some((a) => familiaDe(a) === f));
}

/** Apontamentos que não estão na tabela (para o aviso "Apontamento novo sem família"). */
export function apontNovos(paradas: ParadaNoLocal[]): string[] {
  const novos = new Set<string>();
  for (const p of paradas) for (const a of p.apont) if (!FAMILIA_DO_NOME.has(normalizar(a))) novos.add(a);
  return [...novos].sort((a, b) => a.localeCompare(b));
}

export interface Soma {
  nome: string;
  n: number;
  /** minutos */
  min: number;
}
/** Horas de cada apontamento da família, do maior ao menor; variações do nome somam juntas (fica o primeiro nome visto). */
export function porApontamento(paradas: ParadaNoLocal[], f: Familia): Soma[] {
  const m = new Map<string, Soma>();
  for (const p of paradas) {
    const vistos = new Set<string>();
    for (const a of p.apont) {
      const k = normalizar(a);
      if (familiaDe(a) !== f || vistos.has(k)) continue;
      vistos.add(k);
      const s = m.get(k) ?? { nome: a, n: 0, min: 0 };
      s.n++;
      s.min += minutos(p);
      m.set(k, s);
    }
  }
  return [...m.values()].sort((a, b) => b.min - a.min);
}

export interface LinhaRanking {
  chave: string;
  nome: string;
  n: number;
  /** minutos */
  min: number;
  /** minutos por parada */
  media: number;
}
export const SEM_SUPERVISOR = "Sem supervisor";
function somarPor(paradas: ParadaNoLocal[], chave: (p: ParadaNoLocal) => string, n: number): LinhaRanking[] {
  const m = new Map<string, LinhaRanking>();
  for (const p of paradas) {
    const k = chave(p);
    const r = m.get(k) ?? { chave: k, nome: k, n: 0, min: 0, media: 0 };
    r.n++;
    r.min += minutos(p);
    m.set(k, r);
  }
  return [...m.values()]
    .map((r) => ({ ...r, media: r.min / r.n }))
    .sort((a, b) => b.min - a.min || a.nome.localeCompare(b.nome))
    .slice(0, n);
}
/** Placas com mais tempo parado (top n). */
export const rankingPlacas = (paradas: ParadaNoLocal[], n = 10) => somarPor(paradas, (p) => p.placa, n);
/** Supervisores com mais tempo parado (top n); equipamento sem supervisor soma em "Sem supervisor". */
export const rankingSupervisores = (paradas: ParadaNoLocal[], n = 10) => somarPor(paradas, (p) => p.equip.supervisor ?? SEM_SUPERVISOR, n);

/** Minutos parados em cada dia do período (os `periodo` dias até `hoje`); dia sem parada = 0. */
export function porDia(paradas: ParadaNoLocal[], hoje: string, periodo: number): { dia: string; min: number }[] {
  const dias = Array.from({ length: periodo }, (_, i) => diaMenos(hoje, periodo - 1 - i));
  const m = new Map(dias.map((d) => [d, 0]));
  for (const p of paradas) {
    const atual = m.get(p.dia);
    if (atual != null) m.set(p.dia, atual + minutos(p));
  }
  return dias.map((dia) => ({ dia, min: m.get(dia) ?? 0 }));
}

const CONCENTRACAO = 0.2;
const somaMin = (ps: ParadaNoLocal[]) => ps.reduce((s, p) => s + minutos(p), 0);

/** Conclusões curtas da família (só as que têm dado): total (e comparação), concentração numa placa, pico de 2 horas e lugar. */
export function frases({ rotulo, atual, anterior, dias, locais }: { rotulo: string; atual: ParadaNoLocal[]; anterior: ParadaNoLocal[] | null; dias: number; locais: Map<string, Local> }): string[] {
  if (!atual.length) return [];
  const total = somaMin(atual);
  let t = `${rotulo} somou ${fmtHoras(total)} em ${atual.length} ${atual.length === 1 ? "parada" : "paradas"}`;
  const antes = anterior ? somaMin(anterior) : 0;
  if (antes > 0) {
    const pct = Math.round(((total - antes) / antes) * 100);
    t += pct === 0 ? `, igual aos ${dias} dias anteriores` : `, ${Math.abs(pct)}% a ${pct > 0 ? "mais" : "menos"} que nos ${dias} dias anteriores`;
  }
  const out = [`${t}.`];
  if (total <= 0) return out;
  const [top] = rankingPlacas(atual, 1);
  if (top && top.min / total > CONCENTRACAO) out.push(`A placa ${top.nome} sozinha soma ${Math.round((top.min / total) * 100)}% do tempo.`);
  // janela de 2 horas com mais minutos; no empate, a que começa na hora mais cheia (parada só às 8h = "das 8h às 10h")
  const h = porHora(atual);
  const janela = (i: number) => h[i] + h[i + 1];
  let pico = 0;
  for (let i = 1; i < 23; i++) if (janela(i) > janela(pico) || (janela(i) === janela(pico) && h[i] > h[pico])) pico = i;
  out.push(`O pico é das ${pico}h às ${pico + 2}h.`);
  const lugar = new Map<string, number>();
  for (const p of atual) {
    const l = locais.get(p.local);
    const nome = !l ? p.local : l.naRegiao ? l.nome : "Longe da região";
    lugar.set(nome, (lugar.get(nome) ?? 0) + minutos(p));
  }
  const [onde, min] = [...lugar].sort((a, b) => b[1] - a[1])[0];
  out.push(`Onde mais acontece: ${onde}, ${fmtHoras(min)}.`);
  return out;
}

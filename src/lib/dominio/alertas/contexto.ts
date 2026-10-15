// O que pesa na nota além da regra: apontamento do tablet, sinal do rastreador e repetição na vaga.
// Tempos em segundos desde 00:00 do dia do alerta (o mesmo eixo de Excecao.ini/fim).
import type { Evento } from "../../tipos";
import { diaMenos } from "../analise";
import type { Excecao } from "../excecoes";
import { familiaDe, type Familia } from "../familias";
import { formasDaPlaca, type LinhaTablet } from "../gauss-dia";

export type Situacao = "aberto" | "visto" | "resolvido" | "silenciado";
export interface HistoricoAlerta {
  chave: string;
  regra: string;
  vaga: string;
  dia: string;
  situacao: Situacao;
  resolvido_em: string | null;
  contagem: number;
}

const segIso = (iso: string, dia: string) => (Date.parse(iso) - Date.parse(`${dia}T00:00:00-03:00`)) / 1000;
// o GAUSS grava "AAAA-MM-DD HH:MM:SS" no horário local
const segLocal = (ts: string, dia: string) => segIso(`${ts.slice(0, 10)}T${ts.slice(11, 19)}-03:00`, dia);

/** Período que o alerta cobre: do limite à saída (saída tarde), da chegada ao limite (chegada cedo), ou ini–fim. Mínimo 1 min. */
export function janelaDoAlerta(x: Excecao): { a: number; b: number } {
  const a = Math.min(x.ini, x.ref);
  const b = Math.max(x.fim ?? x.ini, x.ref);
  return { a, b: Math.max(b, a + 60) };
}

export function familiasNoPeriodo(tablet: (LinhaTablet & { placa: string })[], placa: string, dia: string, j: { a: number; b: number }): Familia[] {
  const placas = new Set(formasDaPlaca(placa));
  const out = new Set<Familia>();
  for (const t of tablet) {
    if (!placas.has(t.placa)) continue;
    const a = segLocal(t.inicio, dia);
    const b = t.fim ? segLocal(t.fim, dia) : Infinity;
    if (a < j.b && b > j.a) out.add(familiaDe(t.categoria_demora));
  }
  return [...out];
}

/** Parte do período (0 a 1) em que o rastreador estava sem sinal; perdido e não retomado vale até o fim. */
export function fracaoSemSinal(eventos: Evento[], veiculoId: string, dia: string, j: { a: number; b: number }): number {
  let semDesde: number | null = null;
  let soma = 0;
  const conta = (de: number, ate: number) => (soma += Math.max(0, Math.min(ate, j.b) - Math.max(de, j.a)));
  for (const e of eventos.filter((x) => x.id === veiculoId && !x.motor2).sort((p, q) => p.t.localeCompare(q.t))) {
    const t = segIso(e.t, dia);
    if (e.tipo === "sinal_perdido" && semDesde == null) semDesde = t;
    else if (e.tipo === "sinal_retomado" && semDesde != null) {
      conta(semDesde, t);
      semDesde = null;
    }
  }
  if (semDesde != null) conta(semDesde, j.b);
  return j.b > j.a ? soma / (j.b - j.a) : 0;
}

/** Quantas vezes a mesma regra aconteceu na mesma vaga nos 7 dias até `dia` (sem contar o próprio alerta). */
export function repeticoes(historico: HistoricoAlerta[], regra: string, vaga: string, dia: string, chave: string): number {
  const desde = diaMenos(dia, 6);
  return historico.filter((h) => h.regra === regra && h.vaga === vaga && h.chave !== chave && h.dia >= desde && h.dia <= dia).length;
}

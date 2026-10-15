// Contas da tela de gestão dos alertas (spec, seções 7A e 9): simulador, sugestões e telefone. Tudo puro.
import { diaMenos } from "../analise";
import { ROTULO_REGRA, type RegraExcecao } from "../excecoes";
import type { ConfigRegra, Politica } from "./config";
import type { LinhaAlerta } from "./montar";
import { destinoDaNota, notaDoAlerta, type ContextoNota, type Destino } from "./nota";

export type Avaliacao = "problema" | "nao_era_problema";
/** Linha da tabela `alertas` como a tela lê. */
export interface AlertaGravado extends Omit<LinhaAlerta, "contexto"> {
  id: number;
  /** null em alerta gravado antes da etapa 2 */
  contexto: ContextoNota | null;
  avaliacao: Avaliacao | null;
  visto_por: string | null;
  visto_em: string | null;
  ultimo_aviso_em: string | null;
  detectado_em: string;
}

export interface Simulacao {
  total: number;
  antes: Record<Destino, number>;
  depois: Record<Destino, number>;
  /** quantos mudariam de destino */
  mudaram: number;
  /** mensagens de WhatsApp por regra, antes e depois (só regras com alguma) */
  porRegra: { regra: string; antes: number; depois: number }[];
}

const zero = (): Record<Destino, number> => ({ whatsapp: 0, resumo: 0, tela: 0 });

/** Destino de cada alerta com outra configuração (regra desligada = só tela; sem contexto = fica como está). */
export function simular(alertas: AlertaGravado[], regras: Record<RegraExcecao, ConfigRegra>, p: Politica): Simulacao {
  const antes = zero();
  const depois = zero();
  const porRegra = new Map<string, { antes: number; depois: number }>();
  let mudaram = 0;
  for (const a of alertas) {
    const cfg = regras[a.regra as RegraExcecao];
    const novo: Destino = !a.contexto || !cfg ? a.destino : !cfg.ativa ? "tela" : destinoDaNota(notaDoAlerta(cfg, a.contexto).nota, p);
    antes[a.destino]++;
    depois[novo]++;
    if (novo !== a.destino) mudaram++;
    const r = porRegra.get(a.regra) ?? { antes: 0, depois: 0 };
    if (a.destino === "whatsapp") r.antes++;
    if (novo === "whatsapp") r.depois++;
    porRegra.set(a.regra, r);
  }
  return {
    total: alertas.length,
    antes,
    depois,
    mudaram,
    porRegra: [...porRegra].filter(([, r]) => r.antes || r.depois).map(([regra, r]) => ({ regra, ...r })),
  };
}

export const SUGESTAO_MIN = 10;
export const SUGESTAO_FRACAO = 0.6;
export interface Sugestao {
  regra: RegraExcecao;
  avaliados: number;
  fracao: number;
  texto: string;
}

/** Regras em que a maioria das avaliações dos últimos 30 dias foi "não era problema". Só sugere; quem muda é o gestor. */
export function sugestoes(alertas: AlertaGravado[], hoje: string): Sugestao[] {
  const desde = diaMenos(hoje, 29);
  const porRegra = new Map<RegraExcecao, { n: number; nao: number }>();
  for (const a of alertas) {
    if (!a.avaliacao || a.dia < desde) continue;
    const r = porRegra.get(a.regra as RegraExcecao) ?? { n: 0, nao: 0 };
    r.n++;
    if (a.avaliacao === "nao_era_problema") r.nao++;
    porRegra.set(a.regra as RegraExcecao, r);
  }
  return [...porRegra]
    .filter(([, r]) => r.n >= SUGESTAO_MIN && r.nao / r.n >= SUGESTAO_FRACAO)
    .map(([regra, r]) => {
      const fracao = r.nao / r.n;
      return {
        regra,
        avaliados: r.n,
        fracao,
        texto: `${Math.round(fracao * 100)}% dos alertas de "${ROTULO_REGRA[regra]}" foram marcados como "não era problema" (${r.n} avaliados em 30 dias). Que tal diminuir o peso (vai só para o resumo) ou subir a faixa?`,
      };
    });
}

/** Telefone para o WhatsApp: só dígitos, com 55 na frente (DDD + 8 ou 9 dígitos). Inválido: null. */
export function normalizarTelefone(s: string): string | null {
  const d = s.replace(/\D/g, "");
  const com55 = d.length === 10 || d.length === 11 ? `55${d}` : d;
  return /^55\d{10,11}$/.test(com55) ? com55 : null;
}

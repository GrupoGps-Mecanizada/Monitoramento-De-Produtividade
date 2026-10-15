// Configuração do filtro inteligente dos alertas (spec 2026-10-15-alertas-whatsapp-design.md, seção 7A).
// Os padrões daqui são os mesmos do supabase/alertas.sql; o banco manda (o gestor muda na tela).
import { REGRAS, type RegraExcecao } from "../excecoes";
import type { Familia } from "../familias";

export interface Faixa {
  /** pontos quando o problema passa deste tanto de minutos */
  acima_min: number;
  pontos: number;
}
export type FamiliaJust = Exclude<Familia, "sem">;
export interface ConfigRegra {
  regra: RegraExcecao;
  ativa: boolean;
  /** gravidade base (0-100) */
  peso: number;
  faixas: Faixa[];
  /** família de apontamento do tablet -> pontos a tirar */
  justificativas: Partial<Record<FamiliaJust, number>>;
  espera_min: number;
  lembrete_min: number;
  escalar_min: number | null;
}
export interface Politica {
  corte_whatsapp: number;
  corte_resumo: number;
  corte_coordenador: number;
  max_por_hora: number;
  modo_teste: boolean;
  /** "HH:MM" */
  resumo_hora: string;
}

export const REPETICAO_SEGUNDA = 10;
export const REPETICAO_TERCEIRA = 20;
/** Sem sinal em mais desta fração do período: provavelmente não é "desligado" de verdade. */
export const SEM_SINAL_FRACAO = 0.5;
export const SEM_SINAL_PONTOS = 40;
export const PRESUMIDO_PONTOS = 10;

export const POLITICA_PADRAO: Politica = { corte_whatsapp: 60, corte_resumo: 30, corte_coordenador: 85, max_por_hora: 6, modo_teste: true, resumo_hora: "07:00" };

const JUST: ConfigRegra["justificativas"] = { manutencao: 40, preparacao: 30, aguardando: 25, pausas: 25, logistica: 15 };
const HORARIO: Faixa[] = [{ acima_min: 15, pontos: 30 }, { acima_min: 30, pontos: 55 }];
const regra = (r: RegraExcecao, peso: number, faixas: Faixa[] = [], justificativas = JUST): ConfigRegra => ({ regra: r, ativa: true, peso, faixas, justificativas, espera_min: 10, lembrete_min: 120, escalar_min: null });

export const REGRAS_PADRAO: Record<RegraExcecao, ConfigRegra> = {
  saida_tarde: regra("saida_tarde", 35, HORARIO),
  chegada_cedo: regra("chegada_cedo", 35, HORARIO),
  desligado: regra("desligado", 40, [{ acima_min: 60, pontos: 25 }, { acima_min: 120, pontos: 45 }, { acima_min: 180, pontos: 60 }]),
  patio: regra("patio", 30),
  restaurante: regra("restaurante", 30),
  ocioso: regra("ocioso", 30),
  bica_vacuo: regra("bica_vacuo", 30),
  velocidade: regra("velocidade", 30),
  servitec: regra("servitec", 0, [], {}),
  oficina_fora: regra("oficina_fora", 0, [], {}),
};

/** Linhas do banco por cima dos padrões; regra desconhecida no banco é ignorada. */
export function configCompleta(linhas: Partial<ConfigRegra>[]): Record<RegraExcecao, ConfigRegra> {
  const out = { ...REGRAS_PADRAO };
  for (const l of linhas) if (l.regra && (REGRAS as readonly string[]).includes(l.regra)) out[l.regra] = { ...REGRAS_PADRAO[l.regra], ...l, regra: l.regra };
  return out;
}
export const politicaCompleta = (p: Partial<Politica> | null): Politica => ({ ...POLITICA_PADRAO, ...(p ?? {}) });

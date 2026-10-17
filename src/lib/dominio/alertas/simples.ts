// Filtro simples (pedido do dono, 17/10/2026): por regra só "para onde vai", "WhatsApp após X min" e "coordenador após Y min".
// Os pesos e faixas continuam no banco; aqui é só a tradução de ida e volta. O "Ajuste fino" da tela mexe neles direto.
import type { RegraExcecao } from "../excecoes";
import { REGRAS_PADRAO, type ConfigRegra, type Politica } from "./config";

export type Nivel = "tela" | "resumo" | "whatsapp";
export const ROTULO_NIVEL: Record<Nivel, string> = { tela: "Só na tela", resumo: "Resumo diário", whatsapp: "WhatsApp" };
export interface RegraSimples {
  regra: RegraExcecao;
  ativa: boolean;
  nivel: Nivel;
  /** só no WhatsApp: abaixo disso vai ao resumo; null = sempre WhatsApp */
  whatsappApos: number | null;
  /** só no WhatsApp: acima disso também o coordenador; null = nunca */
  coordenadorApos: number | null;
}

/** Lê pesos e faixas no formato simples (o menor tempo que chega a cada corte). */
export function deConfig(c: ConfigRegra, p: Politica): RegraSimples {
  const faixas = [...c.faixas].sort((a, b) => a.acima_min - b.acima_min);
  const chega = (corte: number) => faixas.find((f) => c.peso + f.pontos >= corte)?.acima_min ?? null;
  const base = { regra: c.regra, ativa: c.ativa };
  if (c.peso >= p.corte_whatsapp) return { ...base, nivel: "whatsapp", whatsappApos: null, coordenadorApos: c.peso >= p.corte_coordenador ? 0 : chega(p.corte_coordenador) };
  const whats = chega(p.corte_whatsapp);
  if (whats != null) return { ...base, nivel: "whatsapp", whatsappApos: whats, coordenadorApos: chega(p.corte_coordenador) };
  return { ...base, nivel: c.peso >= p.corte_resumo ? "resumo" : "tela", whatsappApos: null, coordenadorApos: null };
}

/** Grava o formato simples em peso e faixas, mantendo o resto da regra (lembrete, justificativas). */
export function paraConfig(s: RegraSimples, atual: ConfigRegra, p: Politica): ConfigRegra {
  const c = { ...atual, regra: s.regra, ativa: s.ativa };
  if (s.nivel === "tela") return { ...c, peso: 0, faixas: [] };
  if (s.nivel === "resumo") return { ...c, peso: p.corte_resumo, faixas: [] };
  const base = s.whatsappApos ? p.corte_resumo : p.corte_whatsapp;
  const faixas = [
    ...(s.whatsappApos ? [{ acima_min: s.whatsappApos, pontos: p.corte_whatsapp - base }] : []),
    ...(s.coordenadorApos ? [{ acima_min: s.coordenadorApos, pontos: p.corte_coordenador - base }] : []),
  ];
  return { ...c, peso: base, faixas };
}

/** Apontamento no tablet manda para o resumo? (qualquer família com valor) */
export const temJustificativa = (c: ConfigRegra) => Object.values(c.justificativas).some((v) => (v ?? 0) > 0);
export const comJustificativa = (c: ConfigRegra, ligada: boolean): ConfigRegra => ({
  ...c,
  justificativas: ligada ? (temJustificativa(REGRAS_PADRAO.saida_tarde) ? REGRAS_PADRAO.saida_tarde.justificativas : { manutencao: 40 }) : {},
});

// Nota 0-100 de um alerta: decide se vai ao WhatsApp, ao resumo ou só à tela (spec, seção 7A).
// Cada parte vira um "motivo" para a tela explicar a nota.
import type { Excecao } from "../excecoes";
import { ROTULO_FAMILIA, type Familia } from "../familias";
import { DIA } from "../trilhas";
import { POLITICA_PADRAO, PRESUMIDO_PONTOS, REPETICAO_SEGUNDA, REPETICAO_TERCEIRA, SEM_SINAL_FRACAO, SEM_SINAL_PONTOS, type ConfigRegra, type FamiliaJust, type Politica } from "./config";

export interface ContextoNota {
  /** quanto passou do limite (minutos) */
  excessoMin: number;
  /** alertas anteriores da mesma regra na mesma vaga nos últimos 7 dias */
  repeticoes: number;
  /** famílias de apontamento do tablet no período */
  familias: Familia[];
  /** 0 a 1: parte do período sem sinal do rastreador */
  fracaoSemSinal: number;
  presumido: boolean;
}
export interface Motivo {
  texto: string;
  pontos: number;
}
export type Destino = "whatsapp" | "resumo" | "tela";

/** Minutos além do limite: saída tarde (ainda no Pátio conta até agora), chegada cedo, ou a duração nas outras. */
export function excessoMin(x: Excecao, agoraSeg: number | null): number {
  const seg =
    x.regra === "saida_tarde" ? (x.ini > x.ref ? x.ini : (agoraSeg ?? DIA)) - x.ref : x.regra === "chegada_cedo" ? x.ref - x.ini : (x.fim ?? x.ini) - x.ini;
  return Math.max(0, seg / 60);
}

/** Com apontamento no tablet que justifica, o alerta vai só para o resumo: a nota desce até o corte do resumo (nunca abaixo). */
export function notaDoAlerta(cfg: ConfigRegra, c: ContextoNota, p: Politica = POLITICA_PADRAO): { nota: number; motivos: Motivo[] } {
  const motivos: Motivo[] = [{ texto: "Peso da regra", pontos: cfg.peso }];
  const faixa = [...cfg.faixas].sort((a, b) => b.acima_min - a.acima_min).find((f) => c.excessoMin > f.acima_min);
  if (faixa) motivos.push({ texto: `Passou de ${faixa.acima_min} min`, pontos: faixa.pontos });
  if (c.repeticoes >= 2) motivos.push({ texto: `${c.repeticoes + 1}ª vez na semana nesta vaga: sobe um nível`, pontos: REPETICAO_TERCEIRA });
  else if (c.repeticoes === 1 && REPETICAO_SEGUNDA) motivos.push({ texto: "2ª vez na semana nesta vaga", pontos: REPETICAO_SEGUNDA });
  // vale a justificativa mais forte: duas famílias no mesmo período não somam
  const just = c.familias
    .filter((f): f is FamiliaJust => f !== "sem")
    .map((f) => ({ f, p: cfg.justificativas[f] ?? 0 }))
    .sort((a, b) => b.p - a.p)[0];
  const ate = motivos.reduce((s, m) => s + m.pontos, 0);
  if (just && just.p > 0 && ate > p.corte_resumo) motivos.push({ texto: `Apontado no tablet (${ROTULO_FAMILIA[just.f]}): vai só para o resumo`, pontos: p.corte_resumo - ate });
  if (c.fracaoSemSinal > SEM_SINAL_FRACAO) motivos.push({ texto: "Rastreador sem sinal na maior parte do tempo", pontos: -SEM_SINAL_PONTOS });
  if (c.presumido) motivos.push({ texto: "Regime presumido (ADM)", pontos: -PRESUMIDO_PONTOS });
  const soma = motivos.reduce((s, m) => s + m.pontos, 0);
  return { nota: Math.max(0, Math.min(100, Math.round(soma))), motivos };
}

export const destinoDaNota = (nota: number, p: Politica): Destino => (nota >= p.corte_whatsapp ? "whatsapp" : nota >= p.corte_resumo ? "resumo" : "tela");

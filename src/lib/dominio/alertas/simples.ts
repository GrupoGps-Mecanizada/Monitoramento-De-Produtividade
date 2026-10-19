// Alertas em frases (pedido do dono, 17 e 19/10/2026): por regra só "para onde vai", "depois de quanto tempo" e
// "quando chamar o coordenador". Os pesos e faixas continuam no banco; aqui é só a tradução de ida e volta e o texto
// das frases. O "Ajuste fino" da tela mexe nos pesos direto.
import { ROTULO_REGRA, type RegraExcecao } from "../excecoes";
import { DESLIGADO_MIN, OCIOSO_MIN, RESTAURANTE_MIN, VELOCIDADE_MAX_USINA } from "../regras-frota";
import { REGRAS_PADRAO, type ConfigRegra, type Politica } from "./config";

export type Nivel = "tela" | "resumo" | "whatsapp";
export const ROTULO_NIVEL: Record<Nivel, string> = { tela: "Só na tela", resumo: "Resumo diário", whatsapp: "WhatsApp" };
export interface RegraSimples {
  regra: RegraExcecao;
  ativa: boolean;
  nivel: Nivel;
  /** avisa (no nível escolhido) só depois deste tempo; antes disso fica um nível abaixo. null = sempre */
  apos: number | null;
  /** só no WhatsApp: acima disso também o coordenador; null = nunca */
  coordenadorApos: number | null;
}

/** O que cada regra vigia, para o passo 1 do assistente. */
export const O_QUE_VIGIA: Record<RegraExcecao, string> = {
  saida_tarde: "Caminhão que sai do Pátio depois do horário do regime",
  chegada_cedo: "Caminhão que volta ao Pátio antes do horário do regime",
  patio: "Ida ao Pátio no meio do expediente",
  servitec: "Parada na Oficina da Servitec no expediente",
  oficina_fora: "Ida à Oficina de fora (Centro)",
  bica_vacuo: "Auto ou Hiper Vácuo parado na bica de água",
  restaurante: "Muito tempo no restaurante no expediente",
  ocioso: "Parado com o motor ligado, sem produzir",
  desligado: "Motor desligado fora do Pátio no expediente",
  velocidade: `Velocidade acima de ${VELOCIDADE_MAX_USINA} km/h dentro da usina`,
};

/** A partir de quantos minutos o sistema já percebe a regra (antes disso ela nem aparece). */
export const BASE_MIN: Record<RegraExcecao, number> = {
  saida_tarde: 0, chegada_cedo: 0, patio: 0, servitec: 0, oficina_fora: 0, bica_vacuo: 0, velocidade: 0,
  restaurante: RESTAURANTE_MIN, ocioso: OCIOSO_MIN, desligado: DESLIGADO_MIN,
};

/** Lê pesos e faixas no formato simples (o menor tempo que chega a cada corte). */
export function deConfig(c: ConfigRegra, p: Politica): RegraSimples {
  const faixas = [...c.faixas].sort((a, b) => a.acima_min - b.acima_min);
  const chega = (corte: number) => faixas.find((f) => c.peso + f.pontos >= corte)?.acima_min ?? null;
  const base = { regra: c.regra, ativa: c.ativa };
  if (c.peso >= p.corte_whatsapp) return { ...base, nivel: "whatsapp", apos: null, coordenadorApos: c.peso >= p.corte_coordenador ? 0 : chega(p.corte_coordenador) };
  const whats = chega(p.corte_whatsapp);
  if (whats != null) return { ...base, nivel: "whatsapp", apos: whats, coordenadorApos: chega(p.corte_coordenador) };
  if (c.peso >= p.corte_resumo) return { ...base, nivel: "resumo", apos: null, coordenadorApos: null };
  const resumo = chega(p.corte_resumo);
  if (resumo != null) return { ...base, nivel: "resumo", apos: resumo, coordenadorApos: null };
  return { ...base, nivel: "tela", apos: null, coordenadorApos: null };
}

/** Grava o formato simples em peso e faixas, mantendo o resto da regra (lembrete, justificativas). */
export function paraConfig(s: RegraSimples, atual: ConfigRegra, p: Politica): ConfigRegra {
  const c = { ...atual, regra: s.regra, ativa: s.ativa };
  if (s.nivel === "tela") return { ...c, peso: 0, faixas: [] };
  if (s.nivel === "resumo") return s.apos ? { ...c, peso: 0, faixas: [{ acima_min: s.apos, pontos: p.corte_resumo }] } : { ...c, peso: p.corte_resumo, faixas: [] };
  const base = s.apos ? p.corte_resumo : p.corte_whatsapp;
  const faixas = [
    ...(s.apos ? [{ acima_min: s.apos, pontos: p.corte_whatsapp - base }] : []),
    ...(s.coordenadorApos ? [{ acima_min: s.coordenadorApos, pontos: p.corte_coordenador - base }] : []),
  ];
  return { ...c, peso: base, faixas };
}

const tempo = (min: number) => (min >= 60 && min % 60 === 0 ? `${min / 60} h` : min > 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`);

/** A frase do alerta: o que acontece e para onde vai. */
export function frase(s: RegraSimples, resumoHora: string): { oque: string; destino: string[] } {
  const r = ROTULO_REGRA[s.regra];
  const apos = s.apos && s.apos > BASE_MIN[s.regra] ? s.apos : null;
  const oque =
    s.regra === "saida_tarde" || s.regra === "chegada_cedo"
      ? `${r}${apos ? `, mais de ${tempo(apos)} ${s.regra === "saida_tarde" ? "de atraso" : "antes do horário"}` : ""}`
      : `${r.replace(/ acima de 1 h| 1 h/, "")}${apos || BASE_MIN[s.regra] ? ` por mais de ${tempo(apos ?? BASE_MIN[s.regra])}` : ""}`;
  const destino =
    s.nivel === "whatsapp"
      ? ["WhatsApp para o supervisor da vaga", ...(s.coordenadorApos ? [`depois de ${tempo(s.coordenadorApos)}, também o coordenador`] : [])]
      : s.nivel === "resumo"
        ? [`só no resumo diário das ${resumoHora.slice(0, 5)}`]
        : ["só aparece na tela"];
  return { oque, destino };
}

/** Apontamento no tablet manda para o resumo? (qualquer família com valor) */
export const temJustificativa = (c: ConfigRegra) => Object.values(c.justificativas).some((v) => (v ?? 0) > 0);
export const comJustificativa = (c: ConfigRegra, ligada: boolean): ConfigRegra => ({
  ...c,
  justificativas: ligada ? REGRAS_PADRAO.saida_tarde.justificativas : {},
});

// Rotina da madrugada: quais equipamentos ainda faltam ter a rota completa de ontem processada.
import { diaMenos } from "../src/lib/dominio/analise";
import { diaLocal } from "../src/lib/dominio/formato";

/** Progresso guardado em loc_kv ("noturno"). */
export interface ControleNoturno {
  dia: string;
  feitos: string[];
  /** falhas por equipamento: depois de MAX_TENTATIVAS sai da fila (não repete consultas ao GAUSS a noite toda) */
  tentativas?: Record<string, number>;
}
// depois que o dia fecha (o rastreador descarrega atrasado até ~2 h depois) e antes do turno da manhã
const INICIO_MIN = 2 * 60 + 30;
const FIM_MIN = 6 * 60;
export const POR_CICLO = 6;
export const MAX_TENTATIVAS = 3;

/** Equipamentos a processar neste ciclo (null = fora da janela ou tudo feito: nenhuma consulta ao GAUSS). */
export function escolherNoturno(controle: ControleNoturno | null, ids: string[], agora: Date, porCiclo = POR_CICLO): { dia: string; ids: string[] } | null {
  const min = agora.getHours() * 60 + agora.getMinutes();
  if (min < INICIO_MIN || min >= FIM_MIN) return null;
  const dia = diaMenos(diaLocal(agora), 1);
  const feitos = controle?.dia === dia ? controle.feitos : [];
  const tentativas = controle?.dia === dia ? (controle.tentativas ?? {}) : {};
  const faltam = ids.filter((id) => !feitos.includes(id) && (tentativas[id] ?? 0) < MAX_TENTATIVAS);
  return faltam.length ? { dia, ids: faltam.slice(0, porCiclo) } : null;
}

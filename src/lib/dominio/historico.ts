import type { FonteHistorico, Historico } from "../tipos";
import { fmtMin, hhmm } from "./formato";

export const FONTE: Record<FonteHistorico, string> = { cache: "do banco", incremental: "atualizado (só a parte nova)", gauss: "baixado do GAUSS" };

export interface ItemResumo {
  rotulo: string;
  valor: string;
  /** explicação curta ao lado do valor */
  nota?: string;
  motor2?: boolean;
}

/** Números do dia (Localização e Timeline). Sem RPM confiável, não afirma motor ligado/desligado. */
export function itensResumo(h: Historico): ItemResumo[] {
  const r = h.resumo;
  if (!r) return [];
  const itens: ItemResumo[] = [
    { rotulo: "Período", valor: `${hhmm(r.primeiro)} – ${hhmm(r.ultimo)}` },
    { rotulo: "Distância", valor: `${r.km.toLocaleString("pt-BR")} km · máx ${r.vel_max} km/h` },
    { rotulo: "Em deslocamento", valor: fmtMin(r.movimento_min) },
  ];
  if (h.temRpm) itens.push({ rotulo: "Parado ligado", valor: fmtMin(r.parado_ligado_min) }, { rotulo: "Desligado", valor: fmtMin(r.desligado_min) });
  else
    itens.push({
      rotulo: "Parado",
      valor: fmtMin(r.parado_min),
      nota: h.rpm_travado ? `RPM do rastreador travado em ${h.rpm_travado} o dia todo: sem informação confiável de motor ligado/desligado` : "veículo não envia RPM",
    });
  if (r.sem_sinal_min) itens.push({ rotulo: "Sem sinal", valor: fmtMin(r.sem_sinal_min) });
  if (h.motor2) itens.push({ rotulo: "Motor 2º ligado", valor: `⚙ ${fmtMin(r.motor2_ligado_min)}`, nota: h.motor2.placa, motor2: true });
  if (h.motor2_erro) itens.push({ rotulo: "Motor 2º", valor: "não carregou", nota: h.motor2_erro });
  return itens;
}

import type { FonteHistorico, Historico, Trecho } from "../tipos";
import { fmtMin, hhmm } from "./formato";

export const FONTE: Record<FonteHistorico, string> = { cache: "do banco", incremental: "atualizado (só a parte nova)", gauss: "baixado do GAUSS" };

export interface ItemResumo {
  rotulo: string;
  valor: string;
  /** explicação curta ao lado do valor */
  nota?: string;
  motor2?: boolean;
}

/**
 * Tira do histórico tudo o que vem do RPM do rastreador (decisão do dono, 07/10/2026): motor ligado/desligado e motor 2º
 * passam a vir só da timeline de motor do GAUSS. Do rastreador fica o que é GPS: andando, parado, lugar e sem sinal.
 * Paradas vizinhas no mesmo lugar (antes separadas por ligado/desligado) viram uma só.
 */
export function semRpm(h: Historico): Historico {
  const paradoSe = <E extends string>(e: E) => (e === "parado_ligado" || e === "desligado" ? "parado" : e);
  const trechos: Trecho[] = [];
  for (const t of h.trechos) {
    // o motor 2º por trecho também vinha do RPM: sai
    const novo = (t.estado === "movimento" ? { ...t } : { ...t, estado: paradoSe(t.estado) }) as Trecho;
    delete novo.motor2_min;
    const ult = trechos.at(-1);
    if (ult && ult.estado === "parado" && novo.estado === "parado" && ult.local === novo.local) {
      ult.fim = novo.fim;
      ult.duracao_min += novo.duracao_min;
    } else trechos.push(novo);
  }
  const r = h.resumo;
  return {
    ...h,
    temRpm: false,
    rpm_travado: null,
    motor2_rpm_travado: null,
    motor2: null,
    motor2_erro: null,
    trechos,
    pontos: h.pontos.map((p) => [p[0], p[1], p[2], p[3], paradoSe(p[4]), null]),
    resumo: r && { ...r, parado_min: r.parado_min + r.parado_ligado_min + r.desligado_min, parado_ligado_min: 0, desligado_min: 0, motor2_ligado_min: null },
  };
}

/** Números do dia vindos do GPS (Localização e Timeline). Motor ligado/desligado e motor 2º vêm do GAUSS, à parte. */
export function itensResumo(h: Historico): ItemResumo[] {
  const r = h.resumo;
  if (!r) return [];
  const itens: ItemResumo[] = [
    { rotulo: "Período", valor: `${hhmm(r.primeiro)} – ${hhmm(r.ultimo)}` },
    { rotulo: "Distância", valor: `${r.km.toLocaleString("pt-BR")} km · máx ${r.vel_max} km/h` },
    { rotulo: "Em deslocamento", valor: fmtMin(r.movimento_min) },
    { rotulo: "Parado", valor: fmtMin(r.parado_min + r.parado_ligado_min + r.desligado_min) },
  ];
  if (r.sem_sinal_min) itens.push({ rotulo: "Sem sinal", valor: fmtMin(r.sem_sinal_min) });
  return itens;
}

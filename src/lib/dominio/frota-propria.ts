// O sistema mostra só a frota da Mecanizada (equipamentos.ts). O coletor filtra o retrato e os eventos antes de
// gravar; o site aplica a mesma regra ao ler (retrato e eventos gravados antes do filtro). O estado do coletor
// (loc_kv.estado) continua com todos os veículos: o pareamento do motor 2º precisa deles.
import type { Equip, Evento, Retrato } from "../tipos";
import { identificarEquip } from "./equipamentos";

// grupos do GAUSS onde a frota está: veículo desses grupos fora da planilha vai para fora_da_lista (equipamento novo?)
const GRUPO_DA_FROTA = /ALTA PRESS|V[AÁ]CUO|BROOK|ASPIRADOR|ULTRAVAC/i;

/** Retrato só com a frota: cada veículo ganha `equip`; o motor 2º fica se o caminhão dele é da frota. */
export function aplicarFrota(r: Retrato): Retrato {
  const equipDe = new Map<string, Equip>();
  for (const v of r.veiculos) {
    if (v.motor2_de) continue;
    const e = v.equip ?? identificarEquip(v);
    if (e) equipDe.set(v.id, e);
  }
  const veiculos = r.veiculos.flatMap((v) => {
    const e = equipDe.get(v.motor2_de ?? v.id);
    return e ? [{ ...v, equip: e }] : [];
  });
  const fora = r.veiculos
    .filter((v) => !v.motor2_de && !equipDe.has(v.id) && GRUPO_DA_FROTA.test(v.grupo ?? ""))
    .map((v) => v.placa)
    .sort();
  return { ...r, veiculos, fora_da_lista: fora };
}

/** ids que ficam no sistema (equipamentos e seus motores 2º) de um retrato já passado por aplicarFrota. */
export const idsDaFrota = (r: Retrato) => new Set(r.veiculos.map((v) => v.id));

export const eventosDaFrota = (es: Evento[], ids: ReadonlySet<string>) => es.filter((e) => ids.has(e.id) || (!!e.principal_id && ids.has(e.principal_id)));

/** "Abertura do dia": status e área de cada equipamento no 1º ciclo do dia (nenhuma consulta a mais ao GAUSS). */
export function eventosAbertura(r: Retrato, agoraISO: string): Evento[] {
  return r.veiculos
    .filter((v) => !v.motor2_de)
    .map((v) => ({ t: agoraISO, id: v.id, placa: v.placa, vaga: v.vaga, tipo: "abertura" as const, status: v.status, area: v.area, sem_sinal: v.sem_sinal }));
}

export const precisaAbertura = (ultima: { dia: string } | null, hoje: string) => ultima?.dia !== hoje;

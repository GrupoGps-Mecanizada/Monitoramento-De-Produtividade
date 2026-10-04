// A frota da Mecanizada (planilha "LOCAÇÃO - GPS", 03/10/2026). O GAUSS tem outros veículos da empresa: só estes
// (e o motor secundário deles) aparecem no sistema. Entrou ou saiu um equipamento: muda a lista aqui e publica.
import type { Equip, TipoEquip, Veiculo } from "../tipos";
import { pad } from "./formato";
import { normPlaca } from "./frota";

export const ORDEM_TIPOS: TipoEquip[] = ["ap", "av", "hv", "uv", "pg", "as"];
export const TIPOS_EQUIP: Record<TipoEquip, { sigla: string; rotulo: string }> = {
  ap: { sigla: "AP", rotulo: "Alta Pressão" },
  av: { sigla: "AV", rotulo: "Alto Vácuo" },
  hv: { sigla: "HV", rotulo: "Hiper Vácuo" },
  uv: { sigla: "UV", rotulo: "Ultravac" },
  pg: { sigla: "PG", rotulo: "Poliguindaste (Brook)" },
  as: { sigla: "AS", rotulo: "Aspiradores" },
};

const PLACAS: Record<Exclude<TipoEquip, "as">, string[]> = {
  ap: ["CZC-0453", "DSY-6472", "DSY-6474", "DSY-6475", "EAM-3253", "EAM-3255", "EAM-3256", "EAM-3262", "EGC-2978", "EGC-2983", "EGC-2985", "EGC-2989", "EZS-8764", "PUB-2F80"],
  av: ["ALY-5322", "ANF-2676", "CUB-0763", "DSY-6473", "DSY-6577", "DYB-7210", "EAM-3251", "EAM-3257", "EGC-2993", "FSA-3D71", "HJS-1097"],
  hv: ["DSY-6471", "EGC-1875", "FHD-9264"],
  // no GAUSS está no grupo "CAMINHÃO HIPER VÁCUO"
  uv: ["OWU-1596"],
  pg: ["DSY-6477", "EGC-2984", "EPN-2463"],
};
// aspiradores: pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"); as placas no GAUSS (ASPII, ASP12-RESERVA) não servem
const ASPIRADORES = 10;
const VAGA_ASPIRADOR = /ASPIRADOR.*GPS\s*-\s*(\d{1,2})(?!\d)/i;

export const TOTAL_FROTA = Object.values(PLACAS).reduce((n, l) => n + l.length, 0) + ASPIRADORES;

/** Placa antiga (AAA9999) e Mercosul (AAA9A99) são a mesma: o 5º caractere troca 0-9 <-> A-J. */
export function formasPlaca(placa: string): string[] {
  const n = normPlaca(placa);
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(n)) return [n];
  const c = n[4];
  const troca = /\d/.test(c) ? String.fromCharCode(65 + Number(c)) : c <= "J" ? String(c.charCodeAt(0) - 65) : null;
  return troca ? [n, `${n.slice(0, 4)}${troca}${n.slice(5)}`] : [n];
}

const POR_PLACA = new Map<string, Equip>();
for (const tipo of Object.keys(PLACAS) as (keyof typeof PLACAS)[]) {
  PLACAS[tipo].forEach((nome, i) => {
    for (const f of formasPlaca(nome)) POR_PLACA.set(f, { tipo, nome, ordem: i + 1 });
  });
}

/** Equipamento da frota que este veículo do GAUSS é, ou null (veículo de fora ou motor secundário). */
export function identificarEquip(v: Pick<Veiculo, "placa" | "vaga">): Equip | null {
  const asp = VAGA_ASPIRADOR.exec(v.vaga ?? "");
  if (asp) {
    const n = Number(asp[1]);
    if (n >= 1 && n <= ASPIRADORES) return { tipo: "as", nome: `Aspirador ${pad(n)}`, ordem: n };
  }
  for (const f of formasPlaca(v.placa)) {
    const e = POR_PLACA.get(f);
    if (e) return e;
  }
  return null;
}

/** Nome para a tela: o da planilha ("EGC-2985", "Aspirador 05"); sem equipamento, a placa do GAUSS. */
export const nomeEquip = (v: Pick<Veiculo, "placa" | "equip">) => v.equip?.nome ?? v.placa;

/** Ordem da planilha: tipo e posição na lista; sem equipamento vai para o fim. */
export function compararEquip(a: Pick<Veiculo, "placa" | "equip">, b: Pick<Veiculo, "placa" | "equip">): number {
  const ta = a.equip ? ORDEM_TIPOS.indexOf(a.equip.tipo) : ORDEM_TIPOS.length;
  const tb = b.equip ? ORDEM_TIPOS.indexOf(b.equip.tipo) : ORDEM_TIPOS.length;
  return ta - tb || (a.equip?.ordem ?? 0) - (b.equip?.ordem ?? 0) || a.placa.localeCompare(b.placa);
}

// A frota da Mecanizada vem da matriz de equipamentos (Supabase: frota_equipamento). O GAUSS tem outros veículos da
// empresa: só os da matriz que não estão DESMOBILIZADOS (e o motor secundário deles) aparecem no sistema.
// Entrou, saiu ou foi para a manutenção: muda na tela Equipamentos, sem publicar nada.
import type { Equip, EquipamentoCadastro, StatusEquip, Tom, TipoEquip, Veiculo } from "../tipos";
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

export const STATUS_EQUIP: Record<StatusEquip, { rotulo: string; tom: Tom }> = {
  ATIVO: { rotulo: "Ativo", tom: "ok" },
  EM_MANUTENCAO: { rotulo: "Em manutenção", tom: "warn" },
  DESMOBILIZADO: { rotulo: "Desmobilizado", tom: "na" },
};
export const ORDEM_STATUS: StatusEquip[] = ["ATIVO", "EM_MANUTENCAO", "DESMOBILIZADO"];

// aspiradores: pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"); as placas no GAUSS (ASPII, ASP12-RESERVA) não servem
const VAGA_ASPIRADOR = /ASPIRADOR.*GPS\s*-\s*(\d{1,2})(?!\d)/i;

/** Placa antiga (AAA9999) e Mercosul (AAA9A99) são a mesma: o 5º caractere troca 0-9 <-> A-J. */
export function formasPlaca(placa: string): string[] {
  const n = normPlaca(placa);
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(n)) return [n];
  const c = n[4];
  const troca = /\d/.test(c) ? String.fromCharCode(65 + Number(c)) : c <= "J" ? String(c.charCodeAt(0) - 65) : null;
  return troca ? [n, `${n.slice(0, 4)}${troca}${n.slice(5)}`] : [n];
}

/** Nome do equipamento na matriz: a placa ("EGC-2985") ou "Aspirador 05". */
export const nomeCadastro = (c: Pick<EquipamentoCadastro, "tipo" | "placa" | "numero">) =>
  c.tipo === "as" ? `Aspirador ${pad(c.numero ?? 0)}` : (c.placa ?? "").toUpperCase();

/** Índice da matriz para achar o equipamento de cada veículo do GAUSS. */
export interface Frota {
  porPlaca: Map<string, Equip>;
  aspiradores: Map<number, Equip>;
  /** placas de toda a matriz, inclusive desmobilizados (não são "equipamento novo?") */
  conhecidas: Set<string>;
  /** quantos equipamentos estão no monitoramento (ativos + em manutenção) */
  total: number;
}

const paraEquip = (c: EquipamentoCadastro): Equip => ({
  tipo: c.tipo,
  nome: nomeCadastro(c),
  ordem: c.ordem,
  id: c.id,
  status: c.status === "EM_MANUTENCAO" ? "EM_MANUTENCAO" : "ATIVO",
  codigo: c.codigo,
  supervisor: c.supervisor,
  regime: c.regime,
});

/** Monta o índice com os equipamentos que ficam no monitoramento (desmobilizado fica de fora). */
export function montarFrota(cadastro: readonly EquipamentoCadastro[]): Frota {
  const porPlaca = new Map<string, Equip>();
  const aspiradores = new Map<number, Equip>();
  const conhecidas = new Set<string>();
  let total = 0;
  for (const c of cadastro) {
    if (c.placa) for (const f of formasPlaca(c.placa)) conhecidas.add(f);
    if (c.status === "DESMOBILIZADO") continue;
    const e = paraEquip(c);
    if (c.tipo === "as") {
      if (c.numero == null) continue;
      aspiradores.set(c.numero, e);
    } else {
      if (!c.placa) continue;
      for (const f of formasPlaca(c.placa)) porPlaca.set(f, e);
    }
    total++;
  }
  return { porPlaca, aspiradores, conhecidas, total };
}

/** Equipamento da frota que este veículo do GAUSS é, ou null (veículo de fora, desmobilizado ou motor secundário). */
export function identificarEquip(v: Pick<Veiculo, "placa" | "vaga">, frota: Frota): Equip | null {
  const asp = VAGA_ASPIRADOR.exec(v.vaga ?? "");
  if (asp) {
    const e = frota.aspiradores.get(Number(asp[1]));
    if (e) return e;
  }
  for (const f of formasPlaca(v.placa)) {
    const e = frota.porPlaca.get(f);
    if (e) return e;
  }
  return null;
}

/** Nome para a tela: o da planilha ("EGC-2985", "Aspirador 05"); sem equipamento, a placa do GAUSS. */
export const nomeEquip = (v: Pick<Veiculo, "placa" | "equip">) => v.equip?.nome ?? v.placa;

export const emManutencao = (v: Pick<Veiculo, "equip">) => v.equip?.status === "EM_MANUTENCAO";

/** Ordem da planilha: tipo e posição na lista; sem equipamento vai para o fim. */
export function compararEquip(a: Pick<Veiculo, "placa" | "equip">, b: Pick<Veiculo, "placa" | "equip">): number {
  const ta = a.equip ? ORDEM_TIPOS.indexOf(a.equip.tipo) : ORDEM_TIPOS.length;
  const tb = b.equip ? ORDEM_TIPOS.indexOf(b.equip.tipo) : ORDEM_TIPOS.length;
  return ta - tb || (a.equip?.ordem ?? 0) - (b.equip?.ordem ?? 0) || a.placa.localeCompare(b.placa);
}

/** Ordem da matriz: tipo, posição e nome. */
export function compararCadastro(a: EquipamentoCadastro, b: EquipamentoCadastro): number {
  return ORDEM_TIPOS.indexOf(a.tipo) - ORDEM_TIPOS.indexOf(b.tipo) || a.ordem - b.ordem || nomeCadastro(a).localeCompare(nomeCadastro(b));
}

/** Próxima posição dentro do tipo (equipamento novo entra no fim da lista dele). */
export const proximaOrdem = (cadastro: readonly EquipamentoCadastro[], tipo: TipoEquip) =>
  cadastro.filter((c) => c.tipo === tipo).reduce((m, c) => Math.max(m, c.ordem), 0) + 1;

/** O que a tela de edição grava. */
export interface DadosEquipamento {
  tipo: TipoEquip;
  placa: string;
  numero: string;
  codigo: string;
  status: StatusEquip;
  supervisor_id: number | null;
  regime_id: number | null;
  observacao: string;
}

/** Placa no formato da planilha: "EGC2985" -> "EGC-2985" (Mercosul também: "PUB2F80" -> "PUB-2F80"). */
export function formatarPlaca(placa: string): string {
  const n = normPlaca(placa);
  return /^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(n) ? `${n.slice(0, 3)}-${n.slice(3)}` : n;
}

/**
 * Confere o formulário antes de gravar. Devolve os campos prontos para o banco ou a mensagem do problema.
 * `id` = o equipamento que está sendo editado (não conta como repetido dele mesmo).
 */
export function validarEquipamento(
  d: DadosEquipamento,
  cadastro: readonly EquipamentoCadastro[],
  id?: number,
): { ok: true; linha: Record<string, unknown> } | { ok: false; erro: string } {
  const outros = cadastro.filter((c) => c.id !== id);
  const base = {
    tipo: d.tipo,
    codigo: d.codigo.trim() || null,
    status: d.status,
    supervisor_id: d.supervisor_id,
    regime_id: d.regime_id,
    observacao: d.observacao.trim() || null,
  };
  if (base.observacao && base.observacao.length > 500) return { ok: false, erro: "A observação passa de 500 letras." };
  if (base.codigo && base.codigo.length > 30) return { ok: false, erro: "O código passa de 30 letras." };
  if (d.tipo === "as") {
    const n = Number(d.numero);
    if (!/^\d{1,2}$/.test(d.numero.trim()) || n < 1 || n > 99) return { ok: false, erro: "Informe o número do aspirador (1 a 99)." };
    const rep = outros.find((c) => c.tipo === "as" && c.numero === n);
    if (rep) return { ok: false, erro: `O Aspirador ${pad(n)} já está na matriz.` };
    return { ok: true, linha: { ...base, placa: null, numero: n } };
  }
  const placa = formatarPlaca(d.placa);
  if (!/^[A-Z0-9-]{4,10}$/.test(placa) || placa.replace(/-/g, "").length < 4) return { ok: false, erro: "Informe a placa (ex.: EGC-2985)." };
  const formas = new Set(formasPlaca(placa));
  const rep = outros.find((c) => c.placa && formasPlaca(c.placa).some((f) => formas.has(f)));
  if (rep) return { ok: false, erro: `A placa ${rep.placa} já está na matriz (${TIPOS_EQUIP[rep.tipo].rotulo}).` };
  return { ok: true, linha: { ...base, placa, numero: null } };
}

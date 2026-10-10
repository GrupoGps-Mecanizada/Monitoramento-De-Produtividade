// Produtividade pela timeline de motor do GAUSS (regra do dono, 07/10/2026, a mesma dos projetos antigos):
// cada tipo de equipamento tem o status do GAUSS que conta como "produtivo".
// Na base não conta (regra do dono, 08/10/2026): o produtivo dentro do Pátio do Transporte e da Garagem aparece à parte
// como "motor ligado na base". A Baia de Resíduos fica no Pátio, mas é serviço: lá conta.
import type { Evento, TipoEquip, Trecho } from "../tipos";
import { segDe } from "./formato";
import type { BlocoGauss } from "./gauss-dia";
import { DIA } from "./trilhas";

/** Status do GAUSS que é produtivo para cada tipo (sem regra = o tipo não tem produtividade calculada). */
const POR_TIPO: Partial<Record<TipoEquip, string>> = {
  ap: "secondary_motor_on", // Alta Pressão: motor secundário (bomba) ligado
  av: "stopped", // Alto Vácuo: parado ligado (o vácuo trabalha com o caminhão parado e o motor ligado)
  // Hiper Vácuo, Brook e Aspiradores: sem regra (decisão do dono, 08/10/2026; o GAUSS não registra motor 2º do Hiper Vácuo)
};
/** Exceções por placa (sem hífen): o DSY6472 é Alta Pressão, mas produz parado ligado. */
const POR_PLACA: Record<string, string> = { DSY6472: "stopped" };

/** Código do status produtivo do equipamento (ex.: "secondary_motor_on"), ou null quando o tipo não tem regra. */
export function statusProdutivo(tipo: TipoEquip | undefined, placa: string): string | null {
  const limpa = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return POR_PLACA[limpa] ?? (tipo ? (POR_TIPO[tipo] ?? null) : null);
}

/** Cerca da base (Pátio do Transporte, Garagem): produtivo ali não conta. A Baia de Resíduos é serviço. */
export function ehBase(area: string): boolean {
  return /P[ÁA]TIO DO TRANSPORTE|GARAGEM/i.test(area) && !/BAIA DE RES/i.test(area);
}

/** Pedaço do dia em segundos (a = início, b = fim). */
export interface Intervalo {
  a: number;
  b: number;
}

/** Na base pelos trechos da Timeline: os trechos parados numa cerca da base. */
export function baseDosTrechos(trechos: Trecho[]): Intervalo[] {
  return trechos.filter((t) => t.estado !== "movimento" && ehBase(t.local)).map((t) => ({ a: segDe(t.inicio.slice(11, 19)), b: segDe(t.fim.slice(11, 19)) }));
}

// horário de Brasília (sem horário de verão desde 2019)
const segDoDia = (iso: string, dia: string) => Math.min(DIA, Math.max(0, (Date.parse(iso) - Date.parse(`${dia}T00:00:00-03:00`)) / 1000));

/**
 * Na base pelas entradas e saídas de área que o coletor grava (Dia da frota, sem consulta ao GAUSS). Parte da área da
 * abertura do dia; sem abertura, uma saída como primeiro evento diz que o veículo estava na área desde a meia-noite.
 */
export function baseDosEventos(eventos: Evento[], dia: string): Intervalo[] {
  const fora: Intervalo[] = [];
  let area: string | null = null;
  let desde = 0;
  const mudar = (nova: string, t: number) => {
    if (area && ehBase(area) && t > desde) fora.push({ a: desde, b: t });
    area = nova;
    desde = t;
  };
  for (const e of [...eventos].sort((x, y) => x.t.localeCompare(y.t))) {
    const t = segDoDia(e.t, dia);
    if (e.tipo === "abertura") mudar(e.area, area === null ? 0 : t);
    else if (e.tipo === "entrada") mudar(e.area, t);
    else if (e.tipo === "saida") {
      if (area === null) area = e.area; // estava na área desde a meia-noite
      if (area === e.area) mudar("", t);
    }
  }
  mudar("", DIA);
  return fora;
}

/** Produtivo do dia: `min` fora da base (o que conta) e `base_min` dentro da base. null = o equipamento não tem regra. */
export function dividirProdutivo(blocos: Pick<BlocoGauss, "a" | "b" | "cod">[], produtivo: string | null, base: Intervalo[] = []): { min: number; base_min: number } | null {
  if (!produtivo) return null;
  let total = 0;
  let naBase = 0;
  for (const x of blocos) {
    if (x.cod !== produtivo) continue;
    total += x.b - x.a;
    for (const y of base) naBase += Math.max(0, Math.min(x.b, y.b) - Math.max(x.a, y.a));
  }
  return { min: (total - naBase) / 60, base_min: naBase / 60 };
}

/** O instante t está na base? */
export const naBase = (base: Intervalo[], t: number) => base.some((y) => t >= y.a && t < y.b);

// "Dia da frota": uma faixa por equipamento ao longo do dia, com o status de motor da timeline de motor do GAUSS
// (motor ligado, parado ligado, motor 2º, desligado, parada apontada, manutenção...) e a produtividade de cada tipo.
// Sem RPM (decisão do dono, 07/10/2026). Os dados vêm de timeline_motor_vaga (o coletor grava; nenhuma consulta daqui).
// O produtivo na base (Pátio, Garagem) fica à parte, pelas entradas e saídas de área de loc_eventos.
import type { Evento, TipoEquip, Veiculo } from "../tipos";
import { ORDEM_TIPOS, compararEquip, nomeEquip } from "./equipamentos";
import { blocoEm, montarStatusGauss, type BlocoGauss, type LinhaMotorGauss } from "./gauss-dia";
import { baseDosEventos, dividirProdutivo, naBase, statusProdutivo } from "./produtividade";

/** Linha de timeline_motor_vaga com o veículo (placa_ou_codigo = id do veículo no GAUSS). */
export interface LinhaMotorFrota extends LinhaMotorGauss {
  placa_ou_codigo: string;
}
export interface LinhaFrota {
  id: string;
  nome: string;
  tipo: TipoEquip;
  vaga: string;
  blocos: BlocoGauss[];
  /** código do status produtivo (ex.: secondary_motor_on); null = o tipo não tem regra */
  produtivo: string | null;
  /** produtivo fora da base (o que conta) */
  produtivo_min: number | null;
  /** produtivo dentro da base (Pátio, Garagem): mostrado à parte como "motor ligado na base" */
  base_min: number;
  /** agora no status produtivo e fora da base */
  produzindo: boolean;
  /** motor ligado (andando, parado ligado ou com o motor 2º) */
  ligado_min: number;
  /** status agora (só hoje): o último bloco da timeline */
  agora: BlocoGauss | null;
}
export interface GrupoFrota {
  tipo: TipoEquip;
  linhas: LinhaFrota[];
  produtivo: string | null;
  produtivo_min: number;
  base_min: number;
  ligado_min: number;
  agoraProdutivos: number;
  agoraLigados: number;
  agoraDesligados: number;
}
export type OrdemFrota = "tipo" | "mais" | "menos";

const LIGADO = new Set(["on", "stopped", "secondary_motor_on"]);
const DESLIGADO = new Set(["off", "main_switch_off"]);
const minDe = (blocos: BlocoGauss[], cods: Set<string>) => blocos.reduce((n, x) => n + (cods.has(x.cod) ? (x.b - x.a) / 60 : 0), 0);

/**
 * Uma linha por equipamento da frota (sem o motor 2º, que já aparece como status "Motor 2º ligado" do caminhão), na
 * ordem da planilha. `agoraSeg`: segundos do dia agora (só quando o dia é hoje), para o status atual. `eventos`: entradas
 * e saídas de área do dia (para separar o produtivo na base).
 */
export function montarDiaFrota(linhas: LinhaMotorFrota[], veiculos: Veiculo[], dia: string, agoraSeg: number | null, eventos: Evento[] = []): LinhaFrota[] {
  const porId = new Map<string, LinhaMotorFrota[]>();
  for (const l of linhas) {
    const lista = porId.get(l.placa_ou_codigo);
    if (lista) lista.push(l);
    else porId.set(l.placa_ou_codigo, [l]);
  }
  const eventosPorId = new Map<string, Evento[]>();
  for (const e of eventos) {
    if (e.motor2) continue;
    const lista = eventosPorId.get(e.id);
    if (lista) lista.push(e);
    else eventosPorId.set(e.id, [e]);
  }
  return veiculos
    .filter((v) => !v.motor2_de && v.equip)
    .sort(compararEquip)
    .map((v) => {
      const blocos = montarStatusGauss(porId.get(v.id) ?? [], dia);
      const produtivo = statusProdutivo(v.equip?.tipo, v.placa);
      const base = baseDosEventos(eventosPorId.get(v.id) ?? [], dia);
      const prod = dividirProdutivo(blocos, produtivo, base);
      const ult = blocos.at(-1) ?? null;
      // "agora" = o bloco que cobre este momento; se a timeline ainda não chegou até agora, o último que chegou
      const agora = agoraSeg == null ? null : (blocoEm(blocos, agoraSeg) ?? ult);
      return {
        id: v.id,
        nome: nomeEquip(v),
        tipo: v.equip?.tipo ?? "ap",
        vaga: v.vaga,
        blocos,
        produtivo,
        produtivo_min: prod && prod.min,
        base_min: prod?.base_min ?? 0,
        produzindo: !!agora && agora.cod === produtivo && agoraSeg != null && !naBase(base, agoraSeg),
        ligado_min: Math.round(minDe(blocos, LIGADO)),
        agora,
      };
    });
}

/** Grupos por tipo (só os que têm equipamento), com a contagem de agora e a ordem escolhida (por produtivo; sem regra, por ligado). */
export function agruparFrota(linhas: LinhaFrota[], ordem: OrdemFrota): GrupoFrota[] {
  const chave = (l: LinhaFrota) => l.produtivo_min ?? l.ligado_min;
  return ORDEM_TIPOS.map((tipo) => {
    const ls = linhas.filter((l) => l.tipo === tipo);
    if (ordem !== "tipo") ls.sort((a, b) => (ordem === "mais" ? chave(b) - chave(a) : chave(a) - chave(b)));
    return {
      tipo,
      linhas: ls,
      produtivo: ls.find((l) => l.produtivo)?.produtivo ?? null,
      produtivo_min: ls.reduce((n, l) => n + (l.produtivo_min ?? 0), 0),
      base_min: ls.reduce((n, l) => n + l.base_min, 0),
      ligado_min: ls.reduce((n, l) => n + l.ligado_min, 0),
      agoraProdutivos: ls.filter((l) => l.produzindo).length,
      agoraLigados: ls.filter((l) => l.agora && LIGADO.has(l.agora.cod)).length,
      agoraDesligados: ls.filter((l) => l.agora && DESLIGADO.has(l.agora.cod)).length,
    };
  }).filter((g) => g.linhas.length);
}

// Transforma uma leitura da tela Localização do GAUSS em estado + eventos (entrada/saída de área, mudança de
// status, perda/retorno de sinal), em forma de função pura: o GitHub Actions roda uma vez e termina, então o
// estado anterior vem do Supabase. Mesmo cálculo do coletor em JS (paridade em coletor/paridade.test.ts).
import type { Cerca, EstadoVeiculo, Evento, Retrato } from "../tipos";
import { parearMotores } from "./frota";
import { cercasNoPonto } from "./geo";

// sem leitura nova do GPS há mais que isso = "sem sinal" (gera evento)
export const SEM_SINAL_MIN = 30;

/** Legenda de status do GAUSS (códigos do marcador da tela Localização). */
export const STATUS: Record<number, string> = {
  1: "Ligado",
  2: "Desligado",
  3: "Parado ligado",
  4: "Chave geral desligada",
  5: "Aguardando manutenção",
  6: "Em programação",
  7: "Sem comunicação +6h",
  9: "Em manutenção",
  11: "Disponível",
  37: "Geo área indisponível",
  71: "Desligado",
  88: "Checklist não conforme",
  89: "Checklist impeditivo",
  98: "Desligado",
  99: "Excesso de velocidade",
};

/** Posição de um veículo como o GAUSS devolve na tela Localização (location-online). */
export interface PosicaoGauss {
  vehicle_code: number | string;
  vehicle_name: string;
  lat: string | number;
  lng: string | number;
  /** "AAAA-MM-DD HH:MM:SS" em horário local */
  datetime: string | null;
  status: number | string;
  contract_position_obj?: { name?: string } | null;
  vehicle_group?: string | null;
  driver?: string | null;
  address?: string | null;
  delay_name?: string | null;
  direction?: number | string | null;
}

// o GAUSS manda "2026-09-30 22:52:02" em horário local (TZ=America/Sao_Paulo no workflow)
const gaussParaISO = (s: string | null) => (s ? new Date(s.replace(" ", "T")).toISOString() : null);
const minutosEntre = (a: string | null, b: string | null) => (a && b ? Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000) : null);

export function processarLeitura(
  estadoAnterior: Record<string, EstadoVeiculo>,
  posicoes: PosicaoGauss[],
  cercas: Cerca[],
  agora = new Date(),
): { estado: Record<string, EstadoVeiculo>; eventos: Evento[] } {
  const agoraISO = agora.toISOString();
  const estado = { ...estadoAnterior };
  const eventos: Evento[] = [];
  const { principalDe } = parearMotores(posicoes.map((p) => ({ id: String(p.vehicle_code), placa: p.vehicle_name })));
  const placaPorId = new Map(posicoes.map((p) => [String(p.vehicle_code), p.vehicle_name]));

  for (const p of posicoes) {
    const id = String(p.vehicle_code);
    const ant = estadoAnterior[id];
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    const posicaoEm = gaussParaISO(p.datetime);
    const dentro = cercasNoPonto(lat, lng, cercas);
    const area = dentro.find((c) => c.tipo === "area")?.name ?? "";
    const via = dentro.find((c) => c.tipo === "via")?.name ?? "";
    const status = STATUS[Number(p.status)] ?? `Status ${p.status}`;
    const semSinal = posicaoEm ? (agora.getTime() - new Date(posicaoEm).getTime()) / 60000 > SEM_SINAL_MIN : true;

    const atual: EstadoVeiculo = {
      id,
      placa: p.vehicle_name,
      vaga: p.contract_position_obj?.name ?? "",
      grupo: p.vehicle_group ?? "",
      motorista: p.driver && !/^S\/ MOTORISTA/i.test(p.driver) ? p.driver : "",
      endereco: p.address ?? "",
      demora: p.delay_name && p.delay_name !== "--" ? p.delay_name : "",
      direcao: Number(p.direction) || 0,
      status,
      status_cod: Number(p.status),
      // sem estado anterior não dá pra saber desde quando - fica null em vez de inventar
      status_desde: ant ? (ant.status === status ? ant.status_desde : agoraISO) : null,
      lat,
      lng,
      posicao_em: posicaoEm,
      area,
      area_desde: ant ? (ant.area === area ? ant.area_desde : posicaoEm) : null,
      via,
      sem_sinal: semSinal,
    };

    const principalId = principalDe.get(id);
    const base = {
      t: agoraISO, id, placa: atual.placa, vaga: atual.vaga,
      ...(principalId ? { motor2: true as const, principal_id: principalId, principal: placaPorId.get(principalId) } : {}),
    };
    if (ant) {
      // posição sem data: o evento fica com o horário da leitura (t nulo o banco recusa)
      const quando = posicaoEm ?? agoraISO;
      // entrada/saída de área do motor secundário seria cópia da do caminhão
      if (ant.area !== area && !principalId) {
        if (ant.area) eventos.push({ ...base, t: quando, tipo: "saida", area: ant.area, desde: ant.area_desde, permanencia_min: minutosEntre(ant.area_desde, posicaoEm) });
        if (area) eventos.push({ ...base, t: quando, tipo: "entrada", area, lat, lng });
      }
      if (ant.status !== status) {
        eventos.push({ ...base, tipo: "status", de: ant.status, para: status, area, duracao_min: minutosEntre(ant.status_desde, agoraISO) });
      }
      if (semSinal && !ant.sem_sinal) {
        eventos.push({ ...base, tipo: "sinal_perdido", ultima_posicao: posicaoEm, area });
      } else if (!semSinal && ant.sem_sinal) {
        eventos.push({ ...base, tipo: "sinal_retomado", area, sem_sinal_min: minutosEntre(ant.posicao_em, posicaoEm) });
      }
    }

    estado[id] = atual;
  }
  return { estado, eventos };
}

/** Retrato que a página mostra: o motor secundário vai dentro do caminhão (motor2). */
export function montarSnapshot(estado: Record<string, EstadoVeiculo>, meta: Omit<Retrato, "veiculos" | "sem_sinal_min">): Retrato {
  const todos = Object.values(estado);
  const { principalDe, secundarioDe } = parearMotores(todos);
  const veiculos = todos.map((v) => {
    if (principalDe.has(v.id)) return { ...v, motor2_de: principalDe.get(v.id) };
    const sec = estado[secundarioDe.get(v.id) ?? ""];
    if (!sec) return v;
    return {
      ...v,
      motor2: { id: sec.id, placa: sec.placa, status: sec.status, status_cod: sec.status_cod, status_desde: sec.status_desde, posicao_em: sec.posicao_em, sem_sinal: sec.sem_sinal },
    };
  });
  return { ...meta, sem_sinal_min: SEM_SINAL_MIN, veiculos };
}

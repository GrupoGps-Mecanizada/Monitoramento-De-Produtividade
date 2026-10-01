// Transforma uma leitura da Localização do GAUSS em estado + eventos (entrada/saída
// de área, mudança de status, perda/retorno de sinal). Mesma regra de
// automation/monitoramento/coletor.js, em forma de função pura: o GitHub Actions
// roda uma vez e termina, então o estado anterior vem do Supabase.
import { STATUS, geofencesAt } from './location-online.js';
import { parearMotores } from './frota.js';

// sem leitura nova do GPS há mais que isso = "sem sinal" (gera evento)
export const SEM_SINAL_MIN = 30;

// Ruas/avenidas também são cercas no GAUSS. Para entrada/saída só contam as
// áreas de verdade (pátios, oficinas, baias...) - rua é trânsito e geraria um
// evento a cada esquina. Plantas (layer 3) cobrem a usina inteira.
const VIA = /^(RUA|R\.|AV\b|AV\.|AVENIDA|PN-|CANCELA)/i;
export function tipoCerca(c) {
  if (c.layer === 3) return 'planta';
  if (VIA.test(c.name)) return 'via';
  return 'area';
}

// o GAUSS manda "2026-09-30 22:52:02" em horário local (TZ=America/Sao_Paulo no workflow)
const gaussParaISO = (s) => (s ? new Date(s.replace(' ', 'T')).toISOString() : null);
const minutosEntre = (a, b) => (a && b ? Math.round((new Date(b) - new Date(a)) / 60000) : null);

/**
 * @param {Record<string, object>} estadoAnterior - { [vehicle_code]: estado }
 * @param {object[]} posicoes - resposta do location-online
 * @param {object[]} cercas - com campo tipo
 * @returns {{ estado: Record<string, object>, eventos: object[] }}
 */
export function processarLeitura(estadoAnterior, posicoes, cercas, agora = new Date()) {
  const agoraISO = agora.toISOString();
  const estado = { ...estadoAnterior };
  const eventos = [];
  const { principalDe } = parearMotores(posicoes.map((p) => ({ id: String(p.vehicle_code), placa: p.vehicle_name })));
  const placaPorId = new Map(posicoes.map((p) => [String(p.vehicle_code), p.vehicle_name]));

  for (const p of posicoes) {
    const id = String(p.vehicle_code);
    const ant = estadoAnterior[id];
    const lat = Number(p.lat);
    const lng = Number(p.lng);
    const posicaoEm = gaussParaISO(p.datetime);
    const dentro = geofencesAt(lat, lng, cercas);
    const area = dentro.find((c) => c.tipo === 'area')?.name ?? '';
    const via = dentro.find((c) => c.tipo === 'via')?.name ?? '';
    const status = STATUS[p.status] ?? `Status ${p.status}`;
    const semSinal = posicaoEm ? (agora - new Date(posicaoEm)) / 60000 > SEM_SINAL_MIN : true;

    const atual = {
      id,
      placa: p.vehicle_name,
      vaga: p.contract_position_obj?.name ?? '',
      grupo: p.vehicle_group ?? '',
      motorista: p.driver && !/^S\/ MOTORISTA/i.test(p.driver) ? p.driver : '',
      endereco: p.address ?? '',
      demora: p.delay_name && p.delay_name !== '--' ? p.delay_name : '',
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
    const base = { t: agoraISO, id, placa: atual.placa, vaga: atual.vaga };
    if (principalId) Object.assign(base, { motor2: true, principal_id: principalId, principal: placaPorId.get(principalId) });
    if (ant) {
      // entrada/saída de área do motor secundário seria cópia da do caminhão
      if (ant.area !== area && !principalId) {
        if (ant.area) {
          eventos.push({ ...base, t: posicaoEm, tipo: 'saida', area: ant.area,
            desde: ant.area_desde, permanencia_min: minutosEntre(ant.area_desde, posicaoEm) });
        }
        if (area) eventos.push({ ...base, t: posicaoEm, tipo: 'entrada', area, lat, lng });
      }
      if (ant.status !== status) {
        eventos.push({ ...base, tipo: 'status', de: ant.status, para: status, area,
          duracao_min: minutosEntre(ant.status_desde, agoraISO) });
      }
      if (semSinal && !ant.sem_sinal) {
        eventos.push({ ...base, tipo: 'sinal_perdido', ultima_posicao: posicaoEm, area });
      } else if (!semSinal && ant.sem_sinal) {
        eventos.push({ ...base, tipo: 'sinal_retomado', area,
          sem_sinal_min: minutosEntre(ant.posicao_em, posicaoEm) });
      }
    }

    estado[id] = atual;
  }
  return { estado, eventos };
}

/** Retrato que a página mostra: motor secundário vai dentro do caminhão (motor2). */
export function montarSnapshot(estado, meta) {
  const todos = Object.values(estado);
  const { principalDe, secundarioDe } = parearMotores(todos);
  const veiculos = todos.map((v) => {
    if (principalDe.has(v.id)) return { ...v, motor2_de: principalDe.get(v.id) };
    const sec = estado[secundarioDe.get(v.id)];
    if (!sec) return v;
    return { ...v, motor2: {
      id: sec.id, placa: sec.placa, status: sec.status, status_cod: sec.status_cod,
      status_desde: sec.status_desde, posicao_em: sec.posicao_em, sem_sinal: sec.sem_sinal,
    } };
  });
  return { ...meta, sem_sinal_min: SEM_SINAL_MIN, veiculos };
}

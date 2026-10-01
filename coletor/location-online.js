// Tela "Localização" (mapa em tempo real) do GAUSS - mesmas chamadas que o
// navegador faz em #hard-vehicle/vehicles/location-online/ (descobertas lendo
// o script inline da página e o filterpage.js).

const LOCATION_PATH = '/data/hard-vehicle/vehicles/location-online/';

// legenda do mapa (cores do marcador) - os códigos vêm do switch do HTMLMarker
export const STATUS = {
  1: 'Ligado',
  2: 'Desligado',
  3: 'Parado ligado',
  4: 'Chave geral desligada',
  5: 'Aguardando manutenção',
  6: 'Em programação',
  7: 'Sem comunicação +6h',
  9: 'Em manutenção',
  11: 'Disponível',
  37: 'Geo área indisponível',
  71: 'Desligado',
  88: 'Checklist não conforme',
  89: 'Checklist impeditivo',
  98: 'Desligado',
  99: 'Excesso de velocidade',
};

/** Lista de veículos que o usuário enxerga no filtro da tela (id + rótulo). */
export async function fetchVehicleList(client) {
  const data = await client.post('/filter/dynamic', [
    ['action', 'vehicle'],
    ['page_id', 'location-online'],
  ]);
  const html = data.html ?? '';
  return [...html.matchAll(/name='vehicle\[\]' value='(\d+)'[\s\S]*?<label[^>]*>([^<]*)<\/label>/g)]
    .map(([, id, label]) => ({ id: Number(id), label: label.trim() }));
}

/** Última posição de cada veículo (o mapa chama isso a cada ~15s). */
export async function fetchPositions(client, vehicleIds) {
  const fields = vehicleIds.map((id) => ['vehicle[]', id]);
  fields.push(
    // 0 esconde os reservas "[S/ VAGA]" (vinham só 24 de 63 veículos)
    ['display_backup_equipment', 1],
    ['calculate_stoppage', 0],
    ['only_alerts', 0],
    ['alert_map', 0],
  );
  const data = await client.post(LOCATION_PATH, fields);
  if (data.error) throw new Error(`location-online respondeu error: ${data.msg}`);
  return Object.values(data.msg ?? {});
}

/** Polígonos das cercas (geofences) - o mapa desenha as áreas coloridas com isso. */
export async function fetchGeofences(client, vehicleIds) {
  const init = await client.post(LOCATION_PATH, [
    ['action', 'init_geofences'],
    ['virtual_geofence', 1],
    ['plot_geofences', 1],
    ...vehicleIds.map((id) => ['vehicles[]', id]),
  ]);
  if (init.error) throw new Error('init_geofences respondeu error=true');

  const points = await client.post(LOCATION_PATH, [
    ['action', 'get_geofence_points'],
    ...init.msg.map((g) => ['geofence_code[]', g.code]),
  ]);
  if (points.error) throw new Error('get_geofence_points respondeu error=true');

  return Object.entries(points.msg).map(([code, pts]) => ({
    code: Number(code),
    name: pts[0]?.name?.trim() ?? '',
    layer: Number(pts[0]?.layer),
    color: pts[0]?.color ?? '#3388ff',
    polygon: pts.map((p) => [Number(p.lat), Number(p.lng)]),
  }));
}

function insidePolygon(lat, lng, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i];
    const [yj, xj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// área aproximada (em graus²) só pra ordenar da cerca mais específica pra mais ampla
function area(polygon) {
  let s = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    s += polygon[j][1] * polygon[i][0] - polygon[i][1] * polygon[j][0];
  }
  return Math.abs(s / 2);
}

/** Cercas que contêm o ponto, da menor (mais específica) para a maior. */
export function geofencesAt(lat, lng, geofences) {
  return geofences
    .filter((g) => g.polygon.length >= 3 && insidePolygon(lat, lng, g.polygon))
    .sort((a, b) => area(a.polygon) - area(b.polygon));
}

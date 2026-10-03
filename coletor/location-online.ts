// Tela "Localização" (mapa em tempo real) do GAUSS - mesmas chamadas que o navegador faz em
// #hard-vehicle/vehicles/location-online/ (descobertas lendo o script inline da página e o filterpage.js).
import type { PosicaoGauss } from "../src/lib/dominio/leitura";
import type { CercaGauss } from "../src/lib/tipos";
import type { Campo, GaussFleetClient } from "./gauss";

const LOCATION_PATH = "/data/hard-vehicle/vehicles/location-online/";

export interface VeiculoCadastro {
  id: number;
  label: string;
}

/** Lista de veículos que o usuário enxerga no filtro da tela (id + rótulo). */
export async function listarVeiculos(client: GaussFleetClient): Promise<VeiculoCadastro[]> {
  const data = await client.post<{ html?: string }>("/filter/dynamic", [["action", "vehicle"], ["page_id", "location-online"]]);
  const html = data.html ?? "";
  return [...html.matchAll(/name='vehicle\[\]' value='(\d+)'[\s\S]*?<label[^>]*>([^<]*)<\/label>/g)].map(([, id, label]) => ({ id: Number(id), label: label.trim() }));
}

/** Última posição de cada veículo (UMA requisição para a frota inteira). */
export async function buscarPosicoes(client: GaussFleetClient, ids: number[]): Promise<PosicaoGauss[]> {
  const campos: Campo[] = ids.map((id): Campo => ["vehicle[]", id]);
  campos.push(
    // 0 esconde os reservas "[S/ VAGA]" (vinham só 24 de 63 veículos)
    ["display_backup_equipment", 1],
    ["calculate_stoppage", 0],
    ["only_alerts", 0],
    ["alert_map", 0],
  );
  const data = await client.post<{ error?: boolean; msg?: Record<string, PosicaoGauss> | string }>(LOCATION_PATH, campos);
  if (data.error) throw new Error(`location-online respondeu error: ${String(data.msg)}`);
  return Object.values((data.msg ?? {}) as Record<string, PosicaoGauss>);
}

interface PontoCerca {
  name?: string;
  layer?: string | number;
  color?: string;
  lat: string | number;
  lng: string | number;
}

/** Polígonos das cercas (geofences): o mapa desenha as áreas coloridas com isso. */
export async function buscarCercas(client: GaussFleetClient, ids: number[]): Promise<CercaGauss[]> {
  const init = await client.post<{ error?: boolean; msg: { code: number | string }[] }>(LOCATION_PATH, [
    ["action", "init_geofences"],
    ["virtual_geofence", 1],
    ["plot_geofences", 1],
    ...ids.map((id): Campo => ["vehicles[]", id]),
  ]);
  if (init.error) throw new Error("init_geofences respondeu error=true");

  const pontos = await client.post<{ error?: boolean; msg: Record<string, PontoCerca[]> }>(LOCATION_PATH, [
    ["action", "get_geofence_points"],
    ...init.msg.map((g): Campo => ["geofence_code[]", g.code]),
  ]);
  if (pontos.error) throw new Error("get_geofence_points respondeu error=true");

  return Object.entries(pontos.msg).map(([code, pts]) => ({
    code: Number(code),
    name: pts[0]?.name?.trim() ?? "",
    layer: Number(pts[0]?.layer),
    color: pts[0]?.color ?? "#3388ff",
    polygon: pts.map((p): [number, number] => [Number(p.lat), Number(p.lng)]),
  }));
}

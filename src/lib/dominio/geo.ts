import type { LatLng } from "../tipos";

/** Ponto dentro do polígono (raio cruzando as arestas). Polígono em [lat, lng]. */
export function dentroDoPoligono(lat: number, lng: number, poligono: LatLng[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [yi, xi] = poligono[i];
    const [yj, xj] = poligono[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Área aproximada (em graus²), só para ordenar da cerca mais específica para a mais ampla. */
export function areaPoligono(p: LatLng[]): number {
  let s = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) s += p[j][1] * p[i][0] - p[i][1] * p[j][0];
  return Math.abs(s / 2);
}

/** Cercas que contêm o ponto, da menor (mais específica) para a maior. */
export function cercasNoPonto<C extends { polygon: LatLng[] }>(lat: number, lng: number, cercas: C[]): C[] {
  return cercas.filter((g) => g.polygon.length >= 3 && dentroDoPoligono(lat, lng, g.polygon)).sort((a, b) => areaPoligono(a.polygon) - areaPoligono(b.polygon));
}

/** Distância em metros (haversine). */
export function distanciaM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

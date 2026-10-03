import type { EstadoTrecho, Historico, LatLng, PontoMapa, Trecho, TrechoParado } from "../tipos";

/** Uma linha por sequência de mesmo estado; cada sequência emenda na próxima (sem buraco visual). */
export function sequenciasPorEstado(pontos: PontoMapa[]): { estado: EstadoTrecho; pts: LatLng[] }[] {
  const seqs: { estado: EstadoTrecho; pts: LatLng[] }[] = [];
  for (const [lat, lng, , , estado] of pontos) {
    const atual = seqs.at(-1);
    if (atual && atual.estado === estado) {
      atual.pts.push([lat, lng]);
      continue;
    }
    if (atual) atual.pts.push([lat, lng]);
    seqs.push({ estado, pts: [[lat, lng]] });
  }
  return seqs;
}

/** Paradas que viram marcador no mapa: 10 min ou mais, com posição. */
export function paradasRelevantes(trechos: Trecho[]): { trecho: TrechoParado; i: number; lat: number; lng: number }[] {
  return trechos.flatMap((t, i) =>
    t.estado === "movimento" || t.estado === "sem_sinal" || t.duracao_min < 10 || t.lat == null || t.lng == null ? [] : [{ trecho: t, i, lat: t.lat, lng: t.lng }],
  );
}

/** Pontos do trecho i (para enquadrar no mapa ao clicar no apontamento). */
export function pontosDoTrecho(h: Pick<Historico, "pontos" | "trechos">, i: number): LatLng[] {
  const t = h.trechos[i];
  if (!t) return [];
  const ini = t.inicio.slice(11, 19);
  const fim = t.fim.slice(11, 19);
  return h.pontos.filter((p) => p[2] >= ini && p[2] <= fim).map((p): LatLng => [p[0], p[1]]);
}

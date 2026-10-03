import type * as Leaflet from "leaflet";
import { corResolvida } from "@/lib/cores";
import { fmtMin, hhmm } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { esc, htmlRotulo } from "@/lib/mapa/marcador";
import { paradasRelevantes, sequenciasPorEstado } from "@/lib/mapa/rota";
import type { Historico } from "@/lib/tipos";
import { iconeHtml, type L } from "./leaflet";

/**
 * Desenha a rota do dia (cor por estado, contorno escuro por baixo para destacar no satélite e sobre as
 * cercas), as paradas de 10 min ou mais e os rótulos de início e fim. Devolve os limites para enquadrar.
 */
export function desenharRota(L: L, camada: Leaflet.LayerGroup, h: Historico, aoClicarParada: (i: number) => void): Leaflet.LatLngBounds | null {
  camada.clearLayers();
  if (!h.pontos.length) return null;
  const seqs = sequenciasPorEstado(h.pontos);
  for (const s of seqs) L.polyline(s.pts, { color: "#0b1220", weight: 11, opacity: 0.75, lineJoin: "round" }).addTo(camada);
  for (const s of seqs) L.polyline(s.pts, { color: corResolvida(ESTADOS_TRECHO[s.estado].tom), weight: 7, opacity: 1, lineJoin: "round", lineCap: "round" }).addTo(camada);
  for (const p of paradasRelevantes(h.trechos)) {
    const e = ESTADOS_TRECHO[p.trecho.estado];
    L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 2, fillColor: corResolvida(e.tom), fillOpacity: 1 })
      .bindTooltip(`${hhmm(p.trecho.inicio)}–${hhmm(p.trecho.fim)} · ${e.rotulo} · ${fmtMin(p.trecho.duracao_min)}<br>${esc(p.trecho.local)}`, { sticky: true })
      .on("click", () => aoClicarParada(p.i))
      .addTo(camada);
  }
  const ini = h.pontos[0];
  const fim = h.pontos.at(-1)!;
  L.marker([ini[0], ini[1]], { icon: iconeHtml(L, htmlRotulo(`Início ${ini[2].slice(0, 5)}`, "var(--ok-dot)")) }).addTo(camada);
  L.marker([fim[0], fim[1]], { icon: iconeHtml(L, htmlRotulo(`Fim ${fim[2].slice(0, 5)}`, "var(--primaria)")) }).addTo(camada);
  return L.latLngBounds(h.pontos.map((p): [number, number] => [p[0], p[1]]));
}

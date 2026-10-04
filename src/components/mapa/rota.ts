import type * as Leaflet from "leaflet";
import { corResolvida } from "@/lib/cores";
import type { Capitulo } from "@/lib/dominio/capitulos";
import { fmtMin, hhmm, segDe } from "@/lib/dominio/formato";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { esc } from "@/lib/mapa/marcador";
import { sequenciasPorEstado } from "@/lib/mapa/rota";
import type { Historico, PontoMapa } from "@/lib/tipos";
import { iconeHtml, type L } from "./leaflet";

/** Painel do Leaflet abaixo do padrão (400): o rastro do player fica por cima da rota redesenhada. */
export const PAINEL_ROTA = "rota";

function linhas(L: L, camada: Leaflet.LayerGroup, pontos: PontoMapa[], opacidade: number) {
  const seqs = sequenciasPorEstado(pontos);
  for (const s of seqs) L.polyline(s.pts, { pane: PAINEL_ROTA, color: "#0b1220", weight: 11, opacity: 0.75 * opacidade, lineJoin: "round", interactive: false }).addTo(camada);
  for (const s of seqs) L.polyline(s.pts, { pane: PAINEL_ROTA, color: corResolvida(ESTADOS_TRECHO[s.estado].tom), weight: 7, opacity: opacidade, lineJoin: "round", lineCap: "round", interactive: false }).addTo(camada);
}

/**
 * Rota do dia (cor por estado, contorno escuro para destacar no satélite). Com foco (segundos do dia), o resto do
 * dia fica apagado e só o pedaço do foco aparece forte. O painel PAINEL_ROTA precisa existir no mapa.
 */
export function desenharRota(L: L, camada: Leaflet.LayerGroup, h: Historico, foco: [number, number] | null): void {
  camada.clearLayers();
  if (!h.pontos.length) return;
  linhas(L, camada, h.pontos, foco ? 0.3 : 1);
  if (foco) {
    const dentro = h.pontos.filter((p) => {
      const s = segDe(p[2]);
      return s >= foco[0] && s <= foco[1];
    });
    if (dentro.length > 1) linhas(L, camada, dentro, 1);
  }
}

/** Pinos numerados dos capítulos (os mesmos números da lista); cinza = pátio/base. */
export function desenharCapitulos(L: L, camada: Leaflet.LayerGroup, caps: Capitulo[], aoClicar: (c: Capitulo) => void): void {
  for (const c of caps) {
    if (c.lat == null || c.lng == null) continue;
    L.marker([c.lat, c.lng], { icon: iconeHtml(L, `<div class="cap${c.tipoLugar === "base" ? " base" : ""}">${c.n}</div>`), zIndexOffset: 500 })
      .bindTooltip(`${c.n} · ${esc(c.lugar)}<br>${hhmm(c.inicio)}–${hhmm(c.fim)} · ${fmtMin(c.duracao_min)}`)
      .on("click", () => aoClicar(c))
      .addTo(camada);
  }
}

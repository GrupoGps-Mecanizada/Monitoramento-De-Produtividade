import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;
/** O mundo inteiro: a máscara preta é ele com furos nas plantas. */
const MUNDO: LatLng[] = [[-89, -179], [-89, 179], [89, 179], [89, -179]];
/** Painel da máscara: acima do satélite (200) e abaixo do calor e das áreas (overlayPane, 400). */
export const PAINEL_MASCARA = "mascara";
/** Azul (pouco) → vermelho (muito), legível sobre o satélite; em lista, porque objeto com a chave 1 põe o vermelho primeiro. */
export const CORES_CALOR: [number, string][] = [[0.2, "#2563eb"], [0.45, "#22d3ee"], [0.65, "#facc15"], [0.85, "#f97316"], [1, "#dc2626"]];
const GRADIENTE_CALOR = Object.fromEntries(CORES_CALOR);

/**
 * Mapa de calor sobre o satélite: preto fora das plantas (máscara com furos), contorno fino das plantas e das áreas e o calor
 * com o peso de cada parada. As áreas com parada recebem o mouse (nome e horas) e o clique (escolhe/desfaz o lugar).
 */
export function desenharCalor(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: {
    plantas: { name: string; polygon: LatLng[] }[];
    buracos: LatLng[][];
    areas: { name: string; polygon: LatLng[] }[];
    resumos: ResumoLocal[];
    pontos: [number, number, number][];
    sel: string | null;
    aoClicar: (chave: string) => void;
  },
) {
  camada.clearLayers();
  L.polygon([MUNDO, ...o.buracos], { pane: PAINEL_MASCARA, className: "mascara-analise", stroke: false, fillOpacity: 1, interactive: false }).addTo(camada);
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { className: "planta-contorno", weight: 1.5, fill: false, interactive: false }).addTo(camada);
  // as paradas se somam onde se juntam: o teto cresce com a raiz da quantidade para o vermelho ficar só onde concentra de verdade
  if (o.pontos.length) L.heatLayer(o.pontos, { radius: 20, blur: 16, maxZoom: 17, max: Math.max(1, Math.sqrt(o.pontos.length) / 3), minOpacity: 0.25, gradient: GRADIENTE_CALOR }).addTo(camada);
  const porLocal = new Map(o.resumos.map((r) => [r.local.chave, r]));
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porLocal.get(a.name);
    const pol = L.polygon(a.polygon, { className: a.name === o.sel ? "area-calor area-selecionada" : "area-calor", weight: 1, fillOpacity: 0, interactive: !!r });
    if (r) {
      pol
        .bindTooltip(`<b>${esc(a.name)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}`, { sticky: true, className: "rotulo-cerca" })
        .on("click", () => o.aoClicar(a.name));
    }
    pol.addTo(camada);
    if (r) {
      pol.getElement()?.setAttribute("role", "button");
      pol.getElement()?.setAttribute("aria-label", a.name);
    }
  }
  // nome das plantas de fora da usina (a Usiminas é o mapa inteiro), quando cabem
  const postos: { x: number; y: number }[] = [];
  for (const pl of o.plantas) {
    if (/^PLANTA USIMINAS$/i.test(pl.name)) continue;
    const c = L.polygon(pl.polygon).getBounds().getCenter();
    const pt = mapa.latLngToContainerPoint(c);
    if (postos.some((q) => Math.abs(q.x - pt.x) < LARG && Math.abs(q.y - pt.y) < ALT)) continue;
    postos.push(pt);
    L.marker(c, { interactive: false, icon: L.divIcon({ className: "rotulo-planta", iconSize: [0, 0], html: `<span>${esc(pl.name.replace(/^PLANTA (DAS |DA |DO |DE )?/i, ""))}</span>` }) }).addTo(camada);
  }
}

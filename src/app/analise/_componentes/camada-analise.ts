import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;

type CercaDesenho = { name: string; color: string; polygon: LatLng[] };

/**
 * Cercas sobre o satélite, nas cores do GAUSS (como na Localização): planta tracejada e sem preenchimento, área preenchida.
 * As áreas com parada recebem o mouse (nome e horas) e o clique (escolhe/desfaz o lugar); a escolhida ganha contorno branco.
 */
export function desenharCercas(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: CercaDesenho[]; areas: CercaDesenho[]; resumos: ResumoLocal[]; sel: string | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { color: pl.color, weight: 2, dashArray: "6 4", fillOpacity: 0, interactive: false }).addTo(camada);
  const porLocal = new Map(o.resumos.map((r) => [r.local.chave, r]));
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porLocal.get(a.name);
    const escolhida = a.name === o.sel;
    const pol = L.polygon(a.polygon, { className: escolhida ? "area-cerca area-selecionada" : "area-cerca", color: a.color, weight: 1, fillOpacity: escolhida ? 0.45 : 0.22, interactive: !!r });
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

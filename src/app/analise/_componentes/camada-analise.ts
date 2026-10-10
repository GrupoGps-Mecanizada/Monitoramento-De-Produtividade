import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, raioDaBolha, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import { corDoServico } from "./cores-analise";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;

/**
 * Mapa da região (sem imagem): contorno das plantas e das cercas, apagados, só de referência; uma bolha por lugar com
 * a área proporcional às horas paradas e a cor do serviço principal (3 cores + cinza). Com um lugar escolhido, ele ganha
 * contorno branco e os outros ficam apagados. Passar o mouse = nome, horas e serviço; clicar = escolhe/desfaz o lugar.
 */
export function desenharBolhas(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: { name: string; polygon: LatLng[] }[]; areas: { name: string; polygon: LatLng[] }[]; resumos: ResumoLocal[]; principais: string[]; sel: string | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { className: "usina-contorno", weight: 1.5, fillOpacity: 1, interactive: false }).addTo(camada);
  for (const a of ordemDeDesenho(o.areas)) L.polygon(a.polygon, { className: "area-sem-dado", weight: 1, fillOpacity: 1, interactive: false }).addTo(camada);
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
  const max = Math.max(0, ...o.resumos.map((r) => r.parado));
  // da maior para a menor: a bolha pequena fica por cima e recebe o clique
  for (const r of [...o.resumos].sort((a, b) => b.parado - a.parado)) {
    const principal = r.apont[0]?.nome ?? null;
    const classe = o.sel == null ? "bolha" : r.local.chave === o.sel ? "bolha bolha-selecionada" : "bolha bolha-apagada";
    L.circleMarker([r.local.lat, r.local.lng], { className: classe, radius: raioDaBolha(r.parado, max), color: "#000", weight: 2, fillColor: corDoServico(principal, o.principais), fillOpacity: 0.85 })
      .bindTooltip(`<b>${esc(r.local.nome)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}<br>${esc(principal ?? "sem apontamento")}`, { sticky: true, className: "rotulo-cerca" })
      .on("click", () => o.aoClicar(r.local.chave))
      .addTo(camada);
  }
}

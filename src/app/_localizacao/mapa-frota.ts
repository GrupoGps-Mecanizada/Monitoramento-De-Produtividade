import type * as Leaflet from "leaflet";
import { iconeHtml, type L } from "@/components/mapa/leaflet";
import type { MapaPronto } from "@/components/mapa/use-mapa";
import { esc, htmlMarcador } from "@/lib/mapa/marcador";
import type { Cerca, LatLng, Veiculo } from "@/lib/tipos";

export interface Camadas {
  cercas: Leaflet.LayerGroup;
  hist: Leaflet.LayerGroup;
  cluster: Leaflet.MarkerClusterGroup;
  marcadores: Map<string, { m: Leaflet.Marker; chave: string }>;
}

/** Cercas, histórico e veículos (agrupados até o zoom 18), com o seletor de camadas. */
export function criarCamadas({ L, mapa, camadasBase }: MapaPronto): Camadas {
  const cercas = L.layerGroup().addTo(mapa);
  const hist = L.layerGroup().addTo(mapa);
  const cluster = L.markerClusterGroup({
    disableClusteringAtZoom: 18,
    maxClusterRadius: 45,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    iconCreateFunction: (c) => L.divIcon({ html: `<div class="cl">${c.getChildCount()}</div>`, className: "", iconSize: [38, 38] }),
  }).addTo(mapa);
  L.control.layers(camadasBase, { Cercas: cercas, "Veículos": cluster, "Histórico": hist }).addTo(mapa);
  return { cercas, hist, cluster, marcadores: new Map() };
}

export function desenharCercas(L: L, camada: Leaflet.LayerGroup, cercas: Cerca[]) {
  camada.clearLayers();
  for (const c of cercas) {
    if (c.polygon.length < 3) continue;
    const planta = c.tipo === "planta";
    const via = c.tipo === "via";
    L.polygon(c.polygon, { color: c.color, weight: planta ? 2 : 1, dashArray: planta ? "6 4" : undefined, fillOpacity: planta ? 0 : via ? 0.12 : 0.22, interactive: !planta })
      .bindTooltip(esc(c.name), { sticky: true, className: "rotulo-cerca" })
      .addTo(camada);
  }
}

/** Cria/atualiza os marcadores sem recriar os que não mudaram (a lista ao vivo não pisca). */
export function sincronizarMarcadores(
  L: L,
  c: Camadas,
  veiculos: Veiculo[],
  visiveis: Set<string>,
  sel: string | null,
  comHistorico: boolean,
  semSinalMin: number,
  agora: number,
  aoClicar: (id: string) => void,
) {
  for (const v of veiculos) {
    if (!v.lat || !v.lng) continue;
    // com histórico aberto, só o selecionado fica no mapa; o selecionado aparece mesmo que o filtro o esconda
    const mostrar = (visiveis.has(v.id) || v.id === sel) && (!comHistorico || v.id === sel);
    const html = htmlMarcador(v, v.id === sel, semSinalMin, agora);
    const chave = `${v.lat},${v.lng}|${html}`;
    let reg = c.marcadores.get(v.id);
    if (!reg) {
      const m = L.marker([v.lat, v.lng], { icon: iconeHtml(L, html), riseOnHover: true });
      m.on("click", () => aoClicar(v.id));
      reg = { m, chave };
      c.marcadores.set(v.id, reg);
    } else if (reg.chave !== chave) {
      const moveu = !reg.m.getLatLng().equals([v.lat, v.lng]);
      if (moveu && c.cluster.hasLayer(reg.m)) {
        c.cluster.removeLayer(reg.m);
        reg.m.setLatLng([v.lat, v.lng]);
        c.cluster.addLayer(reg.m);
      } else if (moveu) reg.m.setLatLng([v.lat, v.lng]);
      reg.m.setIcon(iconeHtml(L, html));
      reg.chave = chave;
    }
    reg.m.setZIndexOffset(v.id === sel ? 1000 : 0);
    if (mostrar && !c.cluster.hasLayer(reg.m)) c.cluster.addLayer(reg.m);
    if (!mostrar && c.cluster.hasLayer(reg.m)) c.cluster.removeLayer(reg.m);
  }
}

/** Contorno amarelo piscando por 7 s na cerca achada pela busca. */
export function destacarCerca(L: L, mapa: Leaflet.Map, poligono: LatLng[]) {
  const d = L.polygon(poligono, { color: "#facc15", weight: 5, fill: false, className: "cerca-achada", interactive: false }).addTo(mapa);
  setTimeout(() => mapa.removeLayer(d), 7000);
}

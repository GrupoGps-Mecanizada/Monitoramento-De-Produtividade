import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, type ResumoLocal } from "@/lib/dominio/analise";
import { faixaDe, faixasDe, type Linha } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import { opacidadeDaFaixa } from "./cores-analise";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;
/** Largura aproximada das horas escritas numa cerca ("1499h41"). */
const LARG_HORAS = 56;

type CercaDesenho = { name: string; color: string; polygon: LatLng[] };

/**
 * Cercas sobre o satélite: nas cores do GAUSS (modo "cerca", como na Localização; planta tracejada, área preenchida) ou, no modo
 * "tempo", na cor da medida da aba aberta (mais forte = mais tempo), com as horas escritas nas áreas que mais pesam.
 * As áreas com parada recebem o mouse (nome e horas) e o clique (escolhe/desfaz o lugar); a escolhida ganha contorno branco.
 */
export function desenharCercas(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: CercaDesenho[]; areas: CercaDesenho[]; resumos: ResumoLocal[]; sel: string | null; modo: "cerca" | "tempo"; medida: { valores: Linha[]; cor: string; rotulo: string }; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { color: pl.color, weight: 2, dashArray: "6 4", fillOpacity: 0, interactive: false }).addTo(camada);
  const porLocal = new Map(o.resumos.map((r) => [r.local.chave, r]));
  // modo "tempo": o valor da medida (tempo parado, bomba, status ou família) em cada lugar
  const valor = new Map(o.medida.valores.map((l) => [l.chave, l]));
  const limites = o.modo === "tempo" ? faixasDe(o.medida.valores.map((l) => l.min)) : [];
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porLocal.get(a.name);
    const escolhida = a.name === o.sel;
    const classe = escolhida ? "area-cerca area-selecionada" : "area-cerca";
    const estilo =
      o.modo === "cerca"
        ? { color: a.color, weight: 1, fillOpacity: escolhida ? 0.45 : 0.22 }
        : valor.get(a.name)
          ? { color: o.medida.cor, fillColor: o.medida.cor, weight: 1, fillOpacity: escolhida ? 0.95 : opacidadeDaFaixa(faixaDe(valor.get(a.name)!.min, limites), limites.length + 1) }
          : { color: "#ffffff", weight: 1, opacity: 0.35, fillOpacity: 0 };
    const pol = L.polygon(a.polygon, { className: classe, ...estilo, interactive: !!r });
    if (r) {
      pol
        .bindTooltip(
          `<b>${esc(a.name)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}` +
            (o.modo === "tempo" && o.medida.rotulo !== "Tempo parado" ? `<br>${esc(o.medida.rotulo)}: ${esc(fmtHoras(valor.get(a.name)?.min ?? 0))}` : ""),
          { sticky: true, className: "rotulo-cerca" },
        )
        .on("click", () => o.aoClicar(a.name));
    }
    pol.addTo(camada);
    if (r) {
      pol.getElement()?.setAttribute("role", "button");
      pol.getElement()?.setAttribute("aria-label", a.name);
    }
  }
  if (o.modo === "tempo") {
    const porNome = new Map(o.areas.map((a) => [a.name, a]));
    // as que mais pesam primeiro; a que encostaria numa já escrita fica de fora (passar o mouse na cerca mostra as horas)
    const escritas: { x: number; y: number }[] = [];
    for (const l of o.medida.valores.slice(0, 12)) {
      const a = porNome.get(l.chave);
      if (!a) continue;
      const c = L.polygon(a.polygon).getBounds().getCenter();
      const pt = mapa.latLngToContainerPoint(c);
      if (escritas.some((q) => Math.abs(q.x - pt.x) < LARG_HORAS && Math.abs(q.y - pt.y) < ALT)) continue;
      escritas.push(pt);
      L.marker(c, { interactive: false, icon: L.divIcon({ className: "rotulo-horas", iconSize: [0, 0], html: `<span>${esc(fmtHoras(l.min))}</span>` }) }).addTo(camada);
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

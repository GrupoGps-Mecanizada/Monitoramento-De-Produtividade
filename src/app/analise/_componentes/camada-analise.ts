import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { ordemDeDesenho, type ResumoLocal } from "@/lib/dominio/analise";
import { faixaDe, faixasDe, type Linha } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import type { Predominio } from "@/lib/dominio/predominio";
import { rampaDaCor, tomDaFaixa } from "./cores-analise";

/** Caixa aproximada do nome de uma planta em pixels: nome que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;
/** Largura aproximada das horas escritas numa cerca ("1499h41"). */
const LARG_HORAS = 56;

type CercaDesenho = { name: string; color: string; polygon: LatLng[] };

/**
 * Cercas sobre o satélite: nas cores do GAUSS (modo "cerca", como na Localização; planta tracejada, área preenchida) ou, no modo
 * "quanto", em 5 tons sólidos da cor da medida (claro = pouco, escuro = muito) com as horas escritas; no modo "oque", na cor da
 * categoria que mais pesou em cada área (forte quando passa da metade, fraco quando venceu por pouco, cinza quando é misto).
 * As áreas com parada recebem o mouse (nome e horas) e o clique (escolhe/desfaz o lugar); a escolhida ganha contorno branco.
 */
export function desenharCercas(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: CercaDesenho[]; areas: CercaDesenho[]; resumos: ResumoLocal[]; sel: string | null; modo: "cerca" | "quanto" | "oque"; medida: { valores: Linha[]; cor: string; rotulo: string }; predominio: { porLugar: Map<string, Predominio>; nome: (c: string) => string; cor: (c: string) => string } | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { color: pl.color, weight: 2, dashArray: "6 4", fillOpacity: 0, interactive: false }).addTo(camada);
  const porLocal = new Map(o.resumos.map((r) => [r.local.chave, r]));
  // modo "quanto": o valor da medida (tempo parado, bomba, status ou família) em cada lugar, em 5 tons sólidos
  const valor = new Map(o.medida.valores.map((l) => [l.chave, l]));
  const limites = o.modo === "quanto" ? faixasDe(o.medida.valores.map((l) => l.min)) : [];
  const rampa = rampaDaCor(o.medida.cor);
  const pred = o.modo === "oque" ? o.predominio : null;
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porLocal.get(a.name);
    const escolhida = a.name === o.sel;
    const classe = escolhida ? "area-cerca area-selecionada" : "area-cerca";
    const estilo =
      o.modo === "cerca"
        ? { color: a.color, weight: 1, fillOpacity: escolhida ? 0.45 : 0.22 }
        : pred
          ? estiloPredominio(pred.porLugar.get(a.name), pred.cor, escolhida)
          : valor.get(a.name)
            ? { color: "#ffffff", weight: 1.5, opacity: 0.8, fillColor: rampa[tomDaFaixa(faixaDe(valor.get(a.name)!.min, limites), limites.length + 1)], fillOpacity: escolhida ? 0.95 : 0.78 }
            : { color: "#ffffff", weight: 1, opacity: 0.35, fillOpacity: 0 };
    const pol = L.polygon(a.polygon, { className: classe, ...estilo, interactive: !!r });
    if (r) {
      pol
        .bindTooltip(
          `<b>${esc(a.name)}</b><br>${esc(fmtHoras(r.parado))} parado · ${r.visitas} ${r.visitas === 1 ? "parada" : "paradas"}` +
            (o.modo === "quanto" && o.medida.rotulo !== "Tempo parado" ? `<br>${esc(o.medida.rotulo)}: ${esc(fmtHoras(valor.get(a.name)?.min ?? 0))}` : "") +
            (pred && pred.porLugar.get(a.name) ? `<br>${divisao(pred.porLugar.get(a.name)!, pred.nome)}` : ""),
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
  if (o.modo === "quanto") {
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

const CINZA_MISTO = "#9aa3ad";
/** Cor da área no modo "O que parou": a da categoria vencedora (forte ou fraca); misto em cinza; sem dado, só o contorno. */
function estiloPredominio(p: Predominio | undefined, cor: (c: string) => string, escolhida: boolean) {
  if (!p) return { color: "#ffffff", weight: 1, opacity: 0.35, fillOpacity: 0 };
  const fill = p.nivel === "misto" ? CINZA_MISTO : cor(p.cat);
  return { color: "#ffffff", weight: 1.5, opacity: 0.8, fillColor: fill, fillOpacity: escolhida ? 0.95 : p.nivel === "fraco" ? 0.45 : 0.8 };
}
/** "Parado ligado 70% · Desligado 30%": as 3 maiores partes da área. */
const divisao = (p: Predominio, nome: (c: string) => string) =>
  p.partes
    .slice(0, 3)
    .map(([c, m]) => `${esc(nome(c))} ${Math.round((m / p.total) * 100)}%`)
    .join(" · ");

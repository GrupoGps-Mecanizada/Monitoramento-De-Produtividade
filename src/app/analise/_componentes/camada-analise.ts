import type * as Leaflet from "leaflet";
import type { L } from "@/components/mapa/leaflet";
import { faixaDeCor, ordemDeDesenho, ranking, valorDe, type Medida, type ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";
import { esc } from "@/lib/mapa/marcador";
import type { LatLng } from "@/lib/tipos";
import { COR_CATEGORIA, ESCALAS, corDoApontamento, numerica, rotuloValor } from "./cores-analise";

/** Quantas áreas podem ganhar nome e número escritos no mapa (as primeiras do ranking, se couberem). */
const ROTULOS = 12;
/** Caixa aproximada de um rótulo em pixels: rótulo que encostaria em outro já escrito fica de fora. */
const LARG = 130;
const ALT = 20;
const curto = (nome: string) => (nome.length > 18 ? `${nome.slice(0, 17)}…` : nome);

/** Cor da área pela medida (null = sem valor no filtro). */
export function corDaArea(r: ResumoLocal | undefined, medida: Medida, max: number): string | null {
  if (!r) return null;
  if (medida === "categoria") return COR_CATEGORIA[r.local.categoria];
  if (medida === "apontamento") return r.apont[0] ? corDoApontamento(r.apont[0].nome) : null;
  if (!numerica(medida)) return null;
  const f = faixaDeCor(valorDe(r, medida), max);
  return f ? ESCALAS[medida][f - 1] : null;
}

/** Número curto escrito no mapa ("42h", "8"); tipo de local e apontamento escrevem só o nome. */
function valorCurto(r: ResumoLocal, medida: Medida): string {
  if (medida === "visitas") return String(r.visitas);
  if (!numerica(medida)) return "";
  return fmtHoras(valorDe(r, medida)).replace(/h00$/, "h");
}

/**
 * Mapa só da Usiminas (sem imagem): o contorno da usina, as cercas pintadas pela medida (5 faixas do claro ao escuro),
 * pontos sem cerca como círculos e o nome + número das primeiras áreas do ranking. Passar o mouse = nome e valor;
 * clicar = abre o detalhe na coluna da direita.
 */
export function desenharAnalise(
  L: L,
  camada: Leaflet.LayerGroup,
  mapa: Leaflet.Map,
  o: { plantas: { name: string; polygon: LatLng[] }[]; areas: { name: string; polygon: LatLng[] }[]; resumos: ResumoLocal[]; medida: Medida; sel: string | null; aoClicar: (chave: string) => void },
) {
  camada.clearLayers();
  // contorno de cada planta da região (Usiminas, Poço Redondo, Aterro, oficinas de fora...)
  for (const pl of ordemDeDesenho(o.plantas)) L.polygon(pl.polygon, { className: "usina-contorno", weight: 1.5, fillOpacity: 1, interactive: false }).addTo(camada);
  const porChave = new Map(o.resumos.map((r) => [r.local.chave, r]));
  const max = Math.max(0, ...o.resumos.map((r) => valorDe(r, o.medida)));
  const dica = (nome: string, r: ResumoLocal | undefined) => `<b>${esc(nome)}</b><br>${r ? esc(rotuloValor(r, o.medida)) : "sem paradas neste filtro"}`;
  const classe = (chave: string, base = "") => [base, chave === o.sel ? "area-selecionada" : ""].filter(Boolean).join(" ") || undefined;

  // da maior para a menor: a cerca pequena dentro de uma grande fica por cima e recebe o clique
  for (const a of ordemDeDesenho(o.areas)) {
    const r = porChave.get(a.name);
    const c = corDaArea(r, o.medida, max);
    L.polygon(a.polygon, c ? { className: classe(a.name), color: c, fillColor: c, fillOpacity: 0.8, weight: 1 } : { className: classe(a.name, "area-sem-dado"), fillOpacity: 1, weight: 1 })
      .bindTooltip(dica(a.name, r), { sticky: true, className: "rotulo-cerca" })
      .on("click", () => r && o.aoClicar(a.name))
      .addTo(camada);
  }
  // pontos sem cerca e cercas que não existem mais (sem polígono): círculo na posição
  const comPoligono = new Set(o.areas.map((a) => a.name));
  for (const r of o.resumos) {
    if (r.local.cerca && comPoligono.has(r.local.chave)) continue;
    L.circleMarker([r.local.lat, r.local.lng], { className: classe(r.local.chave), radius: 7, color: "#1f2937", weight: 1, fillColor: corDaArea(r, o.medida, max) ?? "#94a3b8", fillOpacity: 0.95 })
      .bindTooltip(dica(r.local.nome, r), { sticky: true, className: "rotulo-cerca" })
      .on("click", () => o.aoClicar(r.local.chave))
      .addTo(camada);
  }
  // nome e número das primeiras áreas, como os estados no mapa de apuração; só os que cabem sem encostar (aproximar mostra mais)
  const postos: { x: number; y: number }[] = [];
  // nome das plantas de fora da usina (a Usiminas é o mapa inteiro), quando cabem
  for (const pl of o.plantas) {
    if (/^PLANTA USIMINAS$/i.test(pl.name)) continue;
    const c = L.polygon(pl.polygon).getBounds().getCenter();
    const pt = mapa.latLngToContainerPoint(c);
    if (postos.some((q) => Math.abs(q.x - pt.x) < LARG && Math.abs(q.y - pt.y) < ALT)) continue;
    postos.push(pt);
    L.marker(c, { interactive: false, icon: L.divIcon({ className: "rotulo-planta", iconSize: [0, 0], html: `<span>${esc(pl.name.replace(/^PLANTA (DAS |DA |DO |DE )?/i, ""))}</span>` }) }).addTo(camada);
  }
  for (const r of ranking(o.resumos, o.medida, ROTULOS)) {
    const pt = mapa.latLngToContainerPoint([r.local.lat, r.local.lng]);
    if (postos.some((q) => Math.abs(q.x - pt.x) < LARG && Math.abs(q.y - pt.y) < ALT)) continue;
    postos.push(pt);
    const v = valorCurto(r, o.medida);
    L.marker([r.local.lat, r.local.lng], {
      interactive: false,
      icon: L.divIcon({ className: "rotulo-area", iconSize: [0, 0], html: `<span>${esc(curto(r.local.nome))}${v ? `<b>${esc(v)}</b>` : ""}</span>` }),
    }).addTo(camada);
  }
}

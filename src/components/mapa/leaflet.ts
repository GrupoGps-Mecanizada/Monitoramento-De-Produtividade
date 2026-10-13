import type * as Leaflet from "leaflet";

export type L = typeof Leaflet;

let promessa: Promise<L> | null = null;

/**
 * Leaflet + markercluster baixados só no navegador (o site é gerado estático e o Leaflet usa `window`).
 * O plugin de agrupamento procura o `L` global, por isso ele é registrado antes.
 */
export function carregarLeaflet(): Promise<L> {
  promessa ??= (async () => {
    const m = await import("leaflet");
    const L = ((m as unknown as { default?: L }).default ?? m) as L;
    (window as unknown as { L: L }).L = L;
    await import("leaflet.markercluster");
    return L;
  })();
  return promessa;
}

/** Ícone a partir de HTML, sem tamanho fixo (a pílula cresce com o texto). */
export const iconeHtml = (L: L, html: string) => L.divIcon({ html, className: "", iconSize: null as unknown as Leaflet.PointExpression });

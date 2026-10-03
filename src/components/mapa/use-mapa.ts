"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import { carregarLeaflet, type L } from "./leaflet";

export interface MapaPronto {
  L: L;
  mapa: Leaflet.Map;
  camadasBase: Record<string, Leaflet.TileLayer>;
}

const CENTRO: [number, number] = [-19.48, -42.53]; // Usiminas Ipatinga
// a imagem de satélite da Esri só existe até o zoom 18 nesta região; acima disso o Leaflet amplia o tile 18
// (senão aparece "Map data not yet available")
const SATELITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const RUAS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/** Cria o mapa (satélite + ruas) no div de `ref`. Acompanha o tamanho do div (gaveta, painel). */
export function useMapa(zoomInicial = 14) {
  const ref = useRef<HTMLDivElement>(null);
  const zoom = useRef(zoomInicial);
  const [pronto, setPronto] = useState<MapaPronto | null>(null);
  useEffect(() => {
    let vivo = true;
    let mapa: Leaflet.Map | null = null;
    let obs: ResizeObserver | null = null;
    void carregarLeaflet().then((L) => {
      const el = ref.current;
      if (!vivo || !el) return;
      const satelite = L.tileLayer(SATELITE, { maxZoom: 21, maxNativeZoom: 18, attribution: "Imagens © Esri" });
      const ruas = L.tileLayer(RUAS, { maxZoom: 21, maxNativeZoom: 19, attribution: "© OpenStreetMap" });
      const m = L.map(el, { layers: [satelite], zoomControl: true, maxZoom: 21 }).setView(CENTRO, zoom.current);
      mapa = m;
      obs = new ResizeObserver(() => m.invalidateSize());
      obs.observe(el);
      setPronto({ L, mapa: m, camadasBase: { "Satélite": satelite, Mapa: ruas } });
    });
    return () => {
      vivo = false;
      obs?.disconnect();
      mapa?.remove();
    };
  }, []);
  return { ref, pronto };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import { corDoTom } from "@/lib/cores";
import { ESTADOS_TRECHO } from "@/lib/dominio/veiculo";
import { avancar, deslocamentoVizinho, indiceEm, posicaoEm, prepararPontos, trechoEm, type PontoPlayer } from "@/lib/player";
import type { Historico } from "@/lib/tipos";
import { iconeHtml } from "../mapa/leaflet";
import type { MapaPronto } from "../mapa/use-mapa";

export interface Player {
  t: number;
  t0: number;
  t1: number;
  tocando: boolean;
  ponto: PontoPlayer | null;
  trecho: number;
  velocidade: number;
  acelerar: boolean;
  seguir: boolean;
  alternar: () => void;
  irPara: (s: number, centralizar?: boolean) => void;
  pular: (direcao: 1 | -1) => void;
  setVelocidade: (v: number) => void;
  setAcelerar: (v: boolean) => void;
  setSeguir: (v: boolean) => void;
}

/**
 * Caminhão andando sobre a rota do dia. Use com `key` do histórico: um histórico novo monta um player novo.
 * O marcador anda a cada quadro direto no Leaflet; a tela (cursor, horário) atualiza ~10x por segundo.
 */
export function usePlayer(pronto: MapaPronto | null, h: Historico): Player {
  const [pts] = useState(() => prepararPontos(h.pontos));
  const t0 = pts[0]?.s ?? 0;
  const t1 = pts.at(-1)?.s ?? 0;
  const [t, setT] = useState(t0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState(120);
  const [acelerar, setAcelerar] = useState(true);
  const [seguir, setSeguir] = useState(true);
  const m = useRef({
    t: t0, rumo: 0, idxPerc: -1, raf: 0, ultimoTs: 0, ultimoRender: 0, tocando: false,
    marcador: null as Leaflet.Marker | null, percorrido: null as Leaflet.Polyline | null,
    opcoes: { velocidade: 120, acelerar: true, seguir: true },
  });
  useEffect(() => {
    m.current.opcoes = { velocidade, acelerar, seguir };
  }, [velocidade, acelerar, seguir]);

  const desenhar = useCallback(
    (centralizar: boolean) => {
      const s = m.current;
      if (!pronto || !s.marcador || !s.percorrido || !pts.length) return;
      const pos = posicaoEm(pts, s.t, s.rumo);
      s.rumo = pos.rumo;
      s.marcador.setLatLng([pos.lat, pos.lng]);
      const el = s.marcador.getElement()?.querySelector<HTMLElement>(".mk-play");
      if (el) {
        el.style.setProperty("--c", corDoTom(ESTADOS_TRECHO[pos.p.estado].tom));
        const seta = el.querySelector<HTMLElement>(".seta-play");
        if (seta) seta.style.transform = `rotate(${pos.rumo}deg)`;
        const selo = el.querySelector(".m2");
        if (pos.p.m2 === 1 && !selo) el.insertAdjacentHTML("beforeend", '<span class="m2" title="Motor secundário ligado">⚙</span>');
        else if (pos.p.m2 !== 1 && selo) selo.remove();
      }
      // rastro já percorrido (branco tracejado por cima da rota)
      if (pos.i !== s.idxPerc) {
        s.idxPerc = pos.i;
        s.percorrido.setLatLngs([...pts.slice(0, pos.i + 1).map((p): [number, number] => [p.lat, p.lng]), [pos.lat, pos.lng]]);
      } else {
        const ll = s.percorrido.getLatLngs() as Leaflet.LatLng[];
        if (ll.length) {
          ll[ll.length - 1] = pronto.L.latLng(pos.lat, pos.lng);
          s.percorrido.setLatLngs(ll);
        }
      }
      const mapa = pronto.mapa;
      if (centralizar) mapa.setView([pos.lat, pos.lng], Math.max(mapa.getZoom(), 16));
      else if (s.tocando && s.opcoes.seguir && !mapa.getBounds().pad(-0.25).contains([pos.lat, pos.lng])) mapa.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    },
    [pronto, pts],
  );

  // marcador do caminhão e rastro
  useEffect(() => {
    if (!pronto || !pts.length) return;
    const { L, mapa } = pronto;
    const s = m.current;
    const camada = L.layerGroup().addTo(mapa);
    s.percorrido = L.polyline([], { color: "#ffffff", weight: 3, opacity: 0.95, dashArray: "2 7", lineCap: "round", interactive: false }).addTo(camada);
    s.marcador = L.marker([pts[0].lat, pts[0].lng], { icon: iconeHtml(L, '<div class="mk-play"><span class="seta-play">▲</span></div>'), zIndexOffset: 2000, interactive: false }).addTo(camada);
    s.idxPerc = -1;
    desenhar(false);
    return () => {
      s.tocando = false;
      cancelAnimationFrame(s.raf);
      camada.remove();
      s.marcador = null;
      s.percorrido = null;
    };
  }, [pronto, pts, desenhar]);

  const pausar = useCallback(() => {
    const s = m.current;
    s.tocando = false;
    cancelAnimationFrame(s.raf);
    setTocando(false);
  }, []);

  const tocar = useCallback(() => {
    const s = m.current;
    if (!pts.length || !pronto) return;
    if (s.t >= t1) s.t = t0;
    s.tocando = true;
    setTocando(true);
    // ▶ com o mapa afastado (rota do dia inteiro) ou fora da tela: aproxima no caminhão; daí ele acompanha
    const pos = posicaoEm(pts, s.t, s.rumo);
    if (!pronto.mapa.getBounds().contains([pos.lat, pos.lng]) || pronto.mapa.getZoom() < 15) pronto.mapa.setView([pos.lat, pos.lng], Math.max(pronto.mapa.getZoom(), 16));
    s.ultimoTs = performance.now();
    const passo = (ts: number) => {
      if (!s.tocando) return;
      const dt = (ts - s.ultimoTs) / 1000;
      s.ultimoTs = ts;
      const parado = pts[indiceEm(pts, s.t)].estado !== "movimento";
      s.t = avancar(s.t, dt, s.opcoes.velocidade, parado, s.opcoes.acelerar, t1);
      desenhar(false);
      const fim = s.t >= t1;
      if (fim || ts - s.ultimoRender > 100) {
        s.ultimoRender = ts;
        setT(s.t);
      }
      if (fim) {
        s.tocando = false;
        setTocando(false);
        return;
      }
      s.raf = requestAnimationFrame(passo);
    };
    s.raf = requestAnimationFrame(passo);
  }, [pts, pronto, t0, t1, desenhar]);

  const alternar = useCallback(() => {
    if (m.current.tocando) pausar();
    else tocar();
  }, [pausar, tocar]);

  const irPara = useCallback(
    (x: number, centralizar?: boolean) => {
      if (!pts.length) return;
      const s = m.current;
      s.t = Math.min(t1, Math.max(t0, x));
      desenhar(centralizar ?? !s.tocando);
      setT(s.t);
    },
    [pts, t0, t1, desenhar],
  );

  const pular = useCallback(
    (direcao: 1 | -1) => {
      const alvo = deslocamentoVizinho(h.trechos, m.current.t, direcao);
      if (alvo != null) irPara(alvo);
    },
    [h.trechos, irPara],
  );

  // espaço = play/pausa (fora de campos e botões)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.code === "Space" && pts.length && !(e.target as HTMLElement | null)?.closest?.("input, select, textarea, button")) {
        e.preventDefault();
        alternar();
      }
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [pts, alternar]);

  return {
    t, t0, t1, tocando,
    ponto: pts.length ? pts[indiceEm(pts, t)] : null,
    trecho: trechoEm(h.trechos, t),
    velocidade, acelerar, seguir, alternar, irPara, pular, setVelocidade, setAcelerar, setSeguir,
  };
}

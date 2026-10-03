import { describe, expect, it } from "vitest";
import { segDe } from "./dominio/formato";
import { avancar, deslocamentoVizinho, indiceEm, posicaoEm, prepararPontos, rumoEntre, trechoEm } from "./player";
import type { Trecho } from "./tipos";

const pts = prepararPontos([
  [0, 0, "08:00:00", 0, "parado", null],
  [0, 0.001, "08:01:00", 30, "movimento", null],
  [0.001, 0.001, "08:02:00", 30, "movimento", 1],
  [0.001, 0.001, "08:30:00", 0, "parado", 0],
]);
const trecho = (estado: Trecho["estado"], ini: string, fim: string): Trecho =>
  estado === "movimento"
    ? { estado, inicio: `2026-10-01 ${ini}:00`, fim: `2026-10-01 ${fim}:00`, duracao_min: 0, de: "", para: "", percurso: [], km: 0, vel_max: 0 }
    : { estado, inicio: `2026-10-01 ${ini}:00`, fim: `2026-10-01 ${fim}:00`, duracao_min: 0, local: "" };
const trechos = [trecho("movimento", "08:01", "08:05"), trecho("parado", "08:05", "08:20"), trecho("movimento", "08:20", "08:30")];

describe("player", () => {
  it("acha o ponto do instante (busca binária)", () => {
    expect(indiceEm(pts, 0)).toBe(0);
    expect(indiceEm(pts, segDe("08:01:30"))).toBe(1);
    expect(indiceEm(pts, segDe("09:00"))).toBe(3);
  });
  it("interpola entre pontos próximos e mantém o rumo", () => {
    const p = posicaoEm(pts, segDe("08:01:30"), 0);
    expect(p.i).toBe(1);
    expect(p.lat).toBeCloseTo(0.0005);
    expect(p.lng).toBeCloseTo(0.001);
    expect(p.rumo).toBeCloseTo(0);
  });
  it("buraco de mais de 10 min não é interpolado (o caminhão não 'voa')", () => {
    const p = posicaoEm(pts, segDe("08:10:00"), 45);
    expect([p.i, p.lat, p.lng, p.rumo]).toEqual([2, 0.001, 0.001, 45]);
  });
  it("rumo: leste = 90°; parado = sem rumo", () => {
    expect(rumoEntre({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeCloseTo(90);
    expect(rumoEntre({ lat: 0, lng: 0 }, { lat: 0, lng: 0 })).toBeNull();
  });
  it("avança o relógio: limite de 0,25 s por quadro, paradas 20x mais rápidas, para no fim", () => {
    expect(avancar(100, 1, 120, false, true, 1e6)).toBe(130);
    expect(avancar(100, 0.1, 120, true, true, 1e6)).toBe(340);
    expect(avancar(100, 0.1, 120, true, false, 1e6)).toBe(112);
    expect(avancar(100, 1, 120, false, true, 110)).toBe(110);
  });
  it("⏮/⏭ pulam para o início do deslocamento anterior/seguinte", () => {
    expect(deslocamentoVizinho(trechos, segDe("08:10"), 1)).toBe(segDe("08:20"));
    expect(deslocamentoVizinho(trechos, segDe("08:10"), -1)).toBe(segDe("08:01"));
    expect(deslocamentoVizinho(trechos, segDe("08:25"), 1)).toBeNull();
  });
  it("trecho em que o caminhão está", () => {
    expect(trechoEm(trechos, segDe("08:06"))).toBe(1);
    expect(trechoEm(trechos, segDe("07:00"))).toBe(-1);
  });
});

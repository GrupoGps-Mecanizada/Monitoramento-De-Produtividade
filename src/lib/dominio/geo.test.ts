import { describe, expect, it } from "vitest";
import type { LatLng } from "../tipos";
import { areaPoligono, cercasNoPonto, dentroDoPoligono, distanciaM } from "./geo";

const quadrado = (lat: number, lng: number, lado: number): LatLng[] => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

describe("geo", () => {
  it("ponto dentro e fora do polígono", () => {
    expect(dentroDoPoligono(0.5, 0.5, quadrado(0, 0, 1))).toBe(true);
    expect(dentroDoPoligono(1.5, 0.5, quadrado(0, 0, 1))).toBe(false);
  });
  it("cercas que contêm o ponto, da menor para a maior; ignora cerca com menos de 3 pontos", () => {
    const cercas = [{ name: "GRANDE", polygon: quadrado(0, 0, 10) }, { name: "PEQUENA", polygon: quadrado(0, 0, 1) }, { name: "LINHA", polygon: [[0, 0], [1, 1]] as LatLng[] }];
    expect(cercasNoPonto(0.5, 0.5, cercas).map((c) => c.name)).toEqual(["PEQUENA", "GRANDE"]);
    expect(areaPoligono(quadrado(0, 0, 2))).toBe(4);
  });
  it("distância de 1 grau de latitude ≈ 111,2 km", () => {
    expect(Math.round(distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }))).toBe(111195);
  });
});

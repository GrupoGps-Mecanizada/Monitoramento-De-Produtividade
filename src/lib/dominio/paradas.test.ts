import { describe, expect, it } from "vitest";
import type { Cerca, PontoRota } from "../tipos";
import { enriquecerParadas, excessosDaRota, paradasDaRota, paradasDasPosicoes } from "./paradas";

const D = "2026-10-07";
const H = 3600;
const hs = (h: string) => { const [a, b, c] = h.split(":").map(Number); return a * H + b * 60 + (c || 0); };
const pt = (hora: string, vel: number, lat = -19.48, lng = -42.53): PontoRota => ({ t: `${D} ${hora}`, lat, lng, vel, rpm: 0 });
const quad = (lat: number, lng: number, lado: number): [number, number][] => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

describe("paradas da rota completa (madrugada)", () => {
  it("abaixo de 5 km/h por 3 min ou mais; buraco de mais de 10 min corta", () => {
    const pontos = [pt("08:00:00", 30), pt("08:01:00", 2), pt("08:03:00", 0), pt("08:05:00", 1), pt("08:06:00", 40), pt("09:00:00", 0), pt("09:01:00", 0), pt("09:20:00", 0), pt("09:25:00", 0)];
    expect(paradasDaRota(pontos).map((p) => [p.ini, p.fim])).toEqual([
      [hs("08:01:00"), hs("08:05:00")],
      [hs("09:20:00"), hs("09:25:00")],
    ]);
  });
});

describe("paradas das posições de cada ciclo (tempo real)", () => {
  it("leituras seguidas a menos de 80 m viram uma parada; precisa de 2 leituras", () => {
    const pos = [
      { t: hs("08:00"), lat: -19.48, lng: -42.53 },
      { t: hs("08:05"), lat: -19.4802, lng: -42.5301 },
      { t: hs("08:10"), lat: -19.4801, lng: -42.53 },
      { t: hs("08:15"), lat: -19.47, lng: -42.52 },
      { t: hs("08:20"), lat: -19.46, lng: -42.51 },
      { t: hs("08:25"), lat: -19.4601, lng: -42.51 },
    ];
    expect(paradasDasPosicoes(pos).map((p) => [p.ini, p.fim])).toEqual([
      [hs("08:00"), hs("08:10")],
      [hs("08:20"), hs("08:25")],
    ]);
    expect(paradasDasPosicoes([])).toEqual([]);
  });
});

describe("enriquecer", () => {
  const areas = [
    { name: "PÁTIO GRANDE", color: "", tipo: "area", polygon: quad(-19.49, -42.54, 0.02) },
    { name: "BAIA PEQUENA", color: "", tipo: "area", polygon: quad(-19.481, -42.531, 0.002) },
  ] as Cerca[];
  it("cerca menor, minutos de cada status do motor e apontamentos", () => {
    const [p] = enriquecerParadas([{ ini: hs("08:00"), fim: hs("09:00"), lat: -19.48, lng: -42.53 }], { id: "10", placa: "EGC2985" }, {
      dia: D,
      areas,
      motor: [
        { inicio: `${D} 07:30:00`, fim: `${D} 08:20:00`, status: "secondary_motor_on", status_label: null },
        { inicio: `${D} 08:20:00`, fim: `${D} 10:00:00`, status: "off", status_label: null },
      ],
      tablet: [{ inicio: `${D} 08:30:00`, fim: `${D} 08:40:00`, categoria_demora: " Refeição Motorista " }],
      fimDia: 24 * H,
    });
    expect(p).toEqual({ dia: D, veiculo_id: "10", placa: "EGC2985", ini: hs("08:00"), fim: hs("09:00"), lat: -19.48, lng: -42.53, area: "BAIA PEQUENA", motor: { secondary_motor_on: 20, off: 40 }, apont: ["Refeição Motorista"] });
  });
});

describe("excessos de velocidade", () => {
  const usina = quad(-19.5, -42.56, 0.05);
  it("pontos seguidos acima de 30 km/h dentro da usina viram um excesso, com o pico", () => {
    const pontos = [pt("10:00:00", 25), pt("10:00:30", 35), pt("10:01:00", 48, -19.47, -42.52), pt("10:01:30", 33), pt("10:02:00", 20), pt("11:00:00", 60, -19.3, -42.3)];
    expect(excessosDaRota(pontos, usina)).toEqual([{ ini: hs("10:00:30"), fim: hs("10:01:30"), vel_max: 48, lat: -19.47, lng: -42.52 }]);
  });
  it("um ponto só acima do limite (pulo do GPS) não vira excesso", () => {
    expect(excessosDaRota([pt("10:00:00", 20), pt("10:00:30", 70), pt("10:01:00", 20)], usina)).toEqual([]);
  });
  it("sem o contorno da usina, nada", () => {
    expect(excessosDaRota([pt("10:00:00", 90)], null)).toEqual([]);
  });
});

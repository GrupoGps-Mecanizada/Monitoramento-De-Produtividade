import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { CHAVE_FORA, equipDaFrota, montarLocais, type ParadaAnalise } from "./analise";
import {
  MOTOR2, faixaDe, faixasDe, frasesAssunto, gradeHoraDia, lugaresPorPeso, numerosMotor2, numerosStatus, paradasMotor2, pesoParado, pesoStatus, picoDuasHoras, placasPorPeso, placasPorStatus, porHoraPeso, somarStatus,
} from "./assuntos";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [{ name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) }];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv"): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor: "OZIAS", regime: "ADM" } }) as Veiculo;
const equip = equipDaFrota([v("1", "EGC2985", "ap"), v("2", "EGC2993", "av"), v("3", "EAM3257", "hv")]);
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });

// a: AP 8h–9h bomba 40 + parado ligado 20; b: AP 14h–16h parado ligado 120; c: Vácuo 10h–11h desligado 60;
// d: Hiper 15h–16h sem dado de motor; e: AP longe (Recife) 20h–21h bomba 60
const { paradas, locais } = montarLocais(
  [
    p({ motor: { secondary_motor_on: 40, stopped: 20 } }),
    p({ ini: 14 * H, fim: 16 * H, motor: { stopped: 120 } }),
    p({ veiculo_id: "2", placa: "EGC2993", ini: 10 * H, fim: 11 * H, motor: { off: 60 } }),
    p({ veiculo_id: "3", placa: "EAM3257", ini: 15 * H, fim: 16 * H }),
    p({ area: "GALPÃO LONGE", lat: -8.05, lng: -34.9, ini: 20 * H, fim: 21 * H, motor: { secondary_motor_on: 60 } }),
  ],
  AREAS,
  equip,
  AREAS[0].polygon,
);

describe("assuntos: pesos e somas", () => {
  it("peso: tempo parado ou minutos de um status", () => {
    expect(paradas.map(pesoParado)).toEqual([60, 120, 60, 60, 60]);
    expect(paradas.map(pesoStatus("stopped"))).toEqual([20, 120, 0, 0, 0]);
  });
  it("placas pelo peso: só quem tem peso, do maior ao menor", () => {
    expect(placasPorPeso(paradas, pesoStatus(MOTOR2))).toEqual([{ chave: "EGC2985", nome: "EGC2985", n: 2, min: 100 }]);
    expect(placasPorPeso(paradas, pesoParado).map((l) => [l.nome, l.min])).toEqual([["EGC2985", 240], ["EAM3257", 60], ["EGC2993", 60]]);
  });
  it("lugares pelo peso: longe da região juntos em 'Longe da região'", () => {
    expect(lugaresPorPeso(paradas, locais, pesoStatus(MOTOR2))).toEqual([
      { chave: CHAVE_FORA, nome: "Longe da região", n: 1, min: 60 },
      { chave: "ALTO FORNO 3", nome: "ALTO FORNO 3", n: 1, min: 40 },
    ]);
  });
  it("por hora pelo peso e pico de 2 horas (empate: a janela que começa na hora mais cheia)", () => {
    const h = porHoraPeso(paradas, pesoStatus("stopped"));
    expect([h[8], h[14], h[15]]).toEqual([20, 120, 0]);
    expect(picoDuasHoras(h)).toBe(14);
    const so8 = Array<number>(24).fill(0);
    so8[8] = 60;
    expect(picoDuasHoras(so8)).toBe(8);
  });
});

describe("status do motor", () => {
  it("soma por status com o nome em português, do maior ao menor", () => {
    expect(somarStatus(paradas)).toEqual([
      { cod: "stopped", rotulo: "Parado ligado", min: 140 },
      { cod: "secondary_motor_on", rotulo: "Motor 2º ligado", min: 100 },
      { cod: "off", rotulo: "Motor desligado", min: 60 },
    ]);
  });
  it("números: horas paradas (todas), % ligado só sobre o tempo com dado de motor, status que mais pesa", () => {
    expect(numerosStatus(paradas)).toEqual({ parado: 360, comMotor: 300, ligadoPct: 240 / 300, maior: { cod: "stopped", rotulo: "Parado ligado", min: 140 } });
    const semMotor = paradas.filter((x) => x.placa === "EAM3257");
    expect(numerosStatus(semMotor)).toEqual({ parado: 60, comMotor: 0, ligadoPct: null, maior: null });
  });
  it("'Sem dados de bordo' não conta como dado de motor: sozinho dá '—'; junto, fica fora da base do %", () => {
    const ps = montarLocais([p({ motor: { no_data: 60 } }), p({ ini: 10 * H, fim: 11 * H, motor: { stopped: 30, no_data: 30 } })], AREAS, equip, AREAS[0].polygon).paradas;
    expect(numerosStatus(ps.slice(0, 1)).ligadoPct).toBeNull();
    expect(numerosStatus(ps).ligadoPct).toBe(1);
    expect(numerosMotor2(ps.slice(0, 1)).pct).toBeNull();
  });
});

describe("motor secundário", () => {
  it("só os equipamentos cuja produção é a bomba (Alta Pressão)", () => {
    expect(paradasMotor2(paradas).map((x) => x.placa)).toEqual(["EGC2985", "EGC2985", "EGC2985"]);
  });
  it("números: horas de bomba, % do tempo com dado de motor e a placa campeã; sem dado, '—'", () => {
    expect(numerosMotor2(paradas)).toEqual({ bomba: 100, pct: 100 / 240, campea: { chave: "EGC2985", nome: "EGC2985", n: 2, min: 100 } });
    expect(numerosMotor2(paradas.filter((x) => x.placa === "EGC2993"))).toEqual({ bomba: 0, pct: null, campea: null });
  });
});

describe("frases do assunto", () => {
  it("total, concentração, pico e lugar pelo peso", () => {
    expect(frasesAssunto({ rotulo: "Parado ligado", paradas, peso: pesoStatus("stopped"), locais })).toEqual([
      "Parado ligado: 2h20 em 2 paradas.",
      "A placa EGC2985 sozinha soma 100% desse tempo.",
      "O pico é das 14h às 16h.",
      "Onde mais acontece: ALTO FORNO 3, 2h20.",
    ]);
  });
  it("lugar longe vira 'Longe da região'; sem peso, nenhuma frase", () => {
    const f = frasesAssunto({ rotulo: "Bomba ligada", paradas: paradas.filter((x) => x.area === "GALPÃO LONGE"), peso: pesoStatus(MOTOR2), locais });
    expect(f[f.length - 1]).toBe("Onde mais acontece: Longe da região, 1h00.");
    expect(frasesAssunto({ rotulo: "X", paradas, peso: () => 0, locais })).toEqual([]);
  });
});

describe("visualização: grade, faixas e placas por status", () => {
  it("grade dia da semana × hora pelo peso (2026-10-01 = quinta)", () => {
    const g = gradeHoraDia(paradas, pesoParado);
    expect(g).toHaveLength(7);
    expect(g[4]).toHaveLength(24);
    expect([g[4][8], g[4][14], g[4][10], g[4][20]]).toEqual([60, 120, 60, 60]);
    expect(g[0].every((x) => x === 0)).toBe(true);
  });
  it("faixas: quintis dos valores > 0 sem repetir; faixaDe dá 0..n", () => {
    expect(faixasDe([10, 20, 30, 40, 50, 0])).toEqual([10, 20, 30, 40]);
    expect(faixasDe([5, 5, 5])).toEqual([5]);
    expect(faixasDe([0, 0])).toEqual([]);
    expect([faixaDe(10, [10, 20, 30, 40]), faixaDe(11, [10, 20, 30, 40]), faixaDe(99, [10, 20, 30, 40]), faixaDe(7, [])]).toEqual([0, 1, 4, 0]);
  });
  it("placas por status: partes na ordem fixa, ordenadas pelo destaque e depois pelo total", () => {
    const r = placasPorStatus(paradas, "stopped");
    expect(r.map((l) => [l.nome, l.destaque, l.total])).toEqual([["EGC2985", 140, 240], ["EAM3257", 0, 60], ["EGC2993", 0, 60]]);
    expect(r[0].partes.map((x) => x.cod)).toEqual(["stopped", "secondary_motor_on"]);
    expect(placasPorStatus(paradas, "off").map((l) => l.nome)).toEqual(["EGC2993", "EGC2985", "EAM3257"]);
  });
  it("placa sem dado de motor não some: o tempo parado entra como 'Sem dados de bordo'", () => {
    const r = placasPorStatus(paradas, "stopped");
    const hiper = r.find((l) => l.nome === "EAM3257");
    expect(hiper).toMatchObject({ destaque: 0, total: 60 });
    expect(hiper?.partes).toEqual([{ cod: "no_data", rotulo: "Sem dados de bordo", min: 60 }]);
  });
});

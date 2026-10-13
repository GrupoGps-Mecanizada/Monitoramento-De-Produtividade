import { describe, expect, it } from "vitest";
import { FormatoInesperado, validarBoletins, validarEventosIndisp, validarVagaDias, validarVagasBoletim } from "./esquemas";

describe("validações da medição", () => {
  it("números do Postgres (numeric) podem chegar como texto: viram número", () => {
    const [v] = validarVagasBoletim([{ boletim_cod: "B1", vaga_id: 530, vaga: "AP 01", regime: null, horas_regime: "551.6167", horas_indisp: 23.9167, df: "95.66", ausencia_operador: 12.68, area_manutencao: 0, fora_planta: 0, trajeto: 0, cartao_rfid: 0, lancada: 0, motor_desligado: 0, parado_ligado: 0, outros: 0 }]);
    expect(v.horas_regime).toBeCloseTo(551.6167, 4);
    expect(v.df).toBe(95.66);
  });
  it("dia sem placas (null) vira texto vazio", () => {
    expect(validarVagaDias([{ boletim_cod: "B1", vaga_id: 530, dia: "2026-09-16", placas: null, horas_regime: 24, horas_indisp: 1 }])[0].placas).toBe("");
  });
  it("formato errado avisa em vez de quebrar em silêncio", () => {
    expect(() => validarBoletins([{ cod: 1 }])).toThrow(FormatoInesperado);
    expect(() => validarEventosIndisp([{ placa: "X" }])).toThrow(FormatoInesperado);
  });
  it("lista vazia é válida", () => {
    expect(validarBoletins([])).toEqual([]);
    expect(validarBoletins(null)).toEqual([]);
  });
});

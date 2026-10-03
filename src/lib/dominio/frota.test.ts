import { describe, expect, it } from "vitest";
import { tipoCerca } from "./cercas";
import { normPlaca, parearMotores } from "./frota";

describe("motor secundário", () => {
  it("placa + 2 é o motor secundário do caminhão", () => {
    const { principalDe, secundarioDe } = parearMotores([
      { id: 10, placa: "EOF-5208" },
      { id: 11, placa: "EOF52082" },
      { id: 12, placa: "DTW5E38" },
      { id: 13, placa: "XYZ12342" }, // termina em 2, mas não existe XYZ1234
      { id: 14, placa: "DTW5E381" }, // 8 caracteres sem o 2 no fim
    ]);
    expect([...principalDe]).toEqual([["11", "10"]]);
    expect([...secundarioDe]).toEqual([["10", "11"]]);
  });
  it("normaliza placa", () => {
    expect(normPlaca(" eof-5208 ")).toBe("EOF5208");
    expect(normPlaca(null)).toBe("");
  });
});

describe("tipo da cerca", () => {
  it("planta, via e área", () => {
    expect(tipoCerca({ layer: 3, name: "USINA" })).toBe("planta");
    expect(["RUA 1", "R. 2", "AV 3", "AV. 4", "AVENIDA 5", "PN-6", "CANCELA 7"].map((name) => tipoCerca({ layer: 1, name }))).toEqual(Array(7).fill("via"));
    expect(tipoCerca({ layer: 1, name: "PATIO MECANIZADA" })).toBe("area");
    expect(tipoCerca({ layer: 1, name: "AVARIA" })).toBe("area");
  });
});

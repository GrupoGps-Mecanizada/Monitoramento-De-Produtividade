import { describe, expect, it } from "vitest";
import { BICAS, ehDaLista, regimeDoEquip } from "./regras-frota";

describe("regime de cada equipamento", () => {
  it("vem da matriz quando preenchido", () => {
    expect(regimeDoEquip("ADM", "")).toEqual({ regime: "adm", presumido: false });
    expect(regimeDoEquip("16H - 5X2", "")).toEqual({ regime: "16h", presumido: false });
    expect(regimeDoEquip("4X4 - A", "")).toEqual({ regime: "24h", presumido: false });
  });
  it("matriz em branco: pelo nome da vaga do GAUSS; sem pista, ADM presumido", () => {
    expect(regimeDoEquip(null, "ALTA PRESSÃO - GPS - 08 - 24 HS")).toEqual({ regime: "24h", presumido: false });
    expect(regimeDoEquip("", "AUTO VÁCUO - GPS - 07 - 16 HS")).toEqual({ regime: "16h", presumido: false });
    expect(regimeDoEquip(null, "ALTA PRESSÃO - GPS - 03")).toEqual({ regime: "adm", presumido: true });
  });
});

describe("nomes de cerca", () => {
  it("reconhece sem depender de acento, maiúscula ou espaço", () => {
    expect(ehDaLista("abast agua", BICAS)).toBe(true);
    expect(ehDaLista("ABASTECIMENTO  ÁGUA RUA 29 ", BICAS)).toBe(true);
    expect(ehDaLista("ABAST COMBUSTÍVEL", BICAS)).toBe(false);
  });
});

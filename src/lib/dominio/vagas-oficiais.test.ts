import { describe, expect, it } from "vitest";
import { vagaOficial } from "./vagas-oficiais";

describe("vagas que o sistema usa (as 22 da tela do GAUSS do dono, 16/10/2026)", () => {
  it("entram as da Mecanizada", () => {
    const sim = [
      "ALTA PRESSÃO - GPS - 01 - 24 HS",
      "ALTA PRESSÃO - GPS - 02",
      "ALTA PRESSÃO - GPS - 07 - 16 HS",
      "ALTA PRESSÃO - GPS - 08 - 24 HS",
      "ALTA PRESSÃO - GPS - 10",
      "AUTO VÁCUO - GPS - 01 - 24 HS",
      "AUTO VÁCUO - GPS - 06",
      "AUTO VÁCUO - GPS - 07 - 16 HS",
      "AUTO VÁCUO - GPS - 08 - 24 HS",
      "HIPER VÁCUO - GPS - 04",
    ];
    expect(sim.filter((v) => !vagaOficial(v))).toEqual([]);
  });
  it("ficam de fora as outras vagas da GPS no GAUSS (lista de 16/10/2026)", () => {
    const nao = [
      "ALTA PRESSÃO - GPS - 01",
      "ALTA PRESSÃO - GPS - 06 - 16 HS",
      "ALTA PRESSÃO - GPS - 07",
      "ALTA PRESSÃO - GPS - 07 - 24 HS",
      "ALTA PRESSÃO - GPS - 09 - 24 HS",
      "ALTA PRESSÃO - GPS - 11",
      "ALTA PRESSÃO - GPS - 12 - 24 HS",
      "AUTO VÁCUO - GPS - 01 - 16 HS",
      "AUTO VÁCUO - GPS - 02 - 24 HS",
      "AUTO VÁCUO - GPS - 07",
      "AUTO VÁCUO - GPS - 09",
      "CAMINHÃO PIPA - GPS - 01",
      "ASPIRADOR INDUSTRIAL - GPS - 01",
      "CAMINHÃO BROOK - GPS - 01",
      "MINI CARREGADEIRA - GPS - 01",
      "MOTO BOMBA - GPS - 01",
      "ALTA PRESSÃO - SERVITEC - 01",
    ];
    expect(nao.filter(vagaOficial)).toEqual([]);
  });
});

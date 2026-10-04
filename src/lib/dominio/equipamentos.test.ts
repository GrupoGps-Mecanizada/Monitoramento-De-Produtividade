import { describe, expect, it } from "vitest";
import { TOTAL_FROTA, compararEquip, formasPlaca, identificarEquip, nomeEquip } from "./equipamentos";

const sem = (placa: string, vaga = "") => identificarEquip({ placa, vaga });

describe("frota da Mecanizada", () => {
  it("tem 42 equipamentos (41 da planilha e o Ultravac)", () => {
    expect(TOTAL_FROTA).toBe(42);
  });
  it("acha a placa com ou sem hífen e em minúsculas", () => {
    expect(sem("egc-2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(sem("EGC2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(sem("EGC-2984")?.tipo).toBe("pg");
    expect(sem("DSY6471")?.tipo).toBe("hv");
  });
  it("placa Mercosul e antiga são a mesma (5º caractere 0-9 <-> A-J)", () => {
    expect(formasPlaca("DYB7C10")).toEqual(["DYB7C10", "DYB7210"]);
    expect(formasPlaca("dyb-7210")).toEqual(["DYB7210", "DYB7C10"]);
    expect(formasPlaca("PUB2F80")).toEqual(["PUB2F80", "PUB2580"]);
    expect(formasPlaca("EGC29852")).toEqual(["EGC29852"]);
    expect(sem("DYB7C10")).toEqual({ tipo: "av", nome: "DYB-7210", ordem: 6 });
  });
  it("aspirador é achado pelo número da vaga (as placas no GAUSS não são confiáveis)", () => {
    expect(sem("ASP12-RESERVA", "ASPIRADOR INDUSTRIAL - GPS - 05")).toEqual({ tipo: "as", nome: "Aspirador 05", ordem: 5 });
    expect(sem("ASPII", "ASPIRADOR INDUSTRIAL - GPS - 01")).toEqual({ tipo: "as", nome: "Aspirador 01", ordem: 1 });
    expect(sem("ASP99", "ASPIRADOR INDUSTRIAL - GPS - 11")).toBeNull();
  });
  it("Ultravac é tipo próprio", () => {
    expect(sem("OWU1596")).toEqual({ tipo: "uv", nome: "OWU-1596", ordem: 1 });
  });
  it("veículo de fora e motor secundário sozinho não são equipamentos", () => {
    expect(sem("EOF5208")).toBeNull();
    expect(sem("DTW5E38")).toBeNull();
    expect(sem("EGC29852")).toBeNull();
  });
  it("nome e ordem da planilha", () => {
    const a = { placa: "ASP12", equip: { tipo: "as" as const, nome: "Aspirador 03", ordem: 3 } };
    const b = { placa: "EGC2985", equip: { tipo: "ap" as const, nome: "EGC-2985", ordem: 11 } };
    const c = { placa: "CZC0453", equip: { tipo: "ap" as const, nome: "CZC-0453", ordem: 1 } };
    expect(nomeEquip(a)).toBe("Aspirador 03");
    expect(nomeEquip({ placa: "XYZ1234" })).toBe("XYZ1234");
    expect([a, b, c].sort(compararEquip).map((x) => x.placa)).toEqual(["CZC0453", "EGC2985", "ASP12"]);
  });
});

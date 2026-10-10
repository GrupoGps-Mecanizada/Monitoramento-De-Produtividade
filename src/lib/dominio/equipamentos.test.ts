import { describe, expect, it } from "vitest";
import type { EquipamentoCadastro } from "../tipos";
import {
  compararCadastro,
  compararEquip,
  formasPlaca,
  formatarPlaca,
  identificarEquip,
  montarFrota,
  nomeCadastro,
  nomeEquip,
  proximaOrdem,
  validarEquipamento,
  type DadosEquipamento,
} from "./equipamentos";
import { matrizExemplo } from "./matriz-exemplo";

const FROTA = montarFrota(matrizExemplo());
const sem = (placa: string, vaga = "") => identificarEquip({ placa, vaga }, FROTA);
const resumo = (placa: string, vaga = "") => {
  const e = sem(placa, vaga);
  return e && { tipo: e.tipo, nome: e.nome, ordem: e.ordem };
};

describe("frota da Mecanizada (matriz)", () => {
  it("42 equipamentos no monitoramento: os da planilha; o Ultravac desmobilizado fica de fora", () => {
    expect(matrizExemplo()).toHaveLength(43);
    expect(FROTA.total).toBe(42);
    expect(sem("OWU1596")).toBeNull();
  });
  it("acha a placa com ou sem hífen e em minúsculas", () => {
    expect(resumo("egc-2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(resumo("EGC2985")).toEqual({ tipo: "ap", nome: "EGC-2985", ordem: 11 });
    expect(sem("EGC-2984")?.tipo).toBe("pg");
    expect(sem("FMD2200")?.tipo).toBe("hv");
  });
  it("leva da matriz o status, o supervisor e o regime", () => {
    const m = matrizExemplo().map((c) => (c.placa === "EGC-2985" ? { ...c, status: "EM_MANUTENCAO" as const, supervisor: "OZIAS", regime: "ADM", codigo: "AP 08" } : c));
    const e = identificarEquip({ placa: "EGC2985", vaga: "" }, montarFrota(m));
    expect(e).toMatchObject({ status: "EM_MANUTENCAO", supervisor: "OZIAS", regime: "ADM", codigo: "AP 08" });
  });
  it("desmobilizado sai do monitoramento", () => {
    const m = matrizExemplo().map((c) => (c.placa === "EGC-2985" ? { ...c, status: "DESMOBILIZADO" as const } : c));
    const f = montarFrota(m);
    expect(identificarEquip({ placa: "EGC2985", vaga: "" }, f)).toBeNull();
    expect(f.total).toBe(41);
    expect(f.conhecidas.has("EGC2985")).toBe(true);
  });
  it("placa Mercosul e antiga são a mesma (5º caractere 0-9 <-> A-J)", () => {
    expect(formasPlaca("DYB7C10")).toEqual(["DYB7C10", "DYB7210"]);
    expect(formasPlaca("dyb-7210")).toEqual(["DYB7210", "DYB7C10"]);
    expect(formasPlaca("PUB2F80")).toEqual(["PUB2F80", "PUB2580"]);
    expect(formasPlaca("EGC29852")).toEqual(["EGC29852"]);
    expect(resumo("DYB7C10")).toEqual({ tipo: "av", nome: "DYB-7210", ordem: 6 });
  });
  it("aspirador é achado pelo número da vaga (as placas no GAUSS não são confiáveis)", () => {
    expect(resumo("ASP12-RESERVA", "ASPIRADOR INDUSTRIAL - GPS - 05")).toEqual({ tipo: "as", nome: "Aspirador 05", ordem: 5 });
    expect(resumo("ASPII", "ASPIRADOR INDUSTRIAL - GPS - 01")).toEqual({ tipo: "as", nome: "Aspirador 01", ordem: 1 });
    expect(sem("ASP99", "ASPIRADOR INDUSTRIAL - GPS - 11")).toBeNull();
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
  it("matriz em ordem de tipo e posição; equipamento novo entra no fim do tipo", () => {
    const m = [...matrizExemplo()].reverse().sort(compararCadastro);
    expect(m.slice(0, 2).map(nomeCadastro)).toEqual(["CZC-0453", "DSY-6472"]);
    expect(nomeCadastro(m.at(-1)!)).toBe("Aspirador 10");
    expect(proximaOrdem(m, "ap")).toBe(15);
    expect(proximaOrdem(m, "uv")).toBe(2);
    expect(proximaOrdem([], "hv")).toBe(1);
  });
});

describe("cadastro e edição de equipamento", () => {
  const MATRIZ = matrizExemplo();
  const dados = (o: Partial<DadosEquipamento>): DadosEquipamento => ({
    tipo: "ap", placa: "", numero: "", codigo: "", status: "ATIVO", supervisor_id: null, regime_id: null, observacao: "", ...o,
  });
  const id = (placa: string) => MATRIZ.find((c: EquipamentoCadastro) => c.placa === placa)!.id;

  it("placa vira o formato da planilha", () => {
    expect(formatarPlaca("egc2985")).toBe("EGC-2985");
    expect(formatarPlaca("pub 2f80")).toBe("PUB-2F80");
    expect(formatarPlaca("MOTORBOMBA")).toBe("MOTORBOMBA");
  });
  it("caminhão novo: grava a placa formatada e os campos limpos", () => {
    const r = validarEquipamento(dados({ placa: "abc1d23", codigo: " AP 15 ", supervisor_id: 3, regime_id: 1, observacao: "  " }), MATRIZ);
    expect(r).toEqual({ ok: true, linha: { tipo: "ap", placa: "ABC-1D23", numero: null, codigo: "AP 15", status: "ATIVO", supervisor_id: 3, regime_id: 1, observacao: null } });
  });
  it("placa repetida (também na forma Mercosul) não entra", () => {
    expect(validarEquipamento(dados({ placa: "EGC-2985" }), MATRIZ)).toEqual({ ok: false, erro: "A placa EGC-2985 já está na matriz (Alta Pressão)." });
    expect(validarEquipamento(dados({ tipo: "av", placa: "DYB7C10" }), MATRIZ)).toMatchObject({ ok: false });
  });
  it("editar o próprio equipamento não acusa placa repetida", () => {
    expect(validarEquipamento(dados({ placa: "EGC-2985", status: "EM_MANUTENCAO" }), MATRIZ, id("EGC-2985"))).toMatchObject({ ok: true });
  });
  it("aspirador pelo número, sem repetir", () => {
    expect(validarEquipamento(dados({ tipo: "as", numero: "11" }), MATRIZ)).toMatchObject({ ok: true, linha: { placa: null, numero: 11 } });
    expect(validarEquipamento(dados({ tipo: "as", numero: "5" }), MATRIZ)).toEqual({ ok: false, erro: "O Aspirador 05 já está na matriz." });
    expect(validarEquipamento(dados({ tipo: "as", numero: "abc" }), MATRIZ)).toMatchObject({ ok: false });
  });
  it("sem placa ou com texto grande demais não grava", () => {
    expect(validarEquipamento(dados({ placa: "" }), MATRIZ)).toMatchObject({ ok: false });
    expect(validarEquipamento(dados({ placa: "XYZ1A23", observacao: "x".repeat(501) }), MATRIZ)).toMatchObject({ ok: false });
  });
});

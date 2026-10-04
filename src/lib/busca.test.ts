import { describe, expect, it } from "vitest";
import { buscar, pontuarVeiculo, sugestoes } from "./busca";
import type { Cerca, Evento, Veiculo } from "./tipos";

const v = (id: string, placa: string, o: Partial<Veiculo> = {}): Veiculo => ({
  id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Desligado", status_cod: 2,
  status_desde: null, lat: 0, lng: 0, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});
const veiculos = [
  v("1", "EGC2984", { status: "Em manutenção", status_cod: 9, area: "OFICINA" }),
  v("2", "XEGC298", { area: "PATIO" }),
  v("3", "EOF5208", { status: "Ligado", status_cod: 1, area: "PATIO", motor2: { id: "4", placa: "EOF52082", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
];
const cerca = (name: string): Cerca => ({ code: 1, name, layer: 1, color: "#000", tipo: "area", polygon: [[0, 0], [0, 1], [1, 1]] });
const cercas = [cerca("OFICINA"), cerca("PATIO"), cerca("PATIO 2")];
const eventos: Evento[] = [{ t: "2026-10-01T15:00:00.000Z", id: "3", placa: "EOF5208", vaga: "", tipo: "entrada", area: "PATIO", lat: 0, lng: 0 }];
const d = { veiculos, cercas, eventos };

describe("busca geral", () => {
  it("placa com hífen e minúscula; começo da placa vem antes", () => {
    expect(buscar(d, "egc-2984").veiculos.map((x) => x.placa)).toEqual(["EGC2984"]);
    expect(buscar(d, "egc2").veiculos.map((x) => x.placa)).toEqual(["EGC2984", "XEGC298"]);
  });
  it("placa do motor secundário acha o caminhão", () => {
    expect(buscar(d, "52082").veiculos.map((x) => x.placa)).toEqual(["EOF5208"]);
  });
  it("sem acento: 'manutencao' acha o status 'Em manutenção'", () => {
    expect(pontuarVeiculo(veiculos[0], "manutencao")).toBe(1);
  });
  it("cercas por nome, as mais ocupadas primeiro; eventos pelo texto", () => {
    const r = buscar(d, "patio");
    expect(r.cercas.map((c) => c.name)).toEqual(["PATIO", "PATIO 2"]);
    expect(r.eventos).toHaveLength(1);
  });
  it("sem texto: ligados agora e áreas com mais veículos", () => {
    const s = sugestoes(d);
    expect(s.ligados.map((x) => x.placa)).toEqual(["EOF5208"]);
    expect(s.areas.map((c) => c.name)).toEqual(["PATIO", "OFICINA"]);
  });
});

describe("busca pela frota", () => {
  const av = v("1", "DYB7C10", { equip: { tipo: "av", nome: "DYB-7210", ordem: 6 } });
  const asp5 = v("2", "ASP12-RESERVA", { vaga: "ASPIRADOR INDUSTRIAL - GPS - 05", equip: { tipo: "as", nome: "Aspirador 05", ordem: 5 } });
  const asp6 = v("3", "ASP06", { vaga: "ASPIRADOR INDUSTRIAL - GPS - 06", equip: { tipo: "as", nome: "Aspirador 06", ordem: 6 } });
  it("placa antiga acha a Mercosul e vice-versa", () => {
    expect(pontuarVeiculo(av, "dyb-72")).toBe(3);
    expect(pontuarVeiculo(v("4", "DYB7210", { equip: av.equip }), "dyb7c")).toBe(3);
  });
  it("'asp 5' e 'aspirador 05' acham só o Aspirador 05", () => {
    expect(pontuarVeiculo(asp5, "asp 5")).toBe(3);
    expect(pontuarVeiculo(asp5, "aspirador 05")).toBe(3);
    expect(pontuarVeiculo(asp6, "asp 5")).toBe(0);
  });
  it("acha pelo nome do tipo, sem acento", () => {
    expect(pontuarVeiculo(av, "alto vacuo")).toBe(1);
  });
});

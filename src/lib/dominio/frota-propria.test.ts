import { describe, expect, it } from "vitest";
import type { Evento, Retrato, Veiculo } from "../tipos";
import { aplicarFrota, eventosAbertura, eventosDaFrota, idsDaFrota, precisaAbertura } from "./frota-propria";

const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "1", placa: "AAA0001", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: null, area: "PATIO", area_desde: null, via: "", sem_sinal: false, ...o,
});
const retrato = (veiculos: Veiculo[]): Retrato => ({ lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos });

// como o coletor grava hoje (antes do filtro): todos os veículos, sem "equip"
const ANTIGO = retrato([
  v({ id: "10", placa: "EGC2985", grupo: "CAMINHÃO ALTA PRESSÃO", motor2: { id: "11", placa: "EGC29852", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
  v({ id: "11", placa: "EGC29852", grupo: "CAMINHÃO ALTA PRESSÃO", motor2_de: "10" }),
  v({ id: "40", placa: "ASP12", vaga: "ASPIRADOR INDUSTRIAL - GPS - 03", grupo: "ASPIRADOR" }),
  v({ id: "90", placa: "EOF5208", grupo: "CAMINHÃO ALTA PRESSÃO" }),
  v({ id: "91", placa: "EOF52082", grupo: "CAMINHÃO ALTA PRESSÃO", motor2_de: "90" }),
  v({ id: "92", placa: "QQQ1A23", grupo: "VEÍCULO LEVE" }),
]);

describe("só a frota da Mecanizada", () => {
  it("retrato antigo (sem equip): fica a frota e o motor 2º dela, identificados pela placa/vaga", () => {
    const r = aplicarFrota(ANTIGO);
    expect(r.veiculos.map((x) => x.id)).toEqual(["10", "11", "40"]);
    expect(r.veiculos.map((x) => x.equip?.nome)).toEqual(["EGC-2985", "EGC-2985", "Aspirador 03"]);
  });
  it("fora_da_lista: só placas de grupos da frota que não estão na planilha", () => {
    expect(aplicarFrota(ANTIGO).fora_da_lista).toEqual(["EOF5208"]);
  });
  it("respeita o equip já gravado pelo coletor", () => {
    const r = aplicarFrota(retrato([v({ id: "5", placa: "SEMPLACA", equip: { tipo: "uv", nome: "OWU-1596", ordem: 1 } })]));
    expect(r.veiculos.map((x) => x.equip?.tipo)).toEqual(["uv"]);
  });
  it("retrato vazio continua vazio", () => {
    expect(aplicarFrota(retrato([])).veiculos).toEqual([]);
  });
  it("eventos: ficam os da frota (inclusive os do motor 2º), saem os de fora", () => {
    const ids = idsDaFrota(aplicarFrota(ANTIGO));
    const base = { t: "2026-10-03T12:00:00.000Z", vaga: "", tipo: "entrada" as const, area: "P", lat: 0, lng: 0 };
    const es: Evento[] = [
      { ...base, id: "10", placa: "EGC2985" },
      { ...base, id: "11", placa: "EGC29852", motor2: true, principal_id: "10" },
      { ...base, id: "90", placa: "EOF5208" },
    ];
    expect(eventosDaFrota(es, ids).map((e) => e.id)).toEqual(["10", "11"]);
  });
  it("abertura do dia: um evento por equipamento (sem o motor 2º), com status, área e sinal", () => {
    const ab = eventosAbertura(aplicarFrota(ANTIGO), "2026-10-03T03:02:00.000Z");
    expect(ab.map((e) => e.id)).toEqual(["10", "40"]);
    expect(ab[0]).toEqual({ t: "2026-10-03T03:02:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "abertura", status: "Ligado", area: "PATIO", sem_sinal: false });
  });
  it("abertura só no 1º ciclo de cada dia", () => {
    expect(precisaAbertura(null, "2026-10-03")).toBe(true);
    expect(precisaAbertura({ dia: "2026-10-02" }, "2026-10-03")).toBe(true);
    expect(precisaAbertura({ dia: "2026-10-03" }, "2026-10-03")).toBe(false);
  });
});

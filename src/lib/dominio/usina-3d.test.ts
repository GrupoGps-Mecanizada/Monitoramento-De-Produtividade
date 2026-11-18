import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { frotaParaMaquete } from "./usina-3d";

const veiculo = (v: Partial<Veiculo>): Veiculo => ({
  id: "1", placa: "EAM3257", vaga: "AUTO VÁCUO - GPS - 01 - 24 HS", grupo: "CAMINHÃO AUTO VÁCUO", motorista: "", endereco: "", demora: "",
  direcao: 61, status: "Ligado", status_cod: 1, status_desde: null, lat: -19.4857, lng: -42.5359, posicao_em: "2026-10-19T02:14:36Z",
  area: "ALMOXARIFADO CENTRAL", area_desde: null, via: "", sem_sinal: false, ...v,
});

describe("frota para a maquete 3D", () => {
  it("leva placa, vaga, status, posição e direção", () => {
    expect(frotaParaMaquete([veiculo({})])).toEqual([{
      placa: "EAM3257", vaga: "AUTO VÁCUO - GPS - 01 - 24 HS", grupo: "CAMINHÃO AUTO VÁCUO", status: "Ligado",
      area: "ALMOXARIFADO CENTRAL", lat: -19.4857, lng: -42.5359, dir: 61, em: "2026-10-19T02:14:36Z",
    }]);
  });

  it("o motor secundário não vira outro caminhão", () => {
    expect(frotaParaMaquete([veiculo({}), veiculo({ placa: "EAM32572", motor2_de: "EAM3257" })]).map((c) => c.placa)).toEqual(["EAM3257"]);
  });

  it("veículo sem coordenada fica de fora", () => {
    expect(frotaParaMaquete([veiculo({ lat: null }), veiculo({ placa: "X", lng: null })])).toEqual([]);
  });

  it("sem sinal aparece como sem comunicação", () => {
    expect(frotaParaMaquete([veiculo({ sem_sinal: true })])[0].status).toBe("Sem comunicação");
  });
});

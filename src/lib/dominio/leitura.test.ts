import { describe, expect, it } from "vitest";
import type { Cerca, EstadoVeiculo } from "../tipos";
import { montarSnapshot, processarLeitura, type PosicaoGauss } from "./leitura";

const quadrado = (name: string, lat: number, lng: number): Cerca => ({ code: 1, name, layer: 1, color: "#000", tipo: "area", polygon: [[lat, lng], [lat, lng + 1], [lat + 1, lng + 1], [lat + 1, lng]] });
const CERCAS = [quadrado("PATIO", 0, 0), quadrado("OFICINA", 5, 5)];
const AGORA = new Date("2026-10-01T12:05:00-03:00");
const pos = (o: Partial<PosicaoGauss> = {}): PosicaoGauss => ({
  vehicle_code: 10, vehicle_name: "EOF5208", lat: "0.5", lng: "0.5", datetime: "2026-10-01 12:04:00", status: 1,
  contract_position_obj: { name: "VAGA 1" }, vehicle_group: "AP", driver: "S/ MOTORISTA", address: "Rua A", delay_name: "--", direction: 90, ...o,
});
const anterior = (o: Partial<EstadoVeiculo> = {}): EstadoVeiculo => ({
  id: "10", placa: "EOF5208", vaga: "VAGA 1", grupo: "AP", motorista: "", endereco: "Rua A", demora: "", direcao: 90, status: "Ligado", status_cod: 1,
  status_desde: "2026-10-01T14:30:00.000Z", lat: 0.5, lng: 0.5, posicao_em: "2026-10-01T14:59:00.000Z", area: "PATIO", area_desde: "2026-10-01T14:00:00.000Z",
  via: "", sem_sinal: false, ...o,
});

describe("processarLeitura", () => {
  it("primeira leitura: estado sem 'desde' e nenhum evento", () => {
    const r = processarLeitura({}, [pos()], CERCAS, AGORA);
    expect(r.eventos).toEqual([]);
    expect(r.estado["10"]).toMatchObject({ area: "PATIO", status: "Ligado", status_desde: null, area_desde: null, motorista: "", demora: "", sem_sinal: false, posicao_em: "2026-10-01T15:04:00.000Z" });
  });
  it("mudou de área e de status", () => {
    const r = processarLeitura({ "10": anterior() }, [pos({ lat: "5.5", lng: "5.5", status: 2 })], CERCAS, AGORA);
    expect(r.eventos.map((e) => e.tipo)).toEqual(["saida", "entrada", "status"]);
    expect(r.eventos[0]).toMatchObject({ area: "PATIO", permanencia_min: 64, t: "2026-10-01T15:04:00.000Z" });
    expect(r.eventos[2]).toMatchObject({ de: "Ligado", para: "Desligado", duracao_min: 35, area: "OFICINA" });
    expect(r.estado["10"]).toMatchObject({ area: "OFICINA", area_desde: "2026-10-01T15:04:00.000Z", status_desde: "2026-10-01T15:05:00.000Z" });
  });
  it("perdeu o sinal (posição de mais de 30 min)", () => {
    const r = processarLeitura({ "10": anterior() }, [pos({ datetime: "2026-10-01 11:00:00" })], CERCAS, AGORA);
    expect(r.eventos).toEqual([expect.objectContaining({ tipo: "sinal_perdido", ultima_posicao: "2026-10-01T14:00:00.000Z", area: "PATIO" })]);
  });
  it("voltou a comunicar", () => {
    const r = processarLeitura({ "10": anterior({ sem_sinal: true, posicao_em: "2026-10-01T13:00:00.000Z" }) }, [pos()], CERCAS, AGORA);
    expect(r.eventos).toEqual([expect.objectContaining({ tipo: "sinal_retomado", sem_sinal_min: 124 })]);
  });
  it("motor secundário: sem entrada/saída, status marcado com o caminhão principal", () => {
    const ant = { "10": anterior(), "11": anterior({ id: "11", placa: "EOF52082" }) };
    const r = processarLeitura(ant, [pos(), pos({ vehicle_code: 11, vehicle_name: "EOF52082", lat: "5.5", lng: "5.5", status: 2 })], CERCAS, AGORA);
    expect(r.eventos.map((e) => e.tipo)).toEqual(["status"]);
    expect(r.eventos[0]).toMatchObject({ id: "11", motor2: true, principal_id: "10", principal: "EOF5208" });
  });
});

describe("montarSnapshot", () => {
  it("põe o motor secundário dentro do caminhão", () => {
    const estado = { "10": anterior(), "11": anterior({ id: "11", placa: "EOF52082", status: "Desligado", status_cod: 2 }) };
    const s = montarSnapshot(estado, { lido_em: "x", erro: null, intervalo_s: 300 });
    expect(s.sem_sinal_min).toBe(30);
    expect(s.veiculos.find((v) => v.id === "10")?.motor2).toMatchObject({ id: "11", placa: "EOF52082", status_cod: 2 });
    expect(s.veiculos.find((v) => v.id === "11")?.motor2_de).toBe("10");
  });
});

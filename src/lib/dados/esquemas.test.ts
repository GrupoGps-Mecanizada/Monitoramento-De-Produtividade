import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormatoInesperado, RETRATO_VAZIO, validarCercas, validarEvento, validarHistorico, validarRetrato } from "./esquemas";

const veiculo = {
  id: "10", placa: "EOF5208", vaga: "V1", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0,
  status: "Ligado", status_cod: 1, status_desde: null, lat: -19.4, lng: -42.5, posicao_em: "2026-10-01T12:00:00.000Z",
  area: "", area_desde: null, via: "", sem_sinal: false,
};
const retrato = { lido_em: "2026-10-01T12:00:00.000Z", erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [veiculo] };
const historico = {
  id: "10", dia: "2026-10-01", fonte: "gauss", baixado_em: "2026-10-01T12:00:00.000Z", motor2_erro: null,
  temRpm: true, rpm_travado: null, motor2_rpm_travado: null, motor2: null,
  trechos: [{ estado: "parado_ligado", inicio: "2026-10-01 08:00:00", fim: "2026-10-01 08:10:00", duracao_min: 10, local: "PATIO" }],
  resumo: { primeiro: "2026-10-01 08:00:00", ultimo: "2026-10-01 08:10:00", areas: [] },
  pontos: [[-19.4, -42.5, "08:00:00", 0, "parado_ligado", null], [null, null, "08:05:00", 0, "parado_ligado", null]],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("validarRetrato", () => {
  it("aceita o retrato do coletor e mantém campos extras", () => {
    const r = validarRetrato({ ...retrato, gauss: { dia: "2026-10-01", requisicoes: 3, logins: 1, erros: 0, desde: "x", pausadoAte: null } });
    expect(r.veiculos[0].placa).toBe("EOF5208");
    expect(r.gauss?.requisicoes).toBe(3);
  });
  it("sem retrato gravado (antes da 1ª leitura) devolve o retrato vazio", () => {
    expect(validarRetrato(null)).toEqual(RETRATO_VAZIO);
    expect(validarRetrato(undefined).veiculos).toEqual([]);
  });
  it("aceita veículo sem coordenada (NaN do GAUSS vira null)", () => {
    expect(validarRetrato({ ...retrato, veiculos: [{ ...veiculo, lat: null, lng: null }] }).veiculos[0].lat).toBeNull();
  });
  it("formato diferente vira FormatoInesperado", () => {
    expect(() => validarRetrato({ ...retrato, veiculos: "x" })).toThrow(FormatoInesperado);
  });
});

describe("validarCercas, validarEvento", () => {
  it("cercas ausentes viram lista vazia", () => {
    expect(validarCercas(undefined)).toEqual([]);
  });
  it("cerca sem tipo é recusada", () => {
    expect(() => validarCercas([{ name: "A", color: "#000", polygon: [] }])).toThrow(FormatoInesperado);
  });
  it("evento com tipo desconhecido é recusado", () => {
    expect(() => validarEvento({ t: "x", tipo: "outro", id: "1", placa: "A" })).toThrow(FormatoInesperado);
    expect(validarEvento({ t: "x", tipo: "entrada", id: "1", placa: "A", vaga: "", area: "P", lat: 1, lng: 2 }).tipo).toBe("entrada");
  });
});

describe("validarHistorico", () => {
  it("tira do mapa e do player o ponto sem coordenada", () => {
    const h = validarHistorico(historico);
    expect(h.pontos).toHaveLength(1);
    expect(h.trechos[0].estado).toBe("parado_ligado");
  });
  it("dia sem pontos (resumo nulo) é válido", () => {
    expect(validarHistorico({ ...historico, trechos: [], pontos: [], resumo: null }).resumo).toBeNull();
  });
});

describe("evento de abertura do dia", () => {
  it("é aceito", () => {
    const e = { t: "2026-10-03T03:02:00.000Z", tipo: "abertura", id: "10", placa: "EGC2985", vaga: "", status: "Ligado", area: "PATIO", sem_sinal: false };
    expect(validarEvento(e)).toEqual(e);
  });
});

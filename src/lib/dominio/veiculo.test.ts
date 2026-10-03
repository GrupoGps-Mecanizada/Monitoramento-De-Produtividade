import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { FORA_DE_AREA, agruparPorArea, areaInicial, categoria, filtrarVeiculos, frescor, noIndicador, resumoAreas, semMotor2 } from "./veiculo";

const AGORA = new Date("2026-10-01T12:00:00Z").getTime();
const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "1", placa: "AAA0001", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: "2026-10-01T11:59:00Z", area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});

describe("categoria e frescor", () => {
  it("mapeia os códigos de status do GAUSS", () => {
    expect([1, 3, 2, 4, 71, 98, 5, 9, 7, 99].map((c) => categoria({ status_cod: c }))).toEqual(
      ["ligado", "parado", "desligado", "desligado", "desligado", "desligado", "manut", "manut", "semcom", "outro"],
    );
  });
  it("posição de até 5 min é ao vivo; até o limite, atrasada; depois, sem sinal", () => {
    expect(frescor({ posicao_em: "2026-10-01T11:56:00Z" }, 30, AGORA)).toBe("vivo");
    expect(frescor({ posicao_em: "2026-10-01T11:40:00Z" }, 30, AGORA)).toBe("atrasado");
    expect(frescor({ posicao_em: "2026-10-01T11:00:00Z" }, 30, AGORA)).toBe("semsinal");
    expect(frescor({ posicao_em: null }, 30, AGORA)).toBe("semsinal");
  });
});

describe("filtros e agrupamentos", () => {
  const frota = [
    v({ id: "1", placa: "CCC0003", area: "PATIO", status_cod: 1 }),
    v({ id: "2", placa: "BBB0002", area: "PATIO", status_cod: 2 }),
    v({ id: "3", placa: "AAA0001", area: "OFICINA", status_cod: 5, motor2: { id: "9", placa: "AAA00012", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }),
    v({ id: "4", placa: "DDD0004", area: "", via: "RUA A", posicao_em: "2026-10-01T10:00:00Z" }),
    v({ id: "9", placa: "AAA00012", motor2_de: "3" }),
  ];
  it("motor secundário sai da lista", () => {
    expect(semMotor2(frota).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
  });
  it("indicadores: motor 2º ligado e sem sinal", () => {
    expect(noIndicador("motor2", frota[2], 30, AGORA)).toBe(true);
    expect(noIndicador("semsinal", frota[3], 30, AGORA)).toBe(true);
    expect(noIndicador("desligado", frota[1], 30, AGORA)).toBe(true);
  });
  it("busca pela placa do motor 2º, área e fora de área", () => {
    const lista = semMotor2(frota);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "aaa00012", area: null }, 30, AGORA).map((x) => x.id)).toEqual(["3"]);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "", area: "PATIO" }, 30, AGORA).map((x) => x.id)).toEqual(["1", "2"]);
    expect(filtrarVeiculos(lista, { indicador: null, busca: "", area: FORA_DE_AREA }, 30, AGORA).map((x) => x.id)).toEqual(["4"]);
  });
  it("agrupa pela área: mais cheia primeiro, sem área por último, placas em ordem", () => {
    const g = agruparPorArea(semMotor2(frota));
    expect(g.map((x) => x.area)).toEqual(["PATIO", "OFICINA", ""]);
    expect(g[0].veiculos.map((x) => x.placa)).toEqual(["BBB0002", "CCC0003"]);
  });
  it("resumo das áreas conta por categoria", () => {
    const r = resumoAreas(semMotor2(frota));
    expect(r[0]).toEqual({ area: "PATIO", total: 2, porCategoria: [["ligado", 1], ["desligado", 1]] });
    expect(r.at(-1)?.area).toBe(FORA_DE_AREA);
  });
  it("zoom inicial vai para a área com mais veículos com sinal", () => {
    const poligonos = { PATIO: [[0, 0], [0, 1], [1, 1]] as [number, number][], OFICINA: [[2, 2], [2, 3], [3, 3]] as [number, number][] };
    expect(areaInicial(semMotor2(frota), poligonos, 30, AGORA)).toBe("PATIO");
    expect(areaInicial([], poligonos, 30, AGORA)).toBeNull();
  });
});

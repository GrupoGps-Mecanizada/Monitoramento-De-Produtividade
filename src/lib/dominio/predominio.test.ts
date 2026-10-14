import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { CHAVE_FORA, equipDaFrota, montarLocais, type ParadaAnalise } from "./analise";
import { grupoDoStatus, porApontamentoDa, porFamilia, porStatus, predominioPorLugar } from "./predominio";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [{ name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) }, { name: "OFICINA", polygon: quad(-19.47, -42.52) }];
const v = (id: string, placa: string): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo: "ap", nome: placa, ordem: 1, supervisor: "OZIAS", regime: "ADM" } }) as Veiculo;
const equip = equipDaFrota([v("1", "EGC2985")]);
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });
const { paradas, locais } = montarLocais(
  [
    // ALTO FORNO 3: parado ligado 70 x desligado 30 → forte (70%)
    p({ motor: { stopped: 50, off: 10 } }),
    p({ ini: 10 * H, fim: 11 * H, motor: { stopped: 20, main_switch_off: 20 }, apont: ["Aguardando Área", "Refeição Motorista"] }),
    // OFICINA: manutenção 45, desligado 35, sem dado 20 → fraco (45%)
    p({ area: "OFICINA", lat: -19.469, lng: -42.519, motor: { maintenance: 45, off: 35, no_data: 20 }, apont: ["Aguardando semáforo/cancela"] }),
    // longe: ligado 30 + parado ligado 30 + motor 2º 40 → fraco (40% é o mínimo do fraco)
    p({ area: "GALPÃO LONGE", lat: -8.05, lng: -34.9, motor: { on: 30, stopped: 30, secondary_motor_on: 40 } }),
  ],
  AREAS,
  equip,
  AREAS[0].polygon,
);

describe("predomínio por lugar (mapa 'O que parou')", () => {
  it("status em 6 grupos + outros: chave geral desligada junta com desligado; sem dado, fora da planta e sem apropriação em 'outros'", () => {
    expect(["on", "stopped", "secondary_motor_on", "off", "main_switch_off", "maintenance", "categorized_stop", "no_data", "out_of_plant", "not_appropriated"].map(grupoDoStatus))
      .toEqual(["on", "stopped", "secondary_motor_on", "off", "off", "maintenance", "categorized_stop", "outros", "outros", "outros"]);
  });
  it("status: o que mais pesou em cada lugar e a força (forte > 50%, fraco ≥ 40%, senão misto)", () => {
    const m = predominioPorLugar(paradas, locais, porStatus);
    expect(m.get("ALTO FORNO 3")).toMatchObject({ cat: "stopped", total: 100, nivel: "forte" });
    expect(m.get("ALTO FORNO 3")?.parte).toBeCloseTo(0.7);
    expect(m.get("OFICINA")).toMatchObject({ cat: "maintenance", nivel: "fraco" });
    expect(m.get("OFICINA")?.partes).toEqual([["maintenance", 45], ["off", 35], ["outros", 20]]);
    expect(m.get(CHAVE_FORA)).toMatchObject({ cat: "secondary_motor_on", nivel: "fraco" });
  });
  it("família: a parada com 2 famílias conta nas duas; sem apontamento vira 'sem'", () => {
    const m = predominioPorLugar(paradas, locais, porFamilia);
    expect(m.get("ALTO FORNO 3")?.partes).toEqual([["sem", 60], ["aguardando", 60], ["pausas", 60]]);
    expect(m.get("ALTO FORNO 3")?.nivel).toBe("misto");
    expect(m.get("OFICINA")).toMatchObject({ cat: "aguardando", nivel: "forte" });
  });
  it("dentro de uma família: o apontamento (nome normalizado) que mais pesou; lugar sem nenhum fica de fora", () => {
    const m = predominioPorLugar(paradas, locais, porApontamentoDa("aguardando"));
    expect(m.get("ALTO FORNO 3")).toMatchObject({ cat: "aguardando area", nivel: "forte" });
    expect(m.get("OFICINA")?.cat).toBe("aguardando semaforo/cancela");
    expect(m.has(CHAVE_FORA)).toBe(false);
  });
});

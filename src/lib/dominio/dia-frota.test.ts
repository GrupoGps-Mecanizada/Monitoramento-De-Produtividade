import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../tipos";
import { agruparFrota, montarDiaFrota, type LinhaMotorFrota } from "./dia-frota";

const DIA = "2026-10-01";
const H = 3600;
const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "10", placa: "EGC2985", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Desligado", status_cod: 2,
  status_desde: null, lat: 1, lng: 1, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false,
  equip: { tipo: "ap", nome: "EGC-2985", ordem: 11 }, ...o,
});
const m = (id: string, i: string, f: string, status: string): LinhaMotorFrota => ({ placa_ou_codigo: id, inicio: `${DIA} ${i}`, fim: `${DIA} ${f}`, status, status_label: null });

describe("Dia da frota pela timeline de motor do GAUSS", () => {
  const motor = [m("10", "08:00:00", "09:00:00", "on"), m("10", "09:00:00", "11:00:00", "secondary_motor_on"), m("10", "11:00:00", "12:00:00", "off"), m("20", "08:00:00", "10:00:00", "stopped")];
  const frota = [
    v({}),
    v({ id: "20", placa: "EGC2993", equip: { tipo: "av", nome: "EGC-2993", ordem: 1 } }),
    v({ id: "30", placa: "DSY6472", equip: { tipo: "ap", nome: "DSY-6472", ordem: 12 } }),
    v({ id: "11", placa: "EGC29852", motor2_de: "10" }),
    v({ id: "90", placa: "EOF5208", equip: undefined }),
  ];

  it("uma linha por equipamento (ordem da planilha), com produtivo pela regra do tipo e motor ligado", () => {
    const ls = montarDiaFrota(motor, frota, DIA, null);
    expect(ls.map((l) => [l.id, l.produtivo, l.produtivo_min, l.ligado_min, l.blocos.length])).toEqual([
      ["10", "secondary_motor_on", 120, 180, 3],
      ["30", "stopped", 0, 0, 0],
      ["20", "stopped", 120, 120, 1],
    ]);
  });

  it("hoje: o status de agora é o bloco da hora (ou o último que chegou)", () => {
    const ls = montarDiaFrota(motor, frota, DIA, 10 * H);
    expect(ls.find((l) => l.id === "10")?.agora?.cod).toBe("secondary_motor_on");
    expect(ls.find((l) => l.id === "20")?.agora?.cod).toBe("stopped");
    expect(ls.find((l) => l.id === "30")?.agora).toBeNull();
  });

  it("agrupa por tipo com produtivos/ligados/desligados agora e ordena por produtivo", () => {
    const ls = montarDiaFrota(motor, frota, DIA, 11.5 * H);
    const g = agruparFrota(ls, "menos");
    expect(g.map((x) => [x.tipo, x.linhas.map((l) => l.id), x.produtivo_min, x.agoraProdutivos, x.agoraLigados, x.agoraDesligados])).toEqual([
      ["ap", ["30", "10"], 120, 0, 0, 1],
      ["av", ["20"], 120, 1, 1, 0],
    ]);
  });

  it("o produtivo dentro do Pátio do Transporte fica à parte (na base) e não conta como produzindo agora", () => {
    const ev = (tipo: string, hora: string, area: string, id = "20") => ({ tipo, t: `${DIA}T${hora}:00-03:00`, area, id, placa: "", vaga: "" }) as unknown as Evento;
    const eventos = [ev("abertura", "00:05", "PÁTIO DO TRANSPORTE RODOVIÁRIO"), ev("saida", "09:00", "PÁTIO DO TRANSPORTE RODOVIÁRIO"), ev("entrada", "09:00", "PÁTIO DO TRANSPORTE RODOVIÁRIO", "10")];
    const ls = montarDiaFrota(motor, frota, DIA, 8.5 * H, eventos);
    const av = ls.find((l) => l.id === "20")!;
    expect([av.produtivo_min, av.base_min, av.produzindo]).toEqual([60, 60, false]);
    const ap = ls.find((l) => l.id === "10")!;
    expect([ap.produtivo_min, ap.base_min]).toEqual([0, 120]);
    expect(agruparFrota(ls, "tipo").map((g) => g.base_min)).toEqual([120, 60]);
  });
});

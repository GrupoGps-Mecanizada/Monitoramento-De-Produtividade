import { describe, expect, it } from "vitest";
import { blocoEm, capitulosComGauss, formasDaPlaca, minutosEntre, montarStatusGauss, montarTablet, segNoDia, totaisGauss } from "./gauss-dia";

const D = "2026-10-07";
const l = (i: string, f: string, status: string) => ({ inicio: `${D} ${i}`, fim: `${D} ${f}`, status, status_label: null });

describe("status do GAUSS no dia", () => {
  it("converte horários para segundos do dia, cortando o que passa da meia-noite", () => {
    expect(segNoDia(`${D} 06:10:08`, D)).toBe(6 * 3600 + 10 * 60 + 8);
    expect(segNoDia(`${D}T00:00:09`, D)).toBe(9);
    expect(segNoDia("2026-10-06 23:50:00", D)).toBe(0);
    expect(segNoDia("2026-10-08 00:10:00", D)).toBe(86400);
  });

  // dados reais do 4745269 em 07/10/2026: capturas das 07:42, 09:38 e 19:28 que se sobrepõem
  const g = (gravado: string, i: string, f: string, status: string) => ({ ...l(i, f, status), gravado: `${D}T${gravado}:00+00:00` });

  it("em cada instante vale a captura mais nova; trechos iguais vizinhos se juntam", () => {
    const b = montarStatusGauss(
      [g("10:42", "06:42:33", "07:34:10", "maintenance"), g("12:38", "07:18:00", "07:18:03", "off"), g("12:38", "07:18:03", "07:56:01", "maintenance"), g("10:42", "07:34:10", "07:38:00", "on")],
      D,
    );
    expect(b.map((x) => [x.cod, x.a, x.b])).toEqual([
      ["maintenance", 24153, 26280],
      ["off", 26280, 26283],
      ["maintenance", 26283, 28561],
    ]);
  });

  it("a captura nova corrige o fim da bomba", () => {
    const b = montarStatusGauss(
      [g("12:38", "09:26:39", "09:32:39", "secondary_motor_on"), g("12:38", "09:32:39", "09:33:00", "off"), g("22:28", "09:26:39", "09:36:39", "secondary_motor_on"), g("22:28", "09:36:39", "09:43:17", "off")],
      D,
    );
    expect(b.map((x) => [x.rotulo, (x.b - x.a) / 60])).toEqual([
      ["Motor 2º ligado", 10],
      ["Motor desligado", 398 / 60],
    ]);
  });

  it("mesma captura: vale o trecho que começou depois", () => {
    const b = montarStatusGauss([l("08:00:00", "09:00:00", "on"), l("08:30:00", "08:40:00", "stopped")], D);
    expect(b.map((x) => x.cod)).toEqual(["on", "stopped", "on"]);
  });

  it("status desconhecido usa o rótulo do GAUSS", () => {
    expect(montarStatusGauss([{ ...l("10:00:00", "10:05:00", "novo"), status_label: "Algo novo" }], D)[0]).toMatchObject({ rotulo: "Algo novo", tom: "neu" });
  });

  it("acha o bloco da hora e soma os minutos por status", () => {
    const b = montarStatusGauss([l("08:00:00", "09:00:00", "on"), l("09:00:00", "09:30:00", "stopped")], D);
    expect(blocoEm(b, 8.5 * 3600)?.cod).toBe("on");
    expect(blocoEm(b, 10 * 3600)).toBeNull();
    expect(totaisGauss(b).map((t) => [t.cod, t.min])).toEqual([
      ["on", 60],
      ["stopped", 30],
    ]);
  });
});

describe("capítulos com o motor do GAUSS", () => {
  it("ligado (com parado ligado e motor 2º), desligado e o resto", () => {
    const g = montarStatusGauss([l("08:00:00", "08:10:00", "stopped"), l("08:10:00", "08:20:00", "secondary_motor_on"), l("08:20:00", "08:35:00", "off"), l("08:35:00", "08:40:00", "maintenance")], D);
    expect([...minutosEntre(g, 8 * 3600 + 300, 8 * 3600 + 900)]).toEqual([
      ["stopped", 5],
      ["secondary_motor_on", 5],
    ]);
    const cap = { n: 1, lugar: "PATIO", tipoLugar: "base" as const, inicio: `${D} 08:00:00`, fim: `${D} 08:45:00`, duracao_min: 45, ligado_min: 0, desligado_min: 45, outro_min: 0, lat: null, lng: null, ate: null };
    expect(capitulosComGauss([cap], g, D)[0]).toMatchObject({ ligado_min: 20, desligado_min: 15, outro_min: 10 });
  });
});

describe("apontamentos do tablet", () => {
  const t = (cod: number, i: string, f: string | null, cat = "Refeição Motorista") => ({ demora_cod: cod, inicio: `${D} ${i}`, fim: f && `${D} ${f}`, categoria_demora: cat, motorista: "--", concluido: "NÃO" });

  it("ordena, tira repetidos e trata apontamento aberto", () => {
    const a = montarTablet([t(2, "12:00:00", null, "Documentação "), t(1, "08:00:00", "08:30:00"), t(1, "08:00:00", "08:30:00")], D, 13 * 3600);
    expect(a.map((x) => [x.cod, x.categoria, x.b - x.a, x.aberto, x.motorista])).toEqual([
      ["1", "Refeição Motorista", 1800, false, null],
      ["2", "Documentação", 3600, true, null],
    ]);
  });
});

describe("placa", () => {
  it("procura com e sem hífen", () => {
    expect(formasDaPlaca("EAM-3253")).toEqual(["EAM-3253", "EAM3253"]);
    expect(formasDaPlaca("EGC2993")).toEqual(["EGC2993", "EGC-2993"]);
  });
});

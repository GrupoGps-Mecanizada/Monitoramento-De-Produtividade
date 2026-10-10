import { describe, expect, it } from "vitest";
import type { Evento, Trecho } from "../tipos";
import { baseDosEventos, baseDosTrechos, dividirProdutivo, ehBase, naBase, statusProdutivo } from "./produtividade";

const H = 3600;

describe("produtividade por tipo (regra do dono)", () => {
  it("alta pressão: motor secundário; alto vácuo: parado ligado", () => {
    expect(statusProdutivo("ap", "EGC2985")).toBe("secondary_motor_on");
    expect(statusProdutivo("av", "EGC2993")).toBe("stopped");
  });
  it("o DSY6472 (alta pressão) produz parado ligado, com ou sem hífen", () => {
    expect(statusProdutivo("ap", "DSY6472")).toBe("stopped");
    expect(statusProdutivo("ap", "DSY-6472")).toBe("stopped");
  });
  it("hiper vácuo, Brook e aspiradores não têm regra", () => {
    expect(statusProdutivo("hv", "EAM-3257")).toBeNull();
    expect(statusProdutivo("pg", "EPN2463")).toBeNull();
    expect(statusProdutivo("as", "ASP12")).toBeNull();
    expect(statusProdutivo(undefined, "X")).toBeNull();
  });
  it("soma só os minutos do status produtivo", () => {
    const b = [
      { a: 0, b: 600, cod: "secondary_motor_on" },
      { a: 600, b: 1200, cod: "stopped" },
      { a: 1200, b: 1500, cod: "secondary_motor_on" },
    ];
    expect(dividirProdutivo(b, "secondary_motor_on")).toEqual({ min: 15, base_min: 0 });
    expect(dividirProdutivo(b, "stopped")).toEqual({ min: 10, base_min: 0 });
    expect(dividirProdutivo(b, null)).toBeNull();
  });
});

describe("na base o produtivo não conta (regra do dono, 08/10/2026)", () => {
  it("Pátio do Transporte e Garagem são base; a Baia de Resíduos e as áreas de serviço não", () => {
    expect(ehBase("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toBe(true);
    expect(ehBase("GARAGEM ÔNIBUS")).toBe(true);
    expect(ehBase("PRÉDIO DA GARAGEM - TRANSPORTE RODOVIÁRIO")).toBe(true);
    expect(ehBase("BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO")).toBe(false);
    expect(ehBase("ALTO FORNO 3")).toBe(false);
    expect(ehBase("")).toBe(false);
  });
  it("separa o produtivo que caiu na base", () => {
    const b = [{ a: 8 * H, b: 12 * H, cod: "stopped" }];
    expect(dividirProdutivo(b, "stopped", [{ a: 7 * H, b: 9 * H }, { a: 11 * H, b: 11.5 * H }])).toEqual({ min: 150, base_min: 90 });
  });
  it("base pelos trechos parados da Timeline (em movimento nunca é base)", () => {
    const t = [
      { estado: "parado_ligado", local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", inicio: "2026-10-01 06:00:00", fim: "2026-10-01 07:30:00", duracao_min: 90 },
      { estado: "movimento", de: "PÁTIO DO TRANSPORTE RODOVIÁRIO", para: "ALTO FORNO 3", percurso: [], km: 3, vel_max: 40, inicio: "2026-10-01 07:30:00", fim: "2026-10-01 07:45:00", duracao_min: 15 },
      { estado: "parado_ligado", local: "BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO", inicio: "2026-10-01 07:45:00", fim: "2026-10-01 08:00:00", duracao_min: 15 },
    ] as Trecho[];
    expect(baseDosTrechos(t)).toEqual([{ a: 6 * H, b: 7.5 * H }]);
  });
  it("base pelas entradas e saídas de área (horário de Brasília), a partir da abertura do dia", () => {
    const e = (tipo: string, hora: string, area: string) => ({ tipo, t: `2026-10-01T${hora}:00-03:00`, area, id: "10", placa: "X", vaga: "" }) as unknown as Evento;
    const ev = [
      e("abertura", "00:05", "PÁTIO DO TRANSPORTE RODOVIÁRIO"),
      e("saida", "06:00", "PÁTIO DO TRANSPORTE RODOVIÁRIO"),
      e("entrada", "06:20", "ALTO FORNO 3"),
      e("saida", "10:00", "ALTO FORNO 3"),
      e("entrada", "10:10", "BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO"),
      e("saida", "10:40", "BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO"),
      e("entrada", "10:45", "GARAGEM ÔNIBUS"),
    ];
    const base = baseDosEventos(ev, "2026-10-01");
    expect(base).toEqual([{ a: 0, b: 6 * H }, { a: 10.75 * H, b: 24 * H }]);
    expect(naBase(base, 3 * H)).toBe(true);
    expect(naBase(base, 8 * H)).toBe(false);
  });
  it("sem abertura, uma saída como 1º evento diz que estava na área desde a meia-noite", () => {
    const ev = [{ tipo: "saida", t: "2026-10-01T05:00:00-03:00", area: "PÁTIO DO TRANSPORTE RODOVIÁRIO" }] as unknown as Evento[];
    expect(baseDosEventos(ev, "2026-10-01")).toEqual([{ a: 0, b: 5 * H }]);
  });
});

import { describe, expect, it } from "vitest";
import { diaBR, fmtHora, fmtMin, hhmm, hora, idadeCurta, rotuloDia, segDe, ultimosDias } from "./formato";

describe("formato", () => {
  it("fmtMin: minutos, horas e dias", () => {
    expect(fmtMin(null)).toBe("—");
    expect(fmtMin(Number.NaN)).toBe("—");
    expect(fmtMin(45.4)).toBe("45 min");
    expect(fmtMin(61)).toBe("1h01");
    expect(fmtMin(1500)).toBe("1d 1h");
  });
  it("idadeCurta: segundos, minutos, horas e dias", () => {
    const agora = new Date("2026-10-01T12:00:00Z").getTime();
    expect(idadeCurta(null, agora)).toBe("?");
    expect(idadeCurta("2026-10-01T11:59:20Z", agora)).toBe("40s");
    expect(idadeCurta("2026-10-01T11:48:00Z", agora)).toBe("12m");
    expect(idadeCurta("2026-10-01T09:00:00Z", agora)).toBe("3h");
    expect(idadeCurta("2026-09-29T12:00:00Z", agora)).toBe("2d");
  });
  it("segundos do dia e de volta", () => {
    expect(segDe("01:02:03")).toBe(3723);
    expect(segDe("08:30")).toBe(30600);
    expect(fmtHora(3723)).toBe("01:02:03");
  });
  it("datas", () => {
    expect(diaBR("2026-10-01")).toBe("01/10/2026");
    expect(hhmm("2026-10-01 08:05:09")).toBe("08:05");
    expect(hora(null)).toBe("—");
    expect(hora("2026-10-01T17:30:00.000Z")).toBe("14:30");
    expect(rotuloDia("2026-10-02", "2026-10-02")).toBe("Hoje");
    expect(rotuloDia("2026-10-01", "2026-10-02")).toBe("Ontem");
    expect(rotuloDia("2026-09-30", "2026-10-02")).toBe("30/09/2026");
    expect(ultimosDias(3, new Date("2026-10-02T12:00:00-03:00"))).toEqual(["2026-10-02", "2026-10-01", "2026-09-30"]);
  });
});

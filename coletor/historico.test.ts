import { describe, expect, it } from "vitest";
import { diaFechado, mesclarPontos } from "./historico";

const p = (t: string, vel = 0) => ({ t: `2026-10-01 ${t}`, lat: 0, lng: 0, vel, rpm: 0 });

describe("histórico do coletor", () => {
  it("mescla pontos guardados com os novos, sem duplicar, em ordem", () => {
    expect(mesclarPontos([p("08:00:00"), p("08:01:00")], [p("08:01:00", 9), p("07:59:00")]).map((x) => [x.t.slice(11), x.vel])).toEqual([
      ["07:59:00", 0], ["08:00:00", 0], ["08:01:00", 9],
    ]);
  });
  it("dia só fecha 2 h depois da meia-noite (o rastreador descarrega atrasado)", () => {
    expect(diaFechado("2026-10-01", new Date("2026-10-02T01:00:00-03:00").getTime())).toBe(false);
    expect(diaFechado("2026-10-01", new Date("2026-10-02T03:00:00-03:00").getTime())).toBe(true);
  });
});

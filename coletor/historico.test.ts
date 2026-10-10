import { describe, expect, it } from "vitest";
import type { GaussFleetClient } from "./gauss";
import { baixarRota, diaFechado, mesclarPontos } from "./historico";

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

describe("rota completa ou pela metade (madrugada)", () => {
  const pagina = (hora: string, control?: string) => ({ board_data: [{ datetime: `2026-10-01 ${hora}`, location: { lat: 1, lng: 1 }, speed_: 0 }], filter: control ? { control } : {} });
  const gauss = (respostas: unknown[]) => ({ post: async () => respostas.shift() ?? { no_data: true } }) as unknown as GaussFleetClient;
  it("terminou quando a última página cobre o dia", async () => {
    const info = { completa: false };
    const pts = await baixarRota(gauss([pagina("08:00:00", "2026-10-01 12:00:00"), pagina("23:59:00", "2026-10-01 23:59:00")]), "10", "2026-10-01", "00:00", info);
    expect([pts.length, info.completa]).toEqual([2, true]);
  });
  it("erro do GAUSS numa página do meio: pela metade", async () => {
    const info = { completa: true };
    const pts = await baixarRota(gauss([pagina("08:00:00", "2026-10-01 12:00:00"), { error: true }]), "10", "2026-10-01", "00:00", info);
    expect([pts.length, info.completa]).toEqual([1, false]);
  });
  it("dia sem nenhum ponto: completo (e vazio)", async () => {
    const info = { completa: false };
    expect(await baixarRota(gauss([{ no_data: true }]), "10", "2026-10-01", "00:00", info)).toEqual([]);
    expect(info.completa).toBe(true);
  });
});


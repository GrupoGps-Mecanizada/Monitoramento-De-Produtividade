import { describe, expect, it } from "vitest";
import type { Historico } from "../tipos";
import { itensResumo } from "./historico";

const base: Historico = {
  id: "10", dia: "2026-10-01", fonte: "cache", baixado_em: "x", motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null, motor2: null, pontos: [], trechos: [],
  resumo: { primeiro: "2026-10-01 08:00:00", ultimo: "2026-10-01 17:30:00", pontos: 10, km: 12.5, vel_max: 42, movimento_min: 95, parado_ligado_min: 30, desligado_min: 400, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: null, areas: [] },
};

describe("resumo do dia", () => {
  it("com RPM: parado ligado e desligado", () => {
    expect(itensResumo(base).map((i) => [i.rotulo, i.valor])).toEqual([
      ["Período", "08:00 – 17:30"], ["Distância", "12,5 km · máx 42 km/h"], ["Em deslocamento", "1h35"], ["Parado ligado", "30 min"], ["Desligado", "6h40"],
    ]);
  });
  it("RPM travado: só 'Parado', com a explicação; motor 2º e sem sinal", () => {
    const h: Historico = { ...base, temRpm: false, rpm_travado: 1316, motor2: { intervalos: [], placa: "EOF52082" }, resumo: { ...base.resumo!, parado_min: 430, sem_sinal_min: 12, motor2_ligado_min: 65 } };
    const itens = itensResumo(h);
    expect(itens.find((i) => i.rotulo === "Parado")?.nota).toContain("travado em 1316");
    expect(itens.find((i) => i.rotulo === "Sem sinal")?.valor).toBe("12 min");
    expect(itens.find((i) => i.rotulo === "Motor 2º ligado")).toMatchObject({ valor: "⚙ 1h05", nota: "EOF52082", motor2: true });
  });
  it("dia sem pontos não tem resumo", () => {
    expect(itensResumo({ ...base, resumo: null })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { Historico } from "../tipos";
import { itensResumo, semRpm } from "./historico";

const base: Historico = {
  id: "10", dia: "2026-10-01", fonte: "cache", baixado_em: "x", motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null, motor2: null, pontos: [], trechos: [],
  resumo: { primeiro: "2026-10-01 08:00:00", ultimo: "2026-10-01 17:30:00", pontos: 10, km: 12.5, vel_max: 42, movimento_min: 95, parado_ligado_min: 30, desligado_min: 400, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: null, areas: [] },
};

describe("resumo do dia", () => {
  it("só o que é GPS: período, distância, andando e parado (sem RPM; motor vem do GAUSS)", () => {
    expect(itensResumo(base).map((i) => [i.rotulo, i.valor])).toEqual([
      ["Período", "08:00 – 17:30"], ["Distância", "12,5 km · máx 42 km/h"], ["Em deslocamento", "1h35"], ["Parado", "7h10"],
    ]);
  });
  it("sem sinal aparece; motor 2º e RPM travado não", () => {
    const h: Historico = { ...base, temRpm: false, rpm_travado: 1316, motor2: { intervalos: [], placa: "EOF52082" }, resumo: { ...base.resumo!, sem_sinal_min: 12, motor2_ligado_min: 65 } };
    const itens = itensResumo(h);
    expect(itens.find((i) => i.rotulo === "Sem sinal")?.valor).toBe("12 min");
    expect(itens.some((i) => i.motor2 || i.nota?.includes("RPM"))).toBe(false);
  });
  it("semRpm: parado ligado/desligado viram parado (paradas vizinhas no mesmo lugar se juntam) e o motor 2º do RPM sai", () => {
    const d = "2026-10-01";
    const h: Historico = {
      ...base,
      motor2: { intervalos: [["08:00:00", "08:05:00"]], placa: "EOF52082" },
      trechos: [
        { estado: "parado_ligado", inicio: `${d} 08:00:00`, fim: `${d} 08:10:00`, duracao_min: 10, local: "PATIO", motor2_min: 5 },
        { estado: "desligado", inicio: `${d} 08:10:00`, fim: `${d} 08:30:00`, duracao_min: 20, local: "PATIO" },
      ],
      pontos: [[-19, -42, "08:00:00", 0, "parado_ligado", 1]],
    };
    const s = semRpm(h);
    expect(s.trechos).toEqual([{ estado: "parado", inicio: `${d} 08:00:00`, fim: `${d} 08:30:00`, duracao_min: 30, local: "PATIO" }]);
    expect(s.pontos[0][4]).toBe("parado");
    expect(s.pontos[0][5]).toBeNull();
    expect(s.motor2).toBeNull();
    expect(s.resumo).toMatchObject({ parado_ligado_min: 0, desligado_min: 0, parado_min: 430 });
  });
  it("dia sem pontos não tem resumo", () => {
    expect(itensResumo({ ...base, resumo: null })).toEqual([]);
  });
});

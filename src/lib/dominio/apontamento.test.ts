import { describe, expect, it } from "vitest";
import type { PontoRota } from "../tipos";
import { intervalosLigado, montarApontamento, rpmTravado } from "./apontamento";

// um ponto por minuto a partir de "HH:MM"
const serie = (inicio: string, n: number, f: (i: number) => Partial<PontoRota>): PontoRota[] => {
  const [h, m] = inicio.split(":").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const min = h * 60 + m + i;
    const t = `2026-10-01 ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00`;
    return { t, lat: -19.48 + i * 0.0005, lng: -42.53, vel: 0, rpm: 0, ...f(i) };
  });
};

describe("montarApontamento", () => {
  it("dia sem pontos", () => {
    expect(montarApontamento([], [])).toEqual({ trechos: [], resumo: null, temRpm: false, pontos: [], motor2: null });
  });

  it("deslocamento seguido de parada com motor ligado", () => {
    const pts = [...serie("08:00", 10, () => ({ vel: 30, rpm: 1500 })), ...serie("08:10", 11, () => ({ vel: 0, rpm: 800 }))];
    const a = montarApontamento(pts, []);
    expect(a.temRpm).toBe(true);
    expect(a.rpm_travado).toBeNull();
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["movimento", 10], ["parado_ligado", 10]]);
    expect(a.resumo).toMatchObject({ movimento_min: 10, parado_ligado_min: 10, desligado_min: 0, sem_sinal_min: 0, motor2_ligado_min: null, areas: [] });
    expect(a.pontos).toHaveLength(21);
    expect(a.pontos[0].slice(2)).toEqual(["08:00:00", 30, "movimento", null]);
    const parada = a.trechos[1];
    expect(parada.estado !== "movimento" && parada.local).toBe("Fora de cerca");
  });

  it("parada curta (menos de 2 min) é absorvida pelo deslocamento", () => {
    const pts = [...serie("08:00", 6, () => ({ vel: 30, rpm: 1500 })), ...serie("08:06", 1, () => ({ vel: 0, rpm: 800 })), ...serie("08:07", 6, () => ({ vel: 30, rpm: 1500 }))];
    expect(montarApontamento(pts, []).trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["movimento", 12]]);
  });

  it("RPM travado o dia todo: não afirma ligado/desligado", () => {
    const pts = serie("08:00", 40, () => ({ rpm: 1316 }));
    expect(rpmTravado(pts)).toBe(1316);
    const a = montarApontamento(pts, []);
    expect(a.temRpm).toBe(false);
    expect(a.rpm_travado).toBe(1316);
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["parado", 39]]);
  });

  it("RPM 1000 fixo por menos de 6h é liga/desliga legítimo", () => {
    expect(rpmTravado(serie("08:00", 40, () => ({ rpm: 1000 })))).toBeNull();
  });

  it("buraco de mais de 10 min vira trecho sem sinal", () => {
    const pts = [...serie("08:00", 6, () => ({})), ...serie("08:30", 6, () => ({}))];
    const a = montarApontamento(pts, []);
    expect(a.trechos.map((t) => [t.estado, t.duracao_min])).toEqual([["parado", 5], ["sem_sinal", 25], ["parado", 5]]);
    expect(a.resumo).toMatchObject({ sem_sinal_min: 25, parado_min: 10 });
  });

  it("motor secundário: intervalos ligado e minutos em cada trecho", () => {
    const motor2 = serie("08:00", 7, (i) => ({ rpm: i >= 2 && i <= 4 ? 1000 : 0 }));
    expect(intervalosLigado(motor2)).toEqual([["2026-10-01 08:02:00", "2026-10-01 08:05:00"]]);
    const a = montarApontamento(serie("08:00", 10, () => ({ rpm: 800 })), [], motor2);
    expect(a.motor2).toEqual({ intervalos: [["08:02:00", "08:05:00"]] });
    expect(a.resumo?.motor2_ligado_min).toBe(3);
    expect(a.trechos[0].motor2_min).toBe(3);
    expect(a.pontos.map((p) => p[5])).toEqual([0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
  });
});

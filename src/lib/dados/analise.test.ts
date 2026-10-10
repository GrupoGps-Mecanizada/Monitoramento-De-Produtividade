import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { juntarDia, lerParadasAnalise } from "./analise";

const linha = (i: number) => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: i, fim: i + 600, lat: -19.4, lng: -42.5, area: null, motor: { stopped: 10 }, apont: [] });
function falso(linhas: unknown[]) {
  const faixas: [number, number][] = [];
  const q = {
    select: () => q,
    order: () => q,
    range: async (de: number, ate: number) => {
      faixas.push([de, ate]);
      return { data: linhas.slice(de, ate + 1), error: null };
    },
  };
  return { c: { from: () => q } as unknown as SupabaseClient, faixas };
}

describe("lerParadasAnalise", () => {
  it("lê em páginas de 1000 até acabar", async () => {
    const f = falso(Array.from({ length: 2300 }, (_, i) => linha(i)));
    expect(await lerParadasAnalise(f.c)).toHaveLength(2300);
    expect(f.faixas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("tabela vazia = lista vazia", async () => {
    expect(await lerParadasAnalise(falso([]).c)).toEqual([]);
  });
  it("formato inesperado avisa em vez de quebrar em silêncio", async () => {
    await expect(lerParadasAnalise(falso([{ dia: "2026-10-01" }]).c)).rejects.toThrow(/formato inesperado/);
  });
});

describe("releitura de hoje", () => {
  it("troca só as paradas de hoje e mantém os outros dias", () => {
    const a = (dia: string, ini: number) => ({ ...linha(ini), dia });
    const juntas = juntarDia([a("2026-10-06", 1), a("2026-10-07", 2), a("2026-10-07", 3)], "2026-10-07", [a("2026-10-07", 9)]);
    expect(juntas.map((p) => [p.dia, p.ini])).toEqual([["2026-10-06", 1], ["2026-10-07", 9]]);
  });
});


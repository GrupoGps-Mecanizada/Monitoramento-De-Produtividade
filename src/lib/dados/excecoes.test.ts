import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { lerTabletFrotaDia } from "./gauss-dia";

describe("lerTabletFrotaDia", () => {
  it("lê o tablet da frota inteira em páginas de 1000", async () => {
    const linhas = Array.from({ length: 1500 }, (_, i) => ({ placa: "EGC2985", demora_cod: i, inicio: "2026-10-07 08:00:00", fim: null, categoria_demora: "X", motorista: null, concluido: null }));
    const faixas: [number, number][] = [];
    const q = { select: () => q, lt: () => q, or: () => q, order: () => q, range: async (de: number, ate: number) => (faixas.push([de, ate]), { data: linhas.slice(de, ate + 1), error: null }) };
    const r = await lerTabletFrotaDia("2026-10-07", { from: () => q } as unknown as SupabaseClient);
    expect(r).toHaveLength(1500);
    expect(faixas).toEqual([[0, 999], [1000, 1999]]);
  });
});

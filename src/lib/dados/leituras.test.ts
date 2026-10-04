import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { lerEventos, lerRetrato } from "./leituras";

// banco falso com N eventos; registra cada faixa pedida (o Supabase entrega no máximo 1000 linhas por vez)
function falso(total: number) {
  const linhas = Array.from({ length: total }, (_, i) => ({ dados: { t: new Date(Date.UTC(2026, 9, 1, 3) + i * 1000).toISOString(), tipo: "entrada", id: String(i), placa: "A", vaga: "", area: "P", lat: 0, lng: 0 } }));
  const faixas: [number, number][] = [];
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    range: async (de: number, ate: number) => {
      faixas.push([de, ate]);
      return { data: linhas.slice(de, Math.min(ate + 1, de + 1000)), error: null };
    },
  };
  return { c: { from: () => q } as unknown as SupabaseClient, faixas };
}

describe("lerEventos", () => {
  it("dia com mais de 1000 eventos vem inteiro, em páginas (os do fim do dia não somem)", async () => {
    const f = falso(2300);
    const eventos = await lerEventos("2026-10-01", undefined, f.c);
    expect(eventos).toHaveLength(2300);
    expect(eventos.at(-1)?.id).toBe("2299");
    expect(f.faixas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("para em 5000 eventos", async () => {
    const f = falso(7000);
    expect(await lerEventos("2026-10-01", undefined, f.c)).toHaveLength(5000);
    expect(f.faixas).toHaveLength(5);
  });
});

describe("lerRetrato", () => {
  it("devolve só a frota, com o equipamento de cada veículo", async () => {
    const veiculo = (id: string, placa: string, grupo: string) => ({ id, placa, vaga: "", grupo, status: "Ligado", status_cod: 1, lat: 1, lng: 1, posicao_em: null, area: "", via: "", sem_sinal: false });
    const valor = { lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [veiculo("10", "EGC2985", "CAMINHÃO ALTA PRESSÃO"), veiculo("90", "EOF5208", "CAMINHÃO ALTA PRESSÃO")] };
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { valor }, error: null }) };
    const r = await lerRetrato({ from: () => q } as unknown as SupabaseClient);
    expect(r.veiculos.map((v) => [v.id, v.equip?.nome])).toEqual([["10", "EGC-2985"]]);
    expect(r.fora_da_lista).toEqual(["EOF5208"]);
  });
});

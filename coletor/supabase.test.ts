import { beforeEach, describe, expect, it, vi } from "vitest";

// banco falso: conta as requisições ao loc_kv
const chamadas: string[] = [];
const linhas = [{ chave: "estado", valor: { a: 1 } }];
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        in: () => (chamadas.push("in"), Promise.resolve({ data: linhas, error: null })),
        eq: () => q,
        maybeSingle: () => (chamadas.push("um"), Promise.resolve({ data: { valor: "do banco" }, error: null })),
        upsert: (l: unknown[]) => (chamadas.push(`grava ${l.length}`), Promise.resolve({ data: null, error: null })),
      };
      return q;
    },
  }),
}));

const { kvCarregar, kvGet, kvSet, kvSetVarias } = await import("./supabase");

describe("loc_kv numa requisição só", () => {
  beforeEach(() => void chamadas.splice(0));

  it("chaves carregadas vêm da memória; ausente no banco vira null; fora da lista vai ao banco", async () => {
    await kvCarregar(["estado", "carga"]);
    expect(await kvGet("estado")).toEqual({ a: 1 });
    expect(await kvGet("carga")).toBeNull();
    expect(chamadas).toEqual(["in"]);
    expect(await kvGet("outra")).toBe("do banco");
    expect(chamadas).toEqual(["in", "um"]);
  });

  it("kvSet atualiza a memória e kvSetVarias grava tudo numa requisição", async () => {
    await kvCarregar(["estado", "carga"]);
    await kvSet("carga", { n: 2 });
    expect(await kvGet("carga")).toEqual({ n: 2 });
    await kvSetVarias({ carga: 1, snapshot: 2, sessao: 3 });
    expect(chamadas).toEqual(["in", "grava 1", "grava 3"]);
  });
});

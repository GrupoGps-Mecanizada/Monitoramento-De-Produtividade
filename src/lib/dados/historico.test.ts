import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { pedirHistorico } from "./historico";

const AGORA = new Date("2026-10-01T15:00:00Z").getTime();
const resultado = { id: "10", dia: "2026-10-01", fonte: "gauss", baixado_em: "x", motor2_erro: null, temRpm: false, trechos: [], resumo: null, pontos: [], motor2: null };
const linha = (minutosAtras: number, fechado = false) => ({ resultado, fechado, baixado_em: new Date(AGORA - minutosAtras * 60000).toISOString() });

// banco falso: cada leitura de loc_historico / loc_pedidos devolve o próximo item da fila
function falso(r: { historico: (ReturnType<typeof linha> | null)[]; pedidos?: ({ status: string; erro?: string } | null)[]; erroInsert?: { code: string; message: string } }) {
  const historico = [...r.historico];
  const pedidos = [...(r.pedidos ?? [])];
  const inserts: unknown[] = [];
  const cliente = {
    from(tabela: string) {
      const q = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => ({ data: (tabela === "loc_historico" ? historico.shift() : pedidos.shift()) ?? null, error: null }),
        insert: async (l: unknown) => {
          inserts.push(l);
          return { error: r.erroInsert ?? null };
        },
      };
      return q;
    },
  };
  return { c: cliente as unknown as SupabaseClient, inserts };
}
const op = (extra = {}) => ({ agora: () => AGORA, esperar: async () => {}, ...extra });

describe("pedirHistorico", () => {
  it("dia fechado vem do banco, sem pedido", async () => {
    const f = falso({ historico: [linha(600, true)] });
    expect((await pedirHistorico("10", "2026-10-01", op(), f.c)).fonte).toBe("cache");
    expect(f.inserts).toEqual([]);
  });
  it("hoje baixado há menos de 10 min vem do banco, sem pedido", async () => {
    const f = falso({ historico: [linha(5)] });
    await pedirHistorico("10", "2026-10-01", op(), f.c);
    expect(f.inserts).toEqual([]);
  });
  it("versão antiga de hoje: mostra já e pede atualização", async () => {
    const f = falso({ historico: [linha(20)] });
    const h = await pedirHistorico("10", "2026-10-01", op(), f.c);
    expect(h.aviso).toBe("atualização pedida ao coletor");
    expect(f.inserts).toEqual([{ veiculo_id: "10", dia: "2026-10-01" }]);
  });
  it("sem nada no banco: pede e espera o coletor, avisando o andamento", async () => {
    const aoAndar = vi.fn();
    const f = falso({ historico: [null, linha(0)], pedidos: [{ status: "pendente" }, { status: "processando" }, { status: "pronto" }] });
    const h = await pedirHistorico("10", "2026-10-01", op({ aoAndar }), f.c);
    expect(h.fonte).toBe("gauss");
    expect(aoAndar.mock.calls.map((c) => c[0])).toEqual(["fila", "fila", "processando"]);
  });
  it("pedido com erro mostra a mensagem do coletor", async () => {
    const f = falso({ historico: [null], pedidos: [{ status: "erro", erro: "veículo fora do cadastro" }] });
    await expect(pedirHistorico("10", "2026-10-01", op(), f.c)).rejects.toThrow("veículo fora do cadastro");
  });
  it("pedido já em aberto (23505) não é erro", async () => {
    const f = falso({ historico: [null, linha(0)], pedidos: [{ status: "pronto" }], erroInsert: { code: "23505", message: "duplicado" } });
    expect((await pedirHistorico("10", "2026-10-01", op(), f.c)).id).toBe("10");
  });
  it("recusa id ou dia inválidos", async () => {
    await expect(pedirHistorico("abc", "2026-10-01", op(), falso({ historico: [] }).c)).rejects.toThrow("parâmetros inválidos");
  });
  it("cancelar para de esperar", async () => {
    const ctl = new AbortController();
    ctl.abort();
    await expect(pedirHistorico("10", "2026-10-01", op({ sinal: ctl.signal }), falso({ historico: [null] }).c)).rejects.toThrow("cancelado");
  });
});

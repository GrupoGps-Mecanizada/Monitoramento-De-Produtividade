import { afterEach, describe, expect, it, vi } from "vitest";

// banco falso em memória (só o loc_kv e as gravações que o ciclo de motor faz)
const kv = new Map<string, unknown>();
vi.mock("./supabase", () => {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "upsert", "select", "gte", "lt", "limit", "delete", "in"]) q[m] = () => q;
  (q as { then: unknown }).then = (r: (v: unknown) => void) => r({ data: [], error: null });
  return {
    db: () => ({ ...q, rpc: () => Promise.resolve({ data: 1, error: null }) }),
    ok: async (p: PromiseLike<{ data: unknown }>) => (await p).data,
    kvGet: async (c: string) => kv.get(c) ?? null,
    kvSet: async (c: string, v: unknown) => void kv.set(c, structuredClone(v)),
  };
});

const { VAGAS, coletarMotor, daGps } = await import("./motor-vaga");

/** GAUSS lento: cada requisição "leva" 10 s no relógio falso */
const clienteLento = () => ({
  post: async () => {
    vi.setSystemTime(Date.now() + 10_000);
    return { msg: [] };
  },
});

describe("timeline de motor na virada do dia", () => {
  afterEach(() => vi.useRealTimers());

  it("para no tempo do ciclo, guarda o que fez e a próxima execução continua de onde parou", async () => {
    const gps = VAGAS.filter(daGps);
    const ontem = "2026-10-15";
    kv.set("motor_vagas", { em: "2026-10-16T03:00:00.000Z", vagas: gps });
    kv.set("motor", { ciclo: "2026-10-16T02:55:00.000Z", versao: 2, tabletDia: ontem, vagas: Object.fromEntries(gps.map((v) => [v.id, { dia: ontem, em: "2026-10-16T02:55:00.000Z" }])) });

    vi.useFakeTimers({ toFake: ["Date"] });
    const agora = new Date("2026-10-16T03:05:00.000Z"); // 00:05 em Brasília
    vi.setSystemTime(agora);
    const r1 = await coletarMotor(clienteLento() as never, [], agora);
    // cada vaga = 2 requisições (ontem e hoje) = 20 s: em 3 min cabem ~10, nunca todas
    expect(Date.now() - agora.getTime()).toBeLessThan(4 * 60_000);
    expect(r1).toMatch(/para a próxima execução/);
    const c1 = kv.get("motor") as { ciclo: string; vagas: Record<string, { dia: string }> };
    const feitas1 = Object.values(c1.vagas).filter((v) => v.dia === "2026-10-16").length;
    expect(feitas1).toBeGreaterThan(0);
    expect(c1.ciclo).toBe("2026-10-16T02:55:00.000Z"); // não marcou o ciclo: a próxima não espera 10 min

    // próxima execução, 5 min depois: segue com as que faltam
    const agora2 = new Date(agora.getTime() + 5 * 60_000);
    vi.setSystemTime(agora2);
    await coletarMotor(clienteLento() as never, [], agora2);
    const c2 = kv.get("motor") as { vagas: Record<string, { dia: string }> };
    expect(Object.values(c2.vagas).filter((v) => v.dia === "2026-10-16").length).toBeGreaterThan(feitas1);
  });
});

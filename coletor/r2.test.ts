import { describe, expect, it } from "vitest";
import { guardarRota, r2Configurado } from "./r2";

describe("R2", () => {
  it("sem os segredos fica desligado e não tenta enviar", async () => {
    expect(r2Configurado({})).toBe(false);
    expect(r2Configurado({ R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET: "d" })).toBe(true);
    expect(await guardarRota("2026-10-07", "10", [], {})).toBe(false);
  });
});

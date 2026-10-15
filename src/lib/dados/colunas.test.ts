import { describe, expect, it } from "vitest";
import { colunasAlertas } from "./colunas";

describe("colunas da tabela alertas", () => {
  it("sem login não pede visto_por (o e-mail do gestor não é público)", () => {
    expect(colunasAlertas(false)).not.toMatch(/visto_por/);
    expect(colunasAlertas(false)).toMatch(/visto_em/);
  });
  it("com login pede visto_por", () => expect(colunasAlertas(true)).toMatch(/visto_por/));
});

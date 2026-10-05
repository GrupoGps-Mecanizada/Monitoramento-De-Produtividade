import { describe, expect, it } from "vitest";
import { medidaValida, opcaoValida } from "./hooks";

describe("preferência de várias opções", () => {
  const OPCOES = ["fina", "normal", "alta"] as const;
  it("aceita só uma das opções; o resto volta ao padrão", () => {
    expect(opcaoValida("alta", OPCOES, "normal")).toBe("alta");
    expect(opcaoValida(null, OPCOES, "normal")).toBe("normal");
    expect(opcaoValida("1", OPCOES, "normal")).toBe("normal");
  });
});

describe("medida guardada (altura do painel)", () => {
  it("vale só número dentro dos limites; o resto volta ao padrão", () => {
    expect(medidaValida("220", 60, 500, 170)).toBe(220);
    expect(medidaValida(null, 60, 500, 170)).toBe(170);
    expect(medidaValida("abc", 60, 500, 170)).toBe(170);
    expect(medidaValida("900", 60, 500, 170)).toBe(170);
  });
});

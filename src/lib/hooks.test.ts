import { describe, expect, it } from "vitest";
import { opcaoValida } from "./hooks";

describe("preferência de várias opções", () => {
  const OPCOES = ["fina", "normal", "alta"] as const;
  it("aceita só uma das opções; o resto volta ao padrão", () => {
    expect(opcaoValida("alta", OPCOES, "normal")).toBe("alta");
    expect(opcaoValida(null, OPCOES, "normal")).toBe("normal");
    expect(opcaoValida("1", OPCOES, "normal")).toBe("normal");
  });
});

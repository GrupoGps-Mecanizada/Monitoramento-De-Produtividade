import { describe, expect, it } from "vitest";
import { posicionarBalao } from "./balao";

const tela = { width: 1000, height: 800 };
const b = { width: 200, height: 50 };

describe("posição do balão", () => {
  it("fica em cima, centrado na âncora, quando cabe", () => {
    expect(posicionarBalao({ left: 400, top: 100, width: 20, height: 20 }, b, tela, "cima")).toEqual({ left: 310, top: 44, lado: "cima" });
  });
  it("sem espaço em cima, vai para baixo", () => {
    expect(posicionarBalao({ left: 400, top: 20, width: 20, height: 20 }, b, tela, "cima")).toEqual({ left: 310, top: 46, lado: "baixo" });
  });
  it("pedido embaixo sem espaço embaixo: vai para cima", () => {
    expect(posicionarBalao({ left: 400, top: 760, width: 20, height: 20 }, b, tela, "baixo")).toEqual({ left: 310, top: 704, lado: "cima" });
  });
  it("encosta na margem em vez de sair pela direita ou pela esquerda", () => {
    expect(posicionarBalao({ left: 990, top: 100, width: 20, height: 20 }, b, tela, "cima").left).toBe(792);
    expect(posicionarBalao({ left: 0, top: 100, width: 10, height: 20 }, b, tela, "cima").left).toBe(8);
  });
  it("balão maior que a tela fica preso na margem de cima", () => {
    expect(posicionarBalao({ left: 400, top: 100, width: 20, height: 20 }, { width: 200, height: 900 }, tela, "cima").top).toBe(8);
  });
});

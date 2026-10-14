import { describe, expect, it } from "vitest";
import { RAMPA_AZUL, corDaFaixa, textoSobreFaixa } from "./cores-analise";

describe("cores da análise", () => {
  it("texto branco nos tons escuros da rampa, escuro nos claros (pela cor real, não pelo número da faixa)", () => {
    // 2 faixas: a 2ª já é o azul mais escuro
    expect(corDaFaixa(1, 2)).toBe(RAMPA_AZUL[4]);
    expect(textoSobreFaixa(1, 2)).toBe("#fff");
    expect(textoSobreFaixa(0, 2)).toBe("#0d1b2a");
    // 5 faixas: as duas mais claras com texto escuro
    expect([0, 1, 2, 3, 4].map((i) => textoSobreFaixa(i, 5))).toEqual(["#0d1b2a", "#0d1b2a", "#fff", "#fff", "#fff"]);
  });
});

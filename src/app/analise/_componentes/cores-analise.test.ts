import { describe, expect, it } from "vitest";
import { corDaFamilia, corDoApontamento, corDoStatus, fundoDaFaixa, opacidadeDaFaixa, textoDaFaixa } from "./cores-analise";

describe("cores da análise", () => {
  it("mapa na cor da medida: a força do tom cresce com a faixa; uma faixa só fica no meio", () => {
    expect([0, 1, 2, 3, 4].map((i) => opacidadeDaFaixa(i, 5))).toEqual([0.25, 0.4, 0.55, 0.7, 0.85]);
    expect(opacidadeDaFaixa(0, 1)).toBe(0.55);
    expect(opacidadeDaFaixa(1, 2)).toBe(0.85);
  });
  it("status com a cor da Timeline (o tom do GAUSS); desconhecido em cinza", () => {
    expect(corDoStatus("on")).toBe("var(--ok-dot)");
    expect(corDoStatus("stopped")).toBe("var(--warn-dot)");
    expect(corDoStatus("secondary_motor_on")).toBe("var(--motor2)");
    expect(corDoStatus("off")).toBe("var(--bad-dot)");
    expect(corDoStatus("maintenance")).toBe("var(--na-dot)");
    expect(corDoStatus("xyz")).toBe("var(--neu-dot)");
  });
  it("família com cor fixa; o apontamento leva a cor da família dele", () => {
    expect(corDaFamilia("aguardando")).toBe("var(--serie-2)");
    expect(corDaFamilia("sem")).toBe("var(--neu-dot)");
    expect(corDoApontamento("Refeição Motorista")).toBe("var(--serie-3)");
    expect(corDoApontamento("Documentação")).toBe("var(--serie-4)");
  });
  it("faixas na cor da medida: mais forte quanto maior; texto claro só nos tons fortes de cor escura", () => {
    expect(fundoDaFaixa(0, 5, "var(--motor2)")).toBe("color-mix(in srgb, var(--motor2) 22%, var(--superficie))");
    expect(fundoDaFaixa(4, 5, "var(--motor2)")).toBe("color-mix(in srgb, var(--motor2) 100%, var(--superficie))");
    expect(fundoDaFaixa(0, 1, "var(--motor2)")).toBe("color-mix(in srgb, var(--motor2) 60%, var(--superficie))");
    expect([textoDaFaixa(4, 5, "var(--serie-1)"), textoDaFaixa(1, 5, "var(--serie-1)"), textoDaFaixa(4, 5, "var(--warn-dot)")]).toEqual(["#fff", "var(--texto)", "#0d1b2a"]);
  });
});

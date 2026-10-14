import { describe, expect, it } from "vitest";
import { MENU, telaAtiva } from "./menu";

describe("tela ativa", () => {
  it("considera a barra final do endereço (trailingSlash)", () => {
    expect(telaAtiva("/", "/")).toBe(true);
    expect(telaAtiva("/timeline/", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline/", "/")).toBe(false);
    expect(telaAtiva("/alertas/", "/timeline")).toBe(false);
  });
  it("Dia da frota depois da Localização, Análise e Cronoanálise logo depois; Equipamentos logo depois da Timeline", () => {
    expect(MENU.map((m) => m.href)).toEqual(["/", "/frota", "/analise", "/cronoanalise", "/timeline", "/equipamentos", "/alertas"]);
    expect(telaAtiva("/frota/", "/frota")).toBe(true);
  });
});

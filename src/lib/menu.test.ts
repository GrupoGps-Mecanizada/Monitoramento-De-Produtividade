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
  it("Dia da frota está no menu, depois da Localização", () => {
    expect(MENU.map((m) => m.href)).toEqual(["/", "/frota", "/timeline", "/alertas"]);
    expect(telaAtiva("/frota/", "/frota")).toBe(true);
  });
});

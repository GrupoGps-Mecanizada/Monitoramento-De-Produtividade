import { describe, expect, it } from "vitest";
import { CATEGORIAS, MENU, categoriaAtiva, telaAtiva, telasDa } from "./menu";

describe("tela ativa", () => {
  it("considera a barra final do endereço (trailingSlash)", () => {
    expect(telaAtiva("/", "/")).toBe(true);
    expect(telaAtiva("/timeline/", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline", "/timeline")).toBe(true);
    expect(telaAtiva("/timeline/", "/")).toBe(false);
    expect(telaAtiva("/alertas/", "/timeline")).toBe(false);
  });
  it("Dia da frota depois da Localização, Análise e Cronoanálise logo depois; Equipamentos logo depois da Timeline", () => {
    expect(MENU.map((m) => m.href)).toEqual(["/", "/frota", "/analise", "/cronoanalise", "/timeline", "/equipamentos", "/alertas", "/gestao-alertas"]);
    expect(telaAtiva("/frota/", "/frota")).toBe(true);
  });
});

describe("categorias do menu", () => {
  it("cada tela está em uma categoria só: Ao vivo, Análises e Cadastros", () => {
    expect(CATEGORIAS.map((c) => c.rotulo)).toEqual(["Ao vivo", "Análises", "Cadastros"]);
    const todas = CATEGORIAS.flatMap((c) => c.telas);
    expect([...todas].sort()).toEqual(MENU.map((m) => m.href).sort());
    expect(new Set(todas).size).toBe(todas.length);
    expect(telasDa(CATEGORIAS[1]).map((m) => m.rotulo)).toEqual(["Análise", "Dia da frota", "Timeline", "Cronoanálise"]);
  });
  it("Gestão de alertas fica em Ao vivo, depois de Alertas", () => {
    expect(telasDa(CATEGORIAS[0]).map((m) => m.rotulo)).toEqual(["Localização", "Alertas", "Gestão de alertas"]);
    expect(categoriaAtiva("/gestao-alertas/")?.id).toBe("ao-vivo");
  });
  it("categoria da tela aberta (com a barra no fim do endereço)", () => {
    expect(categoriaAtiva("/cronoanalise/")?.id).toBe("analises");
    expect(categoriaAtiva("/")?.id).toBe("ao-vivo");
    expect(categoriaAtiva("/equipamentos/")?.id).toBe("cadastros");
  });
});

import { describe, expect, it } from "vitest";
import { CATEGORIAS, telasDa } from "./menu";
import { destinoForaDoPortal, ePortalAntigo, recarregarPortalAntigo, secoesParaPortal } from "./portal";

describe("portal novo: telas do Controle de Frota no menu em árvore", () => {
  it("as 3 partes (Ao vivo, Análises, Cadastros) com as 9 telas (Usina 3D e Gestão de alertas entraram) e o endereço completo, com barra no fim", () => {
    const s = secoesParaPortal(CATEGORIAS.map((c) => ({ rotulo: c.rotulo, telas: telasDa(c) })), "/Monitoramento-De-Produtividade");
    expect(s.map((x) => x.rotulo)).toEqual(["Ao vivo", "Análises", "Cadastros"]);
    expect(s.flatMap((x) => x.itens ?? []).length).toBe(9);
    expect(s[0].itens?.[0]).toEqual({ rotulo: "Localização", href: "/Monitoramento-De-Produtividade/" });
    expect(s[1].itens?.find((i) => i.rotulo === "Timeline")?.href).toBe("/Monitoramento-De-Produtividade/timeline/");
  });
});

describe("um visual só: aberto por fora vai para o portal", () => {
  it("no endereço do portal, fora de moldura: #/u/<caminho>", () => {
    expect(destinoForaDoPortal("https://sge-portal.pages.dev/Monitoramento-De-Produtividade/timeline/", false, false)).toBe(
      "https://sge-portal.pages.dev/#/u/" + encodeURIComponent("/Monitoramento-De-Produtividade/timeline/"),
    );
  });
  it("fica: moldura, aberto pelo portal (sge_fora), github.io, localhost ou endereço inválido", () => {
    expect(destinoForaDoPortal("https://sge-portal.pages.dev/Monitoramento-De-Produtividade/", true, false)).toBeNull();
    expect(destinoForaDoPortal("https://sge-portal.pages.dev/Monitoramento-De-Produtividade/", false, true)).toBeNull();
    expect(destinoForaDoPortal("https://sge-portal.pages.dev/Monitoramento-De-Produtividade/?sge_fora=1", false, false)).toBeNull();
    expect(destinoForaDoPortal("https://grupogps-mecanizada.github.io/Monitoramento-De-Produtividade/", false, false)).toBeNull();
    expect(destinoForaDoPortal("http://localhost:3000/", false, false)).toBeNull();
    expect(destinoForaDoPortal("nada", false, false)).toBeNull();
  });
});

describe("portal antigo aberto: recarrega para o novo", () => {
  it("reconhece o antigo (sem versão) e deixa o novo em paz", () => {
    expect(ePortalAntigo({ registrarBarra() {} })).toBe(true);
    expect(ePortalAntigo({ registrarBarra() {}, versao: 2 })).toBe(false);
    expect(ePortalAntigo(null)).toBe(false);
  });
  it("recarrega a página de cima uma vez só (trava de 2 min)", () => {
    const guardado: Record<string, string> = {};
    let recarregou = 0;
    const topo = {
      SGEPortal: { registrarBarra() {} } as { registrarBarra(): void; versao?: number },
      sessionStorage: { getItem: (k: string) => guardado[k] ?? null, setItem: (k: string, v: string) => { guardado[k] = v; } },
      location: { reload: () => { recarregou++; } },
    };
    const janela = { top: topo } as unknown as Window;
    expect(recarregarPortalAntigo(janela)).toBe(true);
    expect(recarregarPortalAntigo(janela)).toBe(false);
    expect(recarregou).toBe(1);
    topo.SGEPortal.versao = 2;
    delete guardado.sge_recarregou_portal;
    expect(recarregarPortalAntigo(janela)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, REGRAS_PADRAO } from "./config";
import { destinoDaNota, notaDoAlerta, type ContextoNota } from "./nota";
import { comJustificativa, deConfig, paraConfig, temJustificativa, type RegraSimples } from "./simples";

const P = POLITICA_PADRAO;
const ctx = (excessoMin: number): ContextoNota => ({ excessoMin, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false });
const destino = (s: RegraSimples, min: number) => {
  const c = paraConfig(s, REGRAS_PADRAO[s.regra], P);
  return destinoDaNota(notaDoAlerta(c, ctx(min), P).nota, P);
};

describe("ler a configuração no formato simples", () => {
  it("padrões: saída tarde e desligado vão ao WhatsApp com tolerância; ociosidade só resumo; Servitec só tela", () => {
    expect(deConfig(REGRAS_PADRAO.saida_tarde, P)).toEqual({ regra: "saida_tarde", ativa: true, nivel: "whatsapp", whatsappApos: 15, coordenadorApos: 30 });
    expect(deConfig(REGRAS_PADRAO.desligado, P)).toMatchObject({ nivel: "whatsapp", whatsappApos: 60, coordenadorApos: 120 });
    expect(deConfig(REGRAS_PADRAO.ocioso, P)).toMatchObject({ nivel: "resumo", whatsappApos: null, coordenadorApos: null });
    expect(deConfig(REGRAS_PADRAO.servitec, P)).toMatchObject({ nivel: "tela" });
  });
});

describe("gravar o formato simples", () => {
  const st: RegraSimples = { regra: "saida_tarde", ativa: true, nivel: "whatsapp", whatsappApos: 15, coordenadorApos: 30 };
  it("WhatsApp após 15 min e coordenador após 30: abaixo vai ao resumo, depois WhatsApp, depois coordenador", () => {
    expect(destino(st, 10)).toBe("resumo");
    expect(destino(st, 20)).toBe("whatsapp");
    expect(notaDoAlerta(paraConfig(st, REGRAS_PADRAO.saida_tarde, P), ctx(40), P).nota).toBeGreaterThanOrEqual(P.corte_coordenador);
  });
  it("WhatsApp sem tolerância: sempre WhatsApp", () => expect(destino({ ...st, whatsappApos: null, coordenadorApos: null }, 1)).toBe("whatsapp"));
  it("só resumo e só tela", () => {
    expect(destino({ ...st, nivel: "resumo" }, 90)).toBe("resumo");
    expect(destino({ ...st, nivel: "tela" }, 90)).toBe("tela");
  });
  it("ida e volta: ler o que gravou dá o mesmo", () => {
    for (const s of [st, { ...st, whatsappApos: null }, { ...st, coordenadorApos: null }, { ...st, nivel: "resumo" as const, whatsappApos: null, coordenadorApos: null }, { ...st, ativa: false }])
      expect(deConfig(paraConfig(s, REGRAS_PADRAO.saida_tarde, P), P)).toEqual(s);
  });
  it("mantém as justificativas e o lembrete da regra", () => {
    const c = paraConfig(st, { ...REGRAS_PADRAO.saida_tarde, lembrete_min: 90 }, P);
    expect(c.lembrete_min).toBe(90);
    expect(c.justificativas).toEqual(REGRAS_PADRAO.saida_tarde.justificativas);
  });
});

describe("apontamento no tablet", () => {
  it("ligar e desligar para a regra", () => {
    expect(temJustificativa(REGRAS_PADRAO.desligado)).toBe(true);
    expect(temJustificativa(comJustificativa(REGRAS_PADRAO.desligado, false))).toBe(false);
    expect(temJustificativa(comJustificativa(comJustificativa(REGRAS_PADRAO.desligado, false), true))).toBe(true);
  });
});

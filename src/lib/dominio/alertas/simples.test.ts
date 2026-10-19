import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, REGRAS_PADRAO } from "./config";
import { destinoDaNota, notaDoAlerta, type ContextoNota } from "./nota";
import { comJustificativa, deConfig, frase, paraConfig, temJustificativa, type RegraSimples } from "./simples";

const P = POLITICA_PADRAO;
const ctx = (excessoMin: number): ContextoNota => ({ excessoMin, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false });
const destino = (s: RegraSimples, min: number) => {
  const c = paraConfig(s, REGRAS_PADRAO[s.regra], P);
  return destinoDaNota(notaDoAlerta(c, ctx(min), P).nota, P);
};

describe("ler a configuração no formato simples", () => {
  it("padrões: saída tarde e desligado vão ao WhatsApp com tolerância; ociosidade só resumo; Servitec só tela", () => {
    expect(deConfig(REGRAS_PADRAO.saida_tarde, P)).toEqual({ regra: "saida_tarde", ativa: true, nivel: "whatsapp", apos: 15, coordenadorApos: 30 });
    expect(deConfig(REGRAS_PADRAO.desligado, P)).toMatchObject({ nivel: "whatsapp", apos: 60, coordenadorApos: 120 });
    expect(deConfig(REGRAS_PADRAO.ocioso, P)).toMatchObject({ nivel: "resumo", apos: null, coordenadorApos: null });
    expect(deConfig(REGRAS_PADRAO.servitec, P)).toMatchObject({ nivel: "tela" });
  });
});

describe("gravar o formato simples", () => {
  const st: RegraSimples = { regra: "saida_tarde", ativa: true, nivel: "whatsapp", apos: 15, coordenadorApos: 30 };
  it("WhatsApp após 15 min e coordenador após 30: abaixo vai ao resumo, depois WhatsApp, depois coordenador", () => {
    expect(destino(st, 10)).toBe("resumo");
    expect(destino(st, 20)).toBe("whatsapp");
    expect(notaDoAlerta(paraConfig(st, REGRAS_PADRAO.saida_tarde, P), ctx(40), P).nota).toBeGreaterThanOrEqual(P.corte_coordenador);
  });
  it("WhatsApp sem tolerância: sempre WhatsApp", () => expect(destino({ ...st, apos: null, coordenadorApos: null }, 1)).toBe("whatsapp"));
  it("só resumo e só tela", () => {
    expect(destino({ ...st, nivel: "resumo" }, 90)).toBe("resumo");
    expect(destino({ ...st, nivel: "tela" }, 90)).toBe("tela");
  });
  it("ida e volta: ler o que gravou dá o mesmo", () => {
    for (const s of [st, { ...st, apos: null }, { ...st, coordenadorApos: null }, { ...st, nivel: "resumo" as const, apos: null, coordenadorApos: null }, { ...st, ativa: false }])
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

describe("resumo só depois de um tempo", () => {
  const oc: RegraSimples = { regra: "ocioso", ativa: true, nivel: "resumo", apos: 45, coordenadorApos: null };
  it("abaixo fica só na tela; depois vai ao resumo; ida e volta igual", () => {
    expect(destino(oc, 40)).toBe("tela");
    expect(destino(oc, 50)).toBe("resumo");
    expect(deConfig(paraConfig(oc, REGRAS_PADRAO.ocioso, P), P)).toEqual(oc);
  });
});

describe("frases", () => {
  it("desligado com WhatsApp e coordenador", () => {
    expect(frase({ regra: "desligado", ativa: true, nivel: "whatsapp", apos: 60, coordenadorApos: 120 }, "07:00")).toEqual({
      oque: "Motor desligado por mais de 1 h",
      destino: ["WhatsApp para o supervisor da vaga", "depois de 2 h, também o coordenador"],
    });
  });
  it("saída tarde com atraso; ociosidade no resumo das 7h; Servitec só na tela", () => {
    expect(frase({ regra: "saida_tarde", ativa: true, nivel: "whatsapp", apos: 15, coordenadorApos: null }, "07:00").oque).toBe("Saída tarde do Pátio, mais de 15 min de atraso");
    expect(frase({ regra: "ocioso", ativa: true, nivel: "resumo", apos: null, coordenadorApos: null }, "07:00:00")).toEqual({ oque: "Ociosidade por mais de 30 min", destino: ["só no resumo diário das 07:00"] });
    expect(frase({ regra: "servitec", ativa: true, nivel: "tela", apos: null, coordenadorApos: null }, "07:00").destino).toEqual(["só aparece na tela"]);
  });
  it("restaurante tira o '1 h' do nome e usa o tempo escolhido", () => {
    expect(frase({ regra: "restaurante", ativa: true, nivel: "resumo", apos: 90, coordenadorApos: null }, "07:00").oque).toBe("Restaurante por mais de 1 h 30 min");
  });
});

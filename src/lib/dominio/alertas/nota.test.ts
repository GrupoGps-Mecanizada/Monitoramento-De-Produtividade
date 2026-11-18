import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import { destinoDaNota, excessoMin, notaDoAlerta, type ContextoNota } from "./nota";

const H = 3600;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "saida_tarde", veiculo: "1", ini: 0, fim: null, ref: 0, local: null, detalhe: "", gravidade: "alerta", ...o });
const ctx = (o: Partial<ContextoNota> = {}): ContextoNota => ({ excessoMin: 0, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false, ...o });

describe("excesso em minutos", () => {
  it("saída tarde: saiu depois do limite", () => expect(excessoMin(exc({ ini: 8 * H + 10 * 60, ref: 7 * H + 45 * 60 }), null)).toBe(25));
  it("saída tarde: ainda não saiu conta até agora", () => expect(excessoMin(exc({ ini: 7 * H, ref: 7 * H }), 8 * H)).toBe(60));
  it("chegada cedo: quanto antes do limite", () => expect(excessoMin(exc({ regra: "chegada_cedo", ini: 16 * H, ref: 16 * H + 30 * 60 }), null)).toBe(30));
  it("desligado: a duração", () => expect(excessoMin(exc({ regra: "desligado", ini: 10 * H, fim: 11 * H + 10 * 60, ref: 10 * H }), null)).toBe(70));
});

describe("nota do alerta", () => {
  const st = REGRAS_PADRAO.saida_tarde;
  it("saída tarde 10 min: só o peso (35) -> resumo", () => {
    const n = notaDoAlerta(st, ctx({ excessoMin: 10 }));
    expect(n.nota).toBe(35);
    expect(destinoDaNota(n.nota, POLITICA_PADRAO)).toBe("resumo");
  });
  it("saída tarde 25 min: 35 + 30 = 65 -> WhatsApp", () => expect(notaDoAlerta(st, ctx({ excessoMin: 25 })).nota).toBe(65));
  it("saída tarde 40 min: 35 + 55 = 90 (coordenador)", () => expect(notaDoAlerta(st, ctx({ excessoMin: 40 })).nota).toBe(90));
  it("exatamente no limite da faixa não sobe (acima de)", () => expect(notaDoAlerta(st, ctx({ excessoMin: 15 })).nota).toBe(35));
  it("repetição: a 2ª vez não muda; da 3ª em diante sobe um nível (+30)", () => {
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, repeticoes: 1 })).nota).toBe(35);
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, repeticoes: 2 })).nota).toBe(65);
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, repeticoes: 4 })).motivos.at(-1)?.texto).toBe("5ª vez na semana nesta vaga: sobe um nível");
  });
  it("justificativa no tablet: vai só para o resumo (a nota desce até o corte do resumo, nunca abaixo)", () => {
    const n = notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, familias: ["manutencao", "aguardando", "sem"] }), POLITICA_PADRAO);
    expect(n.nota).toBe(30);
    expect(n.motivos.map((m) => m.pontos)).toEqual([40, 25, -35]);
    expect(n.motivos.at(-1)?.texto).toBe("Apontado no tablet (Manutenção e clima): vai só para o resumo");
    // já abaixo do resumo: a justificativa não tira mais nada
    expect(notaDoAlerta(REGRAS_PADRAO.servitec, ctx({ familias: ["manutencao"] }), POLITICA_PADRAO).motivos).toHaveLength(1);
  });
  it("justificativa desligada na regra (sem valores): não mexe", () => {
    expect(notaDoAlerta({ ...REGRAS_PADRAO.desligado, justificativas: {} }, ctx({ excessoMin: 70, familias: ["manutencao"] })).nota).toBe(65);
  });
  it("sem sinal em mais da metade: -40; regime presumido: -10", () => {
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, fracaoSemSinal: 0.6 })).nota).toBe(25);
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 70, fracaoSemSinal: 0.5 })).nota).toBe(65);
    expect(notaDoAlerta(st, ctx({ excessoMin: 10, presumido: true })).nota).toBe(25);
  });
  it("fica entre 0 e 100", () => {
    expect(notaDoAlerta(REGRAS_PADRAO.servitec, ctx({ presumido: true, fracaoSemSinal: 1 })).nota).toBe(0);
    expect(notaDoAlerta(REGRAS_PADRAO.desligado, ctx({ excessoMin: 300, repeticoes: 5 })).nota).toBe(100);
  });
  it("cada parte vira um motivo legível", () => {
    const n = notaDoAlerta(st, ctx({ excessoMin: 25, repeticoes: 1 }));
    expect(n.motivos.map((m) => m.texto)).toEqual(["Peso da regra", "Passou de 15 min"]);
  });
});

describe("destino pelos cortes", () => {
  it("60+ WhatsApp, 30+ resumo, abaixo tela", () => {
    expect(destinoDaNota(60, POLITICA_PADRAO)).toBe("whatsapp");
    expect(destinoDaNota(59, POLITICA_PADRAO)).toBe("resumo");
    expect(destinoDaNota(29, POLITICA_PADRAO)).toBe("tela");
  });
});

describe("configuração do banco por cima dos padrões", () => {
  it("muda só o que veio e ignora regra desconhecida", () => {
    const c = configCompleta([{ regra: "ocioso", peso: 70 }, { regra: "inventada" as never, peso: 1 }]);
    expect(c.ocioso.peso).toBe(70);
    expect(c.ocioso.justificativas).toEqual(REGRAS_PADRAO.ocioso.justificativas);
    expect(c.desligado).toEqual(REGRAS_PADRAO.desligado);
  });
});

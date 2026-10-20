import { describe, expect, it } from "vitest";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import { normalizarTelefone, simular, sugestoes, type AlertaGravado } from "./gestao";

const D = "2026-10-07";
const al = (o: Partial<AlertaGravado> = {}): AlertaGravado => ({
  id: 1, chave: "k", regra: "saida_tarde", veiculo_id: "1", placa: "EGC2985", vaga: "AP-02", supervisor: null, dia: D, ini: 0, fim: null, ref: 0, local: null, detalhe: "",
  situacao: "aberto", nota: 65, motivos: [], destino: "whatsapp", contagem: 1, resolvido_em: null, resolvido_por: null, atualizado_em: "", avaliacao: null, visto_por: null,
  visto_em: null, ultimo_aviso_em: null, detectado_em: "", contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

describe("simulador", () => {
  it("mesma configuração: nada muda", () => {
    const s = simular([al(), al({ id: 2, regra: "ocioso", nota: 30, destino: "resumo", contexto: { excessoMin: 40, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false } })], REGRAS_PADRAO, POLITICA_PADRAO);
    expect(s).toMatchObject({ total: 2, mudaram: 0, antes: { whatsapp: 1, resumo: 1, tela: 0 }, depois: { whatsapp: 1, resumo: 1, tela: 0 } });
  });
  it("peso menor na saída tarde: sai do WhatsApp para o resumo", () => {
    const s = simular([al()], configCompleta([{ regra: "saida_tarde", peso: 5 }]), POLITICA_PADRAO);
    expect(s.depois).toEqual({ whatsapp: 0, resumo: 1, tela: 0 });
    expect(s.mudaram).toBe(1);
    expect(s.porRegra).toEqual([{ regra: "saida_tarde", antes: 1, depois: 0 }]);
  });
  it("corte do WhatsApp mais alto", () => expect(simular([al()], REGRAS_PADRAO, { ...POLITICA_PADRAO, corte_whatsapp: 70 }).depois.whatsapp).toBe(0));
  it("regra desligada: vai para 'só tela'", () => expect(simular([al()], configCompleta([{ regra: "saida_tarde", ativa: false }]), POLITICA_PADRAO).depois.tela).toBe(1));
  it("alerta antigo sem contexto: igual antes e depois", () => {
    const s = simular([al({ contexto: null })], configCompleta([{ regra: "saida_tarde", peso: 5 }]), POLITICA_PADRAO);
    expect(s.depois.whatsapp).toBe(1);
    expect(s.mudaram).toBe(0);
  });
});

describe("sugestões", () => {
  const avaliados = (n: number, nao: number, regra = "ocioso") =>
    Array.from({ length: n }, (_, i) => al({ id: i, regra, avaliacao: i < nao ? "nao_era_problema" : "problema" }));
  it("10 avaliações com 60% 'não era problema': sugere", () => {
    const [s] = sugestoes(avaliados(10, 6), D);
    expect(s).toMatchObject({ regra: "ocioso", avaliados: 10, fracao: 0.6 });
    expect(s.texto).toMatch(/60% dos alertas de "Ligado sem produzir"/);
  });
  it("menos de 10 avaliações ou menos de 60%: não sugere", () => {
    expect(sugestoes(avaliados(9, 9), D)).toEqual([]);
    expect(sugestoes(avaliados(10, 5), D)).toEqual([]);
  });
  it("avaliações com mais de 30 dias não contam", () => {
    expect(sugestoes(avaliados(10, 10).map((a) => ({ ...a, dia: "2026-09-01" })), D)).toEqual([]);
  });
});

describe("telefone", () => {
  it("só dígitos, com 55", () => {
    expect(normalizarTelefone("(31) 98888-7777")).toBe("5531988887777");
    expect(normalizarTelefone("+55 31 3333-4444")).toBe("553133334444");
    expect(normalizarTelefone("5531988887777")).toBe("5531988887777");
  });
  it("inválido: null", () => {
    expect(normalizarTelefone("9888-7777")).toBeNull();
    expect(normalizarTelefone("")).toBeNull();
  });
});

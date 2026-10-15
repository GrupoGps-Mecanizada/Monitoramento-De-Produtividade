import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import type { Evento } from "../../tipos";
import { familiasNoPeriodo, fracaoSemSinal, janelaDoAlerta, repeticoes, type HistoricoAlerta } from "./contexto";

const D = "2026-10-07";
const H = 3600;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "desligado", veiculo: "1", ini: 10 * H, fim: 11 * H, ref: 10 * H, local: null, detalhe: "", gravidade: "alerta", ...o });
const tab = (placa: string, ini: string, fim: string | null, cat: string) => ({ placa, demora_cod: 1, inicio: `${D} ${ini}:00`, fim: fim ? `${D} ${fim}:00` : null, categoria_demora: cat, motorista: null, concluido: null });
const ev = (tipo: string, hora: string, id = "1") => ({ id, tipo, t: `${D}T${hora}:00-03:00`, area: "", placa: "", vaga: "" }) as unknown as Evento;

describe("janela do alerta", () => {
  it("desligado: do início ao fim", () => expect(janelaDoAlerta(exc({}))).toEqual({ a: 10 * H, b: 11 * H }));
  it("saída tarde: do limite até a saída", () => expect(janelaDoAlerta(exc({ regra: "saida_tarde", ini: 8 * H, fim: null, ref: 7 * H }))).toEqual({ a: 7 * H, b: 8 * H }));
  it("chegada cedo: da chegada até o limite", () => expect(janelaDoAlerta(exc({ regra: "chegada_cedo", ini: 16 * H, fim: null, ref: 16 * H + 1800 }))).toEqual({ a: 16 * H, b: 16 * H + 1800 }));
  it("instante (ainda não saiu): pelo menos 1 min", () => expect(janelaDoAlerta(exc({ regra: "saida_tarde", ini: 7 * H, fim: null, ref: 7 * H }))).toEqual({ a: 7 * H, b: 7 * H + 60 }));
});

describe("famílias do tablet no período", () => {
  const j = { a: 10 * H, b: 11 * H };
  it("placa com hífen no tablet vale para a placa sem hífen", () => {
    expect(familiasNoPeriodo([tab("EGC-2985", "10:20", "10:40", "Pequenas manutenções")], "EGC2985", D, j)).toEqual(["manutencao"]);
  });
  it("fora do período ou de outra placa não conta", () => {
    expect(familiasNoPeriodo([tab("EGC2985", "11:00", "11:30", "Aguardando Área"), tab("XYZ1234", "10:10", "10:20", "Aguardando Área")], "EGC2985", D, j)).toEqual([]);
  });
  it("apontamento ainda aberto (sem fim) conta", () => {
    expect(familiasNoPeriodo([tab("EGC2985", "09:00", null, "Aguardando Área")], "EGC2985", D, j)).toEqual(["aguardando"]);
  });
});

describe("fração sem sinal", () => {
  const j = { a: 10 * H, b: 12 * H };
  it("perdeu 10:30 e voltou 11:30: metade", () => expect(fracaoSemSinal([ev("sinal_perdido", "10:30"), ev("sinal_retomado", "11:30")], "1", D, j)).toBe(0.5));
  it("perdeu e nunca voltou: até o fim do período", () => expect(fracaoSemSinal([ev("sinal_perdido", "11:00")], "1", D, j)).toBe(0.5));
  it("já estava sem sinal antes do período", () => expect(fracaoSemSinal([ev("sinal_perdido", "09:00"), ev("sinal_retomado", "11:00")], "1", D, j)).toBe(0.5));
  it("outro veículo não conta", () => expect(fracaoSemSinal([ev("sinal_perdido", "10:00", "2")], "1", D, j)).toBe(0));
});

describe("repetições na mesma vaga em 7 dias", () => {
  const h = (dia: string, chave: string, vaga = "AP-02", regra = "desligado"): HistoricoAlerta => ({ chave, regra, vaga, dia, situacao: "resolvido", resolvido_em: null, contagem: 1 });
  it("conta outras ocorrências da mesma regra e vaga, dentro de 7 dias, sem contar a própria", () => {
    const hist = [h("2026-10-01", "a"), h("2026-10-06", "b"), h("2026-10-07", "atual"), h("2026-10-05", "c", "AP-03"), h("2026-10-05", "d", "AP-02", "ocioso"), h("2026-09-30", "e")];
    expect(repeticoes(hist, "desligado", "AP-02", D, "atual")).toBe(2);
  });
});

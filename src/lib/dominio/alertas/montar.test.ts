import { describe, expect, it } from "vitest";
import type { Excecao } from "../excecoes";
import type { Veiculo } from "../../tipos";
import { POLITICA_PADRAO, REGRAS_PADRAO, configCompleta } from "./config";
import type { HistoricoAlerta } from "./contexto";
import { chaveDoAlerta, montarAlertas, situacaoNova, type EntradaMontar } from "./montar";

const D = "2026-10-07";
const H = 3600;
const veic = (id: string, placa: string, vaga: string, regime: string | null = "ADM"): Veiculo =>
  ({ id, placa, vaga, equip: { tipo: "ap", nome: placa, ordem: 1, regime, status: "ATIVO", supervisor: "Da Matriz" } }) as unknown as Veiculo;
const exc = (o: Partial<Excecao>): Excecao => ({ regra: "desligado", veiculo: "1", ini: 10 * H, fim: 11 * H + 10 * 60, ref: 10 * H, local: "ALTO FORNO 3", detalhe: "1 h 10 min", gravidade: "alerta", ...o });
const entrada = (o: Partial<EntradaMontar> = {}): EntradaMontar => ({
  dia: D, agoraSeg: 12 * H, agoraIso: "2026-10-07T15:00:00.000Z", excecoes: [exc({})], veiculos: [veic("1", "EGC2985", "ALTA PRESSÃO - GPS - 02")],
  tablet: [], eventos: [], historico: [], silencios: [], regras: REGRAS_PADRAO, politica: POLITICA_PADRAO, ...o,
});
const hist = (chave: string, situacao: HistoricoAlerta["situacao"], o: Partial<HistoricoAlerta> = {}): HistoricoAlerta => ({ chave, regra: "desligado", vaga: "ALTA PRESSÃO - GPS - 02", dia: D, situacao, resolvido_em: null, contagem: 3, ...o });

describe("chave", () => {
  it("regra|veiculo|dia|ref", () => expect(chaveDoAlerta(exc({}), D)).toBe(`desligado|1|${D}|36000`));
});

describe("situação", () => {
  it("resolvido e silenciado não voltam a abrir", () => {
    expect(situacaoNova("resolvido", false, false)).toBe("resolvido");
    expect(situacaoNova("silenciado", false, false)).toBe("silenciado");
  });
  it("silêncio vale sobre aberto e visto", () => expect(situacaoNova("visto", false, true)).toBe("silenciado"));
  it("terminou -> resolvido; visto fica visto; novo -> aberto", () => {
    expect(situacaoNova("aberto", true, false)).toBe("resolvido");
    expect(situacaoNova("visto", false, false)).toBe("visto");
    expect(situacaoNova(null, false, false)).toBe("aberto");
  });
});

describe("montar alertas", () => {
  it("desligado de 70 min terminado há mais de 10 min: resolvido, nota 65, WhatsApp, supervisor pela vaga", () => {
    const [a] = montarAlertas(entrada());
    expect(a).toMatchObject({ chave: `desligado|1|${D}|36000`, placa: "EGC2985", supervisor: "Junior Pereira", situacao: "resolvido", nota: 65, destino: "whatsapp", contagem: 1, resolvido_em: "2026-10-07T15:00:00.000Z" });
  });
  it("ainda acontecendo (fim = agora): aberto", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60 }));
    expect(a.situacao).toBe("aberto");
    expect(a.resolvido_em).toBeNull();
  });
  it("rodar de novo com o mesmo dado: mesma chave, contagem sobe, nada novo", () => {
    const um = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60 }));
    const dois = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(um[0].chave, "aberto", { contagem: 1 })] }));
    expect(dois.map((x) => x.chave)).toEqual(um.map((x) => x.chave));
    expect(dois[0].contagem).toBe(2);
  });
  it("saída tarde: 'não saiu' e depois 'saiu' caem na mesma chave", () => {
    const antes = montarAlertas(entrada({ excecoes: [exc({ regra: "saida_tarde", ini: 7 * H + 45 * 60, fim: null, ref: 7 * H + 45 * 60, detalhe: "não saiu do Pátio" })] }));
    const depois = montarAlertas(entrada({ excecoes: [exc({ regra: "saida_tarde", ini: 8 * H + 10 * 60, fim: null, ref: 7 * H + 45 * 60, detalhe: "saiu 08:10" })] }));
    expect(depois[0].chave).toBe(antes[0].chave);
  });
  it("resolvido pelo gestor não reabre e guarda a data de resolução", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(`desligado|1|${D}|36000`, "resolvido", { resolvido_em: "2026-10-07T14:30:00.000Z" })] }));
    expect(a.situacao).toBe("resolvido");
    expect(a.resolvido_em).toBe("2026-10-07T14:30:00.000Z");
  });
  it("silêncio do equipamento ainda valendo: silenciado; vencido: não", () => {
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: "1", regra: null, ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("silenciado");
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: "1", regra: null, ate: "2026-10-07T10:00:00.000Z" }] }))[0].situacao).toBe("aberto");
  });
  it("silêncio só da regra vale para todos os equipamentos; de outra regra não", () => {
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: null, regra: "desligado", ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("silenciado");
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, silencios: [{ veiculo_id: null, regra: "ocioso", ate: "2026-10-08T00:00:00.000Z" }] }))[0].situacao).toBe("aberto");
  });
  it("regra desligada não gera alerta", () => {
    expect(montarAlertas(entrada({ regras: configCompleta([{ regra: "desligado", ativa: false }]) }))).toEqual([]);
  });
  it("veículo fora da lista (desmobilizado) não gera alerta", () => {
    expect(montarAlertas(entrada({ veiculos: [] }))).toEqual([]);
  });
  it("regime presumido tira 10 pontos e aparece nos motivos", () => {
    const [a] = montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", "ALTA PRESSÃO - GPS - 02", null)] }));
    expect(a.nota).toBe(55);
    expect(a.motivos.at(-1)?.texto).toBe("Regime presumido (ADM)");
  });
  it("dia fechado (agoraSeg null): tudo resolvido", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: null, excecoes: [exc({ regra: "saida_tarde", ini: 8 * H, fim: null, ref: 7 * H + 45 * 60 })] }));
    expect(a.situacao).toBe("resolvido");
  });
});

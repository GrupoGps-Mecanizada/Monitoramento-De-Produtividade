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
const hist = (chave: string, situacao: HistoricoAlerta["situacao"], o: Partial<HistoricoAlerta> = {}): HistoricoAlerta => ({ chave, regra: "desligado", vaga: "ALTA PRESSÃO - GPS - 02", dia: D, ref: 10 * H, situacao, resolvido_em: null, resolvido_por: null, contagem: 3, ...o });

describe("chave", () => {
  it("regra|veiculo|dia|ref", () => expect(chaveDoAlerta(exc({}), D)).toBe(`desligado|1|${D}|36000`));
});

describe("situação", () => {
  it("resolvido pelo gestor e silenciado não voltam a abrir", () => {
    expect(situacaoNova("resolvido", "gestor", false, false)).toBe("resolvido");
    expect(situacaoNova("silenciado", null, false, false)).toBe("silenciado");
  });
  it("resolvido automático reabre se o problema continua", () => expect(situacaoNova("resolvido", "auto", false, false)).toBe("aberto"));
  it("silêncio vale sobre aberto e visto", () => expect(situacaoNova("visto", null, false, true)).toBe("silenciado"));
  it("terminou -> resolvido; visto fica visto; novo -> aberto", () => {
    expect(situacaoNova("aberto", null, true, false)).toBe("resolvido");
    expect(situacaoNova("visto", null, false, false)).toBe("visto");
    expect(situacaoNova(null, null, false, false)).toBe("aberto");
  });
});

describe("montar alertas", () => {
  it("desligado com fim parado há 30 min: continua aberto (o coletor pula a vaga desligada por até 1 h)", () => {
    expect(montarAlertas(entrada({ agoraSeg: 11 * H + 40 * 60 }))[0].situacao).toBe("aberto");
  });
  it("resolvido automático que volta a aparecer: reabre e limpa a data de resolução", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(`desligado|1|${D}|36000`, "resolvido", { resolvido_em: "2026-10-07T14:30:00.000Z", resolvido_por: "auto" })] }));
    expect(a).toMatchObject({ situacao: "aberto", resolvido_em: null, resolvido_por: null });
  });
  it("ainda não saiu com manutenção apontada depois do limite: a justificativa derruba a nota", () => {
    const tablet = [{ placa: "EGC2985", demora_cod: 1, inicio: `${D} 08:00:00`, fim: null, categoria_demora: "Pequenas manutenções", motorista: null, concluido: null }];
    const [a] = montarAlertas(entrada({ agoraSeg: 8 * H + 30 * 60, tablet, excecoes: [exc({ regra: "saida_tarde", ini: 7 * H + 45 * 60, fim: null, ref: 7 * H + 45 * 60, detalhe: "não saiu do Pátio" })] }));
    // pela regra do filtro simples: com justificativa no tablet vai só para o resumo (nota no corte do resumo)
    expect(a.nota).toBe(30);
  });
  it("desligado de 70 min terminado há mais de 70 min: resolvido, nota 65, WhatsApp, supervisor pela vaga", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 13 * H }));
    expect(a).toMatchObject({ chave: `desligado|1|${D}|36000`, placa: "EGC2985", supervisor: "Junior Pereira", situacao: "resolvido", nota: 65, destino: "whatsapp", contagem: 1, resolvido_em: "2026-10-07T15:00:00.000Z", resolvido_por: "auto" });
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
    const [a] = montarAlertas(entrada({ agoraSeg: 11 * H + 10 * 60, historico: [hist(`desligado|1|${D}|36000`, "resolvido", { resolvido_em: "2026-10-07T14:30:00.000Z", resolvido_por: "gestor" })] }));
    expect(a.situacao).toBe("resolvido");
    expect(a.resolvido_por).toBe("gestor");
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
  it("vaga que a Mecanizada não opera (sem vaga, Brook): não gera alerta", () => {
    expect(montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", "[S/ VAGA]")] }))).toEqual([]);
    expect(montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", "CAMINHÃO BROOK - GPS - 03")] }))).toEqual([]);
  });
  it("veículo fora da lista (desmobilizado) não gera alerta", () => {
    expect(montarAlertas(entrada({ veiculos: [] }))).toEqual([]);
  });
  it("vaga das 22 sem HS e matriz em branco: ADM confirmado, sem tirar pontos (antes ficava 55 e nunca ia ao WhatsApp)", () => {
    const [a] = montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", "ALTA PRESSÃO - GPS - 02", null)] }));
    expect(a.nota).toBe(65);
    expect(a.destino).toBe("whatsapp");
    expect(a.motivos.some((m) => m.texto.startsWith("Regime presumido"))).toBe(false);
  });
  it("grava o contexto da nota (o simulador recalcula com ele)", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 13 * H }));
    expect(a.contexto).toEqual({ excessoMin: 70, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false });
  });
  it("dia fechado (agoraSeg null): tudo resolvido", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: null, excecoes: [exc({ regra: "saida_tarde", ini: 8 * H, fim: null, ref: 7 * H + 45 * 60 })] }));
    expect(a.situacao).toBe("resolvido");
  });
});

describe("vaga do trecho (troca de caminhão na vaga)", () => {
  const AP01 = "ALTA PRESSÃO - GPS - 01 - 24 HS";
  it("vaga, filtro das 22 vagas e supervisor vêm da vaga em que o caminhão estava, não da de agora", () => {
    const [a] = montarAlertas(entrada({ excecoes: [exc({ vaga: AP01 })], veiculos: [veic("1", "EGC2985", "[S/ VAGA]")] }));
    const [naVaga] = montarAlertas(entrada({ veiculos: [veic("1", "EGC2985", AP01)] }));
    expect(a?.vaga).toBe(AP01);
    expect(a?.supervisor).toBe(naVaga.supervisor);
  });
  it("troca de escala do 4x4: o alerta que continua depois das 18:40 já vai com o supervisor da letra da noite", () => {
    // 07/10/2026: dia é a letra D (Fabio), noite é a letra A (Ozias)
    const veiculos = [veic("1", "EGC2985", AP01)];
    const [vira] = montarAlertas(entrada({ agoraSeg: 19 * H + 20 * 60, veiculos, excecoes: [exc({ vaga: AP01, ini: 18 * H + 20 * 60, fim: 19 * H + 20 * 60, ref: 18 * H + 20 * 60 })] }));
    expect(vira.supervisor).toBe("Ozias");
    // o que acabou antes da troca fica com quem estava no turno
    const [antes] = montarAlertas(entrada({ agoraSeg: 19 * H + 20 * 60, veiculos, excecoes: [exc({ vaga: AP01, ini: 17 * H, fim: 18 * H + 10 * 60, ref: 17 * H })] }));
    expect(antes.supervisor).toBe("Fabio");
  });
  it("trecho numa vaga que a Mecanizada não opera: sem alerta, mesmo com o caminhão agora numa das 22", () => {
    expect(montarAlertas(entrada({ excecoes: [exc({ vaga: "[S/ VAGA]" })], veiculos: [veic("1", "EGC2985", AP01)] }))).toEqual([]);
  });
});

describe("mesmo desligado com o início ajustado: não vira alerta novo (não manda duas vezes)", () => {
  // o ao vivo viu desligado às 02:30; a timeline do GAUSS chega depois e diz 02:27
  const R0 = 2 * H + 30 * 60;
  const velho = hist(`desligado|1|${D}|${R0}`, "aberto", { ref: R0, contagem: 4 });
  const novo = (o: Partial<Excecao> = {}) => exc({ ini: 2 * H + 27 * 60, ref: 2 * H + 27 * 60, fim: 4 * H + 9 * 60, ...o });
  it("início um pouco antes, mesmo caminhão e regra: fica na chave do alerta já gravado", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 4 * H + 20 * 60, excecoes: [novo()], historico: [velho] }));
    expect(a.chave).toBe(velho.chave);
    expect(a.contagem).toBe(5);
    expect(a.ref).toBe(2 * H + 27 * 60);
  });
  it("depois de gravado com o início novo, continua na mesma chave", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 4 * H + 30 * 60, excecoes: [novo()], historico: [{ ...velho, ref: 2 * H + 27 * 60 }] }));
    expect(a.chave).toBe(velho.chave);
  });
  it("resolvido pelo gestor continua resolvido com o início ajustado", () => {
    const [a] = montarAlertas(entrada({ agoraSeg: 4 * H + 20 * 60, excecoes: [novo()], historico: [{ ...velho, situacao: "resolvido", resolvido_por: "gestor", resolvido_em: "2026-10-07T07:00:00.000Z" }] }));
    expect(a).toMatchObject({ chave: velho.chave, situacao: "resolvido", resolvido_por: "gestor" });
  });
  it("outro desligado (depois do fim do primeiro), outro caminhão, outra regra ou outro dia: chave própria", () => {
    const outro = (e: Excecao, h: HistoricoAlerta[] = [velho]) => montarAlertas(entrada({ agoraSeg: 6 * H, excecoes: [e], historico: h }))[0]?.chave;
    expect(outro(novo({ ini: 4 * H + 11 * 60, ref: 4 * H + 11 * 60, fim: 5 * H + 30 * 60 }))).toBe(`desligado|1|${D}|${4 * H + 11 * 60}`);
    expect(outro(novo(), [{ ...velho, chave: `desligado|2|${D}|${R0}` }])).toBe(`desligado|1|${D}|${2 * H + 27 * 60}`);
    expect(outro(novo({ regra: "ocioso" }))).toBe(`ocioso|1|${D}|${2 * H + 27 * 60}`);
    expect(outro(novo(), [{ ...velho, dia: "2026-10-06", chave: `desligado|1|2026-10-06|${R0}` }])).toBe(`desligado|1|${D}|${2 * H + 27 * 60}`);
  });
  it("começo bem depois, mas no meio do horário do alerta gravado: o mesmo alerta (o GAUSS dividiu o trecho)", () => {
    // caso real de 20/10/2026 (EGC2985): gravado 08:26-09:34; o GAUSS mostrou parada apontada 08:29-08:49 e o desligado virou 08:49-10:13
    const gravado = hist(`desligado|1|${D}|${8 * H + 26 * 60}`, "aberto", { ref: 8 * H + 26 * 60, fim: 9 * H + 34 * 60 });
    const [a] = montarAlertas(entrada({ agoraSeg: 10 * H + 15 * 60, excecoes: [exc({ ini: 8 * H + 49 * 60, ref: 8 * H + 49 * 60, fim: 10 * H + 13 * 60 })], historico: [gravado] }));
    expect(a.chave).toBe(gravado.chave);
    // sem sobrepor (começa depois do fim gravado + folga): alerta próprio
    const [b] = montarAlertas(entrada({ agoraSeg: 11 * H, excecoes: [exc({ ini: 9 * H + 50 * 60, ref: 9 * H + 50 * 60, fim: 10 * H + 55 * 60 })], historico: [gravado] }));
    expect(b.chave).toBe(`desligado|1|${D}|${9 * H + 50 * 60}`);
  });
  it("saída tarde e chegada cedo não entram nisso (o ref delas já é o horário-limite)", () => {
    const e = exc({ regra: "saida_tarde", ini: 7 * H + 50 * 60, fim: null, ref: 7 * H + 45 * 60 });
    const h = hist(`saida_tarde|1|${D}|${7 * H + 40 * 60}`, "aberto", { regra: "saida_tarde", ref: 7 * H + 40 * 60 });
    expect(montarAlertas(entrada({ excecoes: [e], historico: [h] }))[0].chave).toBe(`saida_tarde|1|${D}|${7 * H + 45 * 60}`);
  });
  it("nunca duas linhas com a mesma chave (o banco recusaria o lote inteiro)", () => {
    // dois trechos encostados no mesmo alerta velho: só o primeiro herda a chave
    const xs = montarAlertas(entrada({ agoraSeg: 6 * H, historico: [velho], excecoes: [novo({ fim: 2 * H + 35 * 60 }), novo({ ini: 2 * H + 36 * 60, ref: 2 * H + 36 * 60, fim: 4 * H })] }));
    expect(xs).toHaveLength(2);
    expect(new Set(xs.map((x) => x.chave)).size).toBe(2);
    expect(xs[0].chave).toBe(velho.chave);
  });
});

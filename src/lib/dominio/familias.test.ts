import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { equipDaFrota, montarLocais, type ParadaAnalise } from "./analise";
import {
  SEM_SUPERVISOR, apontNovos, familiaDe, frases, normalizar, paradasDaFamilia, porApontamento, porDia, rankingPlacas, rankingSupervisores,
} from "./familias";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [{ name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) }];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", supervisor: string | undefined): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor, regime: "ADM" } }) as Veiculo;
const equip = equipDaFrota([v("1", "EGC2985", "ap", "OZIAS"), v("2", "EGC2993", "av", "ISRAEL"), v("3", "EAM3257", "hv", undefined)]);
const usina = AREAS[0].polygon;
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });
const montar = (ps: ParadaAnalise[]) => montarLocais(ps, AREAS, equip, usina);

// a1 2h Aguardando Área; a2 1h variação do nome + Refeição; a3 30 min semáforo (outro caminhão); b1 DDS sem " - LM"; b2 apontamento novo; b3 sem apontamento
const { paradas, locais } = montar([
  p({ apont: ["Aguardando Área"], ini: 14 * H, fim: 16 * H }),
  p({ dia: "2026-10-03", apont: ["AGUARDANDO AREA", "Refeição Motorista"], ini: 15 * H, fim: 16 * H }),
  p({ dia: "2026-10-03", veiculo_id: "2", placa: "EGC2993", apont: ["Aguardando semáforo/cancela"], ini: 8 * H, fim: 8 * H + 1800 }),
  p({ apont: ["DDS/Check-List"], ini: 6 * H, fim: 7 * H }),
  p({ apont: ["Lavagem de pátio"], ini: 9 * H, fim: 10 * H }),
  p({ veiculo_id: "3", placa: "EAM3257", ini: 20 * H, fim: 21 * H }),
]);
const aguardando = paradasDaFamilia(paradas, "aguardando");

describe("famílias de apontamento", () => {
  it("nome normalizado: sem acento, minúsculo, espaços simples e sem ' - LM'", () => {
    expect(normalizar("  DDS/Check-List   - LM ")).toBe("dds/check-list");
    expect(normalizar("Aguardando Área")).toBe(normalizar("AGUARDANDO AREA"));
  });
  it("os 18 apontamentos do tablet caem na família certa; novo vai para Manutenção e clima", () => {
    const esperado: [string, string][] = [
      ["Aguardando Área", "aguardando"], ["Aguardando semáforo/cancela", "aguardando"], ["Aguardando Auto Vácuo descarregar", "aguardando"], ["Aguardando carreta bascular", "aguardando"],
      ["Refeição Motorista", "pausas"], ["Pausas Diversas (água, banheiro)", "pausas"], ["Inicio de turno", "pausas"], ["DDS/Check-List - LM", "pausas"], ["Abordagem de Segurança", "pausas"],
      ["Abastecimento (Água) - LM", "logistica"], ["Abastecimento (Combustível)", "logistica"], ["Descarregando equipamento", "logistica"], ["Troca de Equipamento", "logistica"],
      ["Documentação", "preparacao"], ["Preparação - LM", "preparacao"], ["Bloqueio - LM", "preparacao"],
      ["Pequenas manutenções", "manutencao"], ["Condições Climáticas (chuva, etc)", "manutencao"],
      ["Lavagem de pátio", "manutencao"],
    ];
    for (const [nome, f] of esperado) expect([nome, familiaDe(nome)]).toEqual([nome, f]);
  });
  it("paradas da família: a parada com 2 famílias entra nas duas; 'sem' = sem apontamento", () => {
    expect(aguardando.map((x) => x.ini)).toEqual([14 * H, 15 * H, 8 * H]);
    expect(paradasDaFamilia(paradas, "pausas").map((x) => x.ini)).toEqual([15 * H, 6 * H]);
    expect(paradasDaFamilia(paradas, "manutencao").map((x) => x.ini)).toEqual([9 * H]);
    expect(paradasDaFamilia(paradas, "sem").map((x) => x.placa)).toEqual(["EAM3257"]);
    expect(paradasDaFamilia(paradas, "logistica")).toEqual([]);
  });
  it("apontamentos novos (fora da tabela)", () => {
    expect(apontNovos(paradas)).toEqual(["Lavagem de pátio"]);
  });
  it("por apontamento: variações do nome somam juntas, do maior tempo ao menor; repetido na mesma parada conta 1 vez", () => {
    expect(porApontamento(paradas, "aguardando")).toEqual([
      { nome: "Aguardando Área", n: 2, min: 180 },
      { nome: "Aguardando semáforo/cancela", n: 1, min: 30 },
    ]);
    const rep = montar([p({ apont: ["Aguardando Área", "Aguardando Área - LM"] })]).paradas;
    expect(porApontamento(rep, "aguardando")).toEqual([{ nome: "Aguardando Área", n: 1, min: 60 }]);
  });
  it("quem mais para: placas e supervisores com horas, paradas e média", () => {
    expect(rankingPlacas(aguardando)).toEqual([
      { chave: "EGC2985", nome: "EGC2985", n: 2, min: 180, media: 90 },
      { chave: "EGC2993", nome: "EGC2993", n: 1, min: 30, media: 30 },
    ]);
    expect(rankingSupervisores(paradas).map((r) => [r.nome, r.min, r.n, r.media])).toEqual([
      ["OZIAS", 300, 4, 75],
      [SEM_SUPERVISOR, 60, 1, 60],
      ["ISRAEL", 30, 1, 30],
    ]);
    expect(rankingPlacas(aguardando, 1)).toHaveLength(1);
  });
  it("por dia: um item por dia do período, dia sem parada = 0", () => {
    expect(porDia(aguardando, "2026-10-03", 3)).toEqual([
      { dia: "2026-10-01", min: 120 },
      { dia: "2026-10-02", min: 0 },
      { dia: "2026-10-03", min: 90 },
    ]);
  });
});

describe("frases automáticas", () => {
  const base = { rotulo: "Aguardando", atual: aguardando, anterior: null, dias: 30, hoje: "2026-10-08", locais };
  it("sem período anterior (30 dias): total, concentração, pico e lugar", () => {
    expect(frases(base)).toEqual([
      "Aguardando somou 3h30 em 3 paradas.",
      "A placa EGC2985 sozinha soma 86% do tempo.",
      "O pico é das 14h às 16h.",
      "Onde mais acontece: ALTO FORNO 3, 3h30.",
    ]);
  });
  it("com período anterior: compara a média por dia, sem o dia de hoje (incompleto); anterior zerado não compara", () => {
    // atual: 210 min em 01/10 e 03/10; hoje = 08/10 → 6 dias completos = 35 min/dia
    const ant = (min: number) => paradasDaFamilia(montar([p({ dia: "2026-09-28", apont: ["Aguardando Área"], ini: 0, fim: min * 60 })]).paradas, "aguardando");
    const sete = { ...base, dias: 7, hoje: "2026-10-08" };
    expect(frases({ ...sete, anterior: ant(196) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, 25% a mais por dia que nos 7 dias anteriores.");
    expect(frases({ ...sete, anterior: ant(490) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, 50% a menos por dia que nos 7 dias anteriores.");
    expect(frases({ ...sete, anterior: ant(245) })[0]).toBe("Aguardando somou 3h30 em 3 paradas, igual por dia aos 7 dias anteriores.");
    expect(frases({ ...sete, anterior: [] })[0]).toBe("Aguardando somou 3h30 em 3 paradas.");
  });
  it("as paradas de hoje entram no total, mas não na comparação", () => {
    const comHoje = [...aguardando, ...paradasDaFamilia(montar([p({ dia: "2026-10-08", apont: ["Aguardando Área"], ini: 0, fim: 600 * 60 })]).paradas, "aguardando")];
    const ant = paradasDaFamilia(montar([p({ dia: "2026-09-28", apont: ["Aguardando Área"], ini: 0, fim: 245 * 60 })]).paradas, "aguardando");
    expect(frases({ ...base, atual: comHoje, dias: 7, hoje: "2026-10-08", anterior: ant })[0]).toBe("Aguardando somou 13h30 em 4 paradas, igual por dia aos 7 dias anteriores.");
  });
  it("concentração de até 20% não vira frase; 1 parada no singular", () => {
    const cinco = paradasDaFamilia(montar(["P1", "P2", "P3", "P4", "P5"].map((placa) => p({ placa, apont: ["Aguardando Área"] }))).paradas, "aguardando");
    const f = frases({ ...base, atual: cinco });
    expect(f.some((x) => x.startsWith("A placa"))).toBe(false);
    expect(frases({ ...base, atual: aguardando.slice(0, 1) })[0]).toBe("Aguardando somou 2h00 em 1 parada.");
  });
  it("sem paradas: nenhuma frase", () => {
    expect(frases({ ...base, atual: [] })).toEqual([]);
  });
});

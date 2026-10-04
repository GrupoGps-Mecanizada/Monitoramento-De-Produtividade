import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../tipos";
import { agruparFrota, estadoDoStatus, montarDiaFrota } from "./dia-frota";

const DIA = "2026-10-01";
const iso = (hm: string) => new Date(`${DIA}T${hm}:00`).toISOString();
const min = (hm: string) => Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3));
const v = (o: Partial<Veiculo>): Veiculo => ({
  id: "10", placa: "EGC2985", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "Desligado", status_cod: 2,
  status_desde: null, lat: 1, lng: 1, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false,
  equip: { tipo: "ap", nome: "EGC-2985", ordem: 11 }, ...o,
});
const base = { id: "10", placa: "EGC2985", vaga: "" };
const abertura = (hm: string, status: string, area = "PATIO", sem_sinal = false): Evento => ({ ...base, t: iso(hm), tipo: "abertura", status, area, sem_sinal });
const status = (hm: string, de: string, para: string): Evento => ({ ...base, t: iso(hm), tipo: "status", de, para, area: "PATIO", duracao_min: null });
const linha = (es: Evento[], o: { hoje?: boolean; agora?: string; veiculo?: Partial<Veiculo> } = {}) =>
  montarDiaFrota(es, [v(o.veiculo ?? {})], DIA, o.agora ? new Date(iso(o.agora)).getTime() : 0, !!o.hoje)[0];
const resumo = (l: ReturnType<typeof linha>) => l.faixas.map((f) => [f.de, f.ate, f.estado]);

describe("estado pelo texto do status do GAUSS", () => {
  it("mapeia", () => {
    expect(["Ligado", "Parado ligado", "Desligado", "Chave geral desligada", "Em manutenção", "Aguardando manutenção", "Sem comunicação +6h", "Disponível"].map(estadoDoStatus)).toEqual(
      ["ligado", "ligado", "desligado", "desligado", "manut", "manut", "sem_sinal", "desligado"],
    );
  });
});

describe("faixa de um equipamento no dia", () => {
  it("com abertura do dia", () => {
    const l = linha([abertura("00:02", "Desligado"), status("08:00", "Desligado", "Ligado"), status("10:00", "Ligado", "Desligado")]);
    expect(resumo(l)).toEqual([[0, min("08:00"), "desligado"], [min("08:00"), min("10:00"), "ligado"], [min("10:00"), 1440, "desligado"]]);
    expect(l.ligado_min).toBe(120);
    expect(l.agora).toBeNull();
  });
  it("sem abertura: o estado da meia-noite vem do 'de' do primeiro status", () => {
    expect(resumo(linha([status("08:00", "Ligado", "Desligado")]))).toEqual([[0, min("08:00"), "ligado"], [min("08:00"), 1440, "desligado"]]);
  });
  it("sem evento em dia passado: sem registro (nunca inventa)", () => {
    const l = linha([]);
    expect(resumo(l)).toEqual([[0, 1440, "sem_registro"]]);
    expect(l.ligado_min).toBe(0);
  });
  it("sem evento hoje: o status atual vale desde a meia-noite, até agora", () => {
    const l = linha([], { hoje: true, agora: "10:00", veiculo: { status: "Ligado", status_cod: 1 } });
    expect(resumo(l)).toEqual([[0, min("10:00"), "ligado"]]);
    expect(l.agora).toBe("ligado");
  });
  it("sinal perdido no meio fica 'sem sinal' por cima do status", () => {
    const es: Evento[] = [abertura("00:01", "Ligado"), { ...base, t: iso("09:00"), tipo: "sinal_perdido", ultima_posicao: null, area: "PATIO" }, { ...base, t: iso("11:00"), tipo: "sinal_retomado", area: "PATIO", sem_sinal_min: 120 }];
    expect(resumo(linha(es))).toEqual([[0, min("09:00"), "ligado"], [min("09:00"), min("11:00"), "sem_sinal"], [min("11:00"), 1440, "ligado"]]);
  });
  it("manutenção", () => {
    expect(resumo(linha([abertura("00:01", "Desligado"), status("07:00", "Desligado", "Em manutenção")]))).toEqual([[0, min("07:00"), "desligado"], [min("07:00"), 1440, "manut"]]);
  });
  it("área de cada pedaço pelas entradas e saídas", () => {
    const es: Evento[] = [abertura("00:01", "Desligado", ""), { ...base, t: iso("08:00"), tipo: "entrada", area: "PATIO 80", lat: 0, lng: 0 }, { ...base, t: iso("09:00"), tipo: "saida", area: "PATIO 80", desde: null, permanencia_min: 60 }];
    expect(linha(es).faixas.map((f) => [f.de, f.area])).toEqual([[0, ""], [min("08:00"), "PATIO 80"], [min("09:00"), ""]]);
  });
  it("ignora eventos do motor 2º e veículos sem equipamento; ordem da planilha", () => {
    const es: Evento[] = [{ ...status("08:00", "Desligado", "Ligado"), id: "11", motor2: true, principal_id: "10" }];
    const vs = [v({}), v({ id: "40", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } }), v({ id: "11", motor2_de: "10" }), v({ id: "90", equip: undefined }), v({ id: "5", equip: { tipo: "ap", nome: "CZC-0453", ordem: 1 } })];
    const ls = montarDiaFrota(es, vs, DIA, 0, false);
    expect(ls.map((l) => l.id)).toEqual(["5", "10", "40"]);
    expect(ls[1].faixas.map((f) => f.estado)).toEqual(["sem_registro"]);
  });
});

describe("agrupar por tipo", () => {
  it("cabeçalho com contagem de agora e ordem por tempo ligado", () => {
    const ls = montarDiaFrota(
      [abertura("00:01", "Ligado"), { ...abertura("00:01", "Desligado"), id: "5" }],
      [v({}), v({ id: "5", equip: { tipo: "ap", nome: "CZC-0453", ordem: 1 } }), v({ id: "40", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } })],
      DIA, new Date(iso("06:00")).getTime(), true,
    );
    const g = agruparFrota(ls, "mais");
    expect(g.map((x) => x.tipo)).toEqual(["ap", "as"]);
    expect(g[0].linhas.map((l) => l.id)).toEqual(["10", "5"]);
    expect([g[0].agoraLigados, g[0].agoraDesligados, g[0].ligado_min]).toEqual([1, 1, 360]);
  });
});

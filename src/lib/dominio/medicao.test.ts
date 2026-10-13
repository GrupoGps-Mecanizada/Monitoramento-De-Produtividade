import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  conferencia, dataBr, dfDaFrota, dfDoDia, diaSeguinte, fmtDf, fmtH, horaEvento, horasDe, lerBoletim, motivoDe, motivoPrincipal, motor2PorDia,
  ordenarVagas, placasDoCiclo, porMotivo, rotuloBoletim, MOTIVOS, type HorasPorMotivo, type LinhaListaBoletim,
} from "./medicao";

const linha: LinhaListaBoletim = { cod: "B1", identification: "GPS  2026-10  (agrupado)", initial_date: "16/09/2026", final_date: "08/10/2026", status: "<i class='fa fa-lock'></i>" };
const vagaGauss = (o: Record<string, unknown> = {}) => ({
  vacancy_code: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", regime_name: "24h-12 GPS (Novo)", CHM: "551:37", total_indisponibilidade: "23:55:00", DF: "95,66",
  price_time: "R$ 10,00", total_expectative: "R$ 0,00", beneficiary_name: "FULANO DE TAL",
  json_data_indisponibility: JSON.stringify([
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 06:55", end_sql: "2026-09-16 07:00:00", type_indisp: "Ausência de operador#3", approved_time_: "0.083333333333333" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 07:25:26", end_sql: "2026-09-16 07:51:10", type_indisp: "Área de manutenção - PÁTIO DO TRANSPORTE RODOVIÁRIO#1", approved_time_: "0.43" },
    // repetido: entra uma vez
    { vehicle_name: "EAM-3253", start_sql: "2026-09-16 07:25:26", end_sql: "2026-09-16 07:51:10", type_indisp: "Área de manutenção - PÁTIO DO TRANSPORTE RODOVIÁRIO#1", approved_time_: "0.43" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-17 10:00", end_sql: "2026-09-17 11:00", type_indisp: "Indisp. lançada manual #9", approved_time_: "1" },
    { vehicle_name: "EAM-3253", start_sql: "2026-09-17 12:00", end_sql: "2026-09-17 12:30", type_indisp: "Tipo novo do GAUSS#4", approved_time_: "0.5" },
    // sem horário e sem tipo: fora
    { vehicle_name: "EAM-3253", start_sql: "", end_sql: "", type_indisp: "Fora da planta#2", approved_time_: "1" },
    { total: "23:55" },
  ]),
  availability_json_data: JSON.stringify([
    { day: "16/09/2026", vehicle_name: "EAM-3253", regime_util_: 6.3833333333333, indip_total_: "0", beneficiary_name: "FULANO DE TAL" },
    { day: "16/09/2026", vehicle_name: "S/ Apropriação", regime_util_: "17.6", indip_total_: "1.43" },
    { day: "17/09/2026", vehicle_name: "BDVE [Identificação: ]", regime_util_: "24", indip_total_: "1.5" },
    { day: "", regime_util_: "551" },
  ]),
  ...o,
});
const zeros = (): HorasPorMotivo => Object.fromEntries(MOTIVOS.map((m) => [m.chave, 0])) as HorasPorMotivo;

describe("horasDe", () => {
  it("aceita h:mm, h:mm:ss e número com vírgula ou ponto; vazio vira 0", () => {
    expect(horasDe("551:37")).toBeCloseTo(551.6167, 4);
    expect(horasDe("23:55:00")).toBeCloseTo(23.9167, 4);
    expect(horasDe("95,66")).toBe(95.66);
    expect(horasDe("0.25")).toBe(0.25);
    expect(horasDe(1.5)).toBe(1.5);
    for (const v of ["", null, undefined, "--"]) expect(horasDe(v)).toBe(0);
  });
});

describe("motivoDe", () => {
  it("cada tipo do GAUSS cai no seu motivo; tipo desconhecido vai para Outros", () => {
    expect(motivoDe("Ausência de operador")).toBe("ausencia_operador");
    expect(motivoDe("Área de manutenção - OFICINA CENTRO")).toBe("area_manutencao");
    expect(motivoDe("Fora da planta")).toBe("fora_planta");
    expect(motivoDe("Indisp. Movimentação")).toBe("trajeto");
    expect(motivoDe("Indisp. lançada manual")).toBe("lancada");
    expect(motivoDe("Cartão RFID")).toBe("cartao_rfid");
    expect(motivoDe("Motor desligado")).toBe("motor_desligado");
    expect(motivoDe("Parado ligado")).toBe("parado_ligado");
    expect(motivoDe("Tipo novo do GAUSS")).toBe("outros");
  });
});

describe("lerBoletim", () => {
  const lido = lerBoletim(linha, [vagaGauss()]);
  it("boletim com datas em aaaa-mm-dd e nome sem espaços duplos", () => {
    expect(lido.boletim).toEqual({ cod: "B1", identificacao: "GPS 2026-10 (agrupado)", inicio: "2026-09-16", fim: "2026-10-08" });
  });
  it("vaga: totais oficiais dos campos do GAUSS e motivos pela soma dos eventos", () => {
    const v = lido.vagas[0];
    expect(v).toMatchObject({ boletim_cod: "B1", vaga_id: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", regime: "24h-12 GPS (Novo)", df: 95.66, area_manutencao: 0.43, lancada: 1, outros: 0.5, fora_planta: 0 });
    expect(v.horas_regime).toBeCloseTo(551.6167, 4);
    expect(v.horas_indisp).toBeCloseTo(23.9167, 4);
    expect(v.ausencia_operador).toBeCloseTo(0.0833, 4);
  });
  it("eventos: só os com tipo e horário, sem repetidos, hora de Ipatinga (-03:00)", () => {
    expect(lido.eventos).toHaveLength(4);
    expect(lido.eventos[0]).toEqual({ boletim_cod: "B1", vaga_id: 530, placa: "EAM-3253", inicio: "2026-09-16T06:55:00-03:00", fim: "2026-09-16T07:00:00-03:00", tipo: "Ausência de operador", horas: 0.083333333333333 });
    expect(lido.eventos.map((e) => e.tipo)).toContain("Indisp. lançada manual");
  });
  it("dias: soma das janelas; placas sem 'S/…' e 'BDVE'; linha sem dia fica fora", () => {
    expect(lido.dias).toHaveLength(2);
    expect(lido.dias[0]).toMatchObject({ boletim_cod: "B1", vaga_id: 530, dia: "2026-09-16", placas: "EAM-3253", horas_indisp: 1.43 });
    expect(lido.dias[0].horas_regime).toBeCloseTo(23.9833, 4);
    expect(lido.dias[1]).toMatchObject({ dia: "2026-09-17", placas: "", horas_regime: 24, horas_indisp: 1.5 });
  });
  it("nada de R$ nem nome de pessoa na saída", () => {
    expect(JSON.stringify(lido)).not.toMatch(/R\$|FULANO|price|beneficiary|expectative/);
  });
  it("vaga sem código numérico fica fora; JSON quebrado não derruba (eventos vazios)", () => {
    expect(lerBoletim(linha, [vagaGauss({ vacancy_code: "abc" })]).vagas).toHaveLength(0);
    const r = lerBoletim(linha, [vagaGauss({ json_data_indisponibility: "{quebrado", availability_json_data: null })]);
    expect(r.eventos).toEqual([]);
    expect(r.dias).toEqual([]);
    expect(r.vagas[0].ausencia_operador).toBe(0);
  });
});

describe("contas da tela", () => {
  it("DF da frota pondera pelas horas do regime; sem horas, null", () => {
    expect(dfDaFrota([{ horas_regime: 100, horas_indisp: 10 }, { horas_regime: 100, horas_indisp: 0 }])).toBe(95);
    expect(dfDaFrota([])).toBeNull();
  });
  it("ordem: pior DF primeiro; empate, mais horas indisponíveis primeiro", () => {
    const v = (vaga: string, df: number, horas_indisp: number) => ({ vaga, df, horas_indisp });
    expect(ordenarVagas([v("A", 99, 1), v("B", 90, 5), v("C", 90, 9)]).map((x) => x.vaga)).toEqual(["C", "B", "A"]);
  });
  it("motivo principal e motivos com valor, do maior para o menor", () => {
    const m = { ...zeros(), ausencia_operador: 12.68, area_manutencao: 10.5, trajeto: 0.12 };
    expect(motivoPrincipal(m)).toEqual({ chave: "ausencia_operador", nome: "Ausência de operador", horas: 12.68 });
    expect(motivoPrincipal(zeros())).toBeNull();
    expect(porMotivo(m).map((x) => x.chave)).toEqual(["ausencia_operador", "area_manutencao", "trajeto"]);
  });
  it("conferência: até 1 min de diferença confere", () => {
    expect(conferencia([{ horas: 23.905 }], 23.9167).confere).toBe(true);
    const c = conferencia([{ horas: 20 }, { horas: 3.8333 }], 23.9167);
    expect(c.confere).toBe(false);
    expect(c.diferenca).toBeCloseTo(0.0834, 3);
    expect(fmtH(c.soma)).toBe("23h50");
  });
  it("motor 2º: só secondary_motor_on, cortado no ciclo e dividido por dia", () => {
    const t = (inicio: string, fim: string, status = "secondary_motor_on") => ({ inicio, fim, status });
    const r = motor2PorDia(
      [
        t("2026-09-15 23:00:00", "2026-09-16 01:00:00"), // começa antes do ciclo: só 1h conta
        t("2026-09-20 23:30:00", "2026-09-21 00:30:00"), // cruza a meia-noite
        t("2026-10-08 23:00:00", "2026-10-09 02:00:00"), // passa do fim do ciclo
        t("2026-09-18 10:00:00", "2026-09-18 11:00:00", "on"), // motor principal: fora
        t("2026-09-19T10:00:00-03:00", "2026-09-19T10:30:00-03:00"), // com fuso
      ],
      "2026-09-16",
      "2026-10-08",
    );
    expect(r.dias.map((d) => [d.dia, Math.round(d.horas * 60)])).toEqual([["2026-09-16", 60], ["2026-09-19", 30], ["2026-09-20", 30], ["2026-09-21", 30], ["2026-10-08", 60]]);
    expect(r.total).toBeCloseTo(3.5, 6);
  });
  it("DF do dia, placas do ciclo e datas", () => {
    expect(dfDoDia({ horas_regime: 24, horas_indisp: 2.4 })).toBeCloseTo(90, 6);
    expect(dfDoDia({ horas_regime: 0, horas_indisp: 0 })).toBeNull();
    expect(placasDoCiclo([{ placas: "A / B" }, { placas: "" }, { placas: "B" }])).toEqual(["A", "B"]);
    expect(diaSeguinte("2026-12-31")).toBe("2027-01-01");
    expect(dataBr("2026-09-16")).toBe("16/09");
    expect(horaEvento("2026-09-16T09:55:00+00:00")).toBe("16/09 06:55");
    expect(rotuloBoletim({ cod: "B1", identificacao: "GPS 2026-10", inicio: "2026-09-16", fim: "2026-10-08" })).toBe("GPS 2026-10 · 16/09 a 08/10");
    expect(fmtDf(95.664)).toBe("95,66%");
  });
});

// conferência com o boletim real (arquivo baixado pelo automation/medicao/baixar-boletim.js, fora do repositório)
const GABARITO = resolve(process.cwd(), "../../automation/data/medicao/202609161320261008-vaga530.json");
describe.skipIf(!existsSync(GABARITO))("gabarito AP 01 24h (16/09 a 08/10)", () => {
  it("bate com o boletim oficial", () => {
    const { boletim, vagas } = JSON.parse(readFileSync(GABARITO, "utf-8")) as { boletim: LinhaListaBoletim; vagas: Record<string, unknown>[] };
    const ap = lerBoletim(boletim, vagas).vagas.find((v) => v.vaga_id === 530)!;
    expect(fmtH(ap.horas_regime)).toBe("551h37");
    expect(fmtH(ap.horas_indisp)).toBe("23h55");
    expect(ap.df).toBe(95.66);
    expect(fmtH(ap.ausencia_operador)).toBe("12h41");
  });
});

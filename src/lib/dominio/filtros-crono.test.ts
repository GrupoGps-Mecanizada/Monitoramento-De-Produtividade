import { describe, expect, it } from "vitest";
import type { TurnoCrono } from "./cronoanalise";
import { FILTRO_CRONO_VAZIO, completarTurno, filtrarTurnos, letraDaEscala, opcoesDoFiltro, tipoDoTurno } from "./filtros-crono";

const t = (o: Partial<TurnoCrono>): TurnoCrono => ({
  chave: Math.random().toString(), data: "2026-10-13", letra: "A", periodo: "dia", supervisor: "Ozias", placa: "EGC2985", vaga: "AP-01", equip: "Alta Pressão",
  area: null, kit: null, inicio: "2026-10-13T06:40:00", duracao: 43200, pessoas: [], ...o,
});

describe("escala 4x4 (regra do segundo cérebro: 13/10/2026 = 1º dia da letra A de dia)", () => {
  it("letra de dia e de noite em cada bloco de 2 dias", () => {
    expect([letraDaEscala("2026-10-13", "dia"), letraDaEscala("2026-10-14", "noite")]).toEqual(["A", "C"]);
    expect([letraDaEscala("2026-10-15", "dia"), letraDaEscala("2026-10-16", "noite")]).toEqual(["D", "A"]);
    expect([letraDaEscala("2026-10-17", "dia"), letraDaEscala("2026-10-17", "noite")]).toEqual(["B", "D"]);
    expect([letraDaEscala("2026-10-19", "dia"), letraDaEscala("2026-10-20", "noite")]).toEqual(["C", "B"]);
    expect(letraDaEscala("2026-10-21", "dia")).toBe("A");
    // antes da referência: 11 e 12/10 são o bloco da letra C de dia
    expect([letraDaEscala("2026-10-12", "dia"), letraDaEscala("2026-10-11", "noite")]).toEqual(["C", "B"]);
  });
});

describe("completar e classificar o turno", () => {
  it("sem letra: vem da escala; sem supervisor: vem da letra; o que foi lançado não muda", () => {
    expect(completarTurno(t({ letra: "?", supervisor: null, data: "2026-10-15", periodo: "noite" }))).toMatchObject({ letra: "A", supervisor: "Ozias" });
    expect(completarTurno(t({ letra: "B", supervisor: null }))).toMatchObject({ letra: "B", supervisor: "Matusalem" });
    expect(completarTurno(t({ letra: "C", supervisor: "Outro" }))).toMatchObject({ letra: "C", supervisor: "Outro" });
    expect(completarTurno(t({ letra: "ADM", supervisor: null }))).toMatchObject({ letra: "ADM", supervisor: null });
  });
  it("tipo pela vaga e, sem vaga, pelo equipamento", () => {
    expect([tipoDoTurno(t({ vaga: "AP-01" })), tipoDoTurno(t({ vaga: "av 03" })), tipoDoTurno(t({ vaga: "HV-02" }))]).toEqual(["AP", "AV", "HV"]);
    expect([tipoDoTurno(t({ vaga: null, equip: "Vácuo" })), tipoDoTurno(t({ vaga: null, equip: "Aspirador de Pó" })), tipoDoTurno(t({ vaga: null, equip: null }))]).toEqual(["AV", "AS", null]);
  });
});

describe("filtros em cascata", () => {
  const turnos = [
    t({ data: "2026-10-08", letra: "A", vaga: "AP-01" }),
    t({ data: "2026-10-08", letra: "A", vaga: "AV-02", equip: "Vácuo", periodo: "noite" }),
    t({ data: "2026-10-07", letra: "B", vaga: "AP-03", supervisor: "Matusalem" }),
  ];
  it("cada filtro corta; vazio não corta", () => {
    expect(filtrarTurnos(turnos, FILTRO_CRONO_VAZIO)).toHaveLength(3);
    expect(filtrarTurnos(turnos, { ...FILTRO_CRONO_VAZIO, data: "2026-10-08" })).toHaveLength(2);
    expect(filtrarTurnos(turnos, { ...FILTRO_CRONO_VAZIO, data: "2026-10-08", tipo: "AV" }).map((x) => x.vaga)).toEqual(["AV-02"]);
    expect(filtrarTurnos(turnos, { ...FILTRO_CRONO_VAZIO, periodo: "noite" })).toHaveLength(1);
    expect(filtrarTurnos(turnos, { ...FILTRO_CRONO_VAZIO, supervisor: "Matusalem" }).map((x) => x.letra)).toEqual(["B"]);
  });
  it("opções de um filtro: só as que existem com os outros escolhidos (sem contar ele mesmo)", () => {
    expect(opcoesDoFiltro(turnos, { ...FILTRO_CRONO_VAZIO, data: "2026-10-08" }, "vaga")).toEqual(["AP-01", "AV-02"]);
    expect(opcoesDoFiltro(turnos, { ...FILTRO_CRONO_VAZIO, data: "2026-10-08" }, "data")).toEqual(["2026-10-08", "2026-10-07"]);
    expect(opcoesDoFiltro(turnos, { ...FILTRO_CRONO_VAZIO, letra: "B" }, "tipo")).toEqual(["AP"]);
  });
});

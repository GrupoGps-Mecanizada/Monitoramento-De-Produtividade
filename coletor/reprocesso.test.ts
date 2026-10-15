import { describe, expect, it } from "vitest";
import { avancar, diasDaVez, proximasVagas, type Reprocesso } from "./reprocesso";

const vagas = [
  { id: 530, nome: "ALTA PRESSÃO - GPS - 01 - 24 HS" },
  { id: 9001, nome: "ALTA PRESSÃO - SERVITEC - 01" },
  { id: 311, nome: "AUTO VÁCUO - GPS - 01 - 24 HS" },
  { id: 416, nome: "HIPER VÁCUO - GPS - 01" },
];
const base: Reprocesso = {
  de: "2026-10-01",
  ate: "2026-10-14",
  fase: "timeline",
  dia: "2026-10-14",
  feitas: [],
};

describe("reprocessamento de 01/10 a 14/10", () => {
  it("timeline: só vagas da GPS, sem as já feitas e as que esgotaram, no limite por ciclo", () => {
    expect(proximasVagas(base, vagas, 2).map((v) => v.id)).toEqual([530, 311]);
    expect(proximasVagas({ ...base, feitas: [530], falhas: ["2026-10-14|311"] }, vagas).map((v) => v.id)).toEqual([416]);
    // a falha é do dia: no dia seguinte a vaga entra de novo
    expect(proximasVagas({ ...base, dia: "2026-10-13", falhas: ["2026-10-14|311"] }, vagas).map((v) => v.id)).toEqual([530, 311, 416]);
  });
  it("do dia mais novo para o mais velho; no último dia passa para a próxima fase, que recomeça em 14/10", () => {
    expect(avancar(base, "2026-10-14")).toMatchObject({
      fase: "timeline",
      dia: "2026-10-13",
      feitas: [],
    });
    expect(avancar({ ...base, dia: "2026-10-01" }, "2026-10-01")).toMatchObject({ fase: "tablet", dia: "2026-10-14" });
    expect(avancar({ ...base, fase: "tablet" }, "2026-10-01")).toMatchObject({
      fase: "paradas",
      dia: "2026-10-14",
    });
    expect(avancar({ ...base, fase: "paradas" }, "2026-10-01")).toMatchObject({
      fase: "pronto",
    });
  });
  it("dias da vez sem passar do início", () => {
    expect(diasDaVez({ ...base, dia: "2026-10-03" }, 3)).toEqual(["2026-10-03", "2026-10-02", "2026-10-01"]);
    expect(diasDaVez({ ...base, dia: "2026-10-02" }, 3)).toEqual(["2026-10-02", "2026-10-01"]);
    // virada de mês
    expect(diasDaVez({ de: "2026-09-29", ate: "2026-10-01" }, 3)).toEqual(["2026-10-01", "2026-09-30", "2026-09-29"]);
  });
});

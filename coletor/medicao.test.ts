import { describe, expect, it } from "vitest";
import type { LinhaListaBoletim } from "../src/lib/dominio/medicao";
import { DETALHE, LISTA, camposGetData, camposLista, coletarMedicao, conferirChamada, type ControleMedicao, type DepsMedicao } from "./medicao";

const linha = (cod: string, identification: string): LinhaListaBoletim => ({ cod, identification, initial_date: "16/09/2026", final_date: "08/10/2026", status: "<i class='fa fa-lock' title='Bloqueada'></i>" });
const VAGA = { vacancy_code: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", CHM: "24:00", total_indisponibilidade: "1:00", DF: "95,83", json_data_indisponibility: "[]", availability_json_data: "[]" };

describe("trava das chamadas da medição", () => {
  it("aceita a lista do Dashboard e o get_data", () => {
    expect(() => conferirChamada(LISTA, camposLista("2026-07-15", "2026-10-13"))).not.toThrow();
    expect(() => conferirChamada(DETALHE, camposGetData(linha("B1", "GPS 2026-10")))).not.toThrow();
  });
  it("recusa a Medição Mensal (grava no GAUSS)", () => {
    expect(() => conferirChamada("/data/measurement/contract-position-fixed-variable/usiminas/", [["action", "list"]])).toThrow(/proibido/);
  });
  it("recusa as ações que gravam (e qualquer ação que não seja get_data) no endereço do Dashboard", () => {
    for (const acao of ["reprocess", "consolidate", "delete-sap-lines", "close_measurement_boletim", "send_edit_name_measurement", "save-grid", "dashboard"]) {
      expect(() => conferirChamada(DETALHE, [["action", acao], ["cod", "B1"]])).toThrow();
    }
    expect(() => conferirChamada(DETALHE, [["action", "get_data"], ["action", "reprocess"]])).toThrow();
  });
  it("recusa campo fora do filtro na lista (ex.: 'só consolidadas' ou action)", () => {
    expect(() => conferirChamada(LISTA, [...camposLista("2026-07-15", "2026-10-13"), ["view-all-measurements", 1]])).toThrow();
    expect(() => conferirChamada(LISTA, [["action", "list"]])).toThrow();
  });
  it("recusa qualquer outro endereço", () => {
    expect(() => conferirChamada("/data/hard-vehicle/vehicles/location-online/", [])).toThrow();
  });
  it("o texto da linha do boletim (rowData) não trava: 'Consolidado' é só o nome", () => {
    expect(() => conferirChamada(DETALHE, camposGetData(linha("B1", "SERVITEC 2026-10 (Consolidado)")))).not.toThrow();
  });
});

function fake(o: { controle?: ControleMedicao | null; feitos?: string[]; lista?: LinhaListaBoletim[]; falhaLista?: boolean; falhaGetData?: boolean; semTabela?: boolean; vagas?: unknown[] } = {}) {
  const chamadas: string[] = [];
  const gravados: string[] = [];
  let controle = o.controle ?? null;
  const deps: DepsMedicao = {
    lerControle: async () => controle,
    gravarControle: async (c) => {
      controle = c;
    },
    completos: async () => {
      if (o.semTabela) throw new Error("Could not find the table 'public.medicao_boletim' in the schema cache");
      return new Set(o.feitos ?? []);
    },
    listar: async () => {
      chamadas.push("lista");
      if (o.falhaLista) throw new Error("HTTP 500");
      return o.lista ?? [];
    },
    getData: async (l) => {
      chamadas.push(`get_data ${l.cod}`);
      if (o.falhaGetData) throw new Error("timeout");
      return (o.vagas ?? [VAGA]) as Record<string, unknown>[];
    },
    gravar: async (lido) => {
      gravados.push(lido.boletim.cod);
    },
  };
  return { deps, chamadas, gravados, controle: () => controle };
}
const AS_8 = new Date("2026-10-13T08:00:00");

describe("coletarMedicao", () => {
  it("antes das 07:00 não faz nada", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")] });
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T06:30:00"))).toBeNull();
    expect(f.chamadas).toEqual([]);
  });
  it("sem as tabelas (SQL não rodado): erro sem chamar o GAUSS", async () => {
    const f = fake({ semTabela: true, lista: [linha("B2", "GPS 2026-10")] });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/medicao_boletim/);
    expect(f.chamadas).toEqual([]);
  });
  it("lista 1 vez por dia, só GPS ainda não baixado, 1 boletim por ciclo", async () => {
    const f = fake({ feitos: ["B1"], lista: [linha("B1", "GPS 2026-09"), linha("B2", "GPS  2026-10 (agrupado)"), linha("B3", "SERVITEC 2026-10"), linha("B4", "GPS 2026-08")] });
    expect(await coletarMedicao(f.deps, AS_8)).toMatch(/GPS 2026-10 \(agrupado\): 1 vagas/);
    expect(f.chamadas).toEqual(["lista", "get_data B2"]);
    expect(f.controle()?.pendentes.map((p) => p.cod)).toEqual(["B4"]);
    await coletarMedicao(f.deps, new Date("2026-10-13T08:05:00"));
    expect(f.chamadas).toEqual(["lista", "get_data B2", "get_data B4"]);
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T08:10:00"))).toBeNull();
    expect(f.gravados).toEqual(["B2", "B4"]);
  });
  it("get_data com falha: até 3 tentativas no dia; no dia seguinte lista de novo", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")], falhaGetData: true });
    for (let i = 0; i < 3; i++) await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/timeout/);
    expect(await coletarMedicao(f.deps, AS_8)).toBeNull();
    expect(f.chamadas.filter((c) => c.startsWith("get_data"))).toHaveLength(3);
    expect(f.gravados).toEqual([]);
    await expect(coletarMedicao(f.deps, new Date("2026-10-14T08:00:00"))).rejects.toThrow(/timeout/);
    expect(f.chamadas.filter((c) => c === "lista")).toHaveLength(2);
  });
  it("boletim que volta sem vagas conta como falha e não é gravado", async () => {
    const f = fake({ lista: [linha("B2", "GPS 2026-10")], vagas: [] });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/sem vagas/);
    expect(f.gravados).toEqual([]);
    expect(f.controle()?.tentativas).toEqual({ B2: 1 });
  });
  it("falha na lista: não insiste no mesmo dia", async () => {
    const f = fake({ falhaLista: true });
    await expect(coletarMedicao(f.deps, AS_8)).rejects.toThrow(/HTTP 500/);
    expect(await coletarMedicao(f.deps, new Date("2026-10-13T09:00:00"))).toBeNull();
    expect(f.chamadas).toEqual(["lista"]);
  });
});

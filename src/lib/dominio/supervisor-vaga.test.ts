import { describe, expect, it } from "vitest";
import { mapaVagaDoDia, supervisorDaParada, supervisorDaVaga, supervisorDoTurno } from "./supervisor-vaga";

const H = 3600;

describe("supervisor pela vaga", () => {
  it("vagas fixas do ADM", () => {
    expect(supervisorDaVaga("ALTA PRESSÃO - GPS - 02", "2026-10-13", 10 * H)).toBe("Junior Pereira");
    expect(supervisorDaVaga("ALTA PRESSÃO - GPS - 10", "2026-10-13", 10 * H)).toBe("Junior Pereira");
    expect(supervisorDaVaga("AUTO VÁCUO - GPS - 05", "2026-10-13", 10 * H)).toBe("Donizete");
    expect(supervisorDaVaga("HIPER VÁCUO - GPS - 02", "2026-10-13", 10 * H)).toBe("Donizete");
    expect(supervisorDaVaga("HIPER VÁCUO - GPS - 03", "2026-10-13", 10 * H)).toBe("Genésio");
  });

  it("16 h e sem vaga: sem supervisor", () => {
    expect(supervisorDaVaga("ALTA PRESSÃO - GPS - 07 - 16 HS", "2026-10-13", 10 * H)).toBeNull();
    expect(supervisorDaVaga("AUTO VÁCUO - GPS - 07 - 16 HS", "2026-10-13", 10 * H)).toBeNull();
    expect(supervisorDaVaga("[S/ VAGA]", "2026-10-13", 10 * H)).toBeNull();
  });

  it("24 h: a letra do 4x4 no horário (a madrugada é da noite anterior)", () => {
    expect(supervisorDaVaga("ALTA PRESSÃO - GPS - 08 - 24 HS", "2026-10-13", 10 * H)).toBe("Ozias"); // A de dia
    expect(supervisorDaVaga("AUTO VÁCUO - GPS - 01 - 24 HS", "2026-10-13", 20 * H)).toBe("Israel"); // C de noite
    expect(supervisorDoTurno("2026-10-14", 2 * H)).toBe("Israel"); // noite que começou em 13/10
    expect(supervisorDoTurno("2026-10-15", 10 * H)).toBe("Fabio"); // D de dia
    expect(supervisorDoTurno("2026-10-15", 6 * H + 39 * 60)).toBe("Israel"); // 06:39 ainda é a noite de 14/10
  });

  it("parada: aspirador e Brook são do Genésio; sem vaga conhecida vale a matriz", () => {
    expect(supervisorDaParada("as", undefined, "2026-10-13", 0, null)).toBe("Genésio");
    expect(supervisorDaParada("pg", "ALTA PRESSÃO - GPS - 02", "2026-10-13", 0, null)).toBe("Genésio");
    expect(supervisorDaParada("ap", undefined, "2026-10-13", 0, "Donizete")).toBe("Donizete");
    expect(supervisorDaParada("ap", "ALTA PRESSÃO - GPS - 03", "2026-10-13", 0, "Donizete")).toBe("Junior Pereira");
  });

  it("vaga do dia: a que teve mais tempo", () => {
    const m = mapaVagaDoDia([
      { dia: "2026-10-13", veiculo_id: "1", vaga_nome: "ALTA PRESSÃO - GPS - 02", minutos: 30 },
      { dia: "2026-10-13", veiculo_id: "1", vaga_nome: "ALTA PRESSÃO - GPS - 08 - 24 HS", minutos: 600 },
    ]);
    expect(m.get("2026-10-13|1")).toBe("ALTA PRESSÃO - GPS - 08 - 24 HS");
  });
});

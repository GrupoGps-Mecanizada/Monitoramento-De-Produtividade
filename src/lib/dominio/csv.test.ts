import { describe, expect, it } from "vitest";
import { csvApontamento, nomeCsv } from "./csv";

describe("CSV do apontamento", () => {
  it("uma linha por trecho, separador ;, aspas dobradas", () => {
    const csv = csvApontamento(
      {
        dia: "2026-10-01",
        trechos: [
          { estado: "movimento", inicio: "2026-10-01 08:00:00", fim: "2026-10-01 08:10:00", duracao_min: 10, de: "", para: "", percurso: ["PATIO", "RUA 1"], km: 1.2, vel_max: 40, motor2_min: 3 },
          { estado: "parado_ligado", inicio: "2026-10-01 08:10:00", fim: "2026-10-01 08:20:00", duracao_min: 10, local: 'PA"TIO' },
        ],
      },
      "EOF5208",
    );
    expect(csv.split("\r\n")).toEqual([
      '"placa";"dia";"inicio";"fim";"duracao_min";"situacao";"local_ou_percurso";"km";"vel_max";"motor2_ligado_min"',
      '"EOF5208";"2026-10-01";"08:00:00";"08:10:00";"10";"Em deslocamento";"PATIO > RUA 1";"1.2";"40";"3"',
      '"EOF5208";"2026-10-01";"08:10:00";"08:20:00";"10";"Parado ligado";"PA""TIO";"";"";""',
    ]);
    expect(nomeCsv("EOF5208", "2026-10-01")).toBe("apontamento-EOF5208-2026-10-01.csv");
  });
});

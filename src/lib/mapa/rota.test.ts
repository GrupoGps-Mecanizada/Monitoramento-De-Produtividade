import { describe, expect, it } from "vitest";
import type { PontoMapa, Trecho } from "../tipos";
import { paradasRelevantes, pontosDoTrecho, sequenciasPorEstado } from "./rota";

const pontos: PontoMapa[] = [
  [1, 1, "08:00:00", 0, "parado", null],
  [2, 2, "08:01:00", 30, "movimento", null],
  [3, 3, "08:02:00", 30, "movimento", null],
  [4, 4, "08:03:00", 0, "parado", null],
];

describe("rota no mapa", () => {
  it("uma linha por sequência de mesmo estado, emendada na próxima", () => {
    expect(sequenciasPorEstado(pontos)).toEqual([
      { estado: "parado", pts: [[1, 1], [2, 2]] },
      { estado: "movimento", pts: [[2, 2], [3, 3], [4, 4]] },
      { estado: "parado", pts: [[4, 4]] },
    ]);
  });
  it("paradas de 10 min ou mais, com posição, viram marcador", () => {
    const trechos: Trecho[] = [
      { estado: "movimento", inicio: "a", fim: "b", duracao_min: 30, de: "", para: "", percurso: [], km: 1, vel_max: 30 },
      { estado: "parado_ligado", inicio: "a", fim: "b", duracao_min: 12, local: "PATIO", lat: 1, lng: 2 },
      { estado: "desligado", inicio: "a", fim: "b", duracao_min: 5, local: "PATIO", lat: 1, lng: 2 },
      { estado: "sem_sinal", inicio: "a", fim: "b", duracao_min: 40, local: "" },
    ];
    expect(paradasRelevantes(trechos).map((p) => p.i)).toEqual([1]);
  });
  it("pontos de um trecho (para enquadrar)", () => {
    const trechos: Trecho[] = [{ estado: "movimento", inicio: "2026-10-01 08:01:00", fim: "2026-10-01 08:02:00", duracao_min: 1, de: "", para: "", percurso: [], km: 0, vel_max: 30 }];
    expect(pontosDoTrecho({ pontos, trechos }, 0)).toEqual([[2, 2], [3, 3]]);
    expect(pontosDoTrecho({ pontos, trechos }, 5)).toEqual([]);
  });
});

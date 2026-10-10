import { describe, expect, it } from "vitest";
import { escolherNoturno } from "./noturno";

const em = (h: string) => new Date(`2026-10-08T${h}:00`);
const IDS = ["1", "2", "3", "4", "5", "6", "7", "8"];

describe("escolherNoturno", () => {
  it("fora de 02:30–06:00 não faz nada", () => {
    expect(escolherNoturno(null, IDS, em("02:00"))).toBeNull();
    expect(escolherNoturno(null, IDS, em("06:00"))).toBeNull();
  });
  it("na janela: até 6 equipamentos de ontem que faltam", () => {
    expect(escolherNoturno(null, IDS, em("02:30"))).toEqual({ dia: "2026-10-07", ids: ["1", "2", "3", "4", "5", "6"] });
    expect(escolherNoturno({ dia: "2026-10-07", feitos: ["1", "2", "3", "4", "5", "6"] }, IDS, em("02:40"))).toEqual({ dia: "2026-10-07", ids: ["7", "8"] });
  });
  it("tudo feito: nada; progresso de outro dia não vale", () => {
    expect(escolherNoturno({ dia: "2026-10-07", feitos: IDS }, IDS, em("03:00"))).toBeNull();
    expect(escolherNoturno({ dia: "2026-10-06", feitos: IDS }, IDS, em("03:00"))?.ids).toHaveLength(6);
  });
});

describe("limite de tentativas (não repetir consultas ao GAUSS sem fim)", () => {
  it("equipamento que falhou 3 vezes sai da fila e não trava os outros", () => {
    const controle = { dia: "2026-10-07", feitos: [], tentativas: { "1": 3, "2": 3, "3": 1 } };
    expect(escolherNoturno(controle, IDS, em("03:00"))?.ids).toEqual(["3", "4", "5", "6", "7", "8"]);
    expect(escolherNoturno({ dia: "2026-10-07", feitos: ["4", "5", "6", "7", "8"], tentativas: { "1": 3, "2": 3, "3": 3 } }, IDS, em("03:00"))).toBeNull();
  });
});


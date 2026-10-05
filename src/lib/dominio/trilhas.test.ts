import { describe, expect, it } from "vitest";
import { DIA, ampliar, emPct, janelaDosRegistros, janelaDosTrechos, marcasRegua, posBloco, rotuloMarca, segDaFracao, segFim } from "./trilhas";

const H = 3600;
const D = "2026-10-01";

describe("janela da régua", () => {
  it("cobre os registros em horas cheias, com no mínimo 1 h", () => {
    expect(janelaDosRegistros(7 * H + 1200, 18 * H + 300)).toEqual([7 * H, 19 * H]);
    expect(janelaDosRegistros(30000, 30000)).toEqual([8 * H, 9 * H]);
    expect(janelaDosRegistros(8 * H, 8 * H)).toEqual([8 * H, 9 * H]);
    expect(janelaDosRegistros(23.5 * H, 23.9 * H)).toEqual([23 * H, DIA]);
  });
  it("sem registros = dia inteiro", () => {
    expect(janelaDosRegistros(null, null)).toEqual([0, DIA]);
    expect(janelaDosTrechos([])).toEqual([0, DIA]);
  });
  it("trechos: do início do 1º ao fim do último", () => {
    expect(janelaDosTrechos([{ inicio: `${D} 07:20:00`, fim: `${D} 08:00:00` }, { inicio: `${D} 17:00:00`, fim: `${D} 18:05:00` }])).toEqual([7 * H, 19 * H]);
  });
  it("último trecho terminando à meia-noite (dia seguinte 00:00) vai até 24 h", () => {
    expect(janelaDosTrechos([{ inicio: `${D} 22:10:00`, fim: `${D} 23:00:00` }, { inicio: `${D} 23:10:00`, fim: "2026-10-02 00:00:00" }])).toEqual([22 * H, DIA]);
  });
});

describe("posição na janela", () => {
  const j = [8 * H, 10 * H] as const;
  it("instante em % (preso entre 0 e 100) e o inverso", () => {
    expect(emPct(9 * H, j)).toBe(50);
    expect(emPct(7 * H, j)).toBe(0);
    expect(emPct(11 * H, j)).toBe(100);
    expect(segDaFracao(0.25, [8 * H, 12 * H])).toBe(9 * H);
    expect(segDaFracao(-1, j)).toBe(8 * H);
  });
  it("bloco: esquerda e largura em %, cortado na janela", () => {
    expect(posBloco(9 * H, 9 * H + 1800, j)).toEqual({ esq: 50, larg: 25 });
    expect(posBloco(7.5 * H, 8.5 * H, j)).toEqual({ esq: 0, larg: 25 });
    expect(posBloco(7 * H, 7.5 * H, j)).toBeNull();
    expect(posBloco(10 * H, 11 * H, j)).toBeNull();
  });
  it("bloco curto ganha 60 s para aparecer", () => {
    expect(posBloco(9 * H, 9 * H + 10, j)?.larg).toBeCloseTo((60 / 7200) * 100);
  });
});

describe("régua e zoom", () => {
  it("marcas de 1 em 1 h até 8 h de janela, de 2 em 2 até 16 h, depois de 3 em 3", () => {
    expect(marcasRegua([8 * H, 10 * H])).toEqual([8 * H, 9 * H, 10 * H]);
    expect(marcasRegua([7 * H, 19 * H])).toEqual([8 * H, 10 * H, 12 * H, 14 * H, 16 * H, 18 * H]);
    expect(marcasRegua([0, DIA])).toHaveLength(9);
  });
  it("ampliar o foco: 5% de folga de cada lado, mínimo 30 min, dentro do dia", () => {
    expect(ampliar([H, 2 * H])).toEqual([3420, 7380]);
    expect(ampliar([0, 600])).toEqual([0, 1800]);
    expect(ampliar([86000, DIA])).toEqual([84600, DIA]);
  });
});

describe("revisão final", () => {
  it("fim de bloco à meia-noite (data do dia seguinte) vale 24 h, e não 0", () => {
    expect(segFim(`${D} 18:00:00`, "2026-10-02 00:00:00")).toBe(DIA);
    expect(segFim(`${D} 18:00:00`, `${D} 19:30:00`)).toBe(19.5 * H);
  });
  it("janela curta (foco ampliado) ainda tem marcas: de 5 em 5 min até 30 min, de 10 em 10 até 1 h", () => {
    expect(marcasRegua([29100, 30900])).toEqual([29100, 29400, 29700, 30000, 30300, 30600, 30900]);
    expect(marcasRegua([8 * H, 9 * H])).toEqual([8 * H, 8 * H + 600, 8 * H + 1200, 8 * H + 1800, 8 * H + 2400, 8 * H + 3000, 9 * H]);
  });
  it("rótulo da marca: hora cheia como 8h, o resto como 08:05", () => {
    expect(rotuloMarca(8 * H)).toBe("8h");
    expect(rotuloMarca(29100)).toBe("08:05");
  });
});

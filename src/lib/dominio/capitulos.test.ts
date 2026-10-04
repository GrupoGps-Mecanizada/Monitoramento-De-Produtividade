import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { EstadoTrecho, Trecho } from "../tipos";
import { MIN_CAPITULO, capituloEm, classeTempo, montarHistoria, proximoCapitulo, tipoLugar } from "./capitulos";

const D = "2026-10-01";
const P = (ini: string, fim: string, estado: Exclude<EstadoTrecho, "movimento">, local: string, min: number): Trecho => ({ estado, inicio: `${D} ${ini}:00`, fim: `${D} ${fim}:00`, duracao_min: min, local, lat: -19.48, lng: -42.53 });
const M = (ini: string, fim: string, km: number, min: number): Trecho => ({ estado: "movimento", inicio: `${D} ${ini}:00`, fim: `${D} ${fim}:00`, duracao_min: min, de: "", para: "", percurso: [], km, vel_max: 30 });

describe("tipo de lugar e classe de tempo", () => {
  it("pátio/estacionamento/oficina é base; rua, avenida e fora de cerca são vias; o resto é área de serviço", () => {
    expect(tipoLugar("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toBe("base");
    expect(tipoLugar("ESTACIONAMENTO RESTAURANTE CENTRAL")).toBe("base");
    expect(tipoLugar("OFICINA")).toBe("base");
    expect(tipoLugar("PRECIPITADOR PE 5")).toBe("servico");
    expect(tipoLugar("AV CINCO COM RUA DEZESSETE")).toBe("via");
    expect(tipoLugar("RUA VINTE E UM")).toBe("via");
    expect(tipoLugar("Fora de cerca")).toBe("via");
    expect(tipoLugar("")).toBe("via");
  });
  it("classe de tempo (único ponto da futura regra de 'trabalhando')", () => {
    expect(classeTempo("parado_ligado")).toBe("ligado");
    expect(classeTempo("desligado")).toBe("desligado");
    expect(classeTempo("parado")).toBe("desligado");
    expect(classeTempo("sem_sinal")).toBe("outro");
    expect(classeTempo("movimento")).toBeNull();
  });
});

describe("capítulos", () => {
  it("motor ligando e desligando no mesmo lugar é um capítulo só", () => {
    const h = montarHistoria([P("06:00", "06:30", "desligado", "PÁTIO 80", 30), P("06:30", "06:50", "parado_ligado", "PÁTIO 80", 20)]);
    expect(h.capitulos).toHaveLength(1);
    expect(h.capitulos[0]).toMatchObject({ n: 1, lugar: "PÁTIO 80", tipoLugar: "base", duracao_min: 50, ligado_min: 20, desligado_min: 30, inicio: `${D} 06:00:00`, fim: `${D} 06:50:00`, ate: null });
  });
  it(`parada de ${MIN_CAPITULO} min vira capítulo; de 14 min vira "passou por" no deslocamento`, () => {
    const h = montarHistoria([
      P("08:00", "08:20", "desligado", "PÁTIO 80", 20),
      M("08:20", "08:25", 1.2, 5),
      P("08:25", "08:39", "parado_ligado", "ALMOXARIFADO CENTRAL", 14),
      M("08:39", "08:44", 0.8, 5),
      P("08:44", "08:59", "parado_ligado", "ACIARIA 02", 15),
    ]);
    expect(h.capitulos.map((c) => [c.n, c.lugar])).toEqual([[1, "PÁTIO 80"], [2, "ACIARIA 02"]]);
    expect(h.capitulos[0].ate).toEqual({ km: 2, min: 24, destino: "ACIARIA 02", passou: ["ALMOXARIFADO CENTRAL"] });
    expect(h.capitulos[1].ate).toBeNull();
  });
  it("parada curta em rua não entra em 'passou por'", () => {
    const h = montarHistoria([P("08:00", "08:20", "desligado", "PÁTIO 80", 20), M("08:20", "08:25", 1, 5), P("08:25", "08:35", "parado_ligado", "AV CINCO COM RUA DEZESSETE", 10), M("08:35", "08:40", 1, 5), P("08:40", "09:00", "desligado", "ACIARIA 02", 20)]);
    expect(h.capitulos[0].ate?.passou).toEqual([]);
  });
  it("dia sem capítulo (só paradas curtas e deslocamento): lista vazia, faixas desenhadas, destaques vazios", () => {
    const h = montarHistoria([M("08:00", "08:10", 2, 10), P("08:10", "08:15", "parado_ligado", "PRECIPITADOR PE 5", 5), M("08:15", "08:20", 1, 5)]);
    expect(h.capitulos).toEqual([]);
    expect(h.faixaMotor.map((f) => f.estado)).toEqual(["movimento", "parado_ligado", "movimento"]);
    expect(h.faixaLugar.map((f) => f.tipoLugar)).toEqual(["via", "servico", "via"]);
    expect(h.destaques).toEqual({ primeiraSaidaBase: null, ultimaVoltaBase: null, areasServico: 0, maiorParadoLigado: null });
  });
  it("dia vazio", () => {
    expect(montarHistoria([])).toEqual({ capitulos: [], faixaLugar: [], faixaMotor: [], destaques: { primeiraSaidaBase: null, ultimaVoltaBase: null, areasServico: 0, maiorParadoLigado: null } });
  });
  it("faixa de lugar junta deslocamento e parada em rua numa faixa só de vias", () => {
    const h = montarHistoria([M("08:00", "08:10", 2, 10), P("08:10", "08:12", "parado_ligado", "RUA 16", 2), M("08:12", "08:20", 1, 8), P("08:20", "09:00", "desligado", "PÁTIO 80", 40)]);
    expect(h.faixaLugar).toEqual([
      { inicio: `${D} 08:00:00`, fim: `${D} 08:20:00`, tipoLugar: "via", lugar: "" },
      { inicio: `${D} 08:20:00`, fim: `${D} 09:00:00`, tipoLugar: "base", lugar: "PÁTIO 80" },
    ]);
  });
  it("destaques: primeira saída e última volta ao pátio, áreas de serviço e maior parado ligado", () => {
    const h = montarHistoria([
      P("00:00", "00:46", "parado_ligado", "PLANTA CARBOQUÍMICA", 46),
      M("00:46", "06:21", 3, 335),
      P("06:21", "08:32", "desligado", "PÁTIO DO TRANSPORTE RODOVIÁRIO", 131),
      M("08:32", "08:42", 2.8, 10),
      P("08:42", "09:52", "parado_ligado", "ALMOXARIFADO CENTRAL", 70),
      M("09:52", "18:21", 9, 509),
      P("18:21", "19:37", "desligado", "PÁTIO DO TRANSPORTE RODOVIÁRIO", 76),
    ]);
    expect(h.destaques).toEqual({
      primeiraSaidaBase: `${D} 08:32:00`,
      ultimaVoltaBase: `${D} 18:21:00`,
      areasServico: 2,
      maiorParadoLigado: { lugar: "ALMOXARIFADO CENTRAL", min: 70 },
    });
  });
  it("capítulo em que o player está e o próximo", () => {
    const h = montarHistoria([P("08:00", "08:20", "desligado", "PÁTIO 80", 20), M("08:20", "08:30", 1, 10), P("08:30", "09:00", "desligado", "ACIARIA 02", 30)]);
    const s = (hm: string) => Number(hm.slice(0, 2)) * 3600 + Number(hm.slice(3)) * 60;
    expect(capituloEm(h.capitulos, s("08:10"))).toBe(1);
    expect(capituloEm(h.capitulos, s("08:25"))).toBeNull();
    expect(proximoCapitulo(h.capitulos, s("08:10"))?.n).toBe(2);
    expect(proximoCapitulo(h.capitulos, s("08:40"))).toBeNull();
  });
});

// dias reais das amostras do coletor antigo (fora do git; sem elas o bloco é pulado)
const PASTA = new URL("../../../coletor/__amostras__/", import.meta.url);
const amostras = existsSync(PASTA) ? readdirSync(PASTA).filter((n) => n.startsWith("apontamento-")) : [];
describe.skipIf(!amostras.length)("capítulos em dias reais", () => {
  for (const nome of amostras) {
    it(`${nome}: poucos capítulos, numerados, todos de ${MIN_CAPITULO} min ou mais`, () => {
      const trechos: Trecho[] = JSON.parse(readFileSync(new URL(nome, PASTA), "utf-8")).saida.trechos;
      const h = montarHistoria(trechos);
      expect(h.capitulos.map((c) => c.n)).toEqual(h.capitulos.map((_, i) => i + 1));
      for (const c of h.capitulos) expect(c.duracao_min).toBeGreaterThanOrEqual(MIN_CAPITULO);
      if (trechos.length >= 20) expect(h.capitulos.length).toBeLessThan(trechos.length / 2);
    });
  }
});

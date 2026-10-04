import { describe, expect, it } from "vitest";
import type { Evento } from "../tipos";
import { agruparPorHora, contarPorGrupo, ehAlerta, filtrarEventos, grupoDoEvento, textoEvento, textoPlano, TODOS_GRUPOS, veiculoDoEvento } from "./eventos";

const base = { id: "10", placa: "EOF5208", vaga: "V1" };
const ev: Evento[] = [
  { ...base, t: "2026-10-01T17:30:00.000Z", tipo: "entrada", area: "PATIO", lat: 1, lng: 1 },
  { ...base, t: "2026-10-01T17:45:00.000Z", tipo: "saida", area: "PATIO", desde: null, permanencia_min: 15 },
  { ...base, t: "2026-10-01T18:10:00.000Z", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
  { ...base, t: "2026-10-01T18:20:00.000Z", tipo: "sinal_perdido", ultima_posicao: "2026-10-01T17:50:00.000Z", area: "" },
  { id: "11", placa: "EOF52082", vaga: "V1", motor2: true, principal_id: "10", principal: "EOF5208", t: "2026-10-01T18:25:00.000Z", tipo: "sinal_retomado", area: "", sem_sinal_min: 5 },
];

describe("eventos", () => {
  it("textos de cada tipo", () => {
    expect(textoPlano(textoEvento(ev[0]))).toBe("EOF5208 entrou em PATIO");
    expect(textoPlano(textoEvento(ev[1]))).toBe("EOF5208 saiu de PATIO · ficou 15 min");
    expect(textoPlano(textoEvento(ev[2]))).toBe("EOF5208 Ligado → Desligado · 1h10 no anterior · OFICINA");
    expect(textoPlano(textoEvento(ev[3]))).toBe("EOF5208 sem sinal desde 14:50");
    expect(textoPlano(textoEvento(ev[4]))).toBe("EOF5208 ⚙ motor 2º voltou a comunicar após 5 min");
  });
  it("evento do motor 2º abre o caminhão principal", () => {
    expect(veiculoDoEvento(ev[4])).toBe("10");
    expect(grupoDoEvento(ev[4])).toBe("sinal");
  });
  it("filtra por grupo e busca, do mais novo para o mais antigo", () => {
    expect(filtrarEventos(ev, new Set(["entrada", "saida"]), "").map((e) => e.tipo)).toEqual(["saida", "entrada"]);
    expect(filtrarEventos(ev, new Set(TODOS_GRUPOS), "oficina").map((e) => e.tipo)).toEqual(["status"]);
  });
  it("conta por grupo", () => {
    expect(contarPorGrupo(ev)).toEqual({ entrada: 1, saida: 1, status: 1, sinal: 2 });
  });
  it("agrupa pela hora LOCAL (14h em Ipatinga, não 17h UTC)", () => {
    const g = agruparPorHora(filtrarEventos(ev, new Set(TODOS_GRUPOS), ""));
    expect(g.map((x) => [x.rotulo, x.eventos.length])).toEqual([["15:00 – 15:59", 3], ["14:00 – 14:59", 2]]);
  });
});

describe("abertura do dia", () => {
  const abertura = { t: "2026-10-03T03:02:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "abertura" as const, status: "Ligado", area: "PATIO", sem_sinal: false };
  const entrada = { t: "2026-10-03T12:00:00.000Z", id: "10", placa: "EGC2985", vaga: "", tipo: "entrada" as const, area: "PATIO", lat: 0, lng: 0 };
  it("abertura não é alerta: fora da lista e das contagens", () => {
    expect(ehAlerta(abertura)).toBe(false);
    expect(ehAlerta(entrada)).toBe(true);
    expect(filtrarEventos([abertura, entrada], new Set(TODOS_GRUPOS), "")).toEqual([entrada]);
    expect(contarPorGrupo([abertura, entrada])).toEqual({ entrada: 1, saida: 0, status: 0, sinal: 0 });
  });
});

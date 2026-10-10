import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../tipos";
import type { LinhaMotorFrota } from "./dia-frota";
import { excecoesDoDia, intervalosDeArea, type EntradaExcecoes } from "./excecoes";

const D = "2026-10-07"; // quarta
const V = "2026-10-06"; // véspera
const H = 3600;
const PATIO = "PÁTIO DO TRANSPORTE RODOVIÁRIO";
const hs = (h: string) => { const [a, b] = h.split(":").map(Number); return a * H + b * 60; };
const ev = (id: string, tipo: string, dia: string, hora: string, area: string) => ({ id, tipo, t: `${dia}T${hora}:00-03:00`, area, placa: "", vaga: "" }) as unknown as Evento;
const m = (id: string, i: string, f: string, status: string): LinhaMotorFrota => ({ placa_ou_codigo: id, inicio: `${D} ${i}:00`, fim: `${D} ${f}:00`, status, status_label: null });
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", o: { regime?: string | null; vaga?: string; status?: "ATIVO" | "EM_MANUTENCAO" } = {}): Veiculo =>
  ({ id, placa, vaga: o.vaga ?? "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0, posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false,
     equip: { tipo, nome: placa, ordem: 1, regime: o.regime ?? null, status: o.status ?? "ATIVO" } }) as Veiculo;

// 1: Alta Pressão ADM. Sai tarde, passa na Servitec, fica ocioso, desliga, almoça demais, volta ao Pátio no meio,
//    vai à Oficina Centro e chega cedo.
const E1 = [
  ev("1", "abertura", V, "00:05", PATIO),
  ev("1", "saida", D, "08:10", PATIO),
  ev("1", "entrada", D, "08:30", "OFICINA GPS/SERVITEC"), ev("1", "saida", D, "08:50", "OFICINA GPS/SERVITEC"),
  ev("1", "entrada", D, "11:00", "RESTAURANTE DA LUA"), ev("1", "saida", D, "12:20", "RESTAURANTE DA LUA"),
  ev("1", "entrada", D, "13:00", PATIO), ev("1", "saida", D, "13:30", PATIO),
  ev("1", "entrada", D, "14:00", "OFICINA CENTRO"), ev("1", "saida", D, "14:20", "OFICINA CENTRO"),
  ev("1", "entrada", D, "16:00", PATIO),
];
const M1 = [m("1", "09:00", "09:45", "stopped"), m("1", "10:00", "11:10", "off"), m("1", "14:30", "15:40", "off")];
const T1 = [{ placa: "EGC2985", demora_cod: 9, inicio: `${D} 14:30:00`, fim: `${D} 15:30:00`, categoria_demora: "Refeição Motorista", motorista: null, concluido: "SIM" }];
// 2: Auto Vácuo 24 horas (pela vaga). Chega cedo do turno da noite, sai tarde de manhã, para na bica.
const E2 = [
  ev("2", "abertura", V, "00:05", "ALTO FORNO 3"),
  ev("2", "saida", V, "02:00", "ALTO FORNO 3"),
  ev("2", "entrada", D, "05:30", PATIO), ev("2", "saida", D, "07:40", PATIO),
  ev("2", "entrada", D, "09:00", "ABAST ÁGUA"), ev("2", "saida", D, "09:10", "ABAST ÁGUA"),
];
const M2 = [m("2", "10:00", "11:30", "stopped")];
// 3: Hiper Vácuo em manutenção, parado no Pátio e desligado o dia todo: nada.
const E3 = [ev("3", "abertura", V, "00:05", PATIO)];
const M3 = [m("3", "08:00", "17:00", "off")];
// 4: sem regime na matriz nem na vaga (ADM presumido), fica no Pátio o dia todo.
const E4 = [ev("4", "abertura", V, "00:05", PATIO)];

const FROTA = [
  v("1", "EGC2985", "ap", { regime: "ADM" }),
  v("2", "EGC2993", "av", { vaga: "AUTO VÁCUO - GPS - 01 - 24 HS" }),
  v("3", "EAM3257", "hv", { regime: "ADM", status: "EM_MANUTENCAO" }),
  v("4", "DSY6477", "ap", { vaga: "ALTA PRESSÃO - GPS - 03" }),
];
const entrada = (o: Partial<EntradaExcecoes> = {}): EntradaExcecoes => ({ dia: D, agoraSeg: null, veiculos: FROTA, eventos: [...E1, ...E2, ...E3, ...E4], motor: [...M1, ...M2, ...M3], tablet: T1, ...o });
const resumo = (xs: ReturnType<typeof excecoesDoDia>, id: string) => xs.filter((x) => x.veiculo === id).map((x) => [x.regra, x.ini]);

describe("intervalos por área", () => {
  it("abertura, entradas e saídas viram intervalos (eixo desde a véspera)", () => {
    const DIA = 24 * H;
    expect(intervalosDeArea(E2, V, 2 * DIA)).toEqual([
      { area: "ALTO FORNO 3", a: 0, b: hs("02:00") },
      { area: PATIO, a: DIA + hs("05:30"), b: DIA + hs("07:40") },
      { area: "ABAST ÁGUA", a: DIA + hs("09:00"), b: DIA + hs("09:10") },
    ]);
  });
});

describe("exceções do dia", () => {
  const xs = excecoesDoDia(entrada());
  it("ADM: saída tarde, Servitec, ociosidade, motor desligado, restaurante, ida ao Pátio, Oficina Centro e chegada cedo", () => {
    expect(resumo(xs, "1")).toEqual([
      ["saida_tarde", hs("08:10")],
      ["servitec", hs("08:30")],
      ["ocioso", hs("09:00")],
      ["desligado", hs("10:00")],
      ["restaurante", hs("11:00")],
      ["patio", hs("13:00")],
      ["oficina_fora", hs("14:00")],
      ["chegada_cedo", hs("16:00")],
    ]);
    expect(xs.find((x) => x.regra === "saida_tarde" && x.veiculo === "1")?.detalhe).toBe("saiu 08:10 · limite 07:45");
    expect(xs.find((x) => x.regra === "restaurante")?.detalhe).toBe("1h20");
  });
  it("motor desligado com refeição apontada no tablet não vira alerta", () => {
    expect(xs.some((x) => x.veiculo === "1" && x.regra === "desligado" && x.ini === hs("14:30"))).toBe(false);
  });
  it("24 horas: chegada cedo do turno da noite, saída tarde de manhã e vácuo na bica; parado ligado do Alto Vácuo é produtivo", () => {
    expect(resumo(xs, "2")).toEqual([
      ["chegada_cedo", hs("05:30")],
      ["saida_tarde", hs("07:40")],
      ["bica_vacuo", hs("09:00")],
    ]);
  });
  it("em manutenção: nenhuma exceção de horário nem de motor", () => {
    expect(resumo(xs, "3")).toEqual([]);
  });
  it("não saiu do Pátio", () => {
    expect(xs.filter((x) => x.veiculo === "4").map((x) => [x.regra, x.detalhe])).toEqual([["saida_tarde", "não saiu do Pátio · limite 07:45"]]);
  });
  it("hoje pela metade: antes do horário passar, nada de 'não saiu'", () => {
    expect(resumo(excecoesDoDia(entrada({ agoraSeg: hs("07:00") })), "4")).toEqual([]);
    expect(resumo(excecoesDoDia(entrada({ agoraSeg: hs("09:00") })), "4")).toEqual([["saida_tarde", hs("07:45")]]);
  });
  it("sábado: ADM não tem expediente", () => {
    const S = "2026-10-10";
    const sab = excecoesDoDia({ dia: S, agoraSeg: null, veiculos: FROTA, eventos: [ev("4", "abertura", "2026-10-09", "00:05", PATIO)], motor: [], tablet: [] });
    expect(sab).toEqual([]);
  });
});

describe("Pátio e Servitec são vizinhos: o GPS pula de uma cerca para a outra", () => {
  const S = "OFICINA GPS/SERVITEC";
  const pula = [
    ev("5", "abertura", V, "00:05", PATIO),
    ev("5", "saida", D, "07:30", PATIO),
    // no meio do expediente: chega ao Pátio e fica na divisa com a Servitec
    ev("5", "entrada", D, "10:00", PATIO),
    ev("5", "entrada", D, "10:10", S),
    ev("5", "entrada", D, "10:20", PATIO),
    ev("5", "entrada", D, "10:30", S),
    ev("5", "saida", D, "10:50", S),
    // sai 3 min e volta (GPS): conta como a mesma ida
    ev("5", "entrada", D, "10:53", PATIO),
    ev("5", "saida", D, "11:00", PATIO),
    // ida ao Pátio sem passar na Servitec
    ev("5", "entrada", D, "13:00", PATIO),
    ev("5", "saida", D, "13:20", PATIO),
  ];
  it("uma ida que passa pela Servitec vira uma exceção só de Servitec; sem Servitec, Ida ao Pátio", () => {
    const xs = excecoesDoDia({ dia: D, agoraSeg: null, veiculos: [v("5", "EGC2970", "ap", { regime: "ADM" })], eventos: pula, motor: [], tablet: [] });
    expect(xs.map((x) => [x.regra, x.ini, x.fim])).toEqual([
      ["servitec", hs("10:10"), hs("10:50")],
      ["patio", hs("13:00"), hs("13:20")],
    ]);
  });
});
describe("velocidade (regra 10)", () => {
  it("excessos do dia viram exceção com a velocidade máxima; de outro dia, não", () => {
    const xs = excecoesDoDia({
      dia: D, agoraSeg: null, veiculos: [v("1", "EGC2985", "ap", { regime: "ADM" })], eventos: [], motor: [], tablet: [],
      excessos: [
        { dia: D, veiculo_id: "1", ini: hs("10:00"), fim: hs("10:01"), vel_max: 47.6, lat: 0, lng: 0 },
        { dia: V, veiculo_id: "1", ini: hs("10:00"), fim: hs("10:01"), vel_max: 60, lat: 0, lng: 0 },
      ],
    });
    expect(xs.map((x) => [x.regra, x.ini, x.detalhe])).toEqual([["velocidade", hs("10:00"), "48 km/h · limite 30 km/h"]]);
  });
});

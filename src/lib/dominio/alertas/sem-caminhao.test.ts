import { describe, expect, it } from "vitest";
import type { LinhaMotorFrota } from "../dia-frota";
import { REGRAS_PADRAO } from "./config";
import { alertasSemCaminhao, janelaDaJornada, lacunasSemCaminhao } from "./sem-caminhao";

const AP08 = "ALTA PRESSÃO - GPS - 08 - 24 HS";
const AP02 = "ALTA PRESSÃO - GPS - 02";
const AP07 = "ALTA PRESSÃO - GPS - 07 - 16 HS";
const l = (vaga: string, ini: string, fim: string, status = "not_appropriated", dia = "2026-11-11"): LinhaMotorFrota => ({
  placa_ou_codigo: status === "not_appropriated" ? "" : "X",
  vaga_nome: vaga,
  inicio: `${dia} ${ini}:00`,
  fim: `${dia} ${fim}:00`,
  status,
  status_label: null,
});
const H = 3600;

describe("jornada de cada regime", () => {
  it("24 h todo dia; ADM e 16 h só de seg a sex e sem feriado", () => {
    expect(janelaDaJornada(AP08, "2026-11-08")).toEqual([0, 24 * H]); // domingo
    expect(janelaDaJornada(AP02, "2026-11-11")).toEqual([7 * H, 16 * H + 48 * 60]); // quarta
    expect(janelaDaJornada(AP07, "2026-11-11")).toEqual([6 * H + 40 * 60, 22 * H + 40 * 60]);
    expect(janelaDaJornada(AP02, "2026-11-08")).toBeNull(); // domingo
    expect(janelaDaJornada(AP02, "2026-11-02")).toBeNull(); // Finados
    expect(janelaDaJornada(AP08, "2026-11-02")).toEqual([0, 24 * H]); // 4x4 trabalha no feriado
  });
});

describe("lacunas sem caminhão", () => {
  it("ADM: conta só a partir das 07:00 e até a última leitura; 30 min ou mais", () => {
    const r = lacunasSemCaminhao([l(AP02, "00:00", "10:00")], "2026-11-11", 10 * H + 5 * 60);
    expect(r).toEqual([{ vaga: AP02, ini: 7 * H, fim: 10 * H, aberta: true }]);
  });
  it("menos de 30 min não é alerta", () => {
    expect(lacunasSemCaminhao([l(AP02, "00:00", "07:20"), l(AP02, "07:20", "10:00", "on")], "2026-11-11", 10 * H)).toEqual([]);
  });
  it("trecho com caminhão vence o 'sem apropriação' velho no mesmo horário", () => {
    const r = lacunasSemCaminhao([l(AP08, "00:00", "10:00"), l(AP08, "02:00", "10:00", "off")], "2026-11-11", 10 * H);
    expect(r).toEqual([{ vaga: AP08, ini: 0, fim: 2 * H, aberta: false }]);
  });
  it("fora da jornada (domingo na ADM) e vaga que não é oficial: nada", () => {
    expect(lacunasSemCaminhao([l(AP02, "00:00", "12:00", "not_appropriated", "2026-11-08")], "2026-11-08", 12 * H)).toEqual([]);
    expect(lacunasSemCaminhao([l("ALTA PRESSÃO - GPS - 12", "00:00", "12:00")], "2026-11-11", 12 * H)).toEqual([]);
  });
});

describe("linhas de alerta", () => {
  it("marca o supervisor da vaga e fica na tela enquanto o robô novo está em teste", () => {
    const [a] = alertasSemCaminhao({ dia: "2026-11-11", agoraSeg: 10 * H, agoraIso: "2026-11-11T13:00:00Z", motor: [l(AP02, "00:00", "10:00")], historico: [], regra: REGRAS_PADRAO.sem_caminhao });
    expect(a).toMatchObject({ regra: "sem_caminhao", vaga: AP02, supervisor: "Junior Pereira", situacao: "aberto", destino: "tela", fim: null, ref: 7 * H });
    expect(a.chave).toBe(`sem_caminhao|vaga:${AP02}|2026-11-11|${7 * H}`);
    expect(a.detalhe).toBe("sem caminhão desde 07:00 (3 h 00 min)");
  });
  it("regra desligada no banco: nada", () => {
    expect(alertasSemCaminhao({ dia: "2026-11-11", agoraSeg: 10 * H, agoraIso: "", motor: [l(AP02, "00:00", "10:00")], historico: [], regra: { ...REGRAS_PADRAO.sem_caminhao, ativa: false } })).toEqual([]);
  });
});

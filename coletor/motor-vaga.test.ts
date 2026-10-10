import { describe, expect, it } from "vitest";
import { VAGAS, escolherVagas, juntarVagas, lerVagasDoHtml, linhasDaVaga, type ControleMotor } from "./motor-vaga";

const agora = new Date("2026-10-07T10:00:00");
const min = (m: number) => new Date(agora.getTime() - m * 60000).toISOString();
const v = (vaga: string, status = "Ligado", desdeMin = 5, o: { sem_sinal?: boolean; motor2_de?: string } = {}) => ({ vaga, status, status_desde: min(desdeMin), sem_sinal: false, ...o });
const AP1 = "ALTA PRESSÃO - GPS - 01 - 24 HS";
const AV1 = "AUTO VÁCUO - GPS - 01 - 24 HS";
const nomes = (b: ReturnType<typeof escolherVagas>) => b?.map((x) => x.vaga.nome) ?? null;

describe("quais vagas buscar no ciclo de 10 min", () => {
  it("ainda não deu 10 min desde o último ciclo: nada (null)", () => {
    expect(escolherVagas([v(AP1)], { ciclo: min(5), vagas: {} }, agora)).toBeNull();
  });
  it("com 9 min (disparo atrasado) já busca", () => {
    expect(nomes(escolherVagas([v(AP1)], { ciclo: min(9.5), vagas: {} }, agora))).toEqual([AP1]);
  });
  it("só as vagas com equipamento da frota (o motor 2º não conta) e sem as reservas", () => {
    const b = escolherVagas([v(AP1), v("[S/ VAGA]"), v(AV1, "Ligado", 5, { motor2_de: "10" })], { ciclo: null, vagas: {} }, agora);
    expect(nomes(b)).toEqual([AP1]);
  });
  it("caminhão desligado desde antes da última busca: pula até 1 h; depois busca de novo", () => {
    const controle: ControleMotor = { ciclo: min(10), vagas: { 530: { dia: "2026-10-07", em: min(10) } } };
    expect(nomes(escolherVagas([v(AP1, "Desligado", 30)], controle, agora))).toEqual([]);
    // desligou depois da última busca: busca (o fim do trecho ligado mudou)
    expect(nomes(escolherVagas([v(AP1, "Desligado", 5)], controle, agora))).toEqual([AP1]);
    // ligado: sempre busca
    expect(nomes(escolherVagas([v(AP1, "Ligado", 30)], controle, agora))).toEqual([AP1]);
    const velho: ControleMotor = { ciclo: min(10), vagas: { 530: { dia: "2026-10-07", em: min(61) } } };
    expect(nomes(escolherVagas([v(AP1, "Desligado", 120)], velho, agora))).toEqual([AP1]);
  });
  it("vaga buscada hoje que perdeu o caminhão da frota continua (de hora em hora)", () => {
    const controle: ControleMotor = { ciclo: min(10), vagas: { 311: { dia: "2026-10-07", em: min(70) } } };
    expect(nomes(escolherVagas([], controle, agora))).toEqual([AV1]);
  });
  it("1ª busca do dia: busca também o dia anterior uma vez", () => {
    const b = escolherVagas([v(AP1)], { ciclo: min(10), vagas: { 530: { dia: "2026-10-06", em: min(600) } } }, agora);
    expect(b?.[0].ontem).toBe("2026-10-06");
    expect(escolherVagas([v(AP1)], { ciclo: min(10), vagas: { 530: { dia: "2026-10-07", em: min(10) } } }, agora)?.[0].ontem).toBeNull();
  });
});

describe("resposta do GAUSS", () => {
  it("vira linhas de timeline_motor_vaga (placa_ou_codigo = id do veículo)", () => {
    const r = linhasDaVaga({ id: 530, nome: AP1 }, [{ start: "2026-10-07 09:26:39", end: "2026-10-07 09:36:39", status: "secondary_motor_on", status_: "Motor Secundário Ligado", total_time: 0.17, vacancy_info: { vehicle_cs_code: 4745269 } }]);
    expect(r).toEqual([{ vaga_id: 530, vaga_nome: AP1, inicio: "2026-10-07 09:26:39", fim: "2026-10-07 09:36:39", status: "secondary_motor_on", status_label: "Motor Secundário Ligado", tempo_total_horas: 0.17, placa_ou_codigo: "4745269" }]);
  });
});

describe("lista de vagas do GAUSS (1 vez por dia)", () => {
  const html = `<li><input type='checkbox' class='vacancy_530' id='x' name='vacancy[]' value='530' > <label for='x'>ALTA PRESSÃO - GPS - 01 - 24 HS</label></li>
    <li><input type="checkbox" name="vacancy[]" value="901"> <label for="y"> CAMINHÃO BROOK - GPS - 01 </label></li>
    <li><input type='checkbox' name='vacancy[]' value='902' > <label>ASPIRADOR INDUSTRIAL - GPS - 03</label></li>
    <li><input type='checkbox' name='vacancy[]' value='5' > <label>[S/ VAGA]</label></li>`;
  it("lê id e nome (aspas simples ou duplas) e ignora a reserva [S/ VAGA]", () => {
    expect(lerVagasDoHtml(html)).toEqual([
      { id: 530, nome: AP1 },
      { id: 901, nome: "CAMINHÃO BROOK - GPS - 01" },
      { id: 902, nome: "ASPIRADOR INDUSTRIAL - GPS - 03" },
    ]);
  });
  it("junta com as conhecidas sem repetir; Brook e Aspirador passam a ser buscados", () => {
    const vagas = juntarVagas(lerVagasDoHtml(html));
    expect(vagas).toHaveLength(VAGAS.length + 2);
    const b = escolherVagas([v("CAMINHÃO BROOK - GPS - 01"), v("ASPIRADOR INDUSTRIAL - GPS - 03")], { ciclo: null, vagas: {} }, agora, vagas);
    expect(b?.map((x) => x.vaga.id)).toEqual([901, 902]);
  });
  it("formato desconhecido: lista vazia (o coletor segue com as conhecidas)", () => {
    expect(lerVagasDoHtml("<div>nada</div>")).toEqual([]);
  });
});

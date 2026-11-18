import { describe, expect, it } from "vitest";
import {
  VAGAS,
  apontamentosSumidos,
  cortarNoDia,
  escolherVagas,
  juntarVagas,
  lerVagasDoHtml,
  linhasDaVaga,
  veiculoDaVaga,
  veiculoDoTrecho,
  type ControleMotor,
  type SegmentoGauss,
  type Vaga,
} from "./motor-vaga";

const agora = new Date("2026-10-07T10:00:00");
const min = (m: number) => new Date(agora.getTime() - m * 60000).toISOString();
const v = (vaga: string, status = "Ligado", desdeMin = 5, o: { id?: string; sem_sinal?: boolean; motor2_de?: string } = {}) => ({
  id: vaga,
  vaga,
  status,
  status_desde: min(desdeMin),
  sem_sinal: false,
  ...o,
});
const AP1 = "ALTA PRESSÃO - GPS - 01 - 24 HS";
const AV1 = "AUTO VÁCUO - GPS - 01 - 24 HS";
const nomes = (b: ReturnType<typeof escolherVagas>) => b?.map((x) => x.vaga.nome) ?? null;

const so = (...vagas: Vaga[]) => vagas;
const AP1V = { id: 530, nome: AP1 };
const AV1V = { id: 311, nome: AV1 };
const c2 = (vagas: ControleMotor["vagas"], ciclo: string | null = min(10)): ControleMotor => ({ ciclo, vagas, versao: 2 });

describe("quais vagas buscar no ciclo de 10 min", () => {
  it("ainda não deu 10 min desde o último ciclo: nada (null)", () => {
    expect(escolherVagas([v(AP1)], c2({}, min(5)), agora)).toBeNull();
  });
  it("com 9 min (disparo atrasado) já busca", () => {
    expect(nomes(escolherVagas([v(AP1)], c2({}, min(9.5)), agora, so(AP1V)))).toEqual([AP1]);
  });
  it("as vagas que a Mecanizada opera, mesmo sem caminhão da planilha nela; nunca as de outras empresas", () => {
    const vagas = [AP1V, AV1V, { id: 9001, nome: "ALTA PRESSÃO - SERVITEC - 01" }, { id: 9002, nome: "CAMINHÃO BROOK - GPS - 02" }, { id: 9003, nome: "CAMINHÃO PIPA - GPS - 01" }, { id: 9004, nome: "ALTA PRESSÃO - GPS - 12" }];
    // só as 22 vagas do dono (vagas-oficiais.ts): Brook, Pipa e AP-12, também da GPS, ficam de fora
    expect(nomes(escolherVagas([], c2({}), agora, vagas))).toEqual([AP1, AV1]);
  });
  it("controle antigo (antes de 15/10, caminhão errado nas linhas): busca todas de novo, sem a vaga quieta", () => {
    const antigo: ControleMotor = {
      ciclo: min(10),
      vagas: { 530: { dia: "2026-10-07", em: min(10) } },
    };
    expect(nomes(escolherVagas([v(AP1, "Desligado", 30)], antigo, agora, so(AP1V, AV1V)))).toEqual([AP1, AV1]);
  });
  it("caminhão desligado desde antes da última busca: pula até 1 h; depois busca de novo", () => {
    const controle = c2({ 530: { dia: "2026-10-07", em: min(10) } });
    expect(nomes(escolherVagas([v(AP1, "Desligado", 30)], controle, agora, so(AP1V)))).toEqual([]);
    // desligou depois da última busca: busca (o fim do trecho ligado mudou)
    expect(nomes(escolherVagas([v(AP1, "Desligado", 5)], controle, agora, so(AP1V)))).toEqual([AP1]);
    // ligado: sempre busca
    expect(nomes(escolherVagas([v(AP1, "Ligado", 30)], controle, agora, so(AP1V)))).toEqual([AP1]);
    const velho = c2({ 530: { dia: "2026-10-07", em: min(61) } });
    expect(nomes(escolherVagas([v(AP1, "Desligado", 120)], velho, agora, so(AP1V)))).toEqual([AP1]);
  });
  it("desligado há 45 a 90 min: busca todo ciclo (é quando vira o alerta de 1 h); fora disso, de hora em hora", () => {
    const controle = c2({ 530: { dia: "2026-10-07", em: min(10) } });
    expect(nomes(escolherVagas([v(AP1, "Desligado", 50)], controle, agora, so(AP1V)))).toEqual([AP1]);
    expect(nomes(escolherVagas([v(AP1, "Desligado", 85)], controle, agora, so(AP1V)))).toEqual([AP1]);
    expect(nomes(escolherVagas([v(AP1, "Desligado", 30)], controle, agora, so(AP1V)))).toEqual([]);
    expect(nomes(escolherVagas([v(AP1, "Desligado", 100)], controle, agora, so(AP1V)))).toEqual([]);
    // sem sinal: o GAUSS também não tem dado novo, segue de hora em hora
    expect(nomes(escolherVagas([v(AP1, "Desligado", 50, { sem_sinal: true })], controle, agora, so(AP1V)))).toEqual([]);
  });
  it("o caminhão que o GAUSS disse estar na vaga vale mais que a planilha", () => {
    // a planilha diz que o 10 (desligado) está na AP-01, mas o GAUSS disse que é o 20, ligado
    const frota = [v(AP1, "Desligado", 30, { id: "10" }), v("AUTO VÁCUO - GPS - 03", "Ligado", 30, { id: "20" })];
    const controle = c2({
      530: { dia: "2026-10-07", em: min(10), veiculo: "20" },
    });
    expect(nomes(escolherVagas(frota, controle, agora, so(AP1V)))).toEqual([AP1]);
  });
  it("vaga sem caminhão da frota: de hora em hora", () => {
    expect(nomes(escolherVagas([], c2({ 311: { dia: "2026-10-07", em: min(30) } }), agora, so(AV1V)))).toEqual([]);
    expect(nomes(escolherVagas([], c2({ 311: { dia: "2026-10-07", em: min(70) } }), agora, so(AV1V)))).toEqual([AV1]);
  });
  it("1ª busca do dia: busca também o dia anterior uma vez", () => {
    const b = escolherVagas([v(AP1)], c2({ 530: { dia: "2026-10-06", em: min(600) } }), agora, so(AP1V));
    expect(b?.[0].ontem).toBe("2026-10-06");
    expect(escolherVagas([v(AP1)], c2({ 530: { dia: "2026-10-07", em: min(10) } }), agora, so(AP1V))?.[0].ontem).toBeNull();
  });
});

// Trechos no formato da resposta real do GAUSS (captura da tela por vaga em 15/10/2026, vaga 530, campos enxutos)
const trecho = (start: string, end: string, status: string, veiculo: string | null, placa: string | null): SegmentoGauss => ({
  start,
  end,
  status,
  status_: status,
  bgColor: "#008000",
  total_time: 0.1,
  callback: `getModalInfosTimelineEngine('${veiculo ?? ""}', '${status}', '${start}', '${end}', '0');`,
  vehicle_name: placa,
  vehicle_data: veiculo ? { vehicle_cs_code: veiculo, vehicle_name: placa ?? "" } : {},
  // o caminhão da vaga AGORA: igual em todos os trechos
  vacancy_info: { vehicle_cs_code: "4745269" },
});

describe("resposta do GAUSS", () => {
  const msg = [
    trecho("2026-10-15 00:00", "2026-10-15 00:06:10", "not_appropriated", null, null),
    trecho("2026-10-15 00:06:10", "2026-10-15 04:10:00", "off", "4745269", "EAM-3253"),
    trecho("2026-10-15 06:50:00", "2026-10-15 06:51:28", "on", "25202864", "PUB2F80"),
  ];
  it("cada trecho fica com o caminhão DELE, nunca o da vaga agora (vacancy_info)", () => {
    const r = linhasDaVaga(AP1V, msg);
    expect(r.map((l) => [l.placa_ou_codigo, l.placa])).toEqual([
      ["", null],
      ["4745269", "EAM-3253"],
      ["25202864", "PUB2F80"],
    ]);
    expect(r[1]).toMatchObject({
      vaga_id: 530,
      vaga_nome: AP1,
      inicio: "2026-10-15 00:06:10",
      fim: "2026-10-15 04:10:00",
      status: "off",
      cor: "#008000",
    });
  });
  it("sem vehicle_data, o caminhão vem do callback do balão", () => {
    expect(veiculoDoTrecho({ ...msg[2], vehicle_data: [] })).toBe("25202864");
  });
  it("sem apropriação: sem caminhão, mesmo com vacancy_info", () => {
    expect(veiculoDoTrecho(msg[0])).toBe("");
  });
  it("o caminhão da vaga agora vem do vacancy_info (para a regra da vaga quieta)", () => {
    expect(veiculoDaVaga(msg)).toBe("4745269");
    expect(veiculoDaVaga([])).toBeUndefined();
  });
  it("corta na meia-noite e tira trecho vazio", () => {
    const l = linhasDaVaga(AP1V, [
      trecho("2026-10-14 23:50:00", "2026-10-15 00:10:00", "on", "1", "X"),
      trecho("2026-10-15 23:59:00", "2026-10-16 00:20:00", "on", "1", "X"),
      trecho("2026-10-15 05:00", "2026-10-15 05:00", "on", "1", "X"),
    ]);
    expect(cortarNoDia(l, "2026-10-15").map((x) => [x.inicio, x.fim])).toEqual([
      ["2026-10-15 00:00:00", "2026-10-15 00:10:00"],
      ["2026-10-15 23:59:00", "2026-10-16 00:00:00"],
    ]);
  });
});

describe("apontamentos do tablet que sumiram do GAUSS", () => {
  it("só os do dia, das placas buscadas (com ou sem hífen), que não vieram de novo", () => {
    const banco = [
      { demora_cod: 1, placa: "EAM-3253" },
      { demora_cod: 2, placa: "EAM3253" },
      { demora_cod: 3, placa: "OUTRA99" },
    ];
    expect(apontamentosSumidos(banco, ["EAM3253"], [1])).toEqual(["2"]);
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
  it("junta com as conhecidas sem repetir; Brook e Aspirador não são buscados (fora das 22 vagas do dono)", () => {
    const vagas = juntarVagas(lerVagasDoHtml(html));
    expect(vagas).toHaveLength(VAGAS.length + 2);
    const b = escolherVagas([], c2({}, null), agora, vagas);
    expect(b?.map((x) => x.vaga.id)).toEqual(VAGAS.map((v) => v.id));
  });
  it("formato desconhecido: lista vazia (o coletor segue com as conhecidas)", () => {
    expect(lerVagasDoHtml("<div>nada</div>")).toEqual([]);
  });
});

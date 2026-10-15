import { describe, expect, it } from "vitest";
import { duplicados, montarDiaVagas, rotuloTrecho, textoSobre, tipoDaVaga, trechosDaVaga, type ConferenciaVaga, type LinhaMotorVaga } from "./dia-vaga";

const DIA = "2026-10-15";
const AP1 = "ALTA PRESSÃO - GPS - 01 - 24 HS";
const AP5 = "ALTA PRESSÃO - GPS - 05";
const l = (vaga_id: number, vaga_nome: string, inicio: string, fim: string, status: string, veiculo = "", placa: string | null = null, gravado = "2026-10-15T14:00:00Z"): LinhaMotorVaga => ({
  vaga_id,
  vaga_nome,
  inicio: `${DIA} ${inicio}`,
  fim: `${DIA} ${fim}`,
  status,
  status_label: status,
  placa_ou_codigo: veiculo,
  placa,
  cor: null,
  gravado,
});

// o caso real de 15/10/2026: PUB2F80 e EAM-3253 trocaram de vaga entre AP-01 e AP-05
const linhas = [
  l(530, AP1, "00:00:00", "00:06:00", "not_appropriated"),
  l(530, AP1, "00:06:00", "06:00:00", "off", "1", "PUB2F80"),
  l(530, AP1, "06:00:00", "06:51:00", "on", "1", "PUB2F80"),
  l(530, AP1, "06:51:00", "12:51:00", "secondary_motor_on", "2", "EAM-3253"),
  l(527, AP5, "05:48:00", "12:51:00", "on", "1", "PUB2F80"),
  l(527, AP5, "12:52:00", "14:37:00", "off", "2", "EAM-3253"),
];

describe("Dia da frota por vaga (espelho do GAUSS)", () => {
  it("uma linha por vaga, na ordem do GAUSS, cada trecho com o seu caminhão", () => {
    const v = montarDiaVagas(linhas, DIA, null);
    expect(v.map((x) => x.nome)).toEqual([AP1, AP5]);
    expect(v[0].trechos.map((t) => [t.cod, t.placa])).toEqual([
      ["not_appropriated", null],
      ["off", "PUB2F80"],
      ["on", "PUB2F80"],
      ["secondary_motor_on", "EAM-3253"],
    ]);
    expect(v[0].caminhoes.map((c) => c.placa)).toEqual(["PUB2F80", "EAM-3253"]);
    // Alta Pressão: produtivo = motor 2º ligado (6 h); ligado = on + motor 2º
    expect(v[0].produtivo_min).toBe(360);
    expect(v[0].ligado_min).toBe(51 + 360);
  });
  it("vizinhos com o mesmo status mas caminhões diferentes não se juntam", () => {
    const t = trechosDaVaga([l(530, AP1, "08:00:00", "09:00:00", "on", "1", "A"), l(530, AP1, "09:00:00", "10:00:00", "on", "2", "B")], DIA);
    expect(t).toHaveLength(2);
  });
  it("linha gravada depois vence a sobreposição (linhas antigas de antes da troca do dia)", () => {
    const t = trechosDaVaga([l(530, AP1, "08:00:00", "10:00:00", "off", "9", "VELHO", "2026-10-15T09:00:00Z"), l(530, AP1, "08:00:00", "10:00:00", "on", "1", "CERTO")], DIA);
    expect(t.map((x) => [x.cod, x.placa])).toEqual([["on", "CERTO"]]);
  });
  it("conferência: avisa quando o banco não bate com o que o GAUSS mandou (mais de 1 min)", () => {
    const conf: ConferenciaVaga[] = [
      {
        vaga_id: "530",
        minutos: {
          not_appropriated: 6,
          off: 354,
          on: 51,
          secondary_motor_on: 360,
        },
        trechos: 4,
        buscado_em: "2026-10-15T14:00:00Z",
      },
      {
        vaga_id: 527,
        minutos: { on: 423, off: 90 },
        trechos: 2,
        buscado_em: "2026-10-15T14:00:00Z",
      },
    ];
    const v = montarDiaVagas(linhas, DIA, null, conf);
    expect(v[0].conferencia?.ok).toBe(true);
    expect(v[1].conferencia?.diferencas).toEqual([{ cod: "off", banco: 105, gauss: 90 }]);
  });
  it("caminhão em duas vagas ao mesmo tempo é apontado", () => {
    expect(duplicados(montarDiaVagas(linhas, DIA, null))).toEqual([{ placa: "PUB2F80", vagas: [AP1, AP5], min: 63 }]);
  });
  it("status agora (só hoje)", () => {
    expect(montarDiaVagas(linhas, DIA, 7 * 3600)[0].agora?.placa).toBe("EAM-3253");
  });
  it("tipo pelo nome da vaga, rótulo e cor do texto como no GAUSS", () => {
    expect([tipoDaVaga(AP1), tipoDaVaga("AUTO VÁCUO - GPS - 03"), tipoDaVaga("HIPER VÁCUO - GPS - 04"), tipoDaVaga("CAMINHÃO BROOK - GPS - 01")]).toEqual(["ap", "av", "hv", "pg"]);
    expect(rotuloTrecho(DIA, 8 * 3600 + 15 * 60, 10 * 3600 + 20 * 60)).toBe("15/10 08:15 ~ 15/10 10:20");
    expect(rotuloTrecho(DIA, 0, 86400)).toBe("15/10 00:00 ~ 15/10 23:59");
    expect([textoSobre("#FFFF00"), textoSobre("#008000"), textoSobre("#c5c7cc"), textoSobre("#000")]).toEqual(["#111111", "#ffffff", "#111111", "#ffffff"]);
  });
});

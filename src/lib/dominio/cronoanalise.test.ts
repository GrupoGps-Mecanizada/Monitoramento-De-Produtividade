import { describe, expect, it } from "vitest";
import { classeDe, conferir, familiaDe, montarTurnos, padraoVagaGauss, periodoDoTurno, rankingAtividades, relogio, resumoPessoas, reguaDoTurno, segDaFolha, tipoDaVaga, unir, type LinhaCrono } from "./cronoanalise";

const linha = (p: Partial<LinhaCrono>): LinhaCrono => ({
  data: "2026-10-07",
  turno: "A",
  horario: "19h às 07h",
  area: "Alto Forno",
  nome: "Bruno Ribeiro",
  papel: "Motorista",
  placa: "EAM3253",
  vaga: "AP-01",
  equip: "Alta Pressão",
  hi: "18:40",
  hf: "19:00",
  cod: 6,
  descricao: "DDS",
  cls: "Improdutivo necessário",
  obs: null,
  supervisor: "Ozias",
  kit: "CR-0002",
  ...p,
});

describe("régua do turno", () => {
  it("noite: hora antes do meio-dia é do dia seguinte", () => {
    expect(periodoDoTurno("19h às 07h")).toBe("noite");
    expect(periodoDoTurno("19–07")).toBe("noite");
    expect(periodoDoTurno("07–19")).toBe("dia");
    expect(periodoDoTurno(null, [{ hi: "02:00" }])).toBe("noite");
    expect(segDaFolha("18:40", "noite")).toBe(18 * 3600 + 40 * 60);
    expect(segDaFolha("01:00", "noite")).toBe(86400 + 3600);
    expect(segDaFolha("10:00", "dia")).toBe(36000);
  });

  it("turno da noite começa 18:40 e vira o dia", () => {
    const [t] = montarTurnos([linha({ hi: "18:40", hf: "19:00" }), linha({ hi: "23:30", hf: "00:30", cod: 32, descricao: "Hidrojateamento – Pistola", cls: "Produzindo" }), linha({ hi: "06:00", hf: "06:40", cod: 17, descricao: "Troca de Turno" })]);
    expect(t.inicio).toBe("2026-10-07T18:40:00");
    expect(t.duracao).toBe(12 * 3600);
    expect(t.periodo).toBe("noite");
    expect(t.letra).toBe("A");
    expect(t.supervisor).toBe("Ozias");
    const b = t.pessoas[0].blocos;
    expect(b[1]).toMatchObject({ a: (23 * 60 + 30 - (18 * 60 + 40)) * 60, b: (24 * 60 + 30 - (18 * 60 + 40)) * 60, classe: "produzindo" });
    expect(relogio(t, b[2].a)).toBe("06:00");
    const regua = reguaDoTurno(t);
    expect(regua("2026-10-08 00:00:00")).toBe((5 * 60 + 20) * 60);
    expect(regua("2026-10-07T10:00:00")).toBe(0);
    expect(regua("2026-10-09 10:00:00")).toBe(t.duracao);
  });

  it("folha que começa antes do horário estica a régua", () => {
    const [t] = montarTurnos([linha({ hi: "18:10", hf: "18:40" }), linha({ hi: "18:40", hf: "19:00" })]);
    expect(t.inicio).toBe("2026-10-07T18:10:00");
    expect(t.duracao).toBe(12 * 3600 + 30 * 60);
  });

  it("separa turnos por dia, letra e placa e ordena pessoas por papel", () => {
    const ts = montarTurnos([
      linha({ placa: "EAM-3253", nome: "Paulo", papel: "Operador 1" }),
      linha({ nome: "Bruno", papel: "Motorista" }),
      linha({ placa: "EGC2989", vaga: "AP-08" }),
      linha({ data: "2026-10-08" }),
    ]);
    expect(ts).toHaveLength(3);
    expect(ts[0].data).toBe("2026-10-08");
    const ap01 = ts.find((t) => t.data === "2026-10-07" && t.placa === "EAM3253")!;
    expect(ap01.pessoas.map((p) => p.papel)).toEqual(["Motorista", "Operador 1"]);
  });
});

describe("classes, famílias e tipo", () => {
  it("classifica", () => {
    expect(classeDe("Produzindo")).toBe("produzindo");
    expect(classeDe("Improdutivo necessário")).toBe("necessario");
    expect(classeDe("Improdutivo")).toBe("improdutivo");
    expect(classeDe(null)).toBe("sem");
  });
  it("famílias juntam textos diferentes do tablet e da folha", () => {
    expect(familiaDe("Refeição Motorista")).toBe(familiaDe("Almoço / Refeição"));
    expect(familiaDe("DDS/Check-List - LM")).toBe(familiaDe("Checklist"));
    expect(familiaDe("Abastecimento (Água) - LM")).toBe(familiaDe("Abastec. / Carreg. de Água"));
    expect(familiaDe("Hidrojateamento – Pistola")).toBeNull();
    expect(familiaDe("Aguardando Cliente/Usiminas")).toBe("Aguardando");
  });
  it("tipo pela vaga", () => {
    expect(tipoDaVaga("AP-01")).toBe("ap");
    expect(tipoDaVaga("AV-08")).toBe("av");
    expect(tipoDaVaga(null, "Alta Pressão")).toBe("ap");
  });
  it("vaga da folha vira o nome da vaga no GAUSS", () => {
    expect(padraoVagaGauss("AP-01")).toBe("ALTA PRESS% - GPS - 01%");
    expect(padraoVagaGauss("AV-8")).toBe("AUTO V% - GPS - 08%");
    expect(padraoVagaGauss("ASP-03")).toBe("ASPIRADOR% - GPS - 03%");
    expect(padraoVagaGauss(null)).toBeNull();
  });
  it("une faixas", () => {
    expect(unir([{ a: 10, b: 20 }, { a: 0, b: 10 }, { a: 30, b: 40 }])).toEqual([{ a: 0, b: 20 }, { a: 30, b: 40 }]);
  });
});

describe("conferência", () => {
  // AP-01 na noite de 07/10: produzindo 20:00–21:00 (bomba ligada) e 22:00–23:00 (bomba desligada)
  const [t] = montarTurnos([
    linha({ hi: "18:40", hf: "20:00", cod: 3, descricao: "Trajeto", cls: "Improdutivo necessário" }),
    linha({ hi: "20:00", hf: "21:00", cod: 66, descricao: "Operação do motor estacionário / bomba (RPM)", cls: "Produzindo" }),
    linha({ hi: "21:00", hf: "22:00", cod: 5, descricao: "Almoço / Refeição", cls: "Improdutivo necessário" }),
    linha({ hi: "22:00", hf: "23:00", cod: 32, descricao: "Hidrojateamento – Pistola", cls: "Produzindo" }),
    linha({ hi: "23:00", hf: "00:00", cod: 29, descricao: "Aguardando Cliente/Usiminas", cls: "Improdutivo" }),
  ]);
  const motor = [
    { inicio: "2026-10-07 18:40:00", fim: "2026-10-07 20:00:00", status: "on", status_label: "Motor Ligado" },
    { inicio: "2026-10-07 20:00:00", fim: "2026-10-07 21:00:00", status: "secondary_motor_on", status_label: "Motor Secundário Ligado" },
    { inicio: "2026-10-07 21:00:00", fim: "2026-10-07 23:00:00", status: "off", status_label: "Motor Desligado" },
    // bomba ligada sem ninguém produzindo na folha
    { inicio: "2026-10-07 23:00:00", fim: "2026-10-08 00:00:00", status: "secondary_motor_on", status_label: "Motor Secundário Ligado" },
  ];
  const tablet = [
    { demora_cod: 1, inicio: "2026-10-07 21:00:00", fim: "2026-10-07 21:50:00", categoria_demora: "Refeição Motorista", motorista: "--", concluido: "Sim" },
    { demora_cod: 2, inicio: "2026-10-07 23:05:00", fim: "2026-10-07 23:40:00", categoria_demora: "Abastecimento (Água) - LM", motorista: "--", concluido: "Sim" },
  ];
  const c = conferir(t, motor, tablet, new Date(2026, 9, 9));

  it("usa a regra do Alta Pressão (motor 2º)", () => {
    expect(c.produtivo).toBe("secondary_motor_on");
    expect(c.minEquipeProduzindo).toBe(120);
    expect(c.minMotorProdutivo).toBe(120);
    expect(c.minFolha).toBe(320);
  });

  it("concordância minuto a minuto", () => {
    // 320 min de folha; discordam 22:00–23:00 (produzindo sem bomba) e 23:00–00:00 (bomba sem produzindo)
    expect(c.concordancia).toBe(Math.round(((320 - 120) / 320) * 100));
  });

  it("escreve o que não bate", () => {
    const textos = c.frases.map((f) => f.texto);
    expect(textos.some((x) => x.includes("A folha diz produzindo") && x.includes("Bruno") && x.includes("Motor desligado"))).toBe(true);
    expect(textos.some((x) => x.includes("ninguém marcou produzindo") && x.includes("Aguardando Cliente/Usiminas"))).toBe(true);
    expect(textos.some((x) => x.includes('Tablet: "Abastecimento (Água) - LM"'))).toBe(true);
    // refeição no tablet e na folha: bate, não vira frase
    expect(textos.some((x) => x.includes("Refeição Motorista"))).toBe(false);
    expect(c.tabletConfere).toBe(Math.round((50 / 85) * 100));
  });

  it("tipo sem regra não inventa concordância", () => {
    const [hv] = montarTurnos([linha({ vaga: "HV-03", equip: "Hiper Vácuo", placa: "ABC1234" })]);
    const r = conferir(hv, motor, []);
    expect(r.produtivo).toBeNull();
    expect(r.concordancia).toBeNull();
  });
});

describe("colaboradores", () => {
  const ts = montarTurnos([
    linha({ hi: "18:40", hf: "19:40", cod: 32, descricao: "Hidrojateamento – Pistola", cls: "Produzindo" }),
    linha({ hi: "19:40", hf: "20:10", cod: 5, descricao: "Almoço / Refeição" }),
    linha({ nome: "Paulo", papel: "Operador 1", hi: "18:40", hf: "20:40", cod: 32, descricao: "Hidrojateamento – Pistola", cls: "Produzindo" }),
  ]);
  it("resume horas por classe e principais atividades", () => {
    const [bruno, paulo] = resumoPessoas(ts[0]);
    expect(bruno.min.produzindo).toBe(60);
    expect(bruno.min.necessario).toBe(30);
    expect(bruno.principais[0].descricao).toBe("Hidrojateamento – Pistola");
    expect(paulo.total).toBe(120);
  });
  it("ranking de atividades", () => {
    const r = rankingAtividades(ts);
    expect(r[0]).toMatchObject({ descricao: "Hidrojateamento – Pistola", min: 180, pessoas: 2, turnos: 1 });
  });
});

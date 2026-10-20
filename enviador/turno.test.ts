import { describe, expect, it } from "vitest";
import { barra, montarRelatorio, resumirVagas, turnoEncerrado, type ApontTurno, type EventoTurno, type LinhaTurno } from "./turno";

const em = (iso: string) => new Date(`${iso}-03:00`);

describe("qual turno acabou", () => {
  it("o dia acaba às 18:40 e o relatório sai 20 min depois (o coletor busca o GAUSS a cada ~10 min)", () => {
    expect(turnoEncerrado(em("2026-10-20T18:59:00"))).toBeNull();
    const t = turnoEncerrado(em("2026-10-20T19:00:00"))!;
    expect(t).toMatchObject({ chave: "2026-10-20|dia", periodo: "dia", letra: "C", supervisor: "Israel", ini: "2026-10-20 06:40:00", fim: "2026-10-20 18:40:00" });
  });
  it("a noite pertence ao dia em que começou e acaba às 06:40 do dia seguinte", () => {
    const t = turnoEncerrado(em("2026-10-21T07:05:00"))!;
    expect(t).toMatchObject({ chave: "2026-10-20|noite", periodo: "noite", letra: "B", supervisor: "Matusalem", ini: "2026-10-20 18:40:00", fim: "2026-10-21 06:40:00" });
  });
  it("PC ligado muito depois (mais de 3 h do fim): o relatório velho não sai", () => {
    expect(turnoEncerrado(em("2026-10-20T21:41:00"))).toBeNull();
    expect(turnoEncerrado(em("2026-10-20T12:00:00"))).toBeNull();
  });
});

const TURNO = { ini: "2026-10-20 06:40:00", fim: "2026-10-20 18:40:00" };
const AP01 = "ALTA PRESSÃO - GPS - 01 - 24 HS";
const AV08 = "AUTO VÁCUO - GPS - 08 - 24 HS";
const lin = (vaga_nome: string, placa: string, inicio: string, fim: string, status: string): LinhaTurno => ({ vaga_nome, placa, placa_ou_codigo: placa, inicio: `2026-10-20 ${inicio}:00`, fim: `2026-10-20 ${fim}:00`, status });

describe("resumo de cada vaga no turno", () => {
  it("só as 4 vagas de 24 h; produtivo pela regra do tipo e ocioso = motor desligado, cortado no horário do turno", () => {
    const linhas = [
      lin(AP01, "EGC2983", "05:00", "08:40", "secondary_motor_on"), // 2 h dentro do turno (06:40–08:40)
      lin(AP01, "EGC2983", "08:40", "09:40", "stopped"), // ligado parado: não entra
      lin(AP01, "EGC2983", "09:40", "10:10", "on"), // andando ligado: deslocamento, não entra
      lin(AP01, "EGC2983", "10:10", "11:10", "off"), // ocioso 1 h
      lin(AP01, "EGC2983", "11:10", "11:40", "main_switch_off"), // chave geral desligada: ocioso 30 min
      lin(AV08, "HKT4410", "07:00", "10:00", "stopped"), // Auto Vácuo: parado ligado é produtivo
      lin(AV08, "HKT4410", "10:00", "10:45", "off"),
      lin("ALTA PRESSÃO - GPS - 03", "DSY6475", "07:00", "10:00", "secondary_motor_on"), // vaga ADM: fora
    ];
    const r = resumirVagas(linhas, [], [], TURNO);
    expect(r.map((v) => v.vaga)).toEqual(["AP 01", "AP 08", "AV 01", "AV 08"]);
    expect(r[0]).toMatchObject({ placas: ["EGC2983"], produtivo_min: 120, ocioso_min: 90 });
    expect(r[1]).toMatchObject({ placas: [], produtivo_min: 0, ocioso_min: 0 });
    expect(r[3]).toMatchObject({ placas: ["HKT4410"], produtivo_min: 180, ocioso_min: 45 });
  });
  it("bomba ligada na base (Pátio do Transporte, Garagem) não conta como produtivo, igual ao site", () => {
    const ev = (t: string, tipo: string, area: string): EventoTurno => ({ t: `2026-10-20T${t}:00-03:00`, placa: "EGC2983", tipo, area });
    const eventos = [ev("06:00", "abertura", "PÁTIO DO TRANSPORTE"), ev("07:30", "entrada", "ACIARIA 2")];
    const r = resumirVagas([lin(AP01, "EGC2983", "07:00", "09:00", "secondary_motor_on")], eventos, [], TURNO);
    expect(r[0].produtivo_min).toBe(90); // 07:00–07:30 no Pátio do Transporte fica de fora
    // a Baia de Resíduos fica no Pátio, mas é serviço: conta
    const baia = resumirVagas([lin(AP01, "EGC2983", "07:00", "09:00", "secondary_motor_on")], [ev("06:00", "abertura", "BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO")], [], TURNO);
    expect(baia[0].produtivo_min).toBe(120);
  });
  it("trecho repetido não conta duas vezes", () => {
    const r = resumirVagas([lin(AP01, "EGC2983", "07:00", "08:00", "secondary_motor_on"), lin(AP01, "EGC2983", "07:30", "08:00", "secondary_motor_on")], [], [], TURNO);
    expect(r[0].produtivo_min).toBe(60);
  });
  it("áreas pelo tempo que o caminhão ficou nelas (fora da base, 10 min ou mais) e apontamentos do tablet agrupados", () => {
    const ev = (t: string, tipo: string, area: string): EventoTurno => ({ t: `2026-10-20T${t}:00-03:00`, placa: "EGC2983", tipo, area });
    const eventos = [
      ev("06:00", "abertura", "PÁTIO DO TRANSPORTE"),
      ev("07:00", "entrada", "PÁTIOS PRIMÁRIOS"),
      ev("07:05", "entrada", "PORTARIA"), // 5 min: passagem, não conta
      ev("07:10", "entrada", "ACIARIA 2"),
      ev("07:20", "entrada", "RESTAURANTE DA SOL"), // apoio, não é atendimento
      ev("07:50", "entrada", "ACIARIA 2"),
      ev("08:00", "saida", "ACIARIA 2"),
      ev("08:00", "entrada", "PÁTIOS PRIMÁRIOS"),
      ev("11:00", "entrada", "GARAGEM"),
    ];
    const apont: ApontTurno[] = [
      { placa: "EGC2983", inicio: "2026-10-20 11:00:00", fim: "2026-10-20 12:00:00", categoria_demora: "REFEIÇÃO", motorista: "JOSÉ DA SILVA" },
      { placa: "EGC2983", inicio: "2026-10-20 11:30:00", fim: "2026-10-20 11:45:00", categoria_demora: "DOCUMENTAÇÃO", motorista: "JOSÉ DA SILVA" }, // dentro da refeição: o tempo não soma 2 vezes
      { placa: "EGC2983", inicio: "2026-10-20 15:00:00", fim: "2026-10-20 15:30:00", categoria_demora: "REFEIÇÃO", motorista: "--" },
      { placa: "EGC2983", inicio: "2026-10-20 16:00:00", fim: null, categoria_demora: "AGUARDANDO LIBERAÇÃO DE ÁREA", motorista: "--" }, // aberto: até o fim do turno
      { placa: "EGC2983", inicio: "2026-10-20 05:00:00", fim: "2026-10-20 06:00:00", categoria_demora: "REFEIÇÃO" }, // antes do turno
      { placa: "OUTRA", inicio: "2026-10-20 09:00:00", fim: "2026-10-20 10:00:00", categoria_demora: "MANUTENÇÃO" },
    ];
    const r = resumirVagas([lin(AP01, "EGC2983", "06:40", "18:40", "on")], eventos, apont, TURNO);
    expect(r[0].areas).toEqual(["Pátios Primários", "Aciaria 2"]);
    expect(r[0].apontamentos).toBe(4);
    // justificado: 60 + 30 + 160 (16:00 até 18:40)
    expect(r[0]).toMatchObject({ justificado_min: 250, motorista: "José da Silva" });
  });
});

describe("texto do relatório (cartão por vaga, escolhido pelo dono em 20/10/2026)", () => {
  it("barra de 10 blocos pela parte do turno", () => {
    expect(barra(0)).toBe("▱▱▱▱▱▱▱▱▱▱");
    expect(barra(0.62)).toBe("▰▰▰▰▰▰▱▱▱▱");
    expect(barra(1.4)).toBe("▰▰▰▰▰▰▰▰▰▰");
  });
  it("cabeçalho com turno, letra, data e supervisor; um cartão por vaga com motorista, local, apontamentos e 3 barras", () => {
    const turno = turnoEncerrado(em("2026-10-20T19:00:00"))!;
    const t = montarRelatorio(turno, [
      { vaga: "AP 01", placas: ["EGC2983"], motorista: "José da Silva", produtivo_min: 446, ocioso_min: 151, justificado_min: 95, areas: ["Pátios Primários", "Aciaria 2"], apontamentos: 3 },
      { vaga: "AP 08", placas: ["EGC2985"], motorista: null, produtivo_min: 60, ocioso_min: 0, justificado_min: 0, areas: [], apontamentos: 0 },
      { vaga: "AV 08", placas: [], motorista: null, produtivo_min: 0, ocioso_min: 0, justificado_min: 0, areas: [], apontamentos: 0 },
    ]);
    expect(t).toBe(
      [
        "*RELATÓRIO DE PRODUTIVIDADE DO TURNO*",
        "_Dia · Letra C · Terça, 20/10 · 06:40–18:40_",
        "Supervisor: *Israel*",
        "",
        "> *AP 01* · EGC2983",
        "*Motorista:* José da Silva",
        "*Local:* Pátios Primários · Aciaria 2",
        "*Apontamentos:* 3",
        "`Produtivo   ▰▰▰▰▰▰▱▱▱▱  62% 7h26`",
        "`Ocioso      ▰▰▱▱▱▱▱▱▱▱  21% 2h31`",
        "`Justificado ▰▱▱▱▱▱▱▱▱▱  13% 1h35`",
        "",
        "> *AP 08* · EGC2985",
        "*Local:* Sem registro",
        "*Apontamentos:* Nenhum",
        "`Produtivo   ▰▱▱▱▱▱▱▱▱▱   8% 1h00`",
        "`Ocioso      ▱▱▱▱▱▱▱▱▱▱   0% 0h00`",
        "`Justificado ▱▱▱▱▱▱▱▱▱▱   0% 0h00`",
        "",
        "> *AV 08*",
        "_Sem dados do GAUSS no turno_",
        "",
        "",
        "_Relatório de turno · GrupoGPS_",
      ].join("\n"),
    );
  });
});

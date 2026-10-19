import { describe, expect, it } from "vitest";
import {
  DIAS_INICIAIS,
  ENDERECO,
  camposDoObjeto,
  camposFiltro,
  coletarParteDiaria,
  compararParte,
  conferirChamada,
  lerLinha,
  type ControleParteDiaria,
  type DepsParteDiaria,
  type LinhaParteDiaria,
  type LinhaResumo,
} from "./parte-diaria";

// uma programação como o GAUSS devolve (formato da tela em 18/10/2026; nomes e telefones trocados)
const OBS =
  "<ul><li><b>LOCAL/ORIGEM:</b> CALDEIRA 130</li></ul><br><ul><li><b>ENDEREÇO DA ATIVIDADE:</b> RUA 19 - ÁREAS DAS CALDEIRAS 130</li></ul><br>" +
  "<ul><li><b>LOCAL ONDE O OPERADOR/MOTORISTA DEVE SE APRESENTAR:</b> RUA 19 - ÁREAS DAS CALDEIRAS 130</li></ul><br>" +
  "<ul><li><b>ATIVIDADE A SER EXECUTADA (DETALHAR O MÁXIMO POSSÍVEL):</b> *LIMPEZA DE GALERIAS *DRENO DE SEAL POTS</li></ul><br>" +
  "<ul><li><b>MATERIAL A SER COLETADO:</b> AGUA INDUSTRIAL</li></ul><br><ul><li><b>CLASSIFICAÇÃO DO MATERIAL:</b> CLASSE II - NÃO PERIGOSOS</li></ul><br>" +
  "<ul><li><b>DESTINO DO MATERIAL:</b> POÇO REDONDO</li></ul><br><ul><li><b>SERÁ TRABALHO EM ALTURA ?</b> Não</li></ul><br>" +
  "<ul><li><b>ATIVIDADE SERÁ EXECUTADA EM ANDAIME ?</b> Não</li></ul><br><ul><li><b>ATIVIDADE EM ESPAÇO CONFINADO ?</b> Não</li></ul><br>" +
  "<ul><li><b>HÁ PRESENÇA DE GÁS ?</b> Sim</li></ul><br><ul><li><b>NOME E TELEFONE DO RESPONSÁVEL PELA ATIVIDADE:</b> 31999990000</li></ul><br>" +
  "<ul><li><b>SIGLA / GERÊNCIA:</b> TERMOELETRICA</li></ul>";
const PROG = {
  cod: "1",
  programmed_date_day: "18/10/2026",
  initial_date_time: "19:00",
  final_date_time: "23:59",
  request_number: "0000616461",
  vacancy_cod: "541",
  vacancy_name: "AUTO VÁCUO - GPS - 08 - 24 HS",
  vacancy_regime: "24h-12 GPS (Novo)",
  group_name_programmed: "CAMINHÃO AUTO VÁCUO",
  vehicle_name: "ABC1D23",
  geofence: "CALDEIRA 130",
  requester_name: "FULANO DE TAL",
  requester_phone: "(31) 9 9999-0000",
  beneficiary: "CICLANO",
  beneficiary_phone: "31999990000",
  details: "CONFORME ACORDADO COM FULANO",
  obs: OBS,
  readonly: true,
};

describe("trava das chamadas da parte diária", () => {
  it("aceita a lista e o list-by-request_number", () => {
    expect(() => conferirChamada(ENDERECO, camposFiltro("2026-10-18"))).not.toThrow();
    expect(() => conferirChamada(ENDERECO, [["request_number", "1"], ["action", "list-by-request_number"]])).not.toThrow();
  });
  it("recusa outra ação e outro endereço", () => {
    expect(() => conferirChamada(ENDERECO, [["action", "delete"]])).toThrow();
    expect(() => conferirChamada(ENDERECO, [["action", "list-by-request_number"], ["action", "save"]])).toThrow();
    expect(() => conferirChamada("/pdf/hard-vehicle/request-printing/", [])).toThrow();
  });
});

describe("leitura", () => {
  it("o filtro é o da tela (GPS, 5 grupos, por data de atendimento)", () => {
    const c = camposFiltro("2026-10-18");
    expect(c.filter(([k]) => k === "vehicle_group[]").map(([, v]) => v)).toEqual([2, 1, 131, 4, 16]);
    expect(c).toContainEqual(["start_day", "2026-10-18"]);
    expect(c).toContainEqual(["filter-period", 1]);
  });
  it("objeto vira campos como no jQuery", () => {
    expect(camposDoObjeto({ a: 1, l: [2, 3], o: { x: "y" }, n: null })).toEqual([["a", 1], ["l[]", "2"], ["l[]", "3"], ["o[x]", "y"], ["n", ""]]);
  });
  it("pega local, endereço, atividade, destino e segurança, sem nomes nem telefones", () => {
    const l = lerLinha(PROG, "2026-10-18T20:00:00.000Z")!;
    expect(l).toMatchObject({
      dia: "2026-10-18",
      inicio: "19:00",
      fim: "23:59",
      solicitacao: "0000616461",
      vaga_id: 541,
      local_origem: "CALDEIRA 130",
      endereco: "RUA 19 - ÁREAS DAS CALDEIRAS 130",
      atividade: "*LIMPEZA DE GALERIAS *DRENO DE SEAL POTS",
      material: "AGUA INDUSTRIAL",
      destino: "POÇO REDONDO",
      gerencia: "TERMOELETRICA",
      seguranca: { altura: false, andaime: false, confinado: false, gas: true },
      aprovado: true,
    });
    const tudo = JSON.stringify(l);
    for (const proibido of ["FULANO", "CICLANO", "9999", "ACORDADO"]) expect(tudo).not.toContain(proibido);
  });
  it("linha sem dia ou sem vaga é ignorada", () => {
    expect(lerLinha({ ...PROG, programmed_date_day: "" }, "x")).toBeNull();
    expect(lerLinha({ ...PROG, vacancy_name: null }, "x")).toBeNull();
  });
});

function fake(o: { controle?: ControleParteDiaria | null; solicitacoes?: number; falha?: boolean; atuais?: LinhaResumo[] } = {}) {
  let controle = o.controle ?? null;
  const dias: string[] = [];
  const gravados: { dia: string; linhas: LinhaParteDiaria[] }[] = [];
  const deps: DepsParteDiaria = {
    lerControle: async () => controle,
    gravarControle: async (c) => {
      controle = c;
    },
    listar: async (dia) => {
      dias.push(dia);
      if (o.falha) throw new Error("HTTP 500");
      return Array.from({ length: o.solicitacoes ?? 2 }, (_, i) => ({ request_number: String(i), start_day: dia }));
    },
    programacoes: async (s) => {
      const dia = String(s.start_day);
      const br = `${dia.slice(8, 10)}/${dia.slice(5, 7)}/${dia.slice(0, 4)}`;
      // a segunda solicitação repete a programação da primeira
      return [{ ...PROG, programmed_date_day: br, request_number: "7" }];
    },
    atuais: async () => o.atuais ?? [],
    gravar: async (dia, linhas) => {
      gravados.push({ dia, linhas });
    },
  };
  return { deps, dias, gravados, controle: () => controle };
}

const em = (h: string) => new Date(`2026-10-18T${h}:00`);
const feito = (feitos: string[], atrasados: string[] = []): ControleParteDiaria => ({ dia: "2026-10-18", feitos, atrasados });

describe("ritmo da coleta (de 3 em 3 horas)", () => {
  it("primeira vez: o horário vencido mais recente, depois os dias atrasados um por execução", async () => {
    const f = fake();
    await coletarParteDiaria(f.deps, em("10:00"));
    await coletarParteDiaria(f.deps, em("10:05"));
    await coletarParteDiaria(f.deps, em("10:10"));
    // 10:00: vencidos 00:30 (ontem), 06:00 e 09:00 (hoje); o mais recente primeiro
    expect(f.dias).toEqual(["2026-10-18", "2026-10-17", "2026-10-16"]);
    expect(f.controle()!.feitos).toEqual(["06:00", "09:00", "00:30"]);
    expect(f.controle()!.atrasados).toHaveLength(DIAS_INICIAIS - 2);
    // repetida entre solicitações: grava uma só
    expect(f.gravados[0].linhas).toHaveLength(1);
  });
  it("entre um horário e outro não busca nada", async () => {
    const f = fake({ controle: feito(["00:30", "06:00", "09:00"]) });
    expect(await coletarParteDiaria(f.deps, em("11:30"))).toBeNull();
    expect(await coletarParteDiaria(f.deps, em("12:01"))).toMatch(/2026-10-18 \(hoje 12:00\)/);
  });
  it("às 17:00 busca a parte de amanhã (sai ~16:30)", async () => {
    const f = fake({ controle: feito(["00:30", "06:00", "09:00", "12:00", "15:00"]) });
    expect(await coletarParteDiaria(f.deps, em("17:02"))).toMatch(/2026-10-19 \(amanha 17:00\)/);
  });
  it("virou o dia: 00:30 fecha ontem", async () => {
    const f = fake({ controle: feito(["00:30", "06:00", "09:00", "12:00", "15:00", "17:00", "18:00", "20:00", "21:00", "23:00"]) });
    expect(await coletarParteDiaria(f.deps, new Date("2026-10-19T00:20:00"))).toBeNull();
    await coletarParteDiaria(f.deps, new Date("2026-10-19T00:31:00"));
    expect(f.dias).toEqual(["2026-10-18"]);
    expect(f.controle()).toMatchObject({ dia: "2026-10-19", feitos: ["00:30"] });
  });
  it("dia vazio no GAUSS não apaga o que já estava gravado", async () => {
    const f = fake({ solicitacoes: 0 });
    await coletarParteDiaria(f.deps, em("10:00"));
    expect(f.gravados).toEqual([]);
  });
  it("falhou: espera 30 min antes de tentar de novo", async () => {
    const f = fake({ falha: true });
    await expect(coletarParteDiaria(f.deps, em("10:00"))).rejects.toThrow();
    expect(await coletarParteDiaria(f.deps, em("10:05"))).toBeNull();
    expect(f.dias).toHaveLength(1);
  });
  it("execução que já gastou mais de 4 min deixa para a próxima", async () => {
    const f = fake();
    expect(await coletarParteDiaria(f.deps, em("10:05"), em("10:00"))).toBeNull();
    expect(f.dias).toEqual([]);
  });
  it("diz o que mudou desde a busca anterior", async () => {
    const f = fake({ controle: feito(["00:30", "06:00"]), atuais: [{ chave: "velha", solicitacao: "1", vaga: "AP 01", inicio: "07:00", fim: "19:00", local_origem: "X", endereco: "Y" }] });
    expect(await coletarParteDiaria(f.deps, em("09:01"))).toMatch(/1 nova\(s\), 1 cancelada\(s\)/);
  });
});

describe("o que mudou", () => {
  const base: LinhaResumo = { chave: "S1|530|2026-10-18|07:00", solicitacao: "S1", vaga: "AP 01", inicio: "07:00", fim: "19:00", local_origem: "ACIARIA 1", endereco: "RUA 19" };
  it("nova, cancelada, trocada de equipamento e alterada", () => {
    const trocada = { ...base, chave: "S1|531|2026-10-18|07:00", vaga: "AP 02" };
    const outra = { ...base, chave: "S2|530|2026-10-18|07:00", solicitacao: "S2" };
    const cancelada = { ...base, chave: "S3|530|2026-10-18|07:00", solicitacao: "S3" };
    const mantida = { ...base, chave: "S4|530|2026-10-18|07:00", solicitacao: "S4" };
    expect(compararParte([base, cancelada, mantida], [trocada, outra, { ...mantida, endereco: "RUA 20" }])).toEqual({ novas: 1, canceladas: 1, trocadas: 1, alteradas: 1 });
  });
  it("igual: nada mudou", () => {
    expect(compararParte([base], [base])).toEqual({ novas: 0, canceladas: 0, trocadas: 0, alteradas: 0 });
  });
});

import { describe, expect, it } from "vitest";
import {
  DIAS_INICIAIS,
  ENDERECO,
  camposDoObjeto,
  camposFiltro,
  coletarParteDiaria,
  conferirChamada,
  lerLinha,
  type ControleParteDiaria,
  type DepsParteDiaria,
  type LinhaParteDiaria,
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

function fake(o: { controle?: ControleParteDiaria | null; solicitacoes?: number; falha?: boolean } = {}) {
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
    gravar: async (dia, linhas) => {
      gravados.push({ dia, linhas });
    },
  };
  return { deps, dias, gravados, controle: () => controle };
}

const AGORA = new Date("2026-10-18T10:00:00");

describe("ritmo da coleta", () => {
  it("primeira vez: ontem, depois hoje, depois os dias atrasados um por execução", async () => {
    const f = fake();
    await coletarParteDiaria(f.deps, AGORA);
    await coletarParteDiaria(f.deps, new Date("2026-10-18T10:05:00"));
    await coletarParteDiaria(f.deps, new Date("2026-10-18T10:10:00"));
    expect(f.dias).toEqual(["2026-10-17", "2026-10-18", "2026-10-16"]);
    expect(f.controle()!.atrasados).toHaveLength(DIAS_INICIAIS - 2);
    // repetida entre solicitações: grava uma só
    expect(f.gravados[0].linhas).toHaveLength(1);
  });
  it("hoje de novo só depois de 30 min", async () => {
    const f = fake({ controle: { hoje_em: AGORA.toISOString(), ontem: "2026-10-17", atrasados: [] } });
    expect(await coletarParteDiaria(f.deps, new Date("2026-10-18T10:20:00"))).toBeNull();
    expect(await coletarParteDiaria(f.deps, new Date("2026-10-18T10:31:00"))).toMatch(/2026-10-18 \(hoje\)/);
  });
  it("virou o dia: fecha ontem antes de hoje", async () => {
    const f = fake({ controle: { hoje_em: "2026-10-18T23:50:00", ontem: "2026-10-17", atrasados: [] } });
    await coletarParteDiaria(f.deps, new Date("2026-10-19T00:05:00"));
    expect(f.dias).toEqual(["2026-10-18"]);
    expect(f.controle()!.ontem).toBe("2026-10-18");
  });
  it("dia vazio no GAUSS não apaga o que já estava gravado", async () => {
    const f = fake({ solicitacoes: 0 });
    await coletarParteDiaria(f.deps, AGORA);
    expect(f.gravados).toEqual([]);
  });
  it("falhou: espera 30 min antes de tentar de novo", async () => {
    const f = fake({ falha: true });
    await expect(coletarParteDiaria(f.deps, AGORA)).rejects.toThrow();
    expect(await coletarParteDiaria(f.deps, new Date("2026-10-18T10:05:00"))).toBeNull();
    expect(f.dias).toHaveLength(1);
  });
  it("execução que já gastou mais de 4 min deixa para a próxima", async () => {
    const f = fake();
    expect(await coletarParteDiaria(f.deps, new Date("2026-10-18T10:05:00"), AGORA)).toBeNull();
    expect(f.dias).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import {
  areasDaRegiao, contornoDaUsina, plantasDaRegiao, separarFora, totais,
  categoriaPeloNome, diaDaSemana, diaMenos, equipDaFrota, faixaDe, filtrar, montarLocais, ordemDeDesenho, ranking, resumir, temRegra, valoresDaParada,
  CHAVE_FORA, OUTROS, SELECAO_VAZIA, filtrarSelecao, horaDe, lugaresDoGrafico, placar, porHora, porServico, raioDaBolha, servicosPrincipais,
  type FiltroAnalise, type ParadaAnalise, type ResumoLocal,
} from "./analise";

const H = 3600;
const quad = (lat: number, lng: number): [number, number][] => [[lat, lng], [lat, lng + 0.002], [lat + 0.002, lng + 0.002], [lat + 0.002, lng]];
const AREAS = [
  { name: "ALTO FORNO 3", polygon: quad(-19.48, -42.53) },
  { name: "PÁTIO DO TRANSPORTE RODOVIÁRIO", polygon: quad(-19.49, -42.55) },
];
const v = (id: string, placa: string, tipo: "ap" | "av" | "hv", o: Partial<Veiculo> = {}): Veiculo =>
  ({ id, placa, vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 0, status: "", status_cod: 1, status_desde: null, lat: 0, lng: 0,
     posicao_em: null, area: "", area_desde: null, via: "", sem_sinal: false, equip: { tipo, nome: placa, ordem: 1, supervisor: "OZIAS", regime: "ADM" }, ...o }) as Veiculo;
const FROTA = [v("1", "EGC2985", "ap"), v("2", "EGC2993", "av", { equip: { tipo: "av", nome: "EGC2993", ordem: 2, supervisor: "ISRAEL", regime: "4X4 - A" } }), v("3", "EAM3257", "hv"), v("4", "EGC29852", "ap", { motor2_de: "1" }), v("9", "EOF5208", "ap", { equip: undefined })];
const p = (o: Partial<ParadaAnalise>): ParadaAnalise => ({ dia: "2026-10-01", veiculo_id: "1", placa: "EGC2985", ini: 8 * H, fim: 9 * H, lat: -19.479, lng: -42.529, area: "ALTO FORNO 3", motor: {}, apont: [], ...o });
const F: FiltroAnalise = { hoje: "2026-10-08", periodo: 30, tipo: null, supervisor: null, regime: null, faixas: [], diasSemana: [] };

describe("datas e faixas", () => {
  it("faixa pela hora de início", () => {
    expect([faixaDe(0), faixaDe(6 * H), faixaDe(12 * H - 1), faixaDe(18 * H)]).toEqual(["madrugada", "manha", "manha", "noite"]);
  });
  it("dia da semana (0 = domingo) e dia − n", () => {
    expect(diaDaSemana("2026-10-04")).toBe(0);
    expect(diaMenos("2026-10-08", 30)).toBe("2026-09-08");
  });
  it("categoria pelo nome (a Baia de Resíduos é Descarte)", () => {
    expect(categoriaPeloNome("PÁTIO DO TRANSPORTE RODOVIÁRIO")).toBe("Base");
    expect(categoriaPeloNome("BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO")).toBe("Descarte");
    expect(categoriaPeloNome("POSTO DE COMBUSTÍVEL")).toBe("Abastecimento");
    expect(categoriaPeloNome("ALTO FORNO 3")).toBeNull();
  });
});

describe("equipamentos da análise", () => {
  it("só a frota da matriz, sem motor 2º, com a regra de produtividade", () => {
    const e = equipDaFrota(FROTA);
    expect([...e.keys()]).toEqual(["1", "2", "3"]);
    expect([e.get("1")?.produtivo, e.get("2")?.produtivo, e.get("3")?.produtivo]).toEqual(["secondary_motor_on", "stopped", null]);
  });
});

describe("locais", () => {
  const equip = equipDaFrota(FROTA);
  it("paradas de veículo fora da frota ou motor 2º não entram", () => {
    const { paradas } = montarLocais([p({}), p({ veiculo_id: "4" }), p({ veiculo_id: "9" })], AREAS, equip);
    expect(paradas.map((x) => x.veiculo_id)).toEqual(["1"]);
  });
  it("fora das cercas: 3 paradas a menos de 120 m viram um ponto; menos que isso fica de fora", () => {
    const fora = (lat: number, lng: number) => p({ area: null, lat, lng });
    const { locais, paradas } = montarLocais([fora(-19.4, -42.4), fora(-19.4003, -42.4), fora(-19.4, -42.4004), fora(-19.3, -42.3)], AREAS, equip);
    expect([...locais.values()].map((l) => [l.chave, l.cerca])).toEqual([["ponto:1", false]]);
    expect(locais.get("ponto:1")?.nome).toMatch(/^Ponto 1 · perto de /);
    expect(paradas).toHaveLength(3);
  });
  it("categoria: produz 15%+ do tempo com motor = Serviço; base pelo nome; parada sem motor não decide", () => {
    const { locais } = montarLocais(
      [
        p({ motor: { secondary_motor_on: 20, stopped: 40 } }),
        p({ area: "GARAGEM ÔNIBUS", lat: -19.489, lng: -42.549, motor: { secondary_motor_on: 60 } }),
        p({ area: "CERCA SEM MOTOR", motor: {}, ini: 0, fim: 3 * H }),
      ],
      AREAS,
      equip,
    );
    expect(locais.get("ALTO FORNO 3")).toMatchObject({ categoria: "Serviço", naBase: false });
    expect(locais.get("GARAGEM ÔNIBUS")).toMatchObject({ categoria: "Base", naBase: true });
    // sem motor: não é Serviço; parada média de 3 h = Base/pernoite
    expect(locais.get("CERCA SEM MOTOR")).toMatchObject({ categoria: "Base/pernoite", naBase: true });
  });
  it("cerca sem polígono (sumiu ou mudou de nome) fica na posição da parada", () => {
    const { locais } = montarLocais([p({ area: "CERCA ANTIGA", lat: -19.1, lng: -42.1 })], AREAS, equip);
    expect(locais.get("CERCA ANTIGA")).toMatchObject({ cerca: true, lat: -19.1, lng: -42.1 });
  });
});

describe("valores de uma parada", () => {
  const equip = equipDaFrota(FROTA);
  const local = (o: Partial<ParadaAnalise>) => montarLocais([p(o)], AREAS, equip).paradas[0];
  it("fora da base: produtivo conta e o resto do ligado é sem produzir", () => {
    expect(valoresDaParada(local({ motor: { secondary_motor_on: 20, stopped: 30, off: 10 } }), false)).toEqual({ produtivo: 20, base: 0, semProduzir: 30 });
  });
  it("na base: produtivo vira motor ligado na base e todo o ligado é sem produzir", () => {
    expect(valoresDaParada(local({ motor: { secondary_motor_on: 20, stopped: 30 } }), true)).toEqual({ produtivo: 0, base: 20, semProduzir: 50 });
  });
  it("tipo sem regra (Hiper Vácuo): sem produtivo nem sem produzir", () => {
    expect(valoresDaParada(local({ veiculo_id: "3", motor: { stopped: 30 } }), false)).toEqual({ produtivo: null, base: 0, semProduzir: null });
  });
  it("sem timeline de motor: zero produtivo", () => {
    expect(valoresDaParada(local({ motor: {} }), false)).toEqual({ produtivo: 0, base: 0, semProduzir: 0 });
  });
});

describe("filtros e resumo por local", () => {
  const equip = equipDaFrota(FROTA);
  const { locais, paradas } = montarLocais(
    [
      p({ motor: { secondary_motor_on: 30, stopped: 10 }, apont: ["Aguardando Área"] }),
      p({ dia: "2026-10-04", ini: 20 * H, fim: 21 * H, veiculo_id: "2", placa: "EGC2993", motor: { stopped: 50 }, apont: ["Aguardando Área", "Refeição Motorista"] }),
      p({ dia: "2026-09-01", motor: { secondary_motor_on: 60 } }),
      p({ veiculo_id: "3", placa: "EAM3257", motor: { stopped: 60 } }),
    ],
    AREAS,
    equip,
  );
  it("período: só os últimos N dias até hoje", () => {
    expect(filtrar(paradas, F)).toHaveLength(3);
    expect(filtrar(paradas, { ...F, periodo: 7 }).map((x) => x.dia)).toEqual(["2026-10-04"]);
    expect(filtrar(paradas, { ...F, hoje: "2026-10-20", periodo: 7 })).toHaveLength(0);
  });
  it("tipo, supervisor, regime, faixa e dia da semana", () => {
    expect(filtrar(paradas, { ...F, tipo: "av" }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, supervisor: "ISRAEL" }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, regime: "ADM" }).map((x) => x.veiculo_id)).toEqual(["1", "3"]);
    expect(filtrar(paradas, { ...F, faixas: ["noite"] }).map((x) => x.veiculo_id)).toEqual(["2"]);
    expect(filtrar(paradas, { ...F, diasSemana: [0] }).map((x) => x.dia)).toEqual(["2026-10-04"]);
  });
  it("resumo: totais, quem atende, horário e apontamentos", () => {
    const [r] = resumir(filtrar(paradas, F), locais);
    expect(r).toMatchObject({ visitas: 3, parado: 180, produtivo: 80, semProduzir: 10, paradoComRegra: 120, base: 0 });
    expect(r.porEquip.map((e) => [e.nome, e.visitas, e.min, e.ultimoDia])).toEqual([["EGC2985", 1, 60, "2026-10-01"], ["EGC2993", 1, 60, "2026-10-04"], ["EAM3257", 1, 60, "2026-10-01"]]);
    expect(r.porHora[8]).toBe(120);
    expect(r.porHora[20]).toBe(60);
    expect(r.apont).toEqual([{ nome: "Aguardando Área", n: 2 }, { nome: "Refeição Motorista", n: 1 }]);
  });
  it("ranking", () => {
    expect(ranking(resumir(filtrar(paradas, F), locais), "produtivo").map((x) => x.local.nome)).toEqual(["ALTO FORNO 3"]);
    expect(ranking([], "produtivo")).toEqual([]);
  });
});

describe("achados da revisão final", () => {
  const equip = equipDaFrota(FROTA);
  it("% produtivo: parada sem dado de motor não entra na base do percentual", () => {
    const { locais, paradas } = montarLocais([p({ motor: { secondary_motor_on: 30, stopped: 30 } }), p({ dia: "2026-10-02", motor: {} })], AREAS, equip);
    const [r] = resumir(filtrar(paradas, F), locais);
    expect([r.parado, r.paradoComRegra, r.produtivo]).toEqual([120, 60, 30]);
  });
  it("desenha as cercas da maior para a menor (a pequena fica por cima e recebe o clique)", () => {
    const grande = { name: "GRANDE", polygon: [[0, 0], [0, 1], [1, 1], [1, 0]] as [number, number][] };
    const pequena = { name: "PEQUENA", polygon: [[0.1, 0.1], [0.1, 0.2], [0.2, 0.2], [0.2, 0.1]] as [number, number][] };
    expect(ordemDeDesenho([pequena, grande]).map((a) => a.name)).toEqual(["GRANDE", "PEQUENA"]);
  });
  it("tipos sem regra de produtividade: Hiper Vácuo, Ultravac, Brook e Aspiradores", () => {
    expect((["ap", "av", "hv", "uv", "pg", "as"] as const).map(temRegra)).toEqual([true, true, false, false, false, false]);
  });
});

describe("mapa da região (Usiminas, Poço Redondo, Aterro, oficinas de fora), sem o Pátio da base", () => {
  const equip = equipDaFrota(FROTA);
  const USINA: [number, number][] = [[-19.5, -42.56], [-19.5, -42.5], [-19.46, -42.5], [-19.46, -42.56]];
  const CERCAS = [
    { name: "PLANTA POÇO REDONDO", tipo: "planta", polygon: quad(-19.52, -42.6) },
    { name: "PLANTA USIMINAS", tipo: "planta", polygon: USINA },
    { name: "PLANTA LONGE", tipo: "planta", polygon: quad(-9.8, -34.1) },
    ...AREAS.map((a) => ({ ...a, tipo: "area" })),
  ];
  it("o contorno da usina é a cerca de planta PLANTA USIMINAS (sem ela, null)", () => {
    expect(contornoDaUsina(CERCAS)).toEqual(USINA);
    expect(contornoDaUsina(CERCAS.filter((c) => c.name !== "PLANTA USIMINAS"))).toBeNull();
  });
  it("plantas da região: as que ficam a até 50 km da Usiminas (sem a usina, todas)", () => {
    expect(plantasDaRegiao(CERCAS).map((c) => c.name)).toEqual(["PLANTA POÇO REDONDO", "PLANTA USIMINAS"]);
    expect(plantasDaRegiao(CERCAS.filter((c) => c.name !== "PLANTA USIMINAS")).map((c) => c.name)).toEqual(["PLANTA POÇO REDONDO", "PLANTA LONGE"]);
  });
  it("o Pátio do Transporte (a base) sai da análise; a Baia de Resíduos fica", () => {
    const { paradas } = montarLocais(
      [p({ area: "PÁTIO DO TRANSPORTE RODOVIÁRIO", lat: -19.489, lng: -42.549 }), p({ area: "BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO", lat: -19.489, lng: -42.549 }), p({})],
      AREAS,
      equip,
      USINA,
    );
    expect(paradas.map((x) => x.area)).toEqual(["BAIA DE RESÍDUOS - TRANSPORTE RODOVIÁRIO", "ALTO FORNO 3"]);
  });
  it("Poço Redondo e Aterro (até 50 km) ficam no mapa; só o que está longe vira a linha 'Longe da região'", () => {
    const { locais, paradas } = montarLocais(
      [
        p({ motor: { secondary_motor_on: 60 } }),
        p({ area: "ATERRO CONTROLADO", lat: -19.3, lng: -42.3, motor: { secondary_motor_on: 30 } }),
        p({ area: "GALPÃO LONGE", lat: -9.8, lng: -34.1, ini: 10 * H, fim: 12 * H, veiculo_id: "2", placa: "EGC2993" }),
      ],
      AREAS,
      equip,
      USINA,
    );
    expect(locais.get("ALTO FORNO 3")?.naRegiao).toBe(true);
    expect(locais.get("ATERRO CONTROLADO")?.naRegiao).toBe(true);
    expect(locais.get("GALPÃO LONGE")?.naRegiao).toBe(false);
    const { dentro, fora } = separarFora(resumir(filtrar(paradas, F), locais));
    expect(dentro.map((r) => r.local.nome)).toEqual(["ALTO FORNO 3", "ATERRO CONTROLADO"]);
    expect(fora).toMatchObject({ visitas: 1, parado: 120 });
    expect(fora?.local.nome).toBe("Longe da região (mais de 50 km)");
    expect(fora?.partes).toEqual([{ nome: "GALPÃO LONGE", parado: 120 }]);
  });
  it("cercas desenhadas: as da região, nunca o Pátio da base", () => {
    const longe = { name: "LONGE", polygon: quad(-9.8, -34.1) };
    const aterro = { name: "ATERRO CONTROLADO", polygon: quad(-19.3, -42.3) };
    expect(areasDaRegiao([...AREAS, aterro, longe], USINA).map((a) => a.name)).toEqual(["ALTO FORNO 3", "ATERRO CONTROLADO"]);
    expect(areasDaRegiao([...AREAS, longe], null).map((a) => a.name)).toEqual(["ALTO FORNO 3", "LONGE"]);
  });
  it("sem contorno da usina, tudo conta como da região", () => {
    const { locais } = montarLocais([p({ area: "GALPÃO LONGE", lat: -9.8, lng: -34.1 })], AREAS, equip, null);
    expect(locais.get("GALPÃO LONGE")?.naRegiao).toBe(true);
  });
  it("totais do período", () => {
    const { locais, paradas } = montarLocais(
      [p({ dia: "2026-10-06", motor: { secondary_motor_on: 30, stopped: 10 } }), p({ dia: "2026-10-08", veiculo_id: "2", placa: "EGC2993", motor: { stopped: 45 } }), p({ dia: "2026-10-08", veiculo_id: "3", placa: "EAM3257" })],
      AREAS,
      equip,
      USINA,
    );
    const f = filtrar(paradas, { ...F, periodo: 3 });
    expect(totais(resumir(f, locais))).toMatchObject({ produtivo: 75, semProduzir: 10, parado: 180, areas: 1 });
  });
});

describe("painel: seleção cruzada, serviços, horas e placar", () => {
  const equip = equipDaFrota(FROTA);
  const usina = AREAS[0].polygon;
  // ALTO FORNO 3 (caminhão 1, Alta Pressão): 8h–9h com Vácuo e Transbordo; 14h–16h com Vácuo.
  // GALPÃO LONGE (caminhão 2, Alto Vácuo, em Recife): 10h–11h, sem apontamento e sem dado de motor.
  const { paradas, locais } = montarLocais(
    [
      p({ apont: ["Vácuo", "Transbordo"], motor: { secondary_motor_on: 30, stopped: 30 } }),
      p({ ini: 14 * H, fim: 16 * H, apont: ["Vácuo"], motor: { stopped: 120 } }),
      p({ veiculo_id: "2", placa: "EGC2993", area: "GALPÃO LONGE", lat: -8.05, lng: -34.9, ini: 10 * H, fim: 11 * H }),
    ],
    AREAS,
    equip,
    usina,
  );
  const sel = (o: Partial<typeof SELECAO_VAZIA>) => ({ ...SELECAO_VAZIA, ...o });

  it("hora do início (0–23)", () => {
    expect([horaDe(0), horaDe(14 * H), horaDe(24 * H - 1), horaDe(24 * H)]).toEqual([0, 14, 23, 23]);
  });
  it("seleção vazia não filtra; serviço, hora e lugar filtram", () => {
    expect(filtrarSelecao(paradas, SELECAO_VAZIA, locais)).toHaveLength(3);
    expect(filtrarSelecao(paradas, sel({ servico: "Vácuo" }), locais)).toHaveLength(2);
    expect(filtrarSelecao(paradas, sel({ servico: "Transbordo" }), locais)).toHaveLength(1);
    expect(filtrarSelecao(paradas, sel({ hora: 14 }), locais).map((x) => x.ini)).toEqual([14 * H]);
    expect(filtrarSelecao(paradas, sel({ local: "ALTO FORNO 3" }), locais)).toHaveLength(2);
  });
  it("'Longe da região' pega as paradas dos lugares fora da região; lugar que não existe no recorte esvazia", () => {
    expect(filtrarSelecao(paradas, sel({ local: CHAVE_FORA }), locais).map((x) => x.local)).toEqual(["GALPÃO LONGE"]);
    expect(filtrarSelecao(paradas, sel({ local: "OFICINA QUE SUMIU" }), locais)).toEqual([]);
  });
  it("ignorar uma dimensão: o gráfico dela mostra todas e as outras seleções continuam valendo", () => {
    const s = sel({ servico: "Transbordo", hora: 14 });
    expect(filtrarSelecao(paradas, s, locais)).toEqual([]);
    expect(filtrarSelecao(paradas, s, locais, "hora").map((x) => x.ini)).toEqual([8 * H]);
    expect(filtrarSelecao(paradas, s, locais, "servico").map((x) => x.ini)).toEqual([14 * H]);
  });
  it("por serviço: a parada com 2 apontamentos conta nos dois; o mesmo apontamento repetido conta uma vez", () => {
    expect(porServico(paradas)).toEqual([
      { nome: "Vácuo", n: 2, min: 180 },
      { nome: "Transbordo", n: 1, min: 60 },
    ]);
    const repetido = montarLocais([p({ apont: ["Vácuo", "Vácuo"] })], AREAS, equip, usina).paradas;
    expect(porServico(repetido)).toEqual([{ nome: "Vácuo", n: 1, min: 60 }]);
  });
  it("por serviço: depois do 10º, o resto soma em 'Outros'", () => {
    const nomes = Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
    const r = porServico(montarLocais([p({ apont: nomes })], AREAS, equip, usina).paradas);
    expect(r).toHaveLength(11);
    expect(r[9].nome).toBe("S10");
    expect(r[10]).toEqual({ nome: OUTROS, n: 2, min: 120 });
  });
  it("serviços principais: os 3 com mais paradas, sem 'Outros'", () => {
    expect(servicosPrincipais(paradas)).toEqual(["Vácuo", "Transbordo"]);
    const nomes = Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, "0")}`);
    expect(servicosPrincipais(montarLocais([p({ apont: nomes })], AREAS, equip, usina).paradas)).toEqual(["S01", "S02", "S03"]);
  });
  it("por hora: minutos parados pela hora de início", () => {
    const h = porHora(paradas);
    expect(h).toHaveLength(24);
    expect([h[8], h[10], h[14], h[15]]).toEqual([60, 60, 120, 0]);
    expect(h.reduce((s, x) => s + x, 0)).toBe(240);
  });
  it("placar: produtivo e % só das paradas com regra e dado de motor; serviços = paradas com apontamento", () => {
    expect(placar(paradas, locais)).toEqual({ produtivo: 30, pct: 30 / 180, parado: 240, servicos: 2 });
  });
  it("placar: tipo sem regra de produtividade mostra '—' (null), nunca 0%", () => {
    const hv = montarLocais([p({ veiculo_id: "3", placa: "EAM3257", motor: { stopped: 60 } })], AREAS, equip, usina);
    expect(placar(hv.paradas, hv.locais)).toEqual({ produtivo: null, pct: null, parado: 60, servicos: 0 });
    expect(placar([], new Map())).toEqual({ produtivo: null, pct: null, parado: 0, servicos: 0 });
  });
  it("raio da bolha: a área cresce com as horas; mínimo de 5 px para dar para clicar", () => {
    expect(raioDaBolha(0, 0)).toBe(5);
    expect(raioDaBolha(100, 100)).toBe(28);
    expect(raioDaBolha(25, 100)).toBe(14);
    expect(raioDaBolha(1, 10000)).toBe(5);
  });
});

describe("painel: lugares do gráfico", () => {
  const lugar = (chave: string, parado: number) => ({ local: { chave, nome: chave }, parado }) as unknown as ResumoLocal;
  const dentro = Array.from({ length: 12 }, (_, i) => lugar(`L${String(i + 1).padStart(2, "0")}`, 120 - i * 10));
  const fora = lugar(CHAVE_FORA, 5);
  const chaves = (rs: ResumoLocal[]) => rs.map((r) => r.local.chave);

  it("os 10 com mais tempo parado e, no fim, 'Longe da região'", () => {
    expect(chaves(lugaresDoGrafico(dentro, fora, null))).toEqual([...chaves(dentro.slice(0, 10)), CHAVE_FORA]);
  });
  it("o lugar escolhido fora dos 10 entra no fim (antes de 'Longe da região'), para aparecer em destaque", () => {
    expect(chaves(lugaresDoGrafico(dentro, fora, "L12"))).toEqual([...chaves(dentro.slice(0, 10)), "L12", CHAVE_FORA]);
  });
  it("escolhido já entre os 10 ou 'Longe da região': nada se repete", () => {
    expect(lugaresDoGrafico(dentro, null, "L01")).toHaveLength(10);
    expect(chaves(lugaresDoGrafico(dentro, fora, CHAVE_FORA))).toEqual([...chaves(dentro.slice(0, 10)), CHAVE_FORA]);
    expect(lugaresDoGrafico(dentro, null, "SUMIU")).toHaveLength(10);
  });
});

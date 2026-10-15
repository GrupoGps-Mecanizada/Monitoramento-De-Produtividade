import { describe, expect, it } from "vitest";
import { FILTROS_PADRAO, VISOES, agrupar, contarCartoes, contarVisoes, etiquetas, filtrar, opcoes, ordenar, visaoAtual, type FiltrosAlertas } from "./fila";
import type { AlertaGravado } from "./gestao";

const HOJE = "2026-10-15";
let n = 0;
const al = (o: Partial<AlertaGravado> = {}): AlertaGravado => ({
  id: ++n, chave: `k${n}`, regra: "saida_tarde", veiculo_id: "1", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: HOJE, ini: 8 * 3600, fim: null, ref: 0,
  local: "PÁTIO", detalhe: "", situacao: "aberto", nota: 65, motivos: [], destino: "whatsapp", contagem: 1, resolvido_em: null, resolvido_por: null, atualizado_em: "", avaliacao: null,
  visto_por: null, visto_em: null, ultimo_aviso_em: null, detectado_em: "", contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});
const f = (o: Partial<FiltrosAlertas> = {}): FiltrosAlertas => ({ ...FILTROS_PADRAO, ...o });

const BASE = [
  al({ id: 1, nota: 90 }),
  al({ id: 2, regra: "desligado", placa: "DSY6472", supervisor: "Donizete", nota: 65, situacao: "visto" }),
  al({ id: 3, regra: "ocioso", placa: "EAM3257", supervisor: "Donizete", nota: 40, destino: "resumo", situacao: "resolvido", avaliacao: "problema" }),
  al({ id: 4, regra: "desligado", nota: 70, situacao: "silenciado" }),
  al({ id: 5, dia: "2026-10-14", nota: 88 }),
  al({ id: 6, dia: "2026-10-01", nota: 50, destino: "resumo", supervisor: null, contexto: { excessoMin: 10, repeticoes: 2, familias: [], fracaoSemSinal: 0, presumido: false } }),
];
const ids = (xs: AlertaGravado[]) => xs.map((a) => a.id).sort((a, b) => a - b);

describe("filtrar", () => {
  it("padrão: hoje, na fila (aberto e visto)", () => expect(ids(filtrar(BASE, f(), HOJE))).toEqual([1, 2]));
  it("períodos: ontem, 7 e 30 dias", () => {
    expect(ids(filtrar(BASE, f({ periodo: "ontem", cartao: null }), HOJE))).toEqual([5]);
    expect(ids(filtrar(BASE, f({ periodo: "7", cartao: null }), HOJE))).toEqual([1, 2, 3, 4, 5]);
    expect(ids(filtrar(BASE, f({ periodo: "30", cartao: null }), HOJE))).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("cartões: WhatsApp e resumo olham o destino; resolvidos e silenciados, a situação", () => {
    expect(ids(filtrar(BASE, f({ cartao: "whatsapp" }), HOJE))).toEqual([1, 2, 4]);
    expect(ids(filtrar(BASE, f({ cartao: "resumo" }), HOJE))).toEqual([3]);
    expect(ids(filtrar(BASE, f({ cartao: "resolvidos" }), HOJE))).toEqual([3]);
    expect(ids(filtrar(BASE, f({ cartao: "silenciados" }), HOJE))).toEqual([4]);
  });
  it("busca por placa sem hífen, por supervisor e por local, sem acento", () => {
    expect(ids(filtrar(BASE, f({ cartao: null, busca: "dsy-6472" }), HOJE))).toEqual([2]);
    expect(ids(filtrar(BASE, f({ cartao: null, busca: "donizete" }), HOJE))).toEqual([2, 3]);
    expect(ids(filtrar(BASE, f({ cartao: null, busca: "patio" }), HOJE))).toEqual([1, 2, 3, 4]);
  });
  it("supervisor vazio é 'Sem supervisor'", () => expect(ids(filtrar(BASE, f({ periodo: "30", cartao: null, supervisor: "" }), HOJE))).toEqual([6]));
  it("atalhos: mais graves (85+), sem avaliação, repetidos na semana", () => {
    expect(ids(filtrar(BASE, f({ periodo: "7", cartao: null, atalho: "graves" }), HOJE))).toEqual([1, 5]);
    expect(ids(filtrar(BASE, f({ cartao: null, atalho: "sem_avaliacao" }), HOJE))).toEqual([1, 2, 4]);
    expect(ids(filtrar(BASE, f({ periodo: "30", cartao: null, atalho: "repetidos" }), HOJE))).toEqual([6]);
  });
});

describe("contagens (um filtra o outro)", () => {
  it("cartões contam com os outros filtros, menos o próprio cartão", () => {
    expect(contarCartoes(BASE, f({ supervisor: "Donizete" }), HOJE)).toEqual({ fila: 1, whatsapp: 1, resumo: 1, resolvidos: 1, silenciados: 0 });
  });
  it("opções de regra respeitam o supervisor escolhido, com contagem, da maior para a menor", () => {
    expect(opcoes(BASE, f({ cartao: null, supervisor: "Donizete" }), HOJE, "regra")).toEqual([
      { valor: "desligado", n: 1 },
      { valor: "ocioso", n: 1 },
    ]);
  });
  it("opções de supervisor ignoram o próprio filtro de supervisor (empate: ordem alfabética)", () => {
    expect(opcoes(BASE, f({ cartao: null, supervisor: "Donizete" }), HOJE, "supervisor")).toEqual([
      { valor: "Donizete", n: 2 },
      { valor: "Junior Pereira", n: 2 },
    ]);
  });
});

describe("etiquetas", () => {
  it("uma por filtro ativo, com texto legível", () => {
    expect(etiquetas(f({ regra: "desligado", supervisor: "", busca: "egc", atalho: "graves" }))).toEqual([
      { dim: "regra", texto: "Motor desligado 1 h" },
      { dim: "supervisor", texto: "Sem supervisor" },
      { dim: "busca", texto: "“egc”" },
      { dim: "atalho", texto: "Mais graves (85+)" },
    ]);
  });
});

describe("agrupar", () => {
  const xs = filtrar(BASE, f({ periodo: "7", cartao: null }), HOJE);
  it("por supervisor: grupos da nota mais alta para a mais baixa; dentro, por nota", () => {
    const g = agrupar(xs, "supervisor", "nota");
    expect(g.map((x) => [x.titulo, x.notaMax, x.itens.map((a) => a.id)])).toEqual([
      ["Junior Pereira", 90, [1, 5, 4]],
      ["Donizete", 65, [2, 3]],
    ]);
  });
  it("por hora: mais recente primeiro", () => expect(agrupar(xs, "nenhum", "hora")[0].itens.map((a) => a.id)).toEqual([1, 2, 3, 4, 5]));
  it("por equipamento e por regra", () => {
    expect(agrupar(xs, "equipamento", "nota").map((x) => x.titulo)).toEqual(["EGC2985", "DSY6472", "EAM3257"]);
    expect(agrupar(xs, "regra", "nota").map((x) => x.titulo)).toEqual(["Saída tarde do Pátio", "Motor desligado 1 h", "Ociosidade"]);
  });
});

describe("visões salvas", () => {
  it("cada visão aplica cartão e atalho; contam com os outros filtros (período, supervisor...)", () => {
    expect(contarVisoes(BASE, f({ periodo: "7" }), HOJE)).toEqual({ fila: 3, whatsapp: 4, graves: 2, sem_avaliacao: 4, resolvidos: 1, todos: 5 });
    expect(contarVisoes(BASE, f({ supervisor: "Donizete" }), HOJE)).toMatchObject({ fila: 1, todos: 2 });
  });
  it("visão atual a partir dos filtros; combinação fora das visões = null", () => {
    expect(visaoAtual(f())).toBe("fila");
    expect(visaoAtual(f({ cartao: null, atalho: "graves" }))).toBe("graves");
    expect(visaoAtual(f({ cartao: "fila", atalho: "graves" }))).toBeNull();
    expect(VISOES.map((v) => v.id)).toEqual(["fila", "whatsapp", "graves", "sem_avaliacao", "resolvidos", "todos"]);
  });
});

describe("ordenar pela coluna", () => {
  const xs = filtrar(BASE, f({ periodo: "7", cartao: null }), HOJE);
  it("nota (maior primeiro) e o inverso", () => {
    expect(ordenar(xs, "nota", "desc").map((a) => a.id)).toEqual([1, 5, 4, 2, 3]);
    expect(ordenar(xs, "nota", "asc").map((a) => a.id)).toEqual([3, 2, 4, 5, 1]);
  });
  it("placa e supervisor em ordem alfabética (vazio por último)", () => {
    expect(ordenar(xs, "placa", "asc").map((a) => a.placa)).toEqual(["DSY6472", "EAM3257", "EGC2985", "EGC2985", "EGC2985"]);
    expect(ordenar([...xs, ...filtrar(BASE, f({ periodo: "30", cartao: null, supervisor: "" }), HOJE)], "supervisor", "asc").map((a) => a.supervisor).at(-1)).toBeNull();
  });
  it("hora: mais recente primeiro", () => expect(ordenar(xs, "hora", "desc").map((a) => a.id)).toEqual([1, 2, 3, 4, 5]));
});

import { describe, expect, it } from "vitest";
import type { Evento, Veiculo } from "../src/lib/tipos";
import type { LinhaAlerta } from "../src/lib/dominio/alertas/montar";
import { deveRodar, detectarAlertas, type DepsAlertas } from "./alertas";

const D = "2026-10-07";
const ev = (tipo: string, dia: string, hora: string, area: string) => ({ id: "1", tipo, t: `${dia}T${hora}:00-03:00`, area, placa: "", vaga: "" }) as unknown as Evento;
const VEIC = [{ id: "1", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", equip: { tipo: "ap", nome: "EGC2985", ordem: 1, regime: "ADM", status: "ATIVO" } }] as unknown as Veiculo[];
// ADM: limite de saída 07:45; saiu 08:10 -> saída tarde
const EVENTOS = [ev("abertura", "2026-10-06", "00:05", "PÁTIO DO TRANSPORTE RODOVIÁRIO"), ev("saida", D, "08:10", "PÁTIO DO TRANSPORTE RODOVIÁRIO")];

function falso(o: Partial<DepsAlertas> = {}) {
  const banco = new Map<string, LinhaAlerta>();
  let ultima: string | null = null;
  const fechados: string[] = [];
  const deps: DepsAlertas = {
    ultimaExecucao: async () => ultima,
    marcarExecucao: async (iso) => void (ultima = iso),
    lerEntrada: async () => ({ eventos: EVENTOS, motor: [], tablet: [] }),
    lerConfig: async () => ({ regras: [], politica: null }),
    lerHistorico: async () => [...banco.values()].map((l) => ({ chave: l.chave, regra: l.regra, vaga: l.vaga, dia: l.dia, ref: l.ref, situacao: l.situacao, resolvido_em: l.resolvido_em, resolvido_por: l.resolvido_por, contagem: l.contagem })),
    lerSilencios: async () => [],
    gravar: async (linhas) => linhas.forEach((l) => banco.set(l.chave, l)),
    fecharDiasAnteriores: async (hoje) => void fechados.push(hoje),
    ...o,
  };
  return { deps, banco, fechados };
}
const agora = new Date(`${D}T09:00:00-03:00`);

describe("intervalo de 10 min", () => {
  it("roda na primeira vez e depois de 10 min; não antes", () => {
    expect(deveRodar(null, agora)).toBe(true);
    expect(deveRodar(new Date(agora.getTime() - 9 * 60000).toISOString(), agora)).toBe(false);
    expect(deveRodar(new Date(agora.getTime() - 10 * 60000).toISOString(), agora)).toBe(true);
  });
});

describe("detector", () => {
  it("grava a saída tarde com nota e fecha os dias anteriores", async () => {
    const { deps, banco, fechados } = falso();
    const r = await detectarAlertas(deps, VEIC, agora);
    expect(r).toBe("1 alerta(s), 1 novo(s) para WhatsApp");
    const [a] = [...banco.values()];
    expect(a).toMatchObject({ regra: "saida_tarde", nota: 65, destino: "whatsapp", situacao: "aberto" });
    expect(fechados).toEqual([D]);
  });
  it("rodar 2 vezes não duplica (mesma chave, contagem 2)", async () => {
    const { deps, banco } = falso();
    await detectarAlertas(deps, VEIC, agora);
    await detectarAlertas(deps, VEIC, new Date(agora.getTime() + 10 * 60000));
    expect(banco.size).toBe(1);
    expect([...banco.values()][0].contagem).toBe(2);
  });
  it("antes de 10 min não faz nada", async () => {
    const { deps, banco } = falso();
    await detectarAlertas(deps, VEIC, agora);
    expect(await detectarAlertas(deps, VEIC, new Date(agora.getTime() + 60000))).toBeNull();
    expect([...banco.values()][0].contagem).toBe(1);
  });
  it("tabela não criada: o erro sobe (o run.ts transforma em aviso) e não marca a execução", async () => {
    const { deps } = falso({ lerConfig: async () => { throw new Error('relation "public.alerta_regra" does not exist'); } });
    await expect(detectarAlertas(deps, VEIC, agora)).rejects.toThrow(/alerta_regra/);
    expect(await deps.ultimaExecucao()).toBeNull();
  });
});

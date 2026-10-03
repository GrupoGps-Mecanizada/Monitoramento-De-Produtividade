import { describe, expect, it } from "vitest";
import type { Retrato } from "../tipos";
import { avisoLeitura, situacaoLeitura } from "./conexao";

const r = (o: Partial<Retrato> = {}): Retrato => ({ lido_em: "2026-10-01T15:00:00.000Z", erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [], ...o });
const em = (iso: string) => new Date(iso).getTime();

describe("situação da leitura", () => {
  it("antes da 1ª leitura do coletor", () => {
    expect(situacaoLeitura(null, true, em("2026-10-01T15:05:00Z"))).toMatchObject({ tom: "neu", texto: "aguardando 1ª leitura…" });
    expect(situacaoLeitura(r({ lido_em: null }), true).texto).toBe("aguardando 1ª leitura…");
  });
  it("em dia, atrasada, com erro e sem conexão", () => {
    expect(situacaoLeitura(r(), true, em("2026-10-01T15:05:00Z"))).toMatchObject({ tom: "ok", texto: "atualizado 12:00:00 · a cada 5 min", curto: "12:00" });
    expect(situacaoLeitura(r(), true, em("2026-10-01T15:16:00Z")).tom).toBe("warn");
    expect(situacaoLeitura(r({ erro: { em: "2026-10-01T15:00:00.000Z", msg: "x" } }), true, em("2026-10-01T15:05:00Z")).tom).toBe("bad");
    expect(situacaoLeitura(r(), false).texto).toBe("reconectando…");
  });
  it("faixas de aviso: falha e acesso pausado", () => {
    expect(avisoLeitura(r({ erro: { em: "2026-10-01T15:00:00.000Z", msg: "HTTP 500" } }))).toBe("Falha ao consultar o GAUSS às 12:00: HTTP 500. Mostrando a última leitura (12:00:00).");
    const g = { dia: "2026-10-01", requisicoes: 1, logins: 0, erros: 5, desde: "2026-10-01T03:00:00.000Z" };
    expect(avisoLeitura(r({ gauss: { ...g, pausadoAte: "2026-10-01T15:30:00.000Z" } }), em("2026-10-01T15:05:00Z"))).toBe("Acesso ao GAUSS pausado até 12:30 após falhas seguidas (proteção para não insistir).");
    expect(avisoLeitura(r({ gauss: { ...g, pausadoAte: "2026-10-01T15:00:00.000Z" } }), em("2026-10-01T15:05:00Z"))).toBeNull();
  });
});

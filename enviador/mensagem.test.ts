import { describe, expect, it } from "vitest";
import { MAX_ITENS, montarMensagem, numeroDestino, paraEnviar, type AlertaEnvio } from "./mensagem";

const HOJE = "2026-10-19";
const al = (o: Partial<AlertaEnvio> = {}): AlertaEnvio => ({
  id: 1, regra: "saida_tarde", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: HOJE, ini: 8 * 3600 + 600, local: "PÁTIO",
  detalhe: "saiu 08:10 · limite 07:45", destino: "whatsapp", situacao: "aberto", ultimo_aviso_em: null, ...o,
});

describe("o que mandar", () => {
  it("só o que vai para o WhatsApp, de hoje, ainda não avisado e não resolvido; do mais cedo para o mais tarde", () => {
    const xs = [
      al({ id: 1, ini: 36000 }),
      al({ id: 2, ini: 30000 }),
      al({ id: 3, destino: "resumo" }),
      al({ id: 4, ultimo_aviso_em: "2026-10-19T11:00:00Z" }),
      al({ id: 5, situacao: "resolvido" }),
      al({ id: 6, dia: "2026-10-18" }),
      al({ id: 7, situacao: "silenciado" }),
      al({ id: 8, situacao: "visto" }),
      al({ id: 9, vaga: "[S/ VAGA]" }),
      al({ id: 10, vaga: "CAMINHÃO BROOK - GPS - 03" }),
    ];
    expect(paraEnviar(xs, HOJE).map((a) => a.id)).toEqual([8, 2, 1]);
  });
});

describe("texto da mensagem", () => {
  it("cabeçalho com data e hora, um item por alerta com placa, vaga curta, regra, detalhe, local e supervisor", () => {
    const t = montarMensagem([al({ regra: "desligado", placa: "DSY6472", vaga: "AUTO VÁCUO - GPS - 05", detalhe: "1 h 10 min", local: "ALTO FORNO 3", supervisor: "Donizete", ini: 36120 })], new Date("2026-10-19T13:15:00-03:00"));
    expect(t).toBe("🚨 *Alertas da frota* · 19/10 13:15\n\n• *DSY6472* (AV 05) · Motor desligado 1 h\n  1 h 10 min · 10:02 · ALTO FORNO 3 · Donizete");
  });
  it("vários juntos numa mensagem só; acima do limite resume o resto", () => {
    const xs = Array.from({ length: MAX_ITENS + 3 }, (_, i) => al({ id: i, placa: `P${i}` }));
    const t = montarMensagem(xs, new Date("2026-10-19T09:00:00-03:00"));
    expect(t.match(/^• /gm)).toHaveLength(MAX_ITENS);
    expect(t).toContain("+3 outros: veja na Gestão de alertas");
  });
  it("saída tarde e chegada cedo: sem repetir a hora nem o Pátio (já estão no detalhe)", () => {
    const t = montarMensagem([al({ local: "PÁTIO DO TRANSPORTE RODOVIÁRIO" })], new Date("2026-10-19T09:00:00-03:00"));
    expect(t).toContain("  saiu 08:10 · limite 07:45 · Junior Pereira");
  });
  it("sem supervisor e sem local: não deixa buraco", () => {
    expect(montarMensagem([al({ regra: "ocioso", detalhe: "40 min", supervisor: null, local: null })], new Date("2026-10-19T09:00:00-03:00"))).toContain("  40 min · 08:10");
  });
});

describe("destino", () => {
  it("número: só os dígitos; grupo: como veio", () => {
    expect(numeroDestino("+55 31 99953-2405")).toBe("5531999532405");
    expect(numeroDestino(" 120363012345678901@g.us ")).toBe("120363012345678901@g.us");
  });
});

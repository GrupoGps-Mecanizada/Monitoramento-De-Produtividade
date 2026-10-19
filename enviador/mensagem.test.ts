import { describe, expect, it } from "vitest";
import { MAX_ITENS, montarMensagem, numeroDestino, paraEnviar, type AlertaEnvio } from "./mensagem";

const HOJE = "2026-10-19";
const al = (o: Partial<AlertaEnvio> = {}): AlertaEnvio => ({
  id: 1, regra: "saida_tarde", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: HOJE, ini: 8 * 3600 + 600, local: "PÁTIO",
  detalhe: "saiu 08:10 · limite 07:45", destino: "whatsapp", situacao: "aberto", ultimo_aviso_em: null, ref: 7 * 3600 + 45 * 60, fim: null, ...o,
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

describe("texto da mensagem (modelo A: agrupado por tipo)", () => {
  const agora = new Date("2026-10-19T12:35:00-03:00");
  it("cabeçalho com dia da semana, grupos por tipo com quantidade, caminhões em citação e rodapé", () => {
    const t = montarMensagem(
      [
        al({ id: 1, regra: "desligado", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 08 - 24 HS", detalhe: "1h02", local: "CALCINAÇÃO", supervisor: "Fabio", ini: 2 * 3600 + 120, ref: 2 * 3600 + 120 }),
        al({ id: 2, regra: "saida_tarde", placa: "DSY6475", vaga: "ALTA PRESSÃO - GPS - 07 - 16 HS", detalhe: "saiu 07:39 · limite 07:15", supervisor: null, ini: 7 * 3600 + 39 * 60, ref: 7 * 3600 + 15 * 60 }),
        al({ id: 3, regra: "saida_tarde", placa: "EZS8764", vaga: "ALTA PRESSÃO - GPS - 03", detalhe: "não saiu do Pátio · limite 07:45", supervisor: "Junior Pereira", ini: 7 * 3600 + 45 * 60, ref: 7 * 3600 + 45 * 60 }),
        al({ id: 4, regra: "desligado", placa: "DSY6475", vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", detalhe: "1h20", local: "PÁTIOS PRIMÁRIOS", supervisor: "Fabio", ini: 4 * 3600 + 180, ref: 4 * 3600 + 180 }),
      ],
      agora,
    );
    expect(t).toBe(
      [
        "🚛 *ALERTAS DA FROTA*",
        "_Segunda, 19/10 · 12:35_",
        "",
        "🔴 *Motor desligado* · 2",
        "> *EGC2985* · AP 08",
        "> Desligado há 1h02 em Calcinação",
        "> desde 02:02 · Sup. Fabio",
        ">",
        "> *DSY6475* · AP 01",
        "> Desligado há 1h20 em Pátios Primários",
        "> desde 04:03 · Sup. Fabio",
        "",
        "🟠 *Saída tarde do Pátio* · 2",
        "> *DSY6475* · AP 07 — saiu 07:39, +24 min",
        "> *EZS8764* · AP 03 — ainda no Pátio · Sup. Junior Pereira",
        "",
        "_Gestão de alertas · Monitoramento_",
      ].join("\n"),
    );
  });
  it("chegada cedo e ociosidade", () => {
    const t = montarMensagem(
      [
        al({ id: 1, regra: "chegada_cedo", placa: "EGC2993", vaga: "AUTO VÁCUO - GPS - 05", detalhe: "chegou 16:05 · limite 16:30", supervisor: "Donizete", ini: 16 * 3600 + 300, ref: 16 * 3600 + 1800 }),
        al({ id: 2, regra: "ocioso", placa: "EAM3257", vaga: "HIPER VÁCUO - GPS - 03", detalhe: "45 min", local: "ALTO FORNO 3", supervisor: "Genésio", ini: 11 * 3600, ref: 11 * 3600 }),
      ],
      agora,
    );
    expect(t).toContain("> *EGC2993* · AV 05 — chegou 16:05, 25 min antes · Sup. Donizete");
    expect(t).toContain("🟡 *Ociosidade* · 1\n> *EAM3257* · HV 03\n> Ligado sem produzir há 45 min em Alto Forno 3\n> desde 11:00 · Sup. Genésio");
  });
  it("acima do limite resume o resto antes do rodapé", () => {
    const xs = Array.from({ length: MAX_ITENS + 3 }, (_, i) => al({ id: i, placa: `P${i}`, ini: 7 * 3600 + 45 * 60, ref: 7 * 3600 + 45 * 60 }));
    const t = montarMensagem(xs, agora);
    expect(t.match(/^> \*P/gm)).toHaveLength(MAX_ITENS);
    expect(t).toContain("+3 outros: veja na Gestão de alertas\n\n_Gestão de alertas · Monitoramento_");
  });
});

describe("destino", () => {
  it("número: só os dígitos; grupo: como veio", () => {
    expect(numeroDestino("+55 31 99953-2405")).toBe("5531999532405");
    expect(numeroDestino(" 120363012345678901@g.us ")).toBe("120363012345678901@g.us");
  });
});

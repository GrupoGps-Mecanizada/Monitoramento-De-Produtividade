import { describe, expect, it } from "vitest";
import type { Veiculo } from "../tipos";
import { htmlMarcador } from "./marcador";

const AGORA = new Date("2026-10-01T15:00:00Z").getTime();
const v = (o: Partial<Veiculo> = {}): Veiculo => ({
  id: "1", placa: "EOF<5208>", vaga: "", grupo: "", motorista: "", endereco: "", demora: "", direcao: 90, status: "Ligado", status_cod: 1,
  status_desde: null, lat: 1, lng: 1, posicao_em: "2026-10-01T14:59:00Z", area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});

describe("marcador do veículo", () => {
  it("ligado ao vivo: cor do status, seta na direção, placa escapada e idade", () => {
    const h = htmlMarcador(v(), false, 30, AGORA);
    expect(h).toContain("--c:var(--ok-dot)");
    expect(h).toContain("rotate(90deg)");
    expect(h).toContain("EOF&lt;5208&gt;");
    expect(h).toContain("<small>1m</small>");
    expect(h).not.toContain("semsinal");
  });
  it("sem sinal fica tracejado e sem seta", () => {
    const h = htmlMarcador(v({ posicao_em: "2026-10-01T13:00:00Z" }), false, 30, AGORA);
    expect(h).toContain('class="mk semsinal"');
    expect(h).toContain("●");
  });
  it("selecionado e com motor 2º ligado", () => {
    const h = htmlMarcador(v({ motor2: { id: "2", placa: "X", status: "Ligado", status_cod: 1, status_desde: null, posicao_em: null, sem_sinal: false } }), true, 30, AGORA);
    expect(h).toContain('class="mk sel"');
    expect(h).toContain('class="m2"');
  });
  it("mostra a sigla do tipo e o nome da planilha", () => {
    const h = htmlMarcador(v({ placa: "ASP12", equip: { tipo: "as", nome: "Aspirador 03", ordem: 3 } }), false, 30, AGORA);
    expect(h).toContain('<b class="sg">AS</b>');
    expect(h).toContain("Aspirador 03");
    expect(h).not.toContain("ASP12");
  });
});

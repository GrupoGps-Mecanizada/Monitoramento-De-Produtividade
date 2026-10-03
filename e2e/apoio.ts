import type { Page } from "@playwright/test";

const pad = (n: number) => String(n).padStart(2, "0");
export const hoje = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const quadrado = (lat: number, lng: number, lado: number) => [[lat, lng], [lat, lng + lado], [lat + lado, lng + lado], [lat + lado, lng]];

export const CERCAS = [
  { code: 1, name: "PATIO", layer: 1, color: "#2a78d6", tipo: "area", polygon: quadrado(-19.481, -42.531, 0.002) },
  { code: 2, name: "OFICINA", layer: 1, color: "#eb6834", tipo: "area", polygon: quadrado(-19.476, -42.526, 0.002) },
];

const veiculo = (o: Record<string, unknown>) => ({
  vaga: "VAGA 1", grupo: "ALTA PRESSÃO", motorista: "", endereco: "Rua A", demora: "", direcao: 0, status_desde: minutosAtras(30),
  posicao_em: minutosAtras(1), area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});
export const retrato = () => ({
  lido_em: minutosAtras(1), erro: null, intervalo_s: 300, sem_sinal_min: 30,
  gauss: { dia: hoje(), requisicoes: 42, logins: 1, erros: 0, desde: minutosAtras(600), pausadoAte: null },
  veiculos: [
    veiculo({ id: "10", placa: "EOF5208", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", area_desde: minutosAtras(20),
      motor2: { id: "11", placa: "EOF52082", status: "Ligado", status_cod: 1, status_desde: minutosAtras(5), posicao_em: minutosAtras(1), sem_sinal: false } }),
    veiculo({ id: "11", placa: "EOF52082", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", motor2_de: "10" }),
    veiculo({ id: "20", placa: "EGC2984", status: "Desligado", status_cod: 2, lat: -19.475, lng: -42.525, area: "OFICINA" }),
    veiculo({ id: "30", placa: "DTW5E38", status: "Em manutenção", status_cod: 9, lat: -19.470, lng: -42.520, via: "RUA 1", posicao_em: minutosAtras(90) }),
  ],
});
export const eventos = () => [
  { t: minutosAtras(50), id: "10", placa: "EOF5208", vaga: "VAGA 1", tipo: "entrada", area: "PATIO", lat: -19.48, lng: -42.53 },
  { t: minutosAtras(40), id: "20", placa: "EGC2984", vaga: "VAGA 2", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
];
export const historico = () => {
  const dia = hoje();
  const pontos = Array.from({ length: 21 }, (_, i) => [-19.481 + i * 0.0002, -42.531 + i * 0.0001, `08:${pad(i)}:00`, i < 10 ? 35 : 0, i < 10 ? "movimento" : "parado_ligado", i >= 2 && i <= 5 ? 1 : 0]);
  return {
    id: "10", dia, fonte: "cache", baixado_em: minutosAtras(60), motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null,
    motor2: { intervalos: [["08:02:00", "08:05:00"]], id: "11", placa: "EOF52082" },
    trechos: [
      { estado: "movimento", inicio: `${dia} 08:00:00`, fim: `${dia} 08:10:00`, duracao_min: 10, de: "PATIO", para: "", percurso: ["PATIO"], km: 2.1, vel_max: 35, motor2_min: 3 },
      { estado: "parado_ligado", inicio: `${dia} 08:10:00`, fim: `${dia} 08:20:00`, duracao_min: 10, local: "PATIO", lat: -19.479, lng: -42.53, motor2_min: 0 },
    ],
    resumo: { primeiro: `${dia} 08:00:00`, ultimo: `${dia} 08:20:00`, pontos: 21, km: 2.1, vel_max: 35, movimento_min: 10, parado_ligado_min: 10, desligado_min: 0, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: 3, areas: [{ area: "PATIO", min: 20 }] },
    pontos,
  };
};

/**
 * Responde as leituras do Supabase com os dados acima (o banco real nunca é lido nem gravado) e corta os
 * tiles do mapa. Devolve a lista de tentativas de gravação: os testes exigem que fique vazia.
 */
export async function prepararDados(page: Page): Promise<string[]> {
  const gravacoes: string[] = [];
  await page.route(/arcgisonline\.com|tile\.openstreetmap\.org/, (r) => r.abort());
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      gravacoes.push(`${req.method()} ${url.pathname}`);
      return route.fulfill({ status: 201, body: "" });
    }
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    const tabela = url.pathname.split("/").pop();
    if (tabela === "loc_kv") return json(url.searchParams.get("chave") === "eq.cercas" ? [{ valor: { cercas: CERCAS } }] : [{ valor: retrato() }]);
    if (tabela === "loc_eventos") return json(eventos().map((dados) => ({ dados })));
    if (tabela === "loc_dias") return json([{ dia: hoje() }]);
    if (tabela === "loc_historico") return json([{ resultado: historico(), baixado_em: minutosAtras(60), fechado: true }]);
    return json([]);
  });
  return gravacoes;
}

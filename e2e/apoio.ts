import type { Page } from "@playwright/test";
import { matrizExemplo } from "../src/lib/dominio/matriz-exemplo";

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
  // contorno da usina (a Análise mostra só o que fica dentro)
  { code: 3, name: "PLANTA USIMINAS", layer: 1, color: "#888888", tipo: "planta", polygon: quadrado(-19.49, -42.54, 0.03) },
];

const veiculo = (o: Record<string, unknown>) => ({
  vaga: "VAGA 1", grupo: "ALTA PRESSÃO", motorista: "", endereco: "Rua A", demora: "", direcao: 0, status_desde: minutosAtras(30),
  posicao_em: minutosAtras(1), area: "", area_desde: null, via: "", sem_sinal: false, ...o,
});
export const retrato = () => ({
  lido_em: minutosAtras(1), erro: null, intervalo_s: 300, sem_sinal_min: 30,
  gauss: { dia: hoje(), requisicoes: 42, logins: 1, erros: 0, desde: minutosAtras(600), pausadoAte: null },
  veiculos: [
    veiculo({ id: "10", placa: "EGC2985", grupo: "CAMINHÃO ALTA PRESSÃO", motorista: "JOSÉ DA SILVA", vaga: "ALTA PRESSÃO - GPS - 08 - 24 HS", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", area_desde: minutosAtras(20),
      motor2: { id: "11", placa: "EGC29852", status: "Ligado", status_cod: 1, status_desde: minutosAtras(5), posicao_em: minutosAtras(1), sem_sinal: false } }),
    veiculo({ id: "11", placa: "EGC29852", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Ligado", status_cod: 1, lat: -19.480, lng: -42.530, area: "PATIO", motor2_de: "10" }),
    veiculo({ id: "20", placa: "EGC-2984", grupo: "CAMINHÃO BROOK", status: "Desligado", status_cod: 2, lat: -19.475, lng: -42.525, area: "OFICINA" }),
    veiculo({ id: "30", placa: "DSY6472", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Em manutenção", status_cod: 9, lat: -19.470, lng: -42.520, via: "RUA 1", posicao_em: minutosAtras(90) }),
    veiculo({ id: "40", placa: "ASP12", grupo: "ASPIRADOR", vaga: "ASPIRADOR INDUSTRIAL - GPS - 03", status: "Ligado", status_cod: 1, lat: -19.4805, lng: -42.5305, area: "PATIO" }),
    // não é da frota da Mecanizada: não pode aparecer em lugar nenhum
    veiculo({ id: "90", placa: "EOF5208", grupo: "CAMINHÃO ALTA PRESSÃO", status: "Ligado", status_cod: 1, lat: -19.479, lng: -42.529, area: "PATIO" }),
  ],
});
export const eventos = () => [
  { t: minutosAtras(600), id: "10", placa: "EGC2985", vaga: "", tipo: "abertura", status: "Desligado", area: "PATIO", sem_sinal: false },
  { t: minutosAtras(50), id: "10", placa: "EGC2985", vaga: "", tipo: "entrada", area: "PATIO", lat: -19.48, lng: -42.53 },
  { t: minutosAtras(45), id: "10", placa: "EGC2985", vaga: "", tipo: "status", de: "Desligado", para: "Ligado", area: "PATIO", duracao_min: 500 },
  { t: minutosAtras(40), id: "20", placa: "EGC-2984", vaga: "", tipo: "status", de: "Ligado", para: "Desligado", area: "OFICINA", duracao_min: 70 },
  { t: minutosAtras(30), id: "90", placa: "EOF5208", vaga: "", tipo: "status", de: "Desligado", para: "Ligado", area: "PATIO", duracao_min: 10 },
];
export const historico = () => {
  const dia = hoje();
  // 08:00–08:10 andando, 08:10–08:40 parado ligado no PATIO (30 min = 1 capítulo)
  const pontos = Array.from({ length: 41 }, (_, i) => [-19.481 + Math.min(i, 10) * 0.0002, -42.531 + Math.min(i, 10) * 0.0001, `08:${pad(i)}:00`, i < 10 ? 35 : 0, i < 10 ? "movimento" : "parado_ligado", i >= 2 && i <= 5 ? 1 : 0]);
  return {
    id: "10", dia, fonte: "cache", baixado_em: minutosAtras(60), motor2_erro: null, temRpm: true, rpm_travado: null, motor2_rpm_travado: null,
    motor2: { intervalos: [["08:02:00", "08:05:00"]], id: "11", placa: "EGC29852" },
    trechos: [
      { estado: "movimento", inicio: `${dia} 08:00:00`, fim: `${dia} 08:10:00`, duracao_min: 10, de: "OFICINA", para: "PATIO", percurso: ["PATIO"], km: 2.1, vel_max: 35, motor2_min: 3 },
      { estado: "parado_ligado", inicio: `${dia} 08:10:00`, fim: `${dia} 08:40:00`, duracao_min: 30, local: "PATIO", lat: -19.479, lng: -42.53, motor2_min: 0 },
    ],
    resumo: { primeiro: `${dia} 08:00:00`, ultimo: `${dia} 08:40:00`, pontos: 41, km: 2.1, vel_max: 35, movimento_min: 10, parado_ligado_min: 30, desligado_min: 0, parado_min: 0, sem_sinal_min: 0, motor2_ligado_min: 3, areas: [{ area: "PATIO", min: 30 }] },
    pontos,
  };
};

/** Timeline de motor do GAUSS (timeline_motor_vaga) e apontamentos do tablet (demoras_categorizadas) do veículo 10. */
export const motorGauss = () => {
  const d = hoje();
  return [
    { placa_ou_codigo: "10", inicio: `${d} 08:00:00`, fim: `${d} 08:10:00`, status: "on", status_label: "Motor Ligado", gravado: minutosAtras(60) },
    { placa_ou_codigo: "10", inicio: `${d} 08:10:00`, fim: `${d} 08:20:00`, status: "secondary_motor_on", status_label: "Motor Secundário Ligado", gravado: minutosAtras(60) },
    { placa_ou_codigo: "10", inicio: `${d} 08:20:00`, fim: `${d} 08:32:00`, status: "stopped", status_label: "Parado Ligado", gravado: minutosAtras(60) },
    // o RPM do rastreador dizia parado ligado até 08:40; o site só usa o GAUSS: desligado
    { placa_ou_codigo: "10", inicio: `${d} 08:32:00`, fim: `${d} 08:40:00`, status: "off", status_label: "Motor Desligado", gravado: minutosAtras(60) },
  ];
};
export const tablet = () => {
  const d = hoje();
  return [{ demora_cod: 1, inicio: `${d} 08:25:00`, fim: `${d} 08:35:00`, categoria_demora: "Refeição Motorista", motorista: "--", concluido: "NÃO" }];
};

/** Folhas da cronoanálise (crono_registros), dados falsos: turno A de dia, hoje, AP-01. Produzindo 08:20–08:40 com a bomba parada. */
export const cronoFolhas = () => {
  const linha = (nome: string, papel: string, hi: string, hf: string, cod: number, descricao: string, cls: string) => ({
    data: hoje(), turno: "A", horario: "07–19", area: "Área Teste", nome, papel, placa: "EGC2985", vaga: "AP-01", equip: "Alta Pressão",
    hi, hf, cod, descricao, cls, obs: null, supervisor: "Supervisor Teste", kit: "CR-9999",
  });
  return [
    linha("João Teste", "Motorista", "06:40", "08:20", 3, "Trajeto (Bica/Área/Vest./Garagem)", "Improdutivo necessário"),
    linha("João Teste", "Motorista", "08:20", "08:40", 32, "Hidrojateamento – Pistola", "Produzindo"),
    linha("Maria Teste", "Operador 1", "08:00", "08:40", 5, "Almoço / Refeição", "Improdutivo necessário"),
  ];
};

/** Paradas da análise (analise_paradas): ontem, no PATIO e na OFICINA, do caminhão 10 (Alta Pressão) e do aspirador 40. */
export const paradasAnalise = () => {
  const d = new Date(Date.now() - 86400000);
  const ontem = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const p = (veiculo_id: string, placa: string, ini: number, area: string, lat: number, lng: number, motor: Record<string, number>, apont: string[] = []) =>
    ({ dia: ontem, veiculo_id, placa, ini, fim: ini + 3600, lat, lng, area, motor, apont });
  return [
    p("10", "EGC2985", 8 * 3600, "OFICINA", -19.475, -42.525, { secondary_motor_on: 40, stopped: 20 }, ["Aguardando Área"]),
    p("10", "EGC2985", 14 * 3600, "PATIO", -19.48, -42.53, { stopped: 60 }),
    p("40", "ASP12", 9 * 3600, "PATIO", -19.4805, -42.5305, { stopped: 60 }),
    // fora da frota: não pode aparecer
    p("90", "EOF5208", 9 * 3600, "PATIO", -19.479, -42.529, { secondary_motor_on: 60 }),
    // o Pátio do Transporte é a base: sai da análise
    p("10", "EGC2985", 16 * 3600, "PÁTIO DO TRANSPORTE RODOVIÁRIO", -19.485, -42.535, { secondary_motor_on: 60 }),
    // fora da usina, mas na região (como o Aterro e o Poço Redondo): continua no mapa
    p("10", "EGC2985", 18 * 3600, "ATERRO CONTROLADO", -19.4, -42.4, { secondary_motor_on: 30 }),
    // a mais de 50 km: vai para a linha "Longe da região"
    p("10", "EGC2985", 20 * 3600, "GALPÃO LONGE", -9.8, -34.1, { secondary_motor_on: 20 }),
    // Mata CDP e USIPA saem da análise
    p("10", "EGC2985", 10 * 3600, "MATA CDP", -19.47, -42.52, { stopped: 60 }),
  ];
};

const diaAtras = (n: number) => {
  const d = new Date(Date.now() - n * 86400000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const vagaMedicao = (o: Record<string, unknown>) => ({
  boletim_cod: "B1", regime: "24h-12 GPS (Novo)", horas_regime: 72, horas_indisp: 0, df: 100,
  ausencia_operador: 0, area_manutencao: 0, fora_planta: 0, trajeto: 0, cartao_rfid: 0, lancada: 0, motor_desligado: 0, parado_ligado: 0, outros: 0, ...o,
});
/** Medição oficial (tabelas medicao_*): um boletim cujo ciclo termina hoje (o motor 2º de motorGauss cai dentro), 2 vagas. */
export const medicao = () => ({
  boletins: [{ cod: "B1", identificacao: "GPS 2026-10", inicio: diaAtras(2), fim: hoje() }],
  vagas: [
    vagaMedicao({ vaga_id: 545, vaga: "ALTA PRESSÃO - GPS - 08 - 24 HS", horas_indisp: 0.72, df: 99, fora_planta: 0.72 }),
    vagaMedicao({ vaga_id: 530, vaga: "ALTA PRESSÃO - GPS - 01 - 24 HS", horas_indisp: 7.2, df: 90, ausencia_operador: 5, area_manutencao: 2 }),
  ],
  eventos: [
    { boletim_cod: "B1", vaga_id: 530, placa: "EGC2985", inicio: `${hoje()}T06:00:00-03:00`, fim: `${hoje()}T11:00:00-03:00`, tipo: "Ausência de operador", horas: 5 },
    { boletim_cod: "B1", vaga_id: 530, placa: "EGC2985", inicio: `${hoje()}T13:00:00-03:00`, fim: `${hoje()}T15:00:00-03:00`, tipo: "Área de manutenção - OFICINA GPS/SERVITEC", horas: 2 },
  ],
  dias: [2, 1, 0].map((n) => ({ boletim_cod: "B1", vaga_id: 530, dia: diaAtras(n), placas: "EGC2985", horas_regime: 24, horas_indisp: 2.4 })),
});

/** Matriz como o Supabase devolve (com o nome do supervisor e do regime dentro de objetos). */
export const matrizBanco = () =>
  matrizExemplo().map((c) => ({ ...c, supervisor: c.id === 11 ? { nome: "OZIAS" } : null, regime: c.id === 11 ? { nome: "ADM" } : null, supervisor_id: c.id === 11 ? 1 : null, regime_id: c.id === 11 ? 1 : null }));
export const SUPERVISORES = [{ id: 1, nome: "OZIAS", ativo: true }, { id: 2, nome: "ISRAEL", ativo: true }];
export const REGIMES = [{ id: 1, nome: "ADM", ativo: true }, { id: 2, nome: "4X4 - A", ativo: true }];

/**
 * Responde as leituras do Supabase com os dados acima (o banco real nunca é lido nem gravado) e corta os
 * tiles do mapa. Devolve a lista de tentativas de gravação: os testes exigem que fique vazia (só a tela
 * Equipamentos grava, e o teste dela confere o que foi enviado). `matriz`: troca a matriz de equipamentos.
 */
export async function prepararDados(page: Page, opcoes: { alertas?: unknown[]; matriz?: ReturnType<typeof matrizBanco>; analise?: unknown[]; analiseSemTabela?: boolean; eventos?: unknown[]; excessos?: unknown[]; medicao?: ReturnType<typeof medicao>; medicaoSemTabela?: boolean; crono?: unknown[] } = {}): Promise<string[]> {
  const gravacoes: string[] = [];
  await page.route(/arcgisonline\.com|tile\.openstreetmap\.org/, (r) => r.abort());
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (b: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    const tabela = url.pathname.split("/").pop();
    if (req.method() !== "GET" && req.method() !== "HEAD") {
      gravacoes.push(`${req.method()} ${url.pathname}${req.postData() ? ` ${req.postData()}` : ""}`);
      // a matriz grava com .select("id"): devolve a linha gravada
      if (tabela?.startsWith("frota_")) return json([{ id: 99 }]);
      return route.fulfill({ status: 201, body: "" });
    }
    if (tabela === "frota_equipamento") return json(opcoes.matriz ?? matrizBanco());
    if (tabela === "frota_supervisor") return json(SUPERVISORES);
    if (tabela === "frota_regime") return json(REGIMES);
    if (tabela === "frota_equipamento_historico") return json([{ id: 1, em: minutosAtras(60), por: "sistema", mudancas: { novo: true } }]);
    if (tabela === "loc_kv") return json(url.searchParams.get("chave") === "eq.cercas" ? [{ valor: { cercas: CERCAS } }] : [{ valor: retrato() }]);
    if (tabela === "loc_eventos") return json((opcoes.eventos ?? eventos()).map((dados) => ({ dados })));
    if (tabela === "loc_dias") return json([{ dia: hoje() }]);
    if (tabela === "loc_historico") return json([{ resultado: historico(), baixado_em: minutosAtras(60), fechado: true }]);
    if (tabela === "timeline_motor_vaga") return json(motorGauss());
    if (tabela === "crono_registros") return json(opcoes.crono ?? cronoFolhas());
    if (tabela === "demoras_categorizadas") return json(tablet());
    if (tabela === "analise_excessos") return json(opcoes.excessos ?? []);
    if (tabela === "analise_paradas") {
      // como o Supabase responde quando o SQL da tabela ainda não foi rodado
      if (opcoes.analiseSemTabela) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST205", message: "Could not find the table 'public.analise_paradas' in the schema cache" }) });
      return json(opcoes.analise ?? paradasAnalise());
    }
    if (tabela?.startsWith("medicao_")) {
      // como o Supabase responde quando o SQL da medição ainda não foi rodado
      if (opcoes.medicaoSemTabela) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "PGRST205", message: `Could not find the table 'public.${tabela}' in the schema cache` }) });
      const m = opcoes.medicao ?? medicao();
      if (tabela === "medicao_boletim") return json(m.boletins);
      if (tabela === "medicao_boletim_vaga") return json(m.vagas);
      if (tabela === "medicao_indisp_evento") return json(m.eventos);
      if (tabela === "medicao_vaga_dia") return json(m.dias);
    }
    if (tabela === "alertas") return json(opcoes.alertas ?? []);
    if (tabela === "alerta_regra" || tabela === "alerta_politica" || tabela === "alerta_silencio") return json([]);
    return json([]);
  });
  return gravacoes;
}

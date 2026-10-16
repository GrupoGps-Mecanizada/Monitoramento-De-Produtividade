// "Dia da frota" por vaga (15/10/2026): o espelho da tela "Timeline Tempo de Motor (Vaga)" do GAUSS. Uma linha por
// vaga, cada trecho com o caminhão DELE (o caminhão roda entre as vagas), as cores e os nomes do GAUSS, e a conferência
// com o que o GAUSS mandou na última busca (timeline_conferencia).
import type { TipoEquip } from "../tipos";
import type { LinhaMotorFrota } from "./dia-frota";
import { segNoDia, statusGauss } from "./gauss-dia";
import { statusProdutivo } from "./produtividade";
import { vagaOficial } from "./vagas-oficiais";

const DIA = 86400;

/** Cores e nomes da tela do GAUSS (captura de 15/10/2026). */
export const CORES_GAUSS: Record<string, { cor: string; rotulo: string }> = {
  on: { cor: "#008000", rotulo: "Motor Ligado" },
  stopped: { cor: "#FFFF00", rotulo: "Parado Ligado" },
  secondary_motor_on: { cor: "#76e576", rotulo: "Motor Secundário Ligado" },
  off: { cor: "#ff0000", rotulo: "Motor Desligado" },
  categorized_stop: { cor: "#1a1a7a", rotulo: "Parada Apontada" },
  maintenance: { cor: "#ffa500", rotulo: "Em manutenção" },
  not_appropriated: {
    cor: "#c5c7cc",
    rotulo: "Indisponível / Sem Apropriação",
  },
  no_data: { cor: "#000000", rotulo: "Sem dados de bordo" },
};
export const LEGENDA_GAUSS = Object.entries(CORES_GAUSS).map(([cod, x]) => ({
  cod,
  ...x,
}));
const LIGADO = new Set(["on", "stopped", "secondary_motor_on"]);

/** Texto escuro sobre as cores claras do GAUSS (amarelo, verde claro, cinza), branco nas demais. */
export function textoSobre(cor: string): string {
  const h = cor.replace("#", "");
  const [r, g, b] = (h.length === 3 ? [...h].map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]).map((x) => parseInt(x, 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

/** Linha de timeline_motor_vaga com a vaga e o caminhão do trecho. */
export interface LinhaMotorVaga extends LinhaMotorFrota {
  vaga_id: number | string;
  vaga_nome: string;
  placa?: string | null;
  cor?: string | null;
}
export interface ConferenciaVaga {
  vaga_id: number | string;
  minutos: Record<string, number>;
  trechos: number;
  buscado_em: string;
}
export interface TrechoVaga {
  a: number;
  b: number;
  cod: string;
  rotulo: string;
  cor: string;
  /** id do veículo no GAUSS; "" = sem caminhão */
  veiculo: string;
  placa: string | null;
}
export interface LinhaVaga {
  vaga_id: string;
  nome: string;
  tipo: TipoEquip | null;
  trechos: TrechoVaga[];
  /** caminhões que passaram pela vaga no dia, na ordem em que apareceram */
  caminhoes: { veiculo: string; placa: string; min: number }[];
  ligado_min: number;
  /** minutos no status produtivo de cada caminhão (Alta Pressão: motor 2º; Alto Vácuo: parado ligado...) */
  produtivo_min: number;
  /** null = sem conferência (vaga ainda não buscada pelo coletor novo) */
  conferencia: {
    ok: boolean;
    buscado_em: string;
    diferencas: { cod: string; banco: number; gauss: number }[];
  } | null;
  /** trecho deste momento (só hoje) */
  agora: TrechoVaga | null;
}
export interface Duplicado {
  placa: string;
  vagas: string[];
  min: number;
}

/** Tipo da vaga pelo nome do GAUSS. */
export function tipoDaVaga(nome: string): TipoEquip | null {
  if (/ALTA\s+PRESS/i.test(nome)) return "ap";
  if (/(AUTO|ALTO)\s+V[ÁA]CUO/i.test(nome)) return "av";
  if (/HIPER/i.test(nome)) return "hv";
  if (/ULTRA/i.test(nome)) return "uv";
  if (/BROOK|POLIGUIND/i.test(nome)) return "pg";
  if (/ASPIRADOR/i.test(nome)) return "as";
  return null;
}
const ORDEM: (TipoEquip | null)[] = ["ap", "av", "hv", "uv", "pg", "as", null];
const compararVagas = (p: { nome: string; tipo: TipoEquip | null }, q: { nome: string; tipo: TipoEquip | null }) =>
  ORDEM.indexOf(p.tipo) - ORDEM.indexOf(q.tipo) || p.nome.localeCompare(q.nome, "pt-BR", { numeric: true });

/**
 * Trechos de uma vaga sem sobreposição: em cada instante vale a linha gravada por último (empate: a que começou
 * depois), como em montarStatusGauss, mas sem juntar caminhões diferentes. Vizinhos iguais (status e caminhão) viram um.
 */
export function trechosDaVaga(linhas: LinhaMotorVaga[], dia: string): TrechoVaga[] {
  const crus = linhas
    .map((l) => ({
      a: segNoDia(l.inicio, dia),
      b: segNoDia(l.fim, dia),
      chave: `${l.gravado ?? ""}|${l.inicio.replace("T", " ")}|${l.fim.replace("T", " ")}`,
      l,
    }))
    .filter((x) => x.b > x.a);
  const cortes = [...new Set(crus.flatMap((x) => [x.a, x.b]))].sort((p, q) => p - q);
  const out: TrechoVaga[] = [];
  for (let i = 0; i + 1 < cortes.length; i++) {
    const [a, b] = [cortes[i], cortes[i + 1]];
    let vence: (typeof crus)[number] | null = null;
    for (const x of crus) if (x.a <= a && x.b >= b && (!vence || x.chave > vence.chave)) vence = x;
    if (!vence) continue;
    const l = vence.l;
    const veiculo = l.placa_ou_codigo ?? "";
    const ult = out.at(-1);
    if (ult && ult.b === a && ult.cod === l.status && ult.veiculo === veiculo) {
      ult.b = b;
      continue;
    }
    const g = CORES_GAUSS[l.status];
    out.push({
      a,
      b,
      cod: l.status,
      rotulo: g?.rotulo ?? statusGauss(l.status, l.status_label ?? l.status).rotulo,
      cor: l.cor || g?.cor || "#c5c7cc",
      veiculo,
      placa: veiculo ? (l.placa ?? null) : null,
    });
  }
  return out;
}

const minutosPorStatus = (trechos: TrechoVaga[]) => {
  const m: Record<string, number> = {};
  for (const t of trechos) m[t.cod] = (m[t.cod] ?? 0) + (t.b - t.a) / 60;
  return m;
};

/** Diferenças de mais de 1 min por status entre o que está no banco e o que o GAUSS mandou. */
export function conferir(trechos: TrechoVaga[], c: ConferenciaVaga): { cod: string; banco: number; gauss: number }[] {
  const banco = minutosPorStatus(trechos);
  const cods = new Set([...Object.keys(banco), ...Object.keys(c.minutos)]);
  return [...cods]
    .map((cod) => ({
      cod,
      banco: Math.round((banco[cod] ?? 0) * 10) / 10,
      gauss: Number(c.minutos[cod] ?? 0),
    }))
    .filter((d) => Math.abs(d.banco - d.gauss) > 1);
}

/** Uma linha por vaga, na ordem da tela do GAUSS (Alta Pressão, Auto Vácuo, Hiper Vácuo... e o número da vaga). */
export function montarDiaVagas(linhas: LinhaMotorVaga[], dia: string, agoraSeg: number | null, conferencias: ConferenciaVaga[] = []): LinhaVaga[] {
  const porVaga = new Map<string, LinhaMotorVaga[]>();
  // só as vagas que a Mecanizada opera (o banco pode ter outras, gravadas antes de 16/10/2026)
  for (const l of linhas.filter((x) => vagaOficial(x.vaga_nome ?? ""))) {
    const k = String(l.vaga_id);
    const lista = porVaga.get(k);
    if (lista) lista.push(l);
    else porVaga.set(k, [l]);
  }
  const conf = new Map(conferencias.map((c) => [String(c.vaga_id), c]));
  return [...porVaga]
    .map(([vaga_id, ls]): LinhaVaga => {
      const nome = ls.find((l) => l.vaga_nome)?.vaga_nome ?? vaga_id;
      const tipo = tipoDaVaga(nome);
      const trechos = trechosDaVaga(ls, dia);
      const caminhoes = new Map<string, { veiculo: string; placa: string; min: number }>();
      let ligado = 0;
      let produtivo = 0;
      for (const t of trechos) {
        const min = (t.b - t.a) / 60;
        if (LIGADO.has(t.cod)) ligado += min;
        if (t.veiculo) {
          const c = caminhoes.get(t.veiculo) ?? {
            veiculo: t.veiculo,
            placa: t.placa ?? t.veiculo,
            min: 0,
          };
          c.min += min;
          caminhoes.set(t.veiculo, c);
          if (t.cod === statusProdutivo(tipo ?? undefined, t.placa ?? "")) produtivo += min;
        }
      }
      const c = conf.get(vaga_id);
      const diferencas = c ? conferir(trechos, c) : [];
      const agora = agoraSeg == null ? null : (trechos.find((t) => t.a <= agoraSeg && agoraSeg < t.b) ?? trechos.at(-1) ?? null);
      return {
        vaga_id,
        nome,
        tipo,
        trechos,
        caminhoes: [...caminhoes.values()].map((x) => ({
          ...x,
          min: Math.round(x.min),
        })),
        ligado_min: Math.round(ligado),
        produtivo_min: Math.round(produtivo),
        conferencia: c ? { ok: !diferencas.length, buscado_em: c.buscado_em, diferencas } : null,
        agora,
      };
    })
    .sort(compararVagas);
}

/** Caminhão apropriado em duas vagas ao mesmo tempo no GAUSS (ex.: DSY6475 em AP-09 e AP-10, 15/10/2026). */
export function duplicados(vagas: LinhaVaga[], minimoMin = 5): Duplicado[] {
  const porVeiculo = new Map<string, { placa: string; vaga: string; a: number; b: number }[]>();
  for (const v of vagas) for (const t of v.trechos) if (t.veiculo) porVeiculo.set(t.veiculo, [...(porVeiculo.get(t.veiculo) ?? []), { placa: t.placa ?? t.veiculo, vaga: v.nome, a: t.a, b: t.b }]);
  const out: Duplicado[] = [];
  for (const ts of porVeiculo.values()) {
    let seg = 0;
    const vs = new Set<string>();
    for (let i = 0; i < ts.length; i++)
      for (let j = i + 1; j < ts.length; j++) {
        if (ts[i].vaga === ts[j].vaga) continue;
        const x = Math.min(ts[i].b, ts[j].b) - Math.max(ts[i].a, ts[j].a);
        if (x > 0) {
          seg += x;
          vs.add(ts[i].vaga).add(ts[j].vaga);
        }
      }
    if (seg / 60 >= minimoMin)
      out.push({
        placa: ts[0].placa,
        vagas: [...vs].sort((p, q) => p.localeCompare(q, "pt-BR", { numeric: true })),
        min: Math.round(seg / 60),
      });
  }
  return out.sort((p, q) => q.min - p.min);
}

/** "15/10 08:15 ~ 15/10 10:20", como o rótulo do trecho na tela do GAUSS. */
export function rotuloTrecho(dia: string, a: number, b: number): string {
  const d = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  const hm = (s: number) => {
    const m = Math.floor(Math.min(s, DIA - 1) / 60);
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  };
  return `${d} ${hm(a)} ~ ${d} ${hm(b)}`;
}

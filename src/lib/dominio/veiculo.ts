import type { CategoriaVeiculo, EstadoTrecho, Frescor, LatLng, Tom, Veiculo } from "../tipos";
import { minutosDesde } from "./formato";

export const SEM_SINAL_MIN_PADRAO = 30;

export const CATEGORIAS: Record<CategoriaVeiculo, { rotulo: string; tom: Tom }> = {
  ligado: { rotulo: "Ligado", tom: "ok" },
  parado: { rotulo: "Parado ligado", tom: "warn" },
  desligado: { rotulo: "Desligado", tom: "bad" },
  manut: { rotulo: "Manutenção", tom: "na" },
  semcom: { rotulo: "Sem comunicação", tom: "neu" },
  outro: { rotulo: "Outros", tom: "reg" },
};

/** Categoria pelo código de status do GAUSS (legenda do mapa). */
export function categoria(v: Pick<Veiculo, "status_cod">): CategoriaVeiculo {
  const c = v.status_cod;
  if (c === 1) return "ligado";
  if (c === 3) return "parado";
  if ([2, 4, 71, 98].includes(c)) return "desligado";
  if ([5, 9].includes(c)) return "manut";
  if (c === 7) return "semcom";
  return "outro";
}

/** Quão recente é a posição: nunca mostrar posição velha como se fosse ao vivo. */
export function frescor(v: Pick<Veiculo, "posicao_em">, semSinalMin = SEM_SINAL_MIN_PADRAO, agora = Date.now()): Frescor {
  const min = v.posicao_em ? minutosDesde(v.posicao_em, agora) : Infinity;
  if (min <= 5) return "vivo";
  if (min <= semSinalMin) return "atrasado";
  return "semsinal";
}
export const FRESCOR: Record<Frescor, { rotulo: string; tom: Tom }> = {
  vivo: { rotulo: "posição ao vivo", tom: "ok" },
  atrasado: { rotulo: "posição atrasada", tom: "warn" },
  semsinal: { rotulo: "sem sinal", tom: "neu" },
};

/** Situação de cada trecho do histórico (rota no mapa, apontamento, player). */
export const ESTADOS_TRECHO: Record<EstadoTrecho, { rotulo: string; tom: Tom; icone: string }> = {
  movimento: { rotulo: "Em deslocamento", tom: "mov", icone: "➜" },
  parado_ligado: { rotulo: "Parado ligado", tom: "warn", icone: "◐" },
  desligado: { rotulo: "Desligado", tom: "bad", icone: "■" },
  parado: { rotulo: "Parado", tom: "neu", icone: "■" },
  sem_sinal: { rotulo: "Sem sinal", tom: "reg", icone: "!" },
};

export const motor2Ligado = (v: Veiculo) => v.motor2?.status_cod === 1;
/** O motor secundário não é outro caminhão: sai das listas e vai em v.motor2. */
export const semMotor2 = (vs: Veiculo[]) => vs.filter((v) => !v.motor2_de);

export type Indicador = "ligado" | "parado" | "motor2" | "desligado" | "manut" | "semsinal";
export const INDICADORES: { id: Indicador; rotulo: string; curto: string; tom: Tom }[] = [
  { id: "ligado", rotulo: "Ligados", curto: "ligados", tom: "ok" },
  { id: "parado", rotulo: "Parados ligados", curto: "parados lig.", tom: "warn" },
  { id: "motor2", rotulo: "Motor 2º ligado", curto: "⚙ 2º ligado", tom: "motor2" },
  { id: "desligado", rotulo: "Desligados", curto: "desligados", tom: "bad" },
  { id: "manut", rotulo: "Manutenção", curto: "manutenção", tom: "na" },
  { id: "semsinal", rotulo: "Sem sinal", curto: "sem sinal", tom: "neu" },
];
export function noIndicador(id: Indicador, v: Veiculo, semSinalMin: number, agora = Date.now()): boolean {
  if (id === "motor2") return motor2Ligado(v);
  if (id === "semsinal") return frescor(v, semSinalMin, agora) === "semsinal";
  return categoria(v) === id;
}

export const FORA_DE_AREA = "__fora";
export const nomeArea = (a: string) => (!a || a === FORA_DE_AREA ? "Fora de área / em vias" : a);

export interface FiltroVeiculos {
  indicador: Indicador | null;
  busca: string;
  area: string | null;
}
export function filtrarVeiculos(vs: Veiculo[], f: FiltroVeiculos, semSinalMin: number, agora = Date.now()): Veiculo[] {
  const q = f.busca.trim().toUpperCase();
  return vs.filter(
    (v) =>
      (!f.indicador || noIndicador(f.indicador, v, semSinalMin, agora)) &&
      (!f.area || (f.area === FORA_DE_AREA ? !v.area : v.area === f.area)) &&
      (!q || [v.placa, v.motor2?.placa, v.vaga, v.grupo, v.area, v.via, v.motorista].join(" ").toUpperCase().includes(q)),
  );
}

/** Agrupa pela área atual: mais cheias primeiro; quem está em rua/sem área vai para o fim. */
export function agruparPorArea(vs: Veiculo[]): { area: string; veiculos: Veiculo[] }[] {
  const g = new Map<string, Veiculo[]>();
  for (const v of vs) g.set(v.area, [...(g.get(v.area) ?? []), v]);
  return [...g.entries()]
    .sort(([a, va], [b, vb]) => Number(!a) - Number(!b) || vb.length - va.length || a.localeCompare(b))
    .map(([area, lista]) => ({ area, veiculos: [...lista].sort((x, y) => x.placa.localeCompare(y.placa)) }));
}

/** Aba "Áreas": total por área e quantos de cada categoria. */
export function resumoAreas(vs: Veiculo[]): { area: string; total: number; porCategoria: [CategoriaVeiculo, number][] }[] {
  const g = new Map<string, Veiculo[]>();
  for (const v of vs) {
    const k = v.area || FORA_DE_AREA;
    g.set(k, [...(g.get(k) ?? []), v]);
  }
  return [...g.entries()]
    .sort(([a, va], [b, vb]) => Number(a === FORA_DE_AREA) - Number(b === FORA_DE_AREA) || vb.length - va.length)
    .map(([area, lista]) => {
      const conta = new Map<CategoriaVeiculo, number>();
      for (const v of lista) conta.set(categoria(v), (conta.get(categoria(v)) ?? 0) + 1);
      return { area, total: lista.length, porCategoria: [...conta.entries()] };
    });
}

/** Zoom inicial do mapa: a área com mais veículos com sinal (normalmente o pátio). */
export function areaInicial(vs: Veiculo[], poligonos: Record<string, LatLng[]>, semSinalMin: number, agora = Date.now()): string | null {
  const conta = new Map<string, number>();
  for (const v of vs) if (frescor(v, semSinalMin, agora) !== "semsinal" && poligonos[v.area]) conta.set(v.area, (conta.get(v.area) ?? 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Veículo de um link (?v=<id ou placa>): o motor secundário abre o caminhão principal. */
export function resolverVeiculo(todos: Veiculo[], chave: string): Veiculo | null {
  const sec = todos.find((x) => x.motor2_de && (x.id === chave || x.placa === chave));
  const alvo = sec?.motor2_de ?? chave;
  return todos.find((x) => !x.motor2_de && (x.id === alvo || x.placa === alvo)) ?? null;
}

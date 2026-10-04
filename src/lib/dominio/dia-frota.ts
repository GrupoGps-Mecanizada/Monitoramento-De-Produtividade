// "Dia da frota": uma faixa por equipamento ao longo do dia, montada só com os eventos que o coletor já grava
// (abertura do dia, status, entrada/saída de área, sinal) — nenhuma consulta ao GAUSS. Precisão = intervalo do
// coletor (~5 min). "Ligado" aqui é o status do GAUSS (inclui andando).
import type { Evento, TipoEquip, Veiculo } from "../tipos";
import { ORDEM_TIPOS, compararEquip, nomeEquip } from "./equipamentos";

export type EstadoFaixa = "ligado" | "desligado" | "manut" | "sem_sinal" | "sem_registro";
/** de/ate em minutos do dia (0–1440, horário local) */
export interface FaixaFrota {
  de: number;
  ate: number;
  estado: EstadoFaixa;
  status: string;
  area: string;
}
export interface LinhaFrota {
  id: string;
  nome: string;
  tipo: TipoEquip;
  vaga: string;
  faixas: FaixaFrota[];
  ligado_min: number;
  /** estado no fim da faixa quando o dia é hoje */
  agora: EstadoFaixa | null;
}
export interface GrupoFrota {
  tipo: TipoEquip;
  linhas: LinhaFrota[];
  ligado_min: number;
  agoraLigados: number;
  agoraDesligados: number;
  agoraSemSinal: number;
}
export type OrdemFrota = "tipo" | "mais" | "menos";

export function estadoDoStatus(status: string): EstadoFaixa {
  if (/^(ligado|parado ligado)$/i.test(status.trim())) return "ligado";
  if (/manuten/i.test(status)) return "manut";
  if (/sem comunica/i.test(status)) return "sem_sinal";
  return "desligado";
}

export const minutoDoDia = (iso: string, dia: string) => Math.min(1440, Math.max(0, (new Date(iso).getTime() - new Date(`${dia}T00:00:00`).getTime()) / 60000));

interface Situacao {
  status: string | null;
  semSinal: boolean;
  area: string;
}

/** Situação à meia-noite: abertura do dia, senão o "de" do 1º status, senão (hoje) o retrato; senão sem registro. */
function inicial(evs: Evento[], v: Veiculo, hoje: boolean): Situacao {
  const primeiro = evs.find((e) => e.tipo === "abertura" || e.tipo === "status");
  if (evs[0]?.tipo === "abertura") return { status: evs[0].status, semSinal: evs[0].sem_sinal, area: evs[0].area };
  const status = primeiro?.tipo === "abertura" ? primeiro.status : primeiro?.tipo === "status" ? primeiro.de : hoje ? v.status : null;
  const sinal = evs.find((e) => e.tipo === "sinal_perdido" || e.tipo === "sinal_retomado");
  const areaEv = evs.find((e) => e.tipo === "entrada" || e.tipo === "saida");
  const area = areaEv?.tipo === "saida" ? areaEv.area : areaEv?.tipo === "entrada" ? "" : primeiro?.tipo === "status" ? primeiro.area : hoje ? v.area : "";
  return { status, semSinal: sinal ? sinal.tipo === "sinal_retomado" : hoje && !evs.length ? v.sem_sinal : false, area };
}

function aplicar(s: Situacao, e: Evento): Situacao {
  switch (e.tipo) {
    case "abertura":
      return { status: e.status, semSinal: e.sem_sinal, area: e.area };
    case "status":
      return { ...s, status: e.para };
    case "entrada":
      return { ...s, area: e.area };
    case "saida":
      return { ...s, area: s.area === e.area ? "" : s.area };
    case "sinal_perdido":
      return { ...s, semSinal: true };
    case "sinal_retomado":
      return { ...s, semSinal: false };
  }
}

const estadoDe = (s: Situacao): EstadoFaixa => (s.status == null ? "sem_registro" : s.semSinal ? "sem_sinal" : estadoDoStatus(s.status));

function linhaFrota(v: Veiculo, evs: Evento[], dia: string, agora: number, hoje: boolean): LinhaFrota {
  const fim = hoje ? minutoDoDia(new Date(agora).toISOString(), dia) : 1440;
  let s = inicial(evs, v, hoje);
  let de = 0;
  const faixas: FaixaFrota[] = [];
  const fechar = (ate: number) => {
    const a = Math.min(ate, fim);
    if (a <= de) return;
    const estado = estadoDe(s);
    const ult = faixas.at(-1);
    if (ult && ult.estado === estado && ult.area === s.area && ult.status === (s.status ?? "")) ult.ate = a;
    else faixas.push({ de, ate: a, estado, status: s.status ?? "", area: s.area });
    de = a;
  };
  for (const e of evs) {
    fechar(minutoDoDia(e.t, dia));
    s = aplicar(s, e);
  }
  fechar(fim);
  const ligado_min = Math.round(faixas.filter((f) => f.estado === "ligado").reduce((n, f) => n + f.ate - f.de, 0));
  return { id: v.id, nome: nomeEquip(v), tipo: v.equip?.tipo ?? "ap", vaga: v.vaga, faixas, ligado_min, agora: hoje ? (faixas.at(-1)?.estado ?? estadoDe(s)) : null };
}

/** Uma linha por equipamento da frota (sem o motor 2º), na ordem da planilha. */
export function montarDiaFrota(eventos: Evento[], veiculos: Veiculo[], dia: string, agora: number, hoje: boolean): LinhaFrota[] {
  const porId = new Map<string, Evento[]>();
  for (const e of [...eventos].sort((a, b) => a.t.localeCompare(b.t))) {
    if (e.motor2) continue;
    const l = porId.get(e.id);
    if (l) l.push(e);
    else porId.set(e.id, [e]);
  }
  return veiculos
    .filter((v) => !v.motor2_de && v.equip)
    .sort(compararEquip)
    .map((v) => linhaFrota(v, porId.get(v.id) ?? [], dia, agora, hoje));
}

/** Grupos por tipo (só os que têm equipamento), com a contagem de agora e a ordem escolhida. */
export function agruparFrota(linhas: LinhaFrota[], ordem: OrdemFrota): GrupoFrota[] {
  return ORDEM_TIPOS.map((tipo) => {
    const ls = linhas.filter((l) => l.tipo === tipo);
    if (ordem !== "tipo") ls.sort((a, b) => (ordem === "mais" ? b.ligado_min - a.ligado_min : a.ligado_min - b.ligado_min));
    const agora = (e: EstadoFaixa) => ls.filter((l) => l.agora === e).length;
    return { tipo, linhas: ls, ligado_min: ls.reduce((n, l) => n + l.ligado_min, 0), agoraLigados: agora("ligado"), agoraDesligados: agora("desligado"), agoraSemSinal: agora("sem_sinal") };
  }).filter((g) => g.linhas.length);
}

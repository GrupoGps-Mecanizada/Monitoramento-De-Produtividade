// Alerta "Vaga sem caminhão" (dono, 11/11/2026): a vaga ficou sem caminhão apropriado no GAUSS por SEM_CAMINHAO_MIN
// ou mais DENTRO DA JORNADA do regime dela (24 h todo dia; ADM seg a sex 07:00-16:48; 16 h seg a sex 06:40-22:40;
// ADM e 16 h não trabalham feriado). Supervisor marcado = o da vaga na hora (supervisorDaVaga).
// Tudo puro: o coletor só lê a timeline do motor e grava as linhas.
// Só conta o "sem apropriação" que o GAUSS mostrou (status not_appropriated). Um trecho com caminhão no mesmo horário
// vence (a coleta às vezes deixa o "sem apropriação" velho por baixo do trecho novo).
import type { LinhaMotorFrota } from "../dia-frota";
import { FERIADOS, JORNADAS, regimeDoEquip, SEM_CAMINHAO_MIN } from "../regras-frota";
import { supervisorDaVaga } from "../supervisor-vaga";
import { vagaOficial } from "../vagas-oficiais";
import type { ConfigRegra } from "./config";
import type { HistoricoAlerta, Situacao } from "./contexto";
import type { LinhaAlerta } from "./montar";
import type { Destino } from "./nota";

const DIA = 86400;

export interface Lacuna {
  vaga: string;
  /** segundos do dia */
  ini: number;
  fim: number;
  /** a lacuna ainda está aberta na última leitura da vaga */
  aberta: boolean;
}

// "AAAA-MM-DD HH:MM:SS" (horário local do GAUSS) -> segundos desde 00:00 de `dia` (pode ser negativo ou > 1 dia)
const segDe = (ts: string, dia: string) =>
  Math.round((Date.parse(`${ts.slice(0, 10)}T00:00:00Z`) - Date.parse(`${dia}T00:00:00Z`)) / 1000) +
  (Number(ts.slice(11, 13)) * 3600 + Number(ts.slice(14, 16)) * 60 + Number(ts.slice(17, 19) || 0));

/** Junta intervalos [a, b) que se tocam. */
function unir(xs: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a, b] of [...xs].filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0])) {
    const u = out[out.length - 1];
    if (u && a <= u[1]) u[1] = Math.max(u[1], b);
    else out.push([a, b]);
  }
  return out;
}
/** xs menos ys (os dois já unidos). */
function menos(xs: [number, number][], ys: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const [a0, b] of xs) {
    let a = a0;
    for (const [c, d] of ys) {
      if (d <= a || c >= b) continue;
      if (c > a) out.push([a, c]);
      a = Math.max(a, d);
      if (a >= b) break;
    }
    if (a < b) out.push([a, b]);
  }
  return out;
}

/** Janela da jornada no dia, em segundos (null = a vaga não trabalha nesse dia). */
export function janelaDaJornada(vaga: string, dia: string): [number, number] | null {
  const j = JORNADAS[regimeDoEquip(null, vaga).regime];
  const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
  if (!j.dias.includes(semana) || (!j.feriado && FERIADOS.has(dia))) return null;
  return [j.ini * 60, j.fim * 60];
}

/** Lacunas de SEM_CAMINHAO_MIN ou mais, dentro da jornada, até `agoraSeg` (null = dia fechado). */
export function lacunasSemCaminhao(motor: LinhaMotorFrota[], dia: string, agoraSeg: number | null): Lacuna[] {
  const porVaga = new Map<string, LinhaMotorFrota[]>();
  for (const l of motor) {
    if (!l.vaga_nome || !vagaOficial(l.vaga_nome)) continue;
    const lista = porVaga.get(l.vaga_nome) ?? [];
    lista.push(l);
    porVaga.set(l.vaga_nome, lista);
  }
  const out: Lacuna[] = [];
  for (const [vaga, linhas] of porVaga) {
    const jan = janelaDaJornada(vaga, dia);
    if (!jan) continue;
    // até onde o GAUSS já foi lido nesta vaga (não inventa lacuna depois da última leitura)
    const lido = Math.max(...linhas.map((l) => segDe(l.fim, dia)));
    const fimJan = Math.min(jan[1], agoraSeg ?? DIA, lido);
    if (fimJan <= jan[0]) continue;
    const corta = (l: LinhaMotorFrota): [number, number] => [Math.max(segDe(l.inicio, dia), jan[0]), Math.min(segDe(l.fim, dia), fimJan)];
    const sem = unir(linhas.filter((l) => l.status === "not_appropriated").map(corta));
    const com = unir(linhas.filter((l) => l.status !== "not_appropriated").map(corta));
    for (const [a, b] of menos(sem, com))
      if (b - a >= SEM_CAMINHAO_MIN * 60) out.push({ vaga, ini: a, fim: b, aberta: b >= fimJan - 60 && fimJan === lido });
  }
  return out.sort((p, q) => p.ini - q.ini || p.vaga.localeCompare(q.vaga));
}

const hhmm = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
const duracao = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min` : `${Math.floor(s / 60)} min`);

export const chaveSemCaminhao = (vaga: string, dia: string, ref: number) => `sem_caminhao|vaga:${vaga}|${dia}|${ref}`;

/**
 * Lacunas -> linhas da tabela `alertas`. Destino "tela" enquanto o robô novo está em teste (o envio antigo só manda
 * "whatsapp" e não pode receber este alerta no formato velho). Resolvido pelo gestor ou silenciado não reabre.
 */
export function alertasSemCaminhao(x: {
  dia: string;
  agoraSeg: number | null;
  agoraIso: string;
  motor: LinhaMotorFrota[];
  historico: HistoricoAlerta[];
  regra: ConfigRegra;
  destino?: Destino;
}): LinhaAlerta[] {
  if (!x.regra.ativa) return [];
  const anteriores = new Map(x.historico.map((h) => [h.chave, h]));
  return lacunasSemCaminhao(x.motor, x.dia, x.agoraSeg).map((l) => {
    const chave = chaveSemCaminhao(l.vaga, x.dia, l.ini);
    const ant = anteriores.get(chave);
    let situacao: Situacao = l.aberta ? (ant?.situacao === "visto" ? "visto" : "aberto") : "resolvido";
    if (ant?.situacao === "silenciado" || (ant?.situacao === "resolvido" && ant.resolvido_por !== "auto")) situacao = ant.situacao;
    const jaResolvido = ant?.situacao === "resolvido" && situacao === "resolvido";
    return {
      chave,
      regra: "sem_caminhao",
      veiculo_id: `vaga:${l.vaga}`,
      placa: "",
      vaga: l.vaga,
      supervisor: supervisorDaVaga(l.vaga, x.dia, Math.min(l.fim, x.agoraSeg ?? l.fim)),
      dia: x.dia,
      ini: l.ini,
      fim: l.aberta ? null : l.fim,
      ref: l.ini,
      local: null,
      detalhe: l.aberta ? `sem caminhão desde ${hhmm(l.ini)} (${duracao(l.fim - l.ini)})` : `sem caminhão ${hhmm(l.ini)}–${hhmm(l.fim)} (${duracao(l.fim - l.ini)})`,
      situacao,
      nota: x.regra.peso,
      motivos: [{ texto: "Vaga sem caminhão na jornada", pontos: x.regra.peso }],
      contexto: { excessoMin: Math.max(0, (l.fim - l.ini) / 60 - SEM_CAMINHAO_MIN), repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false },
      destino: x.destino ?? "tela",
      contagem: (ant?.contagem ?? 0) + 1,
      resolvido_em: situacao !== "resolvido" ? null : jaResolvido ? (ant?.resolvido_em ?? x.agoraIso) : x.agoraIso,
      resolvido_por: situacao !== "resolvido" ? null : jaResolvido ? (ant?.resolvido_por ?? "auto") : "auto",
      atualizado_em: x.agoraIso,
    };
  });
}

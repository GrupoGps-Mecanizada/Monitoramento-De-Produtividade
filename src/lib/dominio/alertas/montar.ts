// Exceções do dia -> linhas da tabela `alertas` (tudo puro; o coletor só lê e grava).
// Sem duplicado: a chave usa o `ref` (estável) e o banco tem `chave unique`. Resolvido e silenciado não reabrem.
import type { Evento, Veiculo } from "../../tipos";
import type { Excecao, RegraExcecao } from "../excecoes";
import type { LinhaTablet } from "../gauss-dia";
import { regimeDoEquip } from "../regras-frota";
import { supervisorDaParada } from "../supervisor-vaga";
import { vagaOficial } from "../vagas-oficiais";
import type { ConfigRegra, Politica } from "./config";
import { familiasNoPeriodo, fracaoSemSinal, janelaDoAlerta, repeticoes, type HistoricoAlerta, type Situacao } from "./contexto";
import { destinoDaNota, excessoMin, notaDoAlerta, type ContextoNota, type Destino, type Motivo } from "./nota";

/** O coletor vê as áreas a cada 5-10 min: só dá como terminado o que acabou há mais que isso. */
export const FOLGA_FIM_S = 600;
/** Desligado e ociosidade vêm da timeline de motor, e o coletor pula a vaga parada por até 1 h (MAX_QUIETA_MS): o fim fica velho. */
export const FOLGA_MOTOR_S = 70 * 60;
const DO_MOTOR = new Set(["desligado", "ocioso"]);

export interface Silencio {
  veiculo_id: string | null;
  regra: string | null;
  /** ISO */
  ate: string;
}
export interface LinhaAlerta {
  chave: string;
  regra: string;
  veiculo_id: string;
  placa: string;
  vaga: string;
  supervisor: string | null;
  dia: string;
  ini: number;
  fim: number | null;
  ref: number;
  local: string | null;
  detalhe: string;
  situacao: Situacao;
  nota: number;
  motivos: Motivo[];
  /** o que entrou na nota: o simulador da tela recalcula com outra configuração */
  contexto: ContextoNota;
  destino: Destino;
  contagem: number;
  resolvido_em: string | null;
  resolvido_por: "auto" | "gestor" | null;
  atualizado_em: string;
}
export interface EntradaMontar {
  dia: string;
  /** segundos do dia agora (hoje); null = dia fechado */
  agoraSeg: number | null;
  agoraIso: string;
  excecoes: Excecao[];
  veiculos: Veiculo[];
  tablet: (LinhaTablet & { placa: string })[];
  eventos: Evento[];
  /** alertas dos últimos 7 dias (inclui os de hoje já gravados) */
  historico: HistoricoAlerta[];
  silencios: Silencio[];
  regras: Record<RegraExcecao, ConfigRegra>;
  politica: Politica;
}

export const chaveDoAlerta = (x: Excecao, dia: string) => `${x.regra}|${x.veiculo}|${dia}|${x.ref}`;

/**
 * Alerta já gravado do mesmo problema com o início ajustado: o ao vivo vê o desligado uns minutos depois do GAUSS, e a
 * timeline do GAUSS chega depois e pode dividir o trecho (ex.: uma parada apontada no meio). Mesmo caminhão, regra e
 * dia, com o horário gravado (início a fim) encostando no trecho novo (até FOLGA_FIM_S antes). Sem isso a chave mudaria e
 * o WhatsApp receberia o mesmo alerta duas vezes.
 */
function chaveJaGravada(e: Excecao, dia: string, historico: HistoricoAlerta[], usadas: Set<string>): string | null {
  if (!DO_MOTOR.has(e.regra)) return null;
  const fim = e.fim ?? e.ini;
  const h = historico.find(
    (h) => h.regra === e.regra && h.dia === dia && h.chave.split("|")[1] === e.veiculo && !usadas.has(h.chave) && h.ref <= fim && Math.max(h.ref, h.fim ?? h.ref) >= e.ini - FOLGA_FIM_S,
  );
  return h?.chave ?? null;
}

/** Silenciado e resolvido pelo gestor não reabrem; o resolvido automático reabre se o problema continua. */
export function situacaoNova(anterior: Situacao | null, resolvidoPor: HistoricoAlerta["resolvido_por"], terminou: boolean, silenciado: boolean): Situacao {
  if (anterior === "silenciado") return anterior;
  if (anterior === "resolvido" && resolvidoPor !== "auto") return anterior;
  if (silenciado) return "silenciado";
  if (terminou) return "resolvido";
  return anterior === "visto" ? "visto" : "aberto";
}

/** Instante (saída tarde, chegada cedo) só termina com o dia; o resto, quando o fim ficou para trás. */
const terminou = (x: Excecao, agoraSeg: number | null) => agoraSeg == null || (x.fim != null && x.fim < agoraSeg - (DO_MOTOR.has(x.regra) ? FOLGA_MOTOR_S : FOLGA_FIM_S));

export function montarAlertas(x: EntradaMontar): LinhaAlerta[] {
  const porId = new Map(x.veiculos.map((v) => [v.id, v]));
  const anteriores = new Map(x.historico.map((h) => [h.chave, h]));
  const silenciado = (e: Excecao) =>
    x.silencios.some((s) => s.ate > x.agoraIso && (s.veiculo_id == null || s.veiculo_id === e.veiculo) && (s.regra == null || s.regra === e.regra));
  const out: LinhaAlerta[] = [];
  // a chave exata já gravada é de quem a tem; o ajuste de início só pega as que sobram. Nunca duas linhas com a mesma
  // chave: o upsert recusaria o lote inteiro.
  const usadas = new Set(x.excecoes.map((e) => chaveDoAlerta(e, x.dia)).filter((c) => anteriores.has(c)));
  const emitidas = new Set<string>();
  for (const e of x.excecoes) {
    const cfg = x.regras[e.regra];
    const v = porId.get(e.veiculo);
    // a vaga em que o caminhão estava no trecho (regras do motor); nas outras, a de agora
    const vaga = e.vaga ?? v?.vaga ?? "";
    // só as 22 vagas que a Mecanizada opera (sem vaga ou Brook parado no Pátio não é alerta)
    if (!cfg?.ativa || !v?.equip || !vagaOficial(vaga)) continue;
    const propria = chaveDoAlerta(e, x.dia);
    const chave = anteriores.has(propria) ? propria : (chaveJaGravada(e, x.dia, x.historico, usadas) ?? propria);
    if (emitidas.has(chave)) continue;
    emitidas.add(chave);
    usadas.add(chave);
    const ant = anteriores.get(chave) ?? null;
    const j = janelaDoAlerta(e, x.agoraSeg);
    const contexto: ContextoNota = {
      excessoMin: excessoMin(e, x.agoraSeg),
      repeticoes: repeticoes(x.historico, e.regra, vaga, x.dia, chave, e.ref),
      familias: familiasNoPeriodo(x.tablet, v.placa, x.dia, j),
      fracaoSemSinal: fracaoSemSinal(x.eventos, v.id, x.dia, j),
      presumido: regimeDoEquip(v.equip.regime, vaga).presumido,
    };
    const { nota, motivos } = notaDoAlerta(cfg, contexto, x.politica);
    const situacao = situacaoNova(ant?.situacao ?? null, ant?.resolvido_por ?? null, terminou(e, x.agoraSeg), silenciado(e));
    const jaResolvido = ant?.situacao === "resolvido" && situacao === "resolvido";
    out.push({
      chave,
      regra: e.regra,
      veiculo_id: v.id,
      placa: v.placa,
      vaga,
      // o supervisor é da vaga em que o caminhão estava, não da placa
      supervisor: supervisorDaParada(v.equip.tipo, vaga || undefined, x.dia, e.ini, v.equip.supervisor ?? null),
      dia: x.dia,
      ini: e.ini,
      fim: e.fim,
      ref: e.ref,
      local: e.local,
      detalhe: e.detalhe,
      situacao,
      nota,
      motivos,
      contexto,
      destino: destinoDaNota(nota, x.politica),
      contagem: (ant?.contagem ?? 0) + 1,
      resolvido_em: situacao !== "resolvido" ? null : jaResolvido ? (ant?.resolvido_em ?? x.agoraIso) : x.agoraIso,
      resolvido_por: situacao !== "resolvido" ? null : jaResolvido ? (ant?.resolvido_por ?? "auto") : "auto",
      atualizado_em: x.agoraIso,
    });
  }
  return out;
}

// Exceções do dia -> linhas da tabela `alertas` (tudo puro; o coletor só lê e grava).
// Sem duplicado: a chave usa o `ref` (estável) e o banco tem `chave unique`. Resolvido e silenciado não reabrem.
import type { Evento, Veiculo } from "../../tipos";
import type { Excecao, RegraExcecao } from "../excecoes";
import type { LinhaTablet } from "../gauss-dia";
import { regimeDoEquip } from "../regras-frota";
import { supervisorDaParada } from "../supervisor-vaga";
import type { ConfigRegra, Politica } from "./config";
import { familiasNoPeriodo, fracaoSemSinal, janelaDoAlerta, repeticoes, type HistoricoAlerta, type Situacao } from "./contexto";
import { destinoDaNota, excessoMin, notaDoAlerta, type Destino, type Motivo } from "./nota";

/** O coletor vê o motor a cada 10 min: só dá como terminado o que acabou há mais que isso. */
export const FOLGA_FIM_S = 600;

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
  destino: Destino;
  contagem: number;
  resolvido_em: string | null;
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

export function situacaoNova(anterior: Situacao | null, terminou: boolean, silenciado: boolean): Situacao {
  if (anterior === "resolvido" || anterior === "silenciado") return anterior;
  if (silenciado) return "silenciado";
  if (terminou) return "resolvido";
  return anterior === "visto" ? "visto" : "aberto";
}

/** Instante (saída tarde, chegada cedo) só termina com o dia; o resto, quando o fim ficou para trás. */
const terminou = (x: Excecao, agoraSeg: number | null) => agoraSeg == null || (x.fim != null && x.fim < agoraSeg - FOLGA_FIM_S);

export function montarAlertas(x: EntradaMontar): LinhaAlerta[] {
  const porId = new Map(x.veiculos.map((v) => [v.id, v]));
  const anteriores = new Map(x.historico.map((h) => [h.chave, h]));
  const silenciado = (e: Excecao) =>
    x.silencios.some((s) => s.ate > x.agoraIso && (s.veiculo_id == null || s.veiculo_id === e.veiculo) && (s.regra == null || s.regra === e.regra));
  const out: LinhaAlerta[] = [];
  for (const e of x.excecoes) {
    const cfg = x.regras[e.regra];
    const v = porId.get(e.veiculo);
    if (!cfg?.ativa || !v?.equip) continue;
    const chave = chaveDoAlerta(e, x.dia);
    const ant = anteriores.get(chave) ?? null;
    const j = janelaDoAlerta(e);
    const { nota, motivos } = notaDoAlerta(cfg, {
      excessoMin: excessoMin(e, x.agoraSeg),
      repeticoes: repeticoes(x.historico, e.regra, v.vaga, x.dia, chave),
      familias: familiasNoPeriodo(x.tablet, v.placa, x.dia, j),
      fracaoSemSinal: fracaoSemSinal(x.eventos, v.id, x.dia, j),
      presumido: regimeDoEquip(v.equip.regime, v.vaga).presumido,
    });
    const situacao = situacaoNova(ant?.situacao ?? null, terminou(e, x.agoraSeg), silenciado(e));
    out.push({
      chave,
      regra: e.regra,
      veiculo_id: v.id,
      placa: v.placa,
      vaga: v.vaga,
      // o supervisor é da vaga em que o caminhão estava, não da placa
      supervisor: supervisorDaParada(v.equip.tipo, v.vaga || undefined, x.dia, e.ini, v.equip.supervisor ?? null),
      dia: x.dia,
      ini: e.ini,
      fim: e.fim,
      ref: e.ref,
      local: e.local,
      detalhe: e.detalhe,
      situacao,
      nota,
      motivos,
      destino: destinoDaNota(nota, x.politica),
      contagem: (ant?.contagem ?? 0) + 1,
      resolvido_em: ant?.resolvido_em ?? (situacao === "resolvido" ? x.agoraIso : null),
      atualizado_em: x.agoraIso,
    });
  }
  return out;
}

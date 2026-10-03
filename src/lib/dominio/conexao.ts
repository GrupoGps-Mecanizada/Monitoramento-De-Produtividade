import type { Retrato, Tom } from "../tipos";
import { hora, horaSeg } from "./formato";

export interface SituacaoLeitura {
  tom: Tom;
  texto: string;
  /** versão curta para o celular ("12:05") */
  curto: string;
  /** carga gerada no GAUSS (dica do indicador) */
  detalhe: string;
}

/** Indicador "ao vivo" da barra: a leitura mais recente do coletor está em dia? */
export function situacaoLeitura(r: Retrato | null, conectado: boolean, agora = Date.now()): SituacaoLeitura {
  const g = r?.gauss;
  const detalhe = g ? `Requisições ao GAUSS desde ${new Date(g.desde).toLocaleString("pt-BR")}: ${g.requisicoes} (${g.logins} login(s), ${g.erros} erro(s))` : "";
  if (!conectado) return { tom: "warn", texto: "reconectando…", curto: "…", detalhe };
  if (!r?.lido_em) return { tom: "neu", texto: "aguardando 1ª leitura…", curto: "—", detalhe };
  // o disparo não é pontual: só acusa atraso depois de 3 ciclos sem leitura
  const atrasado = agora - new Date(r.lido_em).getTime() > r.intervalo_s * 3 * 1000;
  const cada = r.intervalo_s >= 60 ? `${r.intervalo_s / 60} min` : `${r.intervalo_s}s`;
  return { tom: r.erro ? "bad" : atrasado ? "warn" : "ok", texto: `atualizado ${horaSeg(r.lido_em)} · a cada ${cada}`, curto: hora(r.lido_em), detalhe };
}

/** Faixa de aviso: falha ao consultar o GAUSS ou acesso pausado pela proteção do coletor. */
export function avisoLeitura(r: Retrato | null, agora = Date.now()): string | null {
  if (r?.erro) return `Falha ao consultar o GAUSS às ${hora(r.erro.em)}: ${r.erro.msg}. Mostrando a última leitura${r.lido_em ? ` (${horaSeg(r.lido_em)})` : ""}.`;
  const p = r?.gauss?.pausadoAte;
  if (p && new Date(p).getTime() > agora) return `Acesso ao GAUSS pausado até ${hora(p)} após falhas seguidas (proteção para não insistir).`;
  return null;
}

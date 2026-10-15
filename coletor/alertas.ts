// Detector de alertas (P-026): a cada 10 min, as Exceções do dia viram linhas em `alertas`, com nota e destino.
// Só lê e grava no Supabase (nada no GAUSS). Regras puras em src/lib/dominio/alertas/.
// Desenho: docs/superpowers/specs/2026-10-15-alertas-whatsapp-design.md
import type { Evento, Veiculo } from "../src/lib/tipos";
import { configCompleta, politicaCompleta, type ConfigRegra, type Politica } from "../src/lib/dominio/alertas/config";
import type { HistoricoAlerta } from "../src/lib/dominio/alertas/contexto";
import { montarAlertas, type LinhaAlerta, type Silencio } from "../src/lib/dominio/alertas/montar";
import { diaMenos } from "../src/lib/dominio/analise";
import type { LinhaMotorFrota } from "../src/lib/dominio/dia-frota";
import { excecoesDoDia } from "../src/lib/dominio/excecoes";
import { diaLocal } from "../src/lib/dominio/formato";
import type { LinhaTablet } from "../src/lib/dominio/gauss-dia";
import { db, kvGet, kvSet, ok } from "./supabase";

export const INTERVALO_ALERTAS_MS = 10 * 60 * 1000;
const PAGINA = 1000;
const MAX_LINHAS = 20000;

export interface DepsAlertas {
  ultimaExecucao(): Promise<string | null>;
  marcarExecucao(iso: string): Promise<void>;
  lerEntrada(vespera: string, dia: string): Promise<{ eventos: Evento[]; motor: LinhaMotorFrota[]; tablet: (LinhaTablet & { placa: string })[] }>;
  lerConfig(): Promise<{ regras: Partial<ConfigRegra>[]; politica: Partial<Politica> | null }>;
  lerHistorico(desde: string): Promise<HistoricoAlerta[]>;
  lerSilencios(): Promise<Silencio[]>;
  gravar(linhas: LinhaAlerta[]): Promise<void>;
  /** aberto/visto de dias anteriores vira resolvido; apaga alertas e envios com mais de 90 dias */
  fecharDiasAnteriores(hoje: string): Promise<void>;
}

export const deveRodar = (ultima: string | null, agora: Date) => ultima == null || agora.getTime() - Date.parse(ultima) >= INTERVALO_ALERTAS_MS;

export async function detectarAlertas(deps: DepsAlertas, veiculos: Veiculo[], agora: Date): Promise<string | null> {
  if (!deveRodar(await deps.ultimaExecucao(), agora)) return null;
  const dia = diaLocal(agora);
  const vespera = diaMenos(dia, 1);
  const [cfg, entrada, historico, silencios] = await Promise.all([deps.lerConfig(), deps.lerEntrada(vespera, dia), deps.lerHistorico(diaMenos(dia, 7)), deps.lerSilencios()]);
  const agoraSeg = Math.floor((agora.getTime() - Date.parse(`${dia}T00:00:00-03:00`)) / 1000);
  const excecoes = excecoesDoDia({ dia, agoraSeg, veiculos, ...entrada });
  const politica = politicaCompleta(cfg.politica);
  const linhas = montarAlertas({ dia, agoraSeg, agoraIso: agora.toISOString(), excecoes, veiculos, ...entrada, historico, silencios, regras: configCompleta(cfg.regras), politica });
  if (linhas.length) await deps.gravar(linhas);
  await deps.fecharDiasAnteriores(dia);
  // marca só no fim: se algo falhou, o próximo ciclo tenta de novo
  await deps.marcarExecucao(agora.toISOString());
  const conhecidas = new Set(historico.map((h) => h.chave));
  const novosWhats = linhas.filter((l) => !conhecidas.has(l.chave) && l.destino === "whatsapp").length;
  return `${linhas.length} alerta(s), ${novosWhats} novo(s) para WhatsApp`;
}

async function paginar<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(consulta(de, de + PAGINA - 1))) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

export function depsAlertasReais(): DepsAlertas {
  return {
    ultimaExecucao: async () => (await kvGet<{ em: string }>("alertas"))?.em ?? null,
    marcarExecucao: async (em) => void (await kvSet("alertas", { em })),
    async lerEntrada(vespera, dia) {
      const ate = diaMenos(dia, -1);
      const [ev, motor, tablet] = await Promise.all([
        // id desempata eventos do mesmo instante: as páginas não repetem nem pulam linhas
        paginar<{ dados: Evento }>((de, a) => db().from("loc_eventos").select("dados").in("dia", [vespera, dia]).order("t").order("id").range(de, a)),
        paginar<LinhaMotorFrota>((de, a) => db().from("timeline_motor_vaga").select("placa_ou_codigo, inicio, fim, status, status_label").lt("inicio", ate).gt("fim", vespera).order("id").range(de, a)),
        paginar<LinhaTablet & { placa: string }>((de, a) =>
          db().from("demoras_categorizadas").select("placa, demora_cod, inicio, fim, categoria_demora, motorista, concluido").lt("inicio", ate).or(`fim.is.null,fim.gt.${vespera}`).order("inicio").order("demora_cod").range(de, a),
        ),
      ]);
      return { eventos: ev.map((l) => l.dados), motor, tablet };
    },
    async lerConfig() {
      const [regras, politica] = await Promise.all([
        ok(db().from("alerta_regra").select("regra, ativa, peso, faixas, justificativas, espera_min, lembrete_min, escalar_min")),
        ok(db().from("alerta_politica").select("corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora").eq("id", 1).maybeSingle()),
      ]);
      return { regras: (regras ?? []) as Partial<ConfigRegra>[], politica: politica as Partial<Politica> | null };
    },
    lerHistorico: (desde) => paginar<HistoricoAlerta>((de, a) => db().from("alertas").select("chave, regra, vaga, dia, ref, situacao, resolvido_em, resolvido_por, contagem").gte("dia", desde).order("id").range(de, a)),
    lerSilencios: async () => ((await ok(db().from("alerta_silencio").select("veiculo_id, regra, ate").gt("ate", new Date().toISOString()))) ?? []) as Silencio[],
    async gravar(linhas) {
      // on conflict (chave): só atualiza; detectado_em, visto_* e avaliacao (não enviados) ficam como estão
      for (let i = 0; i < linhas.length; i += 500) await ok(db().from("alertas").upsert(linhas.slice(i, i + 500), { onConflict: "chave" }));
    },
    async fecharDiasAnteriores(hoje) {
      await ok(db().from("alertas").update({ situacao: "resolvido", resolvido_em: new Date().toISOString(), resolvido_por: "auto" }).lt("dia", hoje).in("situacao", ["aberto", "visto"]));
      await ok(db().from("alertas").delete().lt("dia", diaMenos(hoje, 90)));
      await ok(db().from("alerta_envios").delete().lt("criado_em", new Date(Date.now() - 90 * 86400000).toISOString()));
    },
  };
}

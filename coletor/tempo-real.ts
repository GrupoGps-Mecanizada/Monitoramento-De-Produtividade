// Puxador em tempo real (desenho: docs/superpowers/specs/2026-10-08-puxador-tempo-real-design.md):
//   - cada ciclo: posição de cada equipamento da frota em loc_posicoes (a leitura que o coletor já faz; nada a mais no GAUSS)
//   - a cada 10 min: paradas de hoje (fonte "ao_vivo") em analise_paradas
//   - madrugada: rota completa de ontem → paradas exatas (fonte "rota"), excessos de velocidade e R2
// Falha aqui nunca derruba o ciclo: o run.ts chama cada parte num try/catch.
import { contornoDaUsina } from "../src/lib/dominio/analise";
import { diaLocal } from "../src/lib/dominio/formato";
import { formasDaPlaca, type LinhaMotorGauss } from "../src/lib/dominio/gauss-dia";
import { enriquecerParadas, excessosDaRota, paradasDaRota, paradasDasPosicoes, type ContextoDia } from "../src/lib/dominio/paradas";
import type { Cerca, Veiculo } from "../src/lib/tipos";
import type { GaussFleetClient } from "./gauss";
import { baixarRota } from "./historico";
import { escolherNoturno, type ControleNoturno } from "./noturno";
import { guardarRota } from "./r2";
import { db, kvGet, kvSet, ok } from "./supabase";

const PAGINA = 1000;
const MAX_LINHAS = 30000;
const LOTE = 500;
const AO_VIVO_MS = 10 * 60 * 1000;
const DIA = 86400;

const daFrota = (frota: Veiculo[]) => frota.filter((v) => !v.motor2_de && v.equip);
const diaSeguinte = (dia: string) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
/** segundos do dia (Brasília, sem horário de verão desde 2019) */
const segDoDia = (iso: string, dia: string) => (Date.parse(iso) - Date.parse(`${dia}T00:00:00-03:00`)) / 1000;

async function paginado<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(consulta(de, de + PAGINA - 1))) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

async function emLotes<T>(linhas: T[], gravar: (lote: T[]) => PromiseLike<{ error: { message: string } | null }>) {
  for (let i = 0; i < linhas.length; i += LOTE) await ok(gravar(linhas.slice(i, i + LOTE)) as PromiseLike<{ data: unknown; error: { message: string } | null }>);
}

let prontas: boolean | null = null;
/**
 * As tabelas do supabase/tempo-real.sql existem? Sem elas nada roda (nem consulta ao GAUSS nem apaga paradas):
 * publicar o coletor antes do SQL não pode perder as paradas que já estão no banco.
 */
async function tabelasProntas(): Promise<boolean> {
  if (prontas != null) return prontas;
  // conferidas uma vez, fica anotado no loc_kv: não testa as 3 tabelas a cada 5 min
  if ((await kvGet<boolean>("tempo_real_pronto")) === true) return (prontas = true);
  try {
    await ok(db().from("analise_paradas").select("fonte").limit(1));
    await ok(db().from("analise_excessos").select("id").limit(1));
    await ok(db().from("loc_posicoes").select("veiculo_id").limit(1));
    prontas = true;
    await kvSet("tempo_real_pronto", true);
  } catch {
    console.warn("⚠ tempo real desligado: rode supabase/tempo-real.sql no Supabase");
    prontas = false;
  }
  return prontas;
}

/** Cada ciclo: a posição de cada equipamento da frota (o motor 2º não entra). */
export async function gravarPosicoes(frota: Veiculo[], agora: Date): Promise<number> {
  if (!(await tabelasProntas())) return 0;
  const t = agora.toISOString();
  const dia = diaLocal(agora);
  const linhas = daFrota(frota)
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({ veiculo_id: v.id, t, dia, lat: v.lat as number, lng: v.lng as number }));
  if (linhas.length) await ok(db().from("loc_posicoes").upsert(linhas, { onConflict: "veiculo_id,t", ignoreDuplicates: true }));
  return linhas.length;
}

/** Motor (por id do veículo) e tablet (pelas formas da placa) de um dia, só do Supabase. */
async function lerContexto(dia: string) {
  const ate = diaSeguinte(dia);
  const motor = await paginado<LinhaMotorGauss & { placa_ou_codigo: string }>((de, a) =>
    db().from("timeline_motor_vaga").select("placa_ou_codigo, inicio, fim, status, status_label, gravado:updated_at").lt("inicio", ate).gt("fim", dia).order("id").range(de, a),
  );
  const tablet = await paginado<{ placa: string; inicio: string; fim: string | null; categoria_demora: string }>((de, a) =>
    db().from("demoras_categorizadas").select("placa, inicio, fim, categoria_demora").lt("inicio", ate).or(`fim.is.null,fim.gt.${dia}`).order("inicio").order("demora_cod").range(de, a),
  );
  return {
    motorDe: (id: string) => motor.filter((l) => l.placa_ou_codigo === id),
    tabletDe: (placa: string) => {
      const formas = new Set(formasDaPlaca(placa));
      return tablet.filter((t) => formas.has(t.placa));
    },
  };
}

/** A cada 10 min: as paradas de hoje de toda a frota, pelas posições de cada ciclo (fonte "ao_vivo"). */
export async function paradasAoVivo(frota: Veiculo[], cercas: Cerca[], agora: Date): Promise<number | null> {
  if (!(await tabelasProntas())) return null;
  const controle = await kvGet<{ em: string }>("paradas_ao_vivo");
  if (controle && agora.getTime() - Date.parse(controle.em) < AO_VIVO_MS) return null;
  const dia = diaLocal(agora);
  const posicoes = await paginado<{ veiculo_id: string; t: string; lat: number; lng: number }>((de, a) =>
    db().from("loc_posicoes").select("veiculo_id, t, lat, lng").eq("dia", dia).order("veiculo_id").order("t").range(de, a),
  );
  const ctx = await lerContexto(dia);
  const areas = cercas.filter((c) => c.tipo === "area");
  const fimDia = Math.min(DIA, segDoDia(agora.toISOString(), dia));
  const linhas = daFrota(frota).flatMap((v) => {
    const minhas = posicoes.filter((p) => p.veiculo_id === v.id).map((p) => ({ t: segDoDia(p.t, dia), lat: p.lat, lng: p.lng }));
    const base: Omit<ContextoDia, "areas"> = { dia, motor: ctx.motorDe(v.id), tablet: ctx.tabletDe(v.placa), fimDia };
    return enriquecerParadas(paradasDasPosicoes(minhas), v, { ...base, areas }).map((p) => ({ ...p, fonte: "ao_vivo" }));
  });
  await ok(db().from("analise_paradas").delete().eq("dia", dia).eq("fonte", "ao_vivo"));
  await emLotes(linhas, (lote) => db().from("analise_paradas").insert(lote));
  await kvSet("paradas_ao_vivo", { em: agora.toISOString() });
  return linhas.length;
}

/**
 * Refaz as paradas já gravadas de um dia com o motor e o tablet corrigidos (reprocessamento de 15/10/2026). Onde e
 * quando parou vem da rota do próprio caminhão e não muda; só o status do motor e os apontamentos de cada parada são
 * recalculados. Nenhuma consulta ao GAUSS.
 */
export async function refazerParadasDoDia(frota: Veiculo[], cercas: Cerca[], dia: string): Promise<number> {
  if (!(await tabelasProntas())) return 0;
  type Gravada = { veiculo_id: string; placa: string; ini: number; fim: number; lat: number; lng: number; area: string | null; fonte: string };
  const gravadas = await paginado<Gravada>((de, a) =>
    db().from("analise_paradas").select("veiculo_id, placa, ini, fim, lat, lng, area, fonte").eq("dia", dia).order("veiculo_id").order("ini").range(de, a),
  );
  if (!gravadas.length) return 0;
  const ctx = await lerContexto(dia);
  const areas = cercas.filter((c) => c.tipo === "area");
  const placaDe = new Map(frota.map((v) => [v.id, v.placa]));
  const porVeiculo = new Map<string, Gravada[]>();
  for (const g of gravadas) porVeiculo.set(g.veiculo_id, [...(porVeiculo.get(g.veiculo_id) ?? []), g]);
  // tudo montado antes de apagar: um erro aqui não deixa o dia vazio
  const linhas = [...porVeiculo].flatMap(([id, gs]) => {
    const placa = placaDe.get(id) ?? gs[0].placa;
    const novas = enriquecerParadas(gs, { id, placa }, { dia, areas, motor: ctx.motorDe(id), tablet: ctx.tabletDe(placa), fimDia: DIA });
    // a área e a fonte ficam as de antes (a cerca pode ter mudado desde aquele dia)
    return novas.map((p, i) => ({ ...p, placa: gs[i].placa, area: gs[i].area, fonte: gs[i].fonte }));
  });
  await ok(db().from("analise_paradas").delete().eq("dia", dia));
  await emLotes(linhas, (lote) => db().from("analise_paradas").insert(lote));
  return linhas.length;
}

/** Madrugada: rota completa de ontem de até 6 equipamentos por ciclo → paradas exatas, excessos e R2. */
export async function rotinaNoturna(client: GaussFleetClient, frota: Veiculo[], cercas: Cerca[], agora: Date): Promise<string | null> {
  if (!(await tabelasProntas())) return null;
  const controle = await kvGet<ControleNoturno>("noturno");
  const equip = daFrota(frota);
  const vez = escolherNoturno(controle, equip.map((v) => v.id), agora);
  if (!vez) return null;
  const { dia } = vez;
  const feitos = controle?.dia === dia ? [...controle.feitos] : [];
  const tentativas = controle?.dia === dia ? { ...(controle.tentativas ?? {}) } : {};
  const ctx = await lerContexto(dia);
  const areas = cercas.filter((c) => c.tipo === "area");
  const usina = contornoDaUsina(cercas);
  let paradas = 0;
  let excessos = 0;
  let r2 = 0;
  for (const id of vez.ids) {
    const v = equip.find((x) => x.id === id)!;
    try {
      const info = { completa: false };
      const pontos = await baixarRota(client, id, dia, "00:00", info);
      // rota pela metade (erro do GAUSS numa página): não substitui nada; tenta de novo (até MAX_TENTATIVAS)
      if (!info.completa) throw new Error("rota pela metade");
      // sem pontos (desligado o dia todo): mantém as paradas ao vivo
      if (pontos.length) {
        // tudo montado antes de apagar: um erro aqui não deixa o dia vazio
        const linhas = enriquecerParadas(paradasDaRota(pontos), v, { dia, areas, motor: ctx.motorDe(id), tablet: ctx.tabletDe(v.placa), fimDia: DIA }).map((p) => ({ ...p, fonte: "rota" }));
        const ex = excessosDaRota(pontos, usina).map((e) => ({ ...e, dia, veiculo_id: id }));
        await ok(db().from("analise_paradas").delete().eq("dia", dia).eq("veiculo_id", id));
        await emLotes(linhas, (lote) => db().from("analise_paradas").insert(lote));
        await ok(db().from("analise_excessos").delete().eq("dia", dia).eq("veiculo_id", id));
        if (ex.length) await ok(db().from("analise_excessos").insert(ex));
        paradas += linhas.length;
        excessos += ex.length;
        try {
          if (await guardarRota(dia, id, pontos)) r2++;
        } catch (e) {
          console.warn(`⚠ R2 ${v.placa}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      feitos.push(id);
      await kvSet("noturno", { dia, feitos, tentativas });
    } catch (e) {
      tentativas[id] = (tentativas[id] ?? 0) + 1;
      await kvSet("noturno", { dia, feitos, tentativas });
      console.warn(`⚠ madrugada ${v.placa} (tentativa ${tentativas[id]}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return `${dia}: ${feitos.length}/${equip.length} equipamentos, ${paradas} paradas, ${excessos} excessos${r2 ? `, ${r2} rotas no R2` : ""}`;
}

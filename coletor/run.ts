// Uma execução do coletor (GitHub Actions, disparada pelo Supabase a cada 5 min e a cada pedido de histórico):
//   1. posição da frota no GAUSS (UMA requisição para todos os veículos)
//   2. estado + eventos -> Supabase; retrato (snapshot) para a página
//   3. atende os pedidos de histórico que a página deixou em loc_pedidos
//
// Cuidado com a carga no GAUSS (ver gauss.ts): uma requisição por vez com intervalo, sessão reaproveitada
// entre execuções (guardada no Supabase, chave privada), cadastro e cercas em cache, histórico só quando
// alguém pede, dia encerrado baixado uma única vez, no máximo MAX_PEDIDOS por execução.
//
// Variáveis: GAUSSFLEET_USERNAME, GAUSSFLEET_PASSWORD, SUPABASE_URL, SUPABASE_SECRET_KEY e
// TZ=America/Sao_Paulo (o GAUSS fala em horário local).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { montarApontamento } from "../src/lib/dominio/apontamento";
import { tipoCerca } from "../src/lib/dominio/cercas";
import { diaLocal } from "../src/lib/dominio/formato";
import { parearMotores } from "../src/lib/dominio/frota";
import { montarSnapshot, processarLeitura } from "../src/lib/dominio/leitura";
import type { Cerca, EstadoVeiculo, FonteHistorico, PontoRota } from "../src/lib/tipos";
import { verificarAmbiente } from "./config";
import { GaussFleetClient, SESSAO_FILE, estatisticas } from "./gauss";
import { HOJE_TTL_MS, baixarRota, diaFechado, mesclarPontos } from "./historico";
import { buscarCercas, buscarPosicoes, listarVeiculos, type VeiculoCadastro } from "./location-online";
import { db, kvGet, kvSet, ok } from "./supabase";

const VEICULOS_TTL_MS = 24 * 60 * 60 * 1000;
const CERCAS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PEDIDOS = 4;
const INTERVALO_S = 300; // o ritmo do disparo; a página usa para dizer se o dado está atrasado

type Estado = Record<string, EstadoVeiculo>;
interface Pedido {
  id: number;
  veiculo_id: string;
  dia: string;
}
interface PontosDia {
  pontos: PontoRota[];
  fechado: boolean;
  baixado_em: string;
  fonte: FonteHistorico;
}

verificarAmbiente();

// sessão do GAUSS da execução anterior (o gauss.ts só reaproveita se usada há < 20 min)
const sessao = await kvGet<unknown>("sessao");
if (sessao) writeFileSync(SESSAO_FILE, JSON.stringify(sessao), "utf-8");
const client = new GaussFleetClient();

async function carregarVeiculos(): Promise<VeiculoCadastro[]> {
  const cache = await kvGet<{ baixado_em: string; veiculos: VeiculoCadastro[] }>("veiculos");
  if (cache && Date.now() - new Date(cache.baixado_em).getTime() < VEICULOS_TTL_MS) return cache.veiculos;
  const veiculos = await listarVeiculos(client);
  if (!veiculos.length) throw new Error("lista de veículos do GAUSS veio vazia");
  await kvSet("veiculos", { baixado_em: new Date().toISOString(), veiculos });
  return veiculos;
}

async function carregarCercas(veiculos: VeiculoCadastro[]): Promise<Cerca[]> {
  const cache = await kvGet<{ baixado_em: string; cercas: Cerca[] }>("cercas");
  if (cache && Date.now() - new Date(cache.baixado_em).getTime() < CERCAS_TTL_MS) return cache.cercas;
  const cercas = (await buscarCercas(client, veiculos.map((v) => v.id))).map((c) => ({ ...c, tipo: tipoCerca(c) }));
  await kvSet("cercas", { baixado_em: new Date().toISOString(), cercas });
  return cercas;
}

/** Pontos da rota no dia: do cache (loc_historico) quando dá, senão só a parte nova do GAUSS. */
async function obterPontos(id: string, dia: string): Promise<PontosDia> {
  const reg = (await ok(db().from("loc_historico").select("pontos, fechado, baixado_em").eq("veiculo_id", id).eq("dia", dia).maybeSingle())) as Omit<PontosDia, "fonte"> | null;
  if (reg?.fechado) return { ...reg, fonte: "cache" };
  if (reg && Date.now() - new Date(reg.baixado_em).getTime() < HOJE_TTL_MS) return { ...reg, fonte: "cache" };
  const anteriores = reg?.pontos ?? [];
  const horaInicio = anteriores.length ? anteriores.at(-1)!.t.slice(11, 16) : "00:00";
  const novos = await baixarRota(client, id, dia, horaInicio);
  return { pontos: mesclarPontos(anteriores, novos), fechado: diaFechado(dia), baixado_em: new Date().toISOString(), fonte: anteriores.length ? "incremental" : "gauss" };
}

async function atenderPedido(ped: Pedido, estado: Estado, cercas: Cerca[]) {
  const { veiculo_id: id, dia } = ped;
  // caminhão com motor secundário (placa + "2"): busca também o rastreador dele
  const secId = parearMotores(Object.values(estado)).secundarioDe.get(id);
  const pri = await obterPontos(id, dia);
  let sec: PontosDia | null = null;
  let motor2Erro: string | null = null;
  if (secId) {
    try {
      sec = await obterPontos(secId, dia);
    } catch (err) {
      motor2Erro = err instanceof Error ? err.message : String(err);
    }
  }
  const apont = montarApontamento(pri.pontos, cercas, sec?.pontos ?? null);
  if (apont.motor2 && secId) Object.assign(apont.motor2, { id: secId, placa: estado[secId]?.placa });
  const resultado = { id, dia, fonte: pri.fonte, baixado_em: pri.baixado_em, motor2_erro: motor2Erro, ...apont };
  await ok(db().from("loc_historico").upsert({ veiculo_id: id, dia, pontos: pri.pontos, fechado: pri.fechado, baixado_em: pri.baixado_em, resultado }));
  if (sec && secId) {
    // sem "resultado" no objeto: o upsert não apaga um apontamento que o secundário já tenha
    await ok(db().from("loc_historico").upsert({ veiculo_id: secId, dia, pontos: sec.pontos, fechado: sec.fechado, baixado_em: sec.baixado_em }));
  }
}

async function atenderPedidos(estado: Estado, cercas: Cerca[], veiculos: VeiculoCadastro[]): Promise<number> {
  // pedido que ficou "processando" porque uma execução morreu no meio volta para a fila
  await ok(db().from("loc_pedidos").update({ status: "pendente" }).eq("status", "processando").lt("criado_em", new Date(Date.now() - 15 * 60000).toISOString()));
  const fila = ((await ok(db().from("loc_pedidos").select("id, veiculo_id, dia").eq("status", "pendente").order("criado_em").limit(MAX_PEDIDOS))) ?? []) as Pedido[];
  const conhecidos = new Set(veiculos.map((v) => String(v.id)));
  for (const ped of fila) {
    await ok(db().from("loc_pedidos").update({ status: "processando" }).eq("id", ped.id));
    try {
      // a página é pública: só consulta no GAUSS veículo que está no cadastro
      if (!conhecidos.has(ped.veiculo_id)) throw new Error("veículo fora do cadastro");
      await atenderPedido(ped, estado, cercas);
      await ok(db().from("loc_pedidos").update({ status: "pronto", atendido_em: new Date().toISOString() }).eq("id", ped.id));
      console.log(`  histórico ${ped.veiculo_id} ${ped.dia}: pronto`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await ok(db().from("loc_pedidos").update({ status: "erro", erro: msg.slice(0, 300), atendido_em: new Date().toISOString() }).eq("id", ped.id));
      console.error(`  histórico ${ped.veiculo_id} ${ped.dia}: ${msg}`);
    }
  }
  return fila.length;
}

async function limpezaDiaria(hoje: string) {
  const ultima = await kvGet<{ dia: string }>("limpeza");
  if (ultima?.dia === hoje) return;
  const antes = (dias: number) => diaLocal(new Date(Date.now() - dias * 86400000));
  await ok(db().from("loc_eventos").delete().lt("dia", antes(365)));
  await ok(db().from("loc_historico").delete().lt("dia", antes(120)));
  await ok(db().from("loc_pedidos").delete().lt("criado_em", new Date(Date.now() - 30 * 86400000).toISOString()));
  await kvSet("limpeza", { dia: hoje });
}

async function registrarCarga(hoje: string) {
  const anterior = await kvGet<{ dia: string; requisicoes: number; logins: number; erros: number }>("carga");
  const base = anterior?.dia === hoje ? anterior : { dia: hoje, requisicoes: 0, logins: 0, erros: 0 };
  const carga = { dia: hoje, requisicoes: base.requisicoes + estatisticas.requisicoes, logins: base.logins + estatisticas.logins, erros: base.erros + estatisticas.erros };
  await kvSet("carga", carga);
  return carga;
}

async function main() {
  const agora = new Date();
  const hoje = diaLocal(agora);
  let erro: { em: string; msg: string } | null = null;
  let estado: Estado = (await kvGet<Estado>("estado")) ?? {};

  try {
    const veiculos = await carregarVeiculos();
    const cercas = await carregarCercas(veiculos);
    const posicoes = await buscarPosicoes(client, veiculos.map((v) => v.id));
    const r = processarLeitura(estado, posicoes, cercas, agora);
    estado = r.estado;
    await kvSet("estado", estado);
    if (r.eventos.length) {
      await ok(db().from("loc_eventos").insert(r.eventos.map((e) => ({ dia: diaLocal(new Date(e.t)), t: e.t, tipo: e.tipo, veiculo_id: e.id, dados: e }))));
    }
    console.log(`✅ ${posicoes.length} veículos, ${r.eventos.length} eventos`);
    const atendidos = await atenderPedidos(estado, cercas, veiculos);
    if (atendidos) console.log(`✅ ${atendidos} pedido(s) de histórico`);
    await limpezaDiaria(hoje);
  } catch (err) {
    erro = { em: new Date().toISOString(), msg: err instanceof Error ? err.message : String(err) };
    console.error("❌", erro.msg);
    process.exitCode = 1;
  } finally {
    const carga = await registrarCarga(hoje);
    const anterior = (await kvGet<{ lido_em?: string | null }>("snapshot")) ?? {};
    // em caso de erro, a página continua mostrando a última leitura boa, com o aviso
    await kvSet(
      "snapshot",
      montarSnapshot(estado, {
        lido_em: erro ? (anterior.lido_em ?? null) : agora.toISOString(),
        erro,
        intervalo_s: INTERVALO_S,
        gauss: { desde: new Date(`${hoje}T00:00:00`).toISOString(), ...carga, pausadoAte: estatisticas.pausadoAte },
      }),
    );
    if (existsSync(SESSAO_FILE)) await kvSet("sessao", JSON.parse(readFileSync(SESSAO_FILE, "utf-8")));
    console.log(`GAUSS nesta execução: ${estatisticas.requisicoes} requisição(ões), ${estatisticas.logins} login(s)`);
  }
}

await main();

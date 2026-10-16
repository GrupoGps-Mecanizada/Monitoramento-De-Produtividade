// Uma execução do coletor (GitHub Actions, disparada pelo Supabase a cada 5 min e a cada pedido de histórico):
//   1. posição da frota no GAUSS (UMA requisição para todos os veículos)
//   2. estado + eventos -> Supabase; retrato (snapshot) para a página — só a frota da Mecanizada (a matriz de
//      equipamentos no Supabase, sem os desmobilizados; frota-propria.ts),
//      e no 1º ciclo do dia a "abertura" (status e área de cada equipamento, para o Dia da frota)
//   3. atende os pedidos de histórico que a página deixou em loc_pedidos
//   4. a cada 10 min, a timeline de motor por vaga e os apontamentos do tablet (motor-vaga.ts); e, quando pedido,
//      o reprocessamento dos dias antigos aos poucos (reprocesso.ts)
//   5. tempo real (tempo-real.ts): posições da frota a cada ciclo, paradas de hoje a cada 10 min e, de madrugada,
//      a rota completa de ontem (paradas exatas, excessos de velocidade e a rota crua no R2, se configurado)
//   6. medição oficial (medicao.ts): 1 lista de boletins por dia (a partir das 07:00) e no máximo 1 boletim novo
//      por ciclo, só com as 2 chamadas de leitura do Dashboard Medição
//
// Cuidado com a carga no GAUSS (ver gauss.ts): uma requisição por vez com intervalo, sessão reaproveitada
// entre execuções (guardada no Supabase, chave privada), cadastro e cercas em cache, histórico só quando
// alguém pede, dia encerrado baixado uma única vez, no máximo MAX_PEDIDOS por execução.
//
// Variáveis: GAUSSFLEET_USERNAME, GAUSSFLEET_PASSWORD, SUPABASE_URL, SUPABASE_SECRET_KEY e
// TZ=America/Sao_Paulo (o GAUSS fala em horário local).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { lerCadastro } from "../src/lib/dados/cadastro";
import { montarApontamento } from "../src/lib/dominio/apontamento";
import { tipoCerca } from "../src/lib/dominio/cercas";
import { montarFrota, type Frota } from "../src/lib/dominio/equipamentos";
import { diaLocal } from "../src/lib/dominio/formato";
import { parearMotores } from "../src/lib/dominio/frota";
import { aplicarFrota, eventosAbertura, eventosDaFrota, idsDaFrota, precisaAbertura } from "../src/lib/dominio/frota-propria";
import { montarSnapshot, processarLeitura } from "../src/lib/dominio/leitura";
import type { Cerca, EstadoVeiculo, FonteHistorico, PontoRota, Retrato } from "../src/lib/tipos";
import { verificarAmbiente } from "./config";
import { GaussFleetClient, SESSAO_FILE, estatisticas } from "./gauss";
import { HOJE_TTL_MS, baixarRota, diaFechado, mesclarPontos } from "./historico";
import { buscarCercas, buscarPosicoes, listarVeiculos, type VeiculoCadastro } from "./location-online";
import { coletarMotor } from "./motor-vaga";
import { depsAlertasReais, detectarAlertas } from "./alertas";
import { reprocessar } from "./reprocesso";
import { coletarMedicao, depsReais } from "./medicao";
import { db, kvCarregar, kvGet, kvSet, kvSetVarias, ok } from "./supabase";
import { gravarPosicoes, paradasAoVivo, rotinaNoturna } from "./tempo-real";

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

// tudo o que o ciclo lê do loc_kv numa requisição só (menos log no Supabase; ver supabase.ts)
await kvCarregar(["sessao", "estado", "veiculos", "cercas", "abertura", "motor", "motor_vagas", "paradas_ao_vivo", "noturno", "medicao", "limpeza", "carga", "snapshot", "tempo_real_pronto", "reprocesso"]);

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

function somarCarga(hoje: string, anterior: { dia: string; requisicoes: number; logins: number; erros: number } | null) {
  const base = anterior?.dia === hoje ? anterior : { dia: hoje, requisicoes: 0, logins: 0, erros: 0 };
  return { dia: hoje, requisicoes: base.requisicoes + estatisticas.requisicoes, logins: base.logins + estatisticas.logins, erros: base.erros + estatisticas.erros };
}

async function main() {
  const agora = new Date();
  const hoje = diaLocal(agora);
  let erro: { em: string; msg: string } | null = null;
  let estado: Estado = (await kvGet<Estado>("estado")) ?? {};
  let matriz: Frota | null = null;

  try {
    // a matriz (dezenas de linhas no Supabase, nenhuma consulta ao GAUSS) a cada ciclo: mudança na tela vale no próximo
    matriz = montarFrota(await lerCadastro(db()));
    const veiculos = await carregarVeiculos();
    const cercas = await carregarCercas(veiculos);
    const posicoes = await buscarPosicoes(client, veiculos.map((v) => v.id));
    const r = processarLeitura(estado, posicoes, cercas, agora);
    estado = r.estado;
    await kvSet("estado", estado);
    // só a frota da Mecanizada vai para o banco (o estado guarda todos: o pareamento do motor 2º precisa)
    const frota = aplicarFrota(montarSnapshot(estado, { lido_em: agora.toISOString(), erro: null, intervalo_s: INTERVALO_S }), matriz);
    const eventos = eventosDaFrota(r.eventos, idsDaFrota(frota));
    const abrirDia = precisaAbertura(await kvGet<{ dia: string }>("abertura"), hoje);
    if (abrirDia) eventos.push(...eventosAbertura(frota, agora.toISOString()));
    if (eventos.length) {
      await ok(db().from("loc_eventos").insert(eventos.map((e) => ({ dia: diaLocal(new Date(e.t)), t: e.t, tipo: e.tipo, veiculo_id: e.id, dados: e }))));
    }
    // marca a abertura só depois de gravada: se o insert falhar, o próximo ciclo tenta de novo
    if (abrirDia) await kvSet("abertura", { dia: hoje });
    // tempo real: posição de cada equipamento da frota (a leitura já feita; nada a mais no GAUSS)
    try {
      await gravarPosicoes(frota.veiculos, agora);
    } catch (e) {
      console.warn(`⚠ posições: ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log(`✅ ${posicoes.length} veículos (${frota.veiculos.filter((v) => !v.motor2_de).length} da frota), ${eventos.length} eventos${abrirDia ? " (com abertura do dia)" : ""}`);
    const atendidos = await atenderPedidos(estado, cercas, veiculos);
    if (atendidos) console.log(`✅ ${atendidos} pedido(s) de histórico`);
    // timeline de motor e tablet a cada 10 min (o site mostra o motor só pelo GAUSS); falha aqui não derruba o ciclo
    try {
      const motor = await coletarMotor(client, frota.veiculos, agora);
      if (motor) console.log(`✅ motor: ${motor}`);
    } catch (e) {
      console.warn(`⚠ motor: ${e instanceof Error ? e.message : String(e)}`);
    }
    // reprocessamento dos dias antigos (só quando pedido no loc_kv "reprocesso"), aos poucos a cada ciclo. A execução
    // tem 8 min no GitHub: com mais de 3 min gastos (ex.: 1º ciclo do coletor novo, que busca todas as vagas), fica
    // para o próximo ciclo
    try {
      const rep = Date.now() - agora.getTime() < 3 * 60 * 1000 ? await reprocessar(client, frota.veiculos, cercas, agora) : null;
      if (rep) console.log(`✅ reprocesso: ${rep}`);
    } catch (e) {
      console.warn(`⚠ reprocesso: ${e instanceof Error ? e.message : String(e)}`);
    }
    // paradas de hoje a cada 10 min e, de madrugada, a rota completa de ontem
    try {
      const n = await paradasAoVivo(frota.veiculos, cercas, agora);
      if (n != null) console.log(`✅ paradas ao vivo: ${n}`);
    } catch (e) {
      console.warn(`⚠ paradas ao vivo: ${e instanceof Error ? e.message : String(e)}`);
    }
    // alertas (P-026): exceções do dia com nota, a cada 10 min; falha aqui (ex.: SQL ainda não rodado) não derruba o ciclo
    try {
      const a = await detectarAlertas(depsAlertasReais(), frota.veiculos, agora);
      if (a) console.log(`✅ alertas: ${a}`);
    } catch (e) {
      console.warn(`⚠ alertas: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      const r = await rotinaNoturna(client, frota.veiculos, cercas, agora);
      if (r) console.log(`✅ madrugada: ${r}`);
    } catch (e) {
      console.warn(`⚠ madrugada: ${e instanceof Error ? e.message : String(e)}`);
    }
    // medição oficial: falha aqui (ex.: SQL ainda não rodado) não derruba o ciclo
    try {
      const m = await coletarMedicao(depsReais(client), agora);
      if (m) console.log(`✅ medição: ${m}`);
    } catch (e) {
      console.warn(`⚠ medição: ${e instanceof Error ? e.message : String(e)}`);
    }
    await limpezaDiaria(hoje);
  } catch (err) {
    erro = { em: new Date().toISOString(), msg: err instanceof Error ? err.message : String(err) };
    console.error("❌", erro.msg);
    process.exitCode = 1;
  } finally {
    const carga = somarCarga(hoje, await kvGet("carga"));
    const anterior = (await kvGet<Partial<Retrato>>("snapshot")) ?? {};
    // em caso de erro, a página continua mostrando a última leitura boa, com o aviso
    const retrato = montarSnapshot(estado, {
      lido_em: erro ? (anterior.lido_em ?? null) : agora.toISOString(),
      erro,
      intervalo_s: INTERVALO_S,
      gauss: { desde: new Date(`${hoje}T00:00:00`).toISOString(), ...carga, pausadoAte: estatisticas.pausadoAte },
    });
    // sem a matriz (falhou a leitura): fica a frota da última leitura boa, nunca o GAUSS inteiro
    // carga, retrato e sessão numa requisição só
    await kvSetVarias({
      carga,
      snapshot: matriz
        ? aplicarFrota(retrato, matriz)
        : { ...retrato, veiculos: anterior.veiculos ?? [], fora_da_lista: anterior.fora_da_lista ?? [] },
      ...(existsSync(SESSAO_FILE) ? { sessao: JSON.parse(readFileSync(SESSAO_FILE, "utf-8")) } : {}),
    });
    console.log(`GAUSS nesta execução: ${estatisticas.requisicoes} requisição(ões), ${estatisticas.logins} login(s)`);
  }
}

await main();

// Grava amostras para conferir o coletor novo (TypeScript) contra o atual (JS): roda as funções puras do
// coletor ATUAL sobre dados lidos do Supabase. Só LÊ do banco e NÃO consulta o GAUSS.
// Uso (na raiz do repositório): node --env-file=../../automation/.env coletor/scripts/gravar-amostras.mjs
// Saída: coletor/__amostras__/ (no .gitignore: tem placas, posições e motoristas)
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { processarLeitura, montarSnapshot } from "../processamento.js";
import { montarApontamento } from "../historico.js";
import { parearMotores } from "../frota.js";

process.env.TZ = "America/Sao_Paulo"; // o GAUSS fala em horário local (como no workflow)

for (const v of ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]) if (!process.env[v]) throw new Error(`variável ${v} não configurada`);
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
async function ok(p) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data;
}
const kv = async (chave) => (await ok(db.from("loc_kv").select("valor").eq("chave", chave).maybeSingle()))?.valor ?? null;
const SAIDA = new URL("../__amostras__/", import.meta.url);
const gravar = (nome, dados) => writeFileSync(new URL(nome, SAIDA), JSON.stringify(dados, null, 1));
const pad = (n) => String(n).padStart(2, "0");
const local = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

mkdirSync(SAIDA, { recursive: true });
const estado = (await kv("estado")) ?? {};
const cercas = (await kv("cercas"))?.cercas ?? [];
const snapshot = await kv("snapshot");
if (!Object.keys(estado).length || !cercas.length) throw new Error("estado ou cercas vazios no Supabase - rode depois de uma coleta");

// 1. leitura: posições "como o GAUSS manda", derivadas do estado real, com variações que geram eventos
const agora = new Date();
const areas = cercas.filter((c) => c.tipo === "area" && c.polygon.length >= 3);
const centro = (c) => [c.polygon.reduce((s, p) => s + p[0], 0) / c.polygon.length, c.polygon.reduce((s, p) => s + p[1], 0) / c.polygon.length];
const veiculos = Object.values(estado);
const posicoes = veiculos.map((v, i) => {
  let { lat, lng, status_cod: status } = v;
  let quando = new Date(agora.getTime() - 60_000).toISOString();
  if (i % 3 === 0) status = status === 1 ? 2 : 1; // muda de status
  if (i % 5 === 0 && areas.length) [lat, lng] = centro(areas[i % areas.length]); // muda de área
  if (i % 7 === 0) quando = new Date(agora.getTime() - 2 * 3600_000).toISOString(); // perde o sinal
  return {
    vehicle_code: Number(v.id), vehicle_name: v.placa, lat: String(lat), lng: String(lng), datetime: local(quando), status,
    contract_position_obj: { name: v.vaga }, vehicle_group: v.grupo, driver: v.motorista || "S/ MOTORISTA", address: v.endereco,
    delay_name: v.demora || "--", direction: v.direcao,
  };
});
// alguns "voltam a comunicar": no estado anterior estavam sem sinal
const anterior = Object.fromEntries(veiculos.map((v, i) => [v.id, i % 11 === 0 ? { ...v, sem_sinal: true } : v]));
const leitura = processarLeitura(anterior, posicoes, cercas, agora);
gravar("leitura.json", { agora: agora.toISOString(), estadoAnterior: anterior, posicoes, cercas, saida: leitura });
console.log(`leitura: ${posicoes.length} posições, ${leitura.eventos.length} eventos`);

// 2. retrato
const meta = { lido_em: agora.toISOString(), erro: null, intervalo_s: 300, gauss: snapshot?.gauss ?? null };
gravar("snapshot.json", { estado: leitura.estado, meta, saida: montarSnapshot(leitura.estado, meta) });

// 3. apontamentos: até 4 dias guardados, de preferência 2 de caminhão com motor secundário
const { secundarioDe } = parearMotores(veiculos);
const secundarios = new Set(secundarioDe.values());
const linhas = await ok(db.from("loc_historico").select("veiculo_id, dia, pontos").order("baixado_em", { ascending: false }).limit(40));
const comPontos = linhas.filter((l) => l.pontos?.length);
const escolhidos = [
  ...comPontos.filter((l) => secundarioDe.has(l.veiculo_id)).slice(0, 2),
  ...comPontos.filter((l) => !secundarioDe.has(l.veiculo_id) && !secundarios.has(l.veiculo_id)).slice(0, 2),
];
let n = 0;
for (const l of escolhidos) {
  const secId = secundarioDe.get(l.veiculo_id);
  const sec = secId ? (comPontos.find((x) => x.veiculo_id === secId && x.dia === l.dia) ?? null) : null;
  const pontosMotor2 = sec?.pontos ?? null;
  gravar(`apontamento-${++n}.json`, { pontos: l.pontos, cercas, pontosMotor2, saida: montarApontamento(l.pontos, cercas, pontosMotor2) });
}
console.log(`apontamentos: ${n} (${escolhidos.filter((l) => secundarioDe.has(l.veiculo_id)).length} de caminhão com motor secundário)`);

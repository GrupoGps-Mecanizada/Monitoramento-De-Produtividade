// Rota crua do dia no R2 da Cloudflare (bucket próprio do Monitoramento; a regra de apagar após 30 dias é do bucket).
// Só liga com os 4 segredos R2_*; sem eles, a rotina da madrugada pula esta parte.
import { gzipSync } from "node:zlib";
import type { PontoRota } from "../src/lib/tipos";

type Env = Record<string, string | undefined>;
export const r2Configurado = (env: Env = process.env) => !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET);

/** Grava rotas/AAAA-MM-DD/<veiculo>.json.gz. false = R2 não configurado. */
export async function guardarRota(dia: string, id: string, pontos: PontoRota[], env: Env = process.env): Promise<boolean> {
  if (!r2Configurado(env)) return false;
  const { AwsClient } = await import("aws4fetch");
  const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY!, service: "s3", region: "auto" });
  const url = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}/rotas/${dia}/${encodeURIComponent(id)}.json.gz`;
  const r = await aws.fetch(url, { method: "PUT", body: gzipSync(JSON.stringify(pontos)), headers: { "content-type": "application/json", "content-encoding": "gzip" } });
  if (!r.ok) throw new Error(`R2 respondeu ${r.status}`);
  return true;
}

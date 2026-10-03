export const BASE_URL = "https://usiminas.gaussfleet.com";

const NECESSARIAS = ["GAUSSFLEET_USERNAME", "GAUSSFLEET_PASSWORD", "SUPABASE_URL", "SUPABASE_SECRET_KEY"] as const;

/** Para logo no início se faltar segredo do repositório (Settings > Secrets and variables > Actions). */
export function verificarAmbiente(): void {
  for (const v of NECESSARIAS) if (!process.env[v]) throw new Error(`variável ${v} não configurada (segredos do repositório)`);
  if (process.env.TZ !== "America/Sao_Paulo") console.warn("⚠️  TZ não é America/Sao_Paulo - horários do GAUSS serão lidos errado");
}

export const credenciais = () => ({ username: process.env.GAUSSFLEET_USERNAME ?? "", password: process.env.GAUSSFLEET_PASSWORD ?? "" });

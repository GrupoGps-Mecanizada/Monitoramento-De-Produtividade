import type { NextConfig } from "next";

/**
 * Site estático (GitHub Pages): `next build` gera a pasta out/. Não há servidor: a página só lê do Supabase
 * (chave publishable + RLS) e pode criar pedido de histórico, que o coletor atende.
 * BASE_PATH vem do workflow do Pages ("/Monitoramento-De-Produtividade"); local, CI e testes ficam na raiz.
 */
const basePath = process.env.BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // o Pages serve timeline/index.html em /timeline/
  trailingSlash: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  outputFileTracingRoot: process.cwd(),
  turbopack: { root: process.cwd() },
};

export default nextConfig;

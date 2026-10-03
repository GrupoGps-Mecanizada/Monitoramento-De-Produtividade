import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coletor/node_modules/**",
    "test-results/**",
    "playwright-report/**",
    // site antigo (HTML + JS puro): sai na Tarefa 16
    "*.js",
  ]),
]);

export default eslintConfig;

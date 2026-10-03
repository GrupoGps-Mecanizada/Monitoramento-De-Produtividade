import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// horários do GAUSS são locais: as regras são testadas no fuso da usina
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "coletor/**/*.test.ts"],
    environment: "node",
    pool: "threads",
  },
});

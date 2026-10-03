import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  use: { baseURL: process.env.E2E_URL ?? "http://localhost:3210", locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
  projects: [
    { name: "computador", use: { viewport: { width: 1440, height: 900 } } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.E2E_URL ? undefined : { command: "npx serve out -l 3210 --no-clipboard", port: 3210, reuseExistingServer: false, timeout: 120_000 },
});

import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Cronoanálise: turno, raio-x, conferência com frase e horas por colaborador", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/cronoanalise/");
  await expect(page.getByLabel("Turno da cronoanálise")).toContainText("Letra A (Supervisor Teste)");
  await expect(page.getByText("Raio-x do turno")).toBeVisible();
  await expect(page.getByText("João Teste").first()).toBeVisible();
  // produzindo 08:20–08:40 com a bomba (motor 2º) desligada: vira frase
  await expect(page.getByText(/A folha diz produzindo — João/)).toBeVisible();
  // refeição no tablet e na folha: bate, não vira frase
  await expect(page.getByText(/Tablet: "Refeição Motorista"/)).toHaveCount(0);
  await expect(page.getByText("Apontamentos dos colaboradores")).toBeVisible();
  await expect(page.getByText("Hidrojateamento – Pistola").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});

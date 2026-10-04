import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Alertas: só a frota, sem a abertura do dia, e detalhe", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/alertas/");
  // entrada + 2 status da frota; a abertura do dia e o evento do EOF5208 não contam
  await expect(page.getByRole("button", { name: /Total/ })).toContainText("3");
  await expect(page.getByText("EOF5208")).toHaveCount(0);
  await page.getByRole("button", { name: /EGC-2984/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Desligado");
  await expect(page.getByRole("link", { name: "Ver timeline" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

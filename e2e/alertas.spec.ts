import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Alertas: indicadores, lista e detalhe", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/alertas/");
  await expect(page.getByRole("button", { name: /Total/ })).toContainText("2");
  await page.getByRole("button", { name: /EGC2984/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Desligado");
  await expect(page.getByRole("link", { name: "Ver timeline" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

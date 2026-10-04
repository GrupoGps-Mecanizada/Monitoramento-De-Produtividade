import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Dia da frota: por tipo, só a frota, e a linha abre a timeline", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/frota/");
  await expect(page.getByRole("heading", { name: /Alta Pressão/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Aspiradores/ })).toBeVisible();
  await expect(page.getByText("EOF5208")).toHaveCount(0);
  await page.getByRole("link", { name: /EGC-2985/ }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});

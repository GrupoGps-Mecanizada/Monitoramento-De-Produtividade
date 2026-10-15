import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Dia da frota por vaga (igual ao GAUSS): caminhão de cada trecho, conferência e clique na timeline", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/frota/");
  await expect(page.getByRole("tab", { name: "Por vaga (igual ao GAUSS)" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Cores do GAUSS" })).toContainText("Indisponível / Sem Apropriação");
  // ordem do GAUSS: AP-01 antes da AP-08; a AP-01 teve dois caminhões no dia
  await expect(page.locator('[title^="ALTA PRESSÃO"]').first()).toHaveAttribute("title", "ALTA PRESSÃO - GPS - 01 - 24 HS");
  await expect(page.getByText("EGC-2985 → PUB2F80")).toBeVisible();
  // conferência: a AP-01 bate com o GAUSS; a AP-08 não
  await expect(page.getByText("✓ igual ao GAUSS")).toHaveCount(1);
  await expect(page.getByText("1 vaga(s) não batem com o que o GAUSS mandou", { exact: false })).toBeVisible();
  await page.screenshot({ path: `test-results/dia-por-vaga-${info.project.name}.png`, fullPage: true });
  // o trecho do PUB2F80 abre a Timeline dele
  await page.locator('a[href*="v=20"]').first().click();
  await expect(page).toHaveURL(/\/timeline\/\?v=20&dia=/);
  expect(gravacoes).toEqual([]);
});

test("Dia da frota: por equipamento, só a frota, e a linha abre a timeline", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/frota/");
  await page.getByRole("tab", { name: "Por equipamento" }).click();
  await expect(page.getByRole("heading", { name: /Alta Pressão/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Aspiradores/ })).toBeVisible();
  await expect(page.getByText("EOF5208")).toHaveCount(0);
  // motor pela timeline do GAUSS; produtivo da Alta Pressão = motor 2º ligado
  await expect(page.getByRole("list", { name: "Cores do motor" })).toContainText("Motor 2º ligado");
  await expect(page.getByRole("link", { name: /EGC-2985/ })).toContainText("produtivo");
  await page.getByRole("link", { name: /EGC-2985/ }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});

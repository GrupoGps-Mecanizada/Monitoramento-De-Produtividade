import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: abre pelo link e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  await play.click();
  await expect(page.getByRole("button", { name: /Pausar/ })).toBeVisible();
  if (info.project.name === "computador") await expect(page.getByText("Apontamento (2 trechos)")).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Timeline: link com o motor secundário abre o caminhão", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "o nome aparece no painel do computador");
  await prepararDados(page);
  await page.goto(`/timeline/?v=EOF52082&dia=${hoje()}`);
  await expect(page.locator("section").getByText("EOF5208", { exact: true })).toBeVisible();
});

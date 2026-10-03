import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Localização: lista, detalhe e histórico do dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    await expect(page.getByText(/atualizado \d\d:\d\d:\d\d/)).toBeVisible();
    const painel = page.locator("aside");
    await expect(painel.getByRole("button", { name: /EGC2984/ })).toBeVisible();
    await painel.getByRole("button", { name: /EOF5208/ }).click();
    await expect(painel.getByText("Motor secundário")).toBeVisible();
    await painel.getByRole("button", { name: "Ver histórico" }).click();
    await expect(painel.getByText("Apontamento (2 trechos)")).toBeVisible();
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /3 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Busca Ctrl K acha placa com hífen", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "atalho de teclado");
  await prepararDados(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  await page.getByRole("dialog").getByRole("searchbox").fill("egc-2984");
  await expect(page.getByRole("option", { name: /EGC2984/ })).toBeVisible();
});

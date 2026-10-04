import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Localização: só a frota, por tipo, e o detalhe leva ao dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    const painel = page.locator("aside");
    await expect(painel.getByRole("button", { name: /Alta Pressão/ })).toBeVisible();
    await expect(painel.getByRole("button", { name: /Aspirador 03/ })).toBeVisible();
    await expect(page.getByText("EOF5208")).toHaveCount(0);
    await painel.getByRole("button", { name: /EGC-2985/ }).click();
    await expect(painel.getByText("Bomba (motor 2º)")).toBeVisible();
    await expect(painel.getByRole("link", { name: /Ver o dia/ })).toHaveAttribute("href", /\/timeline\/\?v=10&dia=/);
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Painel recolhe numa barra com os tipos, filtra e reabre", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "barra só no computador");
  await prepararDados(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Recolher painel" }).click();
  const barra = page.getByRole("navigation", { name: "Tipos de equipamento" });
  await expect(barra).toBeVisible();
  const as = barra.getByRole("button", { name: /^AS/ });
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "true");
  await barra.getByRole("button", { name: "Abrir painel" }).click();
  await expect(page.locator("aside").getByText("Aspiradores ✕")).toBeVisible();
});

test("Busca Ctrl K acha placa com hífen e aspirador pelo número", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "atalho de teclado");
  await prepararDados(page);
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const caixa = page.getByRole("dialog").getByRole("searchbox");
  await caixa.fill("egc-2984");
  await expect(page.getByRole("option", { name: /^EGC-2984 Poliguindaste/ })).toBeVisible();
  await caixa.fill("asp 3");
  await expect(page.getByRole("option", { name: /^Aspirador 03 Aspiradores/ })).toBeVisible();
});

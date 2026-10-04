import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: conta o dia em capítulos e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  if (info.project.name === "computador") {
    const capitulos = page.getByRole("list", { name: "Capítulos do dia" });
    await expect(capitulos).toBeVisible();
    await capitulos.getByRole("button", { name: /PATIO/ }).click();
    await expect(page.getByText(/08:10:00/).first()).toBeVisible();
  }
  await play.click();
  await expect(page.getByRole("button", { name: /Pausar/ })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Timeline: link com o motor secundário abre o caminhão", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "o nome aparece no painel do computador");
  await prepararDados(page);
  await page.goto(`/timeline/?v=EGC29852&dia=${hoje()}`);
  await expect(page.locator("section").getByText("EGC-2985", { exact: true })).toBeVisible();
});

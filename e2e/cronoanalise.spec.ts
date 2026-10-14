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

test("Cronoanálise: rodinha do mouse aproxima o raio-x e mostra os nomes nas caixas", async ({ page }, info) => {
  test.skip(info.project.name === "celular", "rodinha do mouse só no computador; no celular há os botões");
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  const caixa = page.locator("span[title^='32 · Hidrojateamento']");
  await expect(caixa).toHaveText("");
  // aproxima no ponto da caixa (08:20–08:40)
  const r = (await caixa.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -100);
  await expect(page.getByText(/zoom \d/)).toBeVisible();
  await expect(caixa).toContainText("Hidrojateamento");
  if (process.env.FOTO_ZOOM) await page.screenshot({ path: process.env.FOTO_ZOOM, fullPage: false });
  await page.getByRole("button", { name: "Turno inteiro" }).click();
  await expect(caixa).toHaveText("");
});

test("Cronoanálise: botões de zoom (celular)", async ({ page }) => {
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Aproximar" }).click();
  await expect(page.getByText(/zoom \d/)).toBeVisible();
  await page.getByRole("button", { name: "Turno inteiro" }).click();
  await expect(page.getByText(/zoom \d/)).toHaveCount(0);
});

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

test("Cronoanálise: rodinha do mouse aproxima o raio-x e mostra os nomes nas caixas; afastar volta ao turno inteiro", async ({ page }, info) => {
  test.skip(info.project.name === "celular", "rodinha do mouse só no computador");
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  const caixa = page.locator("span[title^='32 · Hidrojateamento']");
  await expect(caixa).toHaveText("");
  // aproxima no ponto da caixa (08:20–08:40)
  const r = (await caixa.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -100);
  await expect(page.getByLabel("Janela visível")).toBeVisible();
  await expect(caixa).toContainText("Hidrojateamento");
  if (process.env.FOTO_ZOOM) await page.screenshot({ path: process.env.FOTO_ZOOM, fullPage: false });
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 100);
  await expect(caixa).toHaveText("");
  await expect(page.getByLabel("Janela visível")).toHaveCount(0);
});

test("Cronoanálise: sem botões nem barra de zoom e sem textos de ajuda; arrastar anda no tempo", async ({ page }, info) => {
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  await expect(page.getByText("Raio-x do turno")).toBeVisible();
  for (const b of ["Aproximar", "Afastar", "Turno inteiro", "Voltar no tempo", "Avançar no tempo"]) await expect(page.getByRole("button", { name: b })).toHaveCount(0);
  await expect(page.getByLabel("Zoom do raio-x")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByText(/Passe o mouse|Rodinha do mouse|Aproxime para ler/)).toHaveCount(0);
  // arrastar para a esquerda anda para a frente no tempo (só no computador: no celular o dedo rola a página)
  if (info.project.name !== "celular") {
    const faixa = (await page.getByLabel("Faixas do raio-x").boundingBox())!;
    await page.mouse.move(faixa.x + faixa.width * 0.6, faixa.y + 40);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -100);
    const janela = page.getByLabel("Janela visível");
    await expect(janela).toBeVisible();
    const antes = await janela.textContent();
    await page.mouse.down();
    await page.mouse.move(faixa.x + faixa.width * 0.3, faixa.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(janela).not.toHaveText(antes!);
  }
});

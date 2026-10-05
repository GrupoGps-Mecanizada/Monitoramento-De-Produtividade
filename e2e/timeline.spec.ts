import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: conta o dia em capítulos e reproduz", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: /Reproduzir/ });
  await expect(play).toBeVisible();
  if (info.project.name === "computador") {
    // sem coluna lateral: as trilhas ficam embaixo do mapa, os números no topo
    const trilhas = page.getByRole("region", { name: "Timeline do veículo" });
    await expect(page.getByText(/2,1 km/).first()).toBeVisible();
    const cap = trilhas.getByRole("button", { name: /Capítulo 1 · PATIO/ });
    await cap.hover();
    await expect(page.getByRole("tooltip")).toContainText("08:10–08:40");
    await cap.click();
    await expect(page.getByText(/08:10:00/).first()).toBeVisible();
    // cartão do horário no mapa: maior e com onde está e o motorista (o dia é hoje)
    const agoraNoMapa = page.getByRole("status", { name: "Agora no mapa" });
    await expect(agoraNoMapa).toContainText("08:10:00");
    await expect(agoraNoMapa).toContainText("Parado ligado");
    await expect(agoraNoMapa).toContainText("PATIO");
    await expect(agoraNoMapa).toContainText("JOSÉ DA SILVA");
    // trilha de status com o nome dentro, filtro de hora e régua grande
    await expect(trilhas.getByText("Parado ligado · 30 min")).toBeVisible();
    await trilhas.getByLabel("Mostrar a partir de").selectOption("6");
    await expect(trilhas.getByLabel("Mostrar até")).toHaveValue("9");
    const aMais = trilhas.getByRole("button", { name: "A+" });
    await aMais.click();
    await expect(aMais).toHaveAttribute("aria-pressed", "true");
    await trilhas.getByRole("button", { name: "Apontamento" }).click();
    const gaveta = page.getByRole("dialog", { name: /Apontamento/ });
    await expect(gaveta.getByRole("list", { name: "Capítulos do dia" })).toBeVisible();
    await expect(gaveta.getByRole("button", { name: /Exportar CSV/ })).toBeVisible();
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

test("Timeline: painel de baixo recolhe, expande e acompanha o arrasto", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "painel só no computador");
  await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const trilhas = page.getByRole("region", { name: "Timeline do veículo" });
  const corpo = trilhas.getByTestId("corpo-trilhas");
  await expect(corpo).toBeVisible();
  const h0 = (await corpo.boundingBox())!.height;
  const a = (await trilhas.getByRole("separator", { name: "Altura das trilhas" }).boundingBox())!;
  const x = a.x + a.width / 2;
  await page.mouse.move(x, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, a.y - 40, { steps: 4 });
  // fluido: o painel cresce enquanto arrasta, antes de soltar
  expect((await corpo.boundingBox())!.height).toBeGreaterThan(h0 + 20);
  await page.mouse.move(x, a.y - 80, { steps: 4 });
  await page.mouse.up();
  expect((await corpo.boundingBox())!.height).toBeGreaterThan(h0 + 60);
  await trilhas.getByRole("button", { name: "Recolher trilhas" }).click();
  await expect(corpo).toBeHidden();
  await trilhas.getByRole("button", { name: "Expandir trilhas" }).click();
  await expect(corpo).toBeVisible();
});

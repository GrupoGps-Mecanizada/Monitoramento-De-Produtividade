import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Localização: só a frota, por tipo, e o detalhe leva ao dia", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/");
  if (info.project.name === "computador") {
    await expect(page.getByRole("navigation", { name: "Menu principal" })).toBeVisible();
    // sem coluna lateral: filtros no topo, lista do tipo num balão
    await expect(page.locator("aside")).toHaveCount(0);
    const filtros = page.getByRole("navigation", { name: "Filtros do mapa" });
    await expect(filtros.getByRole("button", { name: /^AS/ })).toBeVisible();
    await expect(page.getByText("EOF5208")).toHaveCount(0);
    const ap = filtros.getByRole("button", { name: /^AP/ });
    await ap.click();
    await expect(ap).toHaveAttribute("aria-pressed", "true");
    const lista = page.getByRole("dialog", { name: "Alta Pressão" });
    await lista.getByRole("button", { name: /EGC-2985/ }).click();
    await expect(lista).toHaveCount(0);
    const cartao = page.getByRole("region", { name: "Equipamento" });
    await expect(cartao.getByText("Bomba (motor 2º)")).toBeVisible();
    await expect(cartao.getByRole("link", { name: /Ver o dia/ })).toHaveAttribute("href", /\/timeline\/\?v=10&dia=/);
    await cartao.getByRole("button", { name: "Fechar" }).click();
    await expect(cartao).toHaveCount(0);
  } else {
    await expect(page.getByRole("navigation", { name: "Telas" })).toBeVisible();
    await expect(page.getByRole("button", { name: /4 veículos/ })).toBeVisible();
  }
  expect(gravacoes).toEqual([]);
});

test("Localização: sino com os alertas do dia e clique de novo no tipo tira o filtro", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "barra do topo só no computador");
  await prepararDados(page);
  await page.goto("/");
  const filtros = page.getByRole("navigation", { name: "Filtros do mapa" });
  await filtros.getByRole("button", { name: /^Alertas/ }).click();
  const alertas = page.getByRole("dialog", { name: "Alertas" });
  await expect(alertas.getByText(/EGC-2984/).first()).toBeVisible();
  await expect(alertas.getByText("Início do dia")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(alertas).toHaveCount(0);
  const as = filtros.getByRole("button", { name: /^AS/ });
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "true");
  await as.click();
  await expect(as).toHaveAttribute("aria-pressed", "false");
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

test("Localização: faixa de acontecimentos com balão e clique que abre o equipamento", async ({ page }, info) => {
  test.skip(info.project.name !== "computador", "faixa só no computador");
  await prepararDados(page);
  await page.goto("/");
  const faixa = page.getByRole("region", { name: "Acontecimentos de hoje" });
  await expect(faixa.getByText("Status")).toBeVisible();
  const bolinha = faixa.getByRole("button", { name: /EGC-2984/ });
  await bolinha.hover();
  await expect(page.getByRole("tooltip", { name: "Acontecimentos" })).toContainText("EGC-2984");
  await bolinha.click();
  await expect(page.getByRole("region", { name: "Equipamento" }).getByText("EGC-2984").first()).toBeVisible();
  // filtro de tipo vale para a faixa: só aspiradores = nenhum acontecimento
  await page.getByRole("navigation", { name: "Filtros do mapa" }).getByRole("button", { name: /^AS/ }).click();
  await page.keyboard.press("Escape");
  await expect(faixa.getByText(/Nenhum acontecimento/)).toBeVisible();
});

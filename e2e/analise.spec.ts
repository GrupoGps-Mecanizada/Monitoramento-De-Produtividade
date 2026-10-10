import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Análise: mapa em tela cheia, funil com medida/período/filtros e lista com áreas, resumo e detalhe", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await expect(page.getByRole("button", { name: "Medida, período e filtros" })).toContainText("Produtivo");
  // lista (2º botão): áreas e resumo
  await page.getByRole("button", { name: "Áreas e resumo" }).click();
  const ranking = page.getByRole("list", { name: "Ranking" });
  // produtivo (padrão): só a OFICINA tem motor 2º do caminhão de Alta Pressão; o Pátio da base não entra
  await expect(ranking).toContainText("OFICINA");
  await expect(ranking).not.toContainText("PATIO");
  await expect(page.getByText("PÁTIO DO TRANSPORTE RODOVIÁRIO", { exact: true })).toHaveCount(0);
  // o Aterro (fora da usina, mas na região) continua; só o que está a mais de 50 km vai para "Longe da região"
  await expect(ranking).toContainText("ATERRO CONTROLADO");
  await expect(page.getByRole("button", { name: /Longe da região/ })).toBeVisible();
  await page.getByRole("tab", { name: "Resumo" }).click();
  await expect(page.getByRole("region", { name: "Resumo do período" })).toContainText("Produtivo");
  await page.getByRole("tab", { name: "Áreas" }).click();
  // funil: medida, período, filtros e "Ir para" (a lista fecha com Esc; abrir o funil pelo cartão também a fecharia)
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Filtros da análise" }).click();
  await expect(page.getByRole("group", { name: "Ir para" }).getByRole("button", { name: "USIMINAS" })).toBeVisible();
  // fundo do mapa: preto (padrão) ou branco
  await expect(page.locator(".mapa-analise")).not.toHaveClass(/mapa-claro/);
  await page.getByRole("tab", { name: "Branco" }).click();
  await expect(page.locator(".mapa-analise")).toHaveClass(/mapa-claro/);
  await page.getByRole("tab", { name: "Preto" }).click();
  await expect(page.locator(".mapa-analise")).not.toHaveClass(/mapa-claro/);
  // tempo parado: o PATIO (2 paradas da frota) passa na frente; a placa de fora da frota não conta
  await page.getByRole("tab", { name: "Tempo parado" }).click();
  // aspirador não tem regra de produtividade
  await page.getByLabel("Tipo").selectOption("as");
  await page.getByRole("tab", { name: "Produtivo" }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Áreas e resumo" }).click();
  await expect(page.getByText("Este tipo não tem regra de produtividade")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Medida, período e filtros" }).click();
  await page.getByRole("tab", { name: "Tempo parado" }).click();
  await page.getByLabel("Tipo").selectOption("");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Áreas e resumo" }).click();
  await expect(ranking.getByRole("button").first()).toContainText("PATIO");
  // detalhe abre na lista, no lugar do ranking
  await ranking.getByRole("button", { name: /PATIO/ }).click();
  const detalhe = page.getByRole("region", { name: "Detalhe: PATIO" });
  await expect(detalhe.getByRole("list", { name: "Quem atende" })).toContainText("EGC-2985");
  await expect(detalhe).not.toContainText("EOF5208");
  await expect(detalhe).toContainText("Ultravac");
  await expect(ranking).toHaveCount(0);
  await detalhe.getByRole("button", { name: /Voltar/ }).click();
  await page.getByRole("button", { name: /Longe da região/ }).click();
  const longe = page.getByRole("region", { name: /Detalhe: Longe da região/ });
  await expect(longe).toContainText("GALPÃO LONGE");
  await longe.getByRole("link", { name: /EGC-2985/ }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});

test("Análise: sem histórico enviado, avisa em vez de quebrar", async ({ page }) => {
  await prepararDados(page, { analise: [] });
  await page.goto("/analise/");
  await expect(page.getByText("O histórico ainda não foi enviado")).toBeVisible();
});

test("Análise: tabela ainda não criada, avisa em português (também no celular)", async ({ page }) => {
  await prepararDados(page, { analiseSemTabela: true });
  await page.goto("/analise/");
  await expect(page.getByText("A tabela da análise ainda não foi criada")).toBeVisible();
  await expect(page.getByText("schema cache")).toHaveCount(0);
});

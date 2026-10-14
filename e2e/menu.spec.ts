import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Menu em 3 categorias: a categoria abre a lista das telas e mostra a tela aberta", async ({ page }, info) => {
  await prepararDados(page);
  await page.goto("/analise/");
  const celular = info.project.name === "celular";
  const menu = page.getByRole("navigation", { name: celular ? "Telas" : "Menu principal" });
  for (const c of ["Ao vivo", "Análises"]) await expect(menu.getByRole("button", { name: new RegExp(`^${c}`) })).toBeVisible();
  // Cadastros tem uma tela só: vai direto
  await expect(menu.getByRole("link", { name: /Cadastros/ })).toHaveAttribute("href", /\/equipamentos/);
  // a tela aberta aparece no botão da categoria (no computador)
  if (!celular) await expect(menu.getByRole("button", { name: /^Análises/ })).toContainText("· Análise");
  await menu.getByRole("button", { name: /^Análises/ }).click();
  await page.getByRole("link", { name: "Cronoanálise", exact: true }).click();
  await expect(page).toHaveURL(/\/cronoanalise\/?$/);
  // a lista fecha ao trocar de tela
  await expect(page.getByRole("link", { name: "Timeline", exact: true })).toHaveCount(0);
});

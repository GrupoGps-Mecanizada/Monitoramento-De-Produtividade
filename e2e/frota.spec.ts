import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Dia da frota por vaga (desenho da Gestão de alertas): abas em cascata, conferência e trechos da vaga", async ({ page }, info) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/frota/");
  // só por vaga: a visão "Por equipamento" saiu (pedido do dono, 17/10/2026)
  await expect(page.getByRole("tab", { name: "Por equipamento" })).toHaveCount(0);
  const tipos = page.getByRole("tablist", { name: "Tipo de vaga" });
  await expect(tipos.getByRole("tab", { name: /Todas/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("list", { name: "Cores do GAUSS" })).toContainText("Indisponível / Sem Apropriação");
  // ordem do GAUSS: AP-01 antes da AP-08; a AP-01 teve dois caminhões no dia
  await expect(page.locator('[title^="ALTA PRESSÃO"]').first()).toHaveAttribute("title", "ALTA PRESSÃO - GPS - 01 - 24 HS");
  await expect(page.getByText("EGC-2985 → PUB2F80")).toBeVisible();
  // conferência: a AP-01 bate com o GAUSS; a AP-08 não
  await expect(page.getByText("✓ igual ao GAUSS")).toHaveCount(1);
  await expect(page.getByText("diferentes do GAUSS")).toBeVisible();
  await page.screenshot({ path: `test-results/dia-por-vaga-${info.project.name}.png`, fullPage: true });
  // cascata: Alta Pressão → AP-01 mostra só a vaga e a tabela dos trechos
  await tipos.getByRole("tab", { name: /Alta Pressão/ }).click();
  await page.getByRole("tablist", { name: "Vaga" }).getByRole("tab", { name: "AP-01" }).click();
  const trechos = page.getByRole("region", { name: /Trechos da ALTA PRESSÃO - GPS - 01/ });
  await expect(trechos.getByRole("row")).toHaveCount(6);
  await expect(trechos).toContainText("PUB2F80");
  await page.screenshot({ path: `test-results/dia-por-vaga-ap01-${info.project.name}.png`, fullPage: true });
  // o caminhão da tabela abre a Timeline dele
  await trechos.getByRole("link", { name: "PUB2F80" }).click();
  await expect(page).toHaveURL(/\/timeline\/\?v=20&dia=/);
  expect(gravacoes).toEqual([]);
});
